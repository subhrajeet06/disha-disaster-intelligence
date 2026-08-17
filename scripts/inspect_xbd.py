"""
DISHA — xBD Dataset Inspection Script
Scans the raw xBD dataset and generates a comprehensive report
without modifying any files.

Usage:
    python scripts/inspect_xbd.py
"""

import sys
from pathlib import Path
from collections import Counter, defaultdict

# Allow running standalone or as import
sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import load_config, parse_filename, print_header


def run(config):
    """Inspect the raw xBD dataset and generate a report."""
    raw_path = config["_raw_path"]
    reports_path = config["_reports_path"]
    reports_path.mkdir(parents=True, exist_ok=True)

    lines = []

    def log(msg=""):
        print(msg)
        lines.append(msg)

    print_header("xBD DATASET INSPECTION")
    log("xBD DATASET INSPECTION")
    log("=" * 60)

    # --- Root directory ---
    log(f"\nRoot directory: {raw_path}")
    log(f"Exists: {raw_path.exists()}")

    if not raw_path.exists():
        log("\nERROR: Raw dataset path does not exist!")
        _write_report(reports_path, lines)
        return

    # --- Subdirectories ---
    subdirs = [d.name for d in raw_path.iterdir() if d.is_dir()]
    log(f"\nSubdirectories found: {subdirs}")

    images_dir = raw_path / "images"
    labels_dir = raw_path / "labels"
    targets_dir = raw_path / "targets"

    # --- Count files ---
    image_files = sorted(images_dir.glob("*.png")) if images_dir.exists() else []
    label_files = sorted(labels_dir.glob("*.json")) if labels_dir.exists() else []
    target_files = sorted(targets_dir.glob("*.png")) if targets_dir.exists() else []

    log(f"\n--- File Counts ---")
    log(f"Image files (.png):   {len(image_files)}")
    log(f"Label files (.json):  {len(label_files)}")
    log(f"Target files (.png):  {len(target_files)}")

    # --- Parse filenames and gather statistics ---
    events = Counter()
    pre_images = []
    post_images = []
    phases = Counter()
    sample_keys = set()

    for img in image_files:
        parsed = parse_filename(img.name)
        if parsed:
            events[parsed["event"]] += 1
            phases[parsed["phase"]] += 1
            sample_keys.add(parsed["sample_key"])
            if parsed["phase"] == "pre":
                pre_images.append(img)
            else:
                post_images.append(img)

    log(f"\n--- Image Breakdown ---")
    log(f"Pre-disaster images:  {len(pre_images)}")
    log(f"Post-disaster images: {len(post_images)}")
    log(f"Unique sample keys:   {len(sample_keys)}")

    # --- Disaster events ---
    log(f"\n--- Disaster Events ({len(events)} total) ---")
    log(f"{'Event':<25} {'Total Files':>12} {'Pairs':>8}")
    log("-" * 50)
    for event, count in events.most_common():
        log(f"{event:<25} {count:>12} {count // 2:>8}")

    # --- Naming conventions ---
    log(f"\n--- Naming Convention ---")
    if image_files:
        log(f"Sample image name:  {image_files[0].name}")
    if label_files:
        log(f"Sample label name:  {label_files[0].name}")
    if target_files:
        log(f"Sample target name: {target_files[0].name}")
    log(f"Pattern: {{event}}_{{8-digit-id}}_{{pre|post}}_disaster.{{png|json}}")

    # --- Image dimensions (sample) ---
    log(f"\n--- Image Dimensions (sampling first 5) ---")
    try:
        from PIL import Image
        for img_path in image_files[:5]:
            with Image.open(img_path) as im:
                log(f"  {img_path.name}: {im.size[0]}x{im.size[1]}, mode={im.mode}")
    except ImportError:
        log("  (Pillow not installed, skipping dimension check)")

    # --- Check for missing pairs ---
    log(f"\n--- Pairing Check ---")
    pre_keys = set()
    post_keys = set()
    for img in image_files:
        parsed = parse_filename(img.name)
        if parsed:
            if parsed["phase"] == "pre":
                pre_keys.add(parsed["sample_key"])
            else:
                post_keys.add(parsed["sample_key"])

    missing_post = pre_keys - post_keys
    missing_pre = post_keys - pre_keys
    complete_pairs = pre_keys & post_keys

    log(f"Complete pairs:       {len(complete_pairs)}")
    log(f"Missing post images:  {len(missing_post)}")
    log(f"Missing pre images:   {len(missing_pre)}")
    if missing_post:
        log(f"  Missing post: {list(missing_post)[:5]}...")
    if missing_pre:
        log(f"  Missing pre:  {list(missing_pre)[:5]}...")

    # --- Label coverage ---
    log(f"\n--- Label Coverage ---")
    label_keys_pre = set()
    label_keys_post = set()
    for lbl in label_files:
        parsed = parse_filename(lbl.name)
        if parsed:
            if parsed["phase"] == "pre":
                label_keys_pre.add(parsed["sample_key"])
            else:
                label_keys_post.add(parsed["sample_key"])

    images_without_labels = sample_keys - (label_keys_pre | label_keys_post)
    log(f"Samples with pre labels:  {len(label_keys_pre)}")
    log(f"Samples with post labels: {len(label_keys_post)}")
    log(f"Images without any label: {len(images_without_labels)}")

    # --- Target coverage ---
    log(f"\n--- Target Coverage ---")
    target_keys = set()
    for tgt in target_files:
        parsed = parse_filename(tgt.name)
        if parsed:
            target_keys.add(parsed["sample_key"])
    log(f"Samples with targets: {len(target_keys)}")
    missing_targets = sample_keys - target_keys
    log(f"Missing targets:      {len(missing_targets)}")

    # --- Summary ---
    log(f"\n--- Summary ---")
    log(f"Total disaster events:    {len(events)}")
    log(f"Total image pairs:        {len(complete_pairs)}")
    log(f"Total image files:        {len(image_files)}")
    log(f"Total label files:        {len(label_files)}")
    log(f"Total target files:       {len(target_files)}")
    log(f"Image format:             PNG")
    log(f"Label format:             JSON (WKT polygons)")
    log(f"Status:                   Raw dataset NOT modified")

    # Write report
    _write_report(reports_path, lines)

    return {
        "complete_pairs": len(complete_pairs),
        "events": dict(events),
        "total_images": len(image_files),
        "total_labels": len(label_files),
        "total_targets": len(target_files),
    }


def _write_report(reports_path, lines):
    report_file = reports_path / "inspection_report.txt"
    with open(report_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"\n[OK] Report saved to: {report_file}")


if __name__ == "__main__":
    config = load_config()
    run(config)
