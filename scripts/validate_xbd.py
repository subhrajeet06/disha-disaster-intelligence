"""
DISHA — xBD Dataset Integrity Validation Script
Validates images, annotations, and pairing integrity.
Generates reports of valid and invalid samples.

Usage:
    python scripts/validate_xbd.py
"""

import json
import sys
import csv
from pathlib import Path
from collections import Counter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import load_config, get_sample_pairs, print_header


VALID_DAMAGE_SUBTYPES = {"no-damage", "minor-damage", "major-damage", "destroyed"}


def validate_image(img_path, expected_w, expected_h):
    """Validate a single image file. Returns (is_valid, issues_list)."""
    from PIL import Image
    issues = []

    if img_path is None:
        return False, ["File path is None (missing)"]

    if not img_path.exists():
        return False, [f"File does not exist: {img_path}"]

    try:
        with Image.open(img_path) as im:
            im.load()  # Force full decode to detect corruption
            w, h = im.size
            if w != expected_w or h != expected_h:
                issues.append(f"Unexpected dimensions {w}x{h} (expected {expected_w}x{expected_h})")
    except Exception as e:
        issues.append(f"Corrupted or unreadable: {e}")

    return len(issues) == 0, issues


def validate_json_annotation(json_path, expected_w, expected_h, is_post=True):
    """Validate a JSON annotation file. Returns (is_valid, issues_list, building_count, damage_counts)."""
    issues = []
    damage_counts = Counter()
    building_count = 0

    if json_path is None:
        return False, ["File path is None (missing)"], 0, damage_counts

    if not json_path.exists():
        return False, [f"File does not exist: {json_path}"], 0, damage_counts

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return False, [f"Invalid JSON: {e}"], 0, damage_counts

    # Check required keys
    if "metadata" not in data:
        issues.append("Missing 'metadata' key")
    if "features" not in data and "xy" not in data:
        issues.append("Missing 'features' or 'xy' key")

    # Get features list
    features = []
    if "features" in data:
        feat_data = data["features"]
        if isinstance(feat_data, dict) and "xy" in feat_data:
            features = feat_data["xy"]
        elif isinstance(feat_data, list):
            features = feat_data
    elif "xy" in data:
        features = data["xy"]

    # Validate each building polygon
    for i, feat in enumerate(features):
        building_count += 1
        props = feat.get("properties", {})

        # Check feature type
        if props.get("feature_type") != "building":
            pass  # Some may not be buildings

        # Check damage subtype (only for post-disaster)
        if is_post:
            subtype = props.get("subtype", "")
            if subtype and subtype != "un-classified":
                if subtype not in VALID_DAMAGE_SUBTYPES:
                    issues.append(f"Building {i}: invalid damage subtype '{subtype}'")
                else:
                    damage_counts[subtype] += 1

        # Validate WKT polygon
        wkt = feat.get("wkt", "")
        if wkt:
            try:
                from shapely import wkt as swkt
                from shapely.validation import explain_validity
                geom = swkt.loads(wkt)
                if not geom.is_valid:
                    reason = explain_validity(geom)
                    issues.append(f"Building {i}: invalid polygon — {reason}")
                else:
                    # Check bounds within image
                    minx, miny, maxx, maxy = geom.bounds
                    tolerance = 2  # Allow small overflow
                    if minx < -tolerance or miny < -tolerance:
                        issues.append(f"Building {i}: polygon out of bounds (min: {minx:.1f}, {miny:.1f})")
                    if maxx > expected_w + tolerance or maxy > expected_h + tolerance:
                        issues.append(f"Building {i}: polygon out of bounds (max: {maxx:.1f}, {maxy:.1f})")
            except Exception as e:
                issues.append(f"Building {i}: WKT parse error — {e}")

    return len(issues) == 0, issues, building_count, damage_counts


def validate_target(target_path):
    """Validate a target mask file. Returns (is_valid, issues_list)."""
    import numpy as np
    from PIL import Image
    issues = []

    if target_path is None:
        return False, ["File path is None (missing)"]

    if not target_path.exists():
        return False, [f"File does not exist: {target_path}"]

    try:
        with Image.open(target_path) as im:
            arr = np.array(im)
            unique_vals = set(np.unique(arr))
            invalid_vals = unique_vals - {0, 1, 2, 3, 4}
            if invalid_vals:
                issues.append(f"Unexpected pixel values: {invalid_vals}")
    except Exception as e:
        issues.append(f"Corrupted or unreadable: {e}")

    return len(issues) == 0, issues


def run(config):
    """Run full dataset validation. Returns list of valid sample keys."""
    from tqdm import tqdm

    raw_path = config["_raw_path"]
    reports_path = config["_reports_path"]
    reports_path.mkdir(parents=True, exist_ok=True)
    expected_w = config["expected_width"]
    expected_h = config["expected_height"]

    print_header("xBD DATASET VALIDATION")

    # Get all sample pairs
    print("Scanning dataset for sample pairs...")
    pairs = get_sample_pairs(raw_path)
    print(f"Found {len(pairs)} sample keys\n")

    # Validation counters
    stats = Counter()
    stats["total"] = len(pairs)
    total_buildings = 0
    total_damage = Counter()
    invalid_records = []
    valid_samples = []

    for key in tqdm(sorted(pairs.keys()), desc="Validating samples"):
        sample = pairs[key]
        sample_issues = []
        is_sample_valid = True

        # --- Validate pre-disaster image ---
        ok, issues = validate_image(sample["pre_image"], expected_w, expected_h)
        if not ok:
            is_sample_valid = False
            stats["missing_pre_images" if sample["pre_image"] is None else "corrupted_images"] += 1
            for issue in issues:
                sample_issues.append(("pre_image", issue))

        # --- Validate post-disaster image ---
        ok, issues = validate_image(sample["post_image"], expected_w, expected_h)
        if not ok:
            is_sample_valid = False
            stats["missing_post_images" if sample["post_image"] is None else "corrupted_images"] += 1
            for issue in issues:
                sample_issues.append(("post_image", issue))

        # --- Validate pre-disaster label ---
        ok, issues, bcount, _ = validate_json_annotation(
            sample["pre_label"], expected_w, expected_h, is_post=False
        )
        if not ok:
            stats["missing_pre_labels" if sample["pre_label"] is None else "invalid_json"] += 1
            for issue in issues:
                sample_issues.append(("pre_label", issue))
            if sample["pre_label"] is None:
                is_sample_valid = False

        # --- Validate post-disaster label ---
        ok, issues, bcount, dmg = validate_json_annotation(
            sample["post_label"], expected_w, expected_h, is_post=True
        )
        if not ok:
            stats["missing_post_labels" if sample["post_label"] is None else "invalid_json"] += 1
            for issue in issues:
                sample_issues.append(("post_label", issue))
            if sample["post_label"] is None:
                is_sample_valid = False
        total_buildings += bcount
        total_damage += dmg

        # --- Validate targets (non-critical) ---
        for phase in ["pre_target", "post_target"]:
            ok, issues = validate_target(sample[phase])
            if not ok:
                for issue in issues:
                    sample_issues.append((phase, issue))

        # --- Record results ---
        if is_sample_valid and not sample_issues:
            stats["valid"] += 1
            valid_samples.append(key)
        elif is_sample_valid:
            # Has minor issues but core files are present
            stats["valid_with_warnings"] += 1
            valid_samples.append(key)
        else:
            stats["invalid"] += 1

        # Record invalid/warning issues
        for component, desc in sample_issues:
            invalid_records.append({
                "sample_id": key,
                "disaster_event": sample["event"],
                "problem_type": component,
                "file_path": str(sample.get(component, "")),
                "description": desc,
            })

    # --- Write integrity report ---
    report_lines = [
        "xBD DATASET INTEGRITY REPORT",
        "=" * 60,
        "",
        f"Total samples:            {stats['total']}",
        f"Valid samples:            {stats['valid']}",
        f"Valid with warnings:      {stats['valid_with_warnings']}",
        f"Invalid samples:          {stats['invalid']}",
        "",
        f"Missing pre-images:       {stats['missing_pre_images']}",
        f"Missing post-images:      {stats['missing_post_images']}",
        f"Corrupted images:         {stats['corrupted_images']}",
        f"Missing pre-labels:       {stats['missing_pre_labels']}",
        f"Missing post-labels:      {stats['missing_post_labels']}",
        f"Invalid JSON:             {stats['invalid_json']}",
        "",
        f"Total buildings found:    {total_buildings}",
        "",
        "Damage distribution (from post-disaster labels):",
    ]
    for label, count in sorted(total_damage.items()):
        report_lines.append(f"  {label:<20} {count:>8}")

    report_file = reports_path / "integrity_report.txt"
    with open(report_file, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    print(f"\n[OK] Integrity report: {report_file}")

    # --- Write invalid samples CSV ---
    csv_file = reports_path / "invalid_samples.csv"
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["sample_id", "disaster_event", "problem_type", "file_path", "description"])
        writer.writeheader()
        writer.writerows(invalid_records)
    print(f"[OK] Invalid samples log: {csv_file}")

    # --- Write valid samples list ---
    valid_file = reports_path / "valid_samples.csv"
    with open(valid_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["sample_key", "event"])
        for key in valid_samples:
            event = pairs[key]["event"]
            writer.writerow([key, event])
    print(f"[OK] Valid samples list: {valid_file}")

    # Print summary
    for line in report_lines:
        print(line)

    return valid_samples


if __name__ == "__main__":
    config = load_config()
    run(config)
