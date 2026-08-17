"""
DISHA — Dataset Statistics Generation Script
Calculates and reports damage class distribution, building counts,
and per-split breakdowns.

Usage:
    python scripts/generate_statistics.py
"""

import csv
import json
import sys
from pathlib import Path
from collections import Counter, defaultdict

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import load_config, print_header


def run(config):
    """Generate comprehensive dataset statistics."""
    from tqdm import tqdm

    output_path = config["_output_path"]
    reports_path = config["_reports_path"]
    metadata_dir = output_path / "metadata"
    damage_classes = config["damage_classes"]

    print_header("DATASET STATISTICS")

    overall = {
        "total_pairs": 0,
        "damage_pixels": Counter(),
        "damage_buildings": Counter(),
        "events": Counter(),
    }
    split_stats = {}

    for split_name in ["train", "val", "test"]:
        csv_file = metadata_dir / f"{split_name}.csv"
        if not csv_file.exists():
            continue

        # Count samples
        samples = []
        with open(csv_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                samples.append(row)

        n_samples = len(samples)
        overall["total_pairs"] += n_samples

        # Count events
        event_counts = Counter()
        for s in samples:
            event_counts[s["disaster_event"]] += 1
            overall["events"][s["disaster_event"]] += 1

        # Analyze masks for damage distribution
        labels_dir = output_path / split_name / "labels"
        damage_pixel_counts = Counter()
        damage_building_counts = Counter()

        for label_file in tqdm(sorted(labels_dir.glob("*.png")), desc=f"  {split_name} masks"):
            mask = np.array(Image.open(label_file))
            unique, counts = np.unique(mask, return_counts=True)
            for val, cnt in zip(unique, counts):
                damage_pixel_counts[int(val)] += int(cnt)

            # Count buildings (connected components per class)
            for class_id in range(1, 5):
                class_mask = (mask == class_id).astype(np.uint8)
                if class_mask.any():
                    num_labels, _ = cv2.connectedComponents(class_mask)
                    damage_building_counts[class_id] += num_labels - 1  # -1 for background

        overall["damage_pixels"] += damage_pixel_counts
        overall["damage_buildings"] += damage_building_counts

        split_stats[split_name] = {
            "pairs": n_samples,
            "events": dict(event_counts),
            "damage_pixels": dict(damage_pixel_counts),
            "damage_buildings": dict(damage_building_counts),
        }

    # --- Format and print report ---
    lines = []

    def log(msg=""):
        print(msg)
        lines.append(msg)

    log("DATASET STATISTICS")
    log("=" * 60)
    log()
    log(f"Total pairs: {overall['total_pairs']}")
    log()

    for split_name in ["train", "val", "test"]:
        if split_name in split_stats:
            s = split_stats[split_name]
            pct = s["pairs"] / overall["total_pairs"] * 100 if overall["total_pairs"] > 0 else 0
            log(f"{split_name.capitalize():<12} {s['pairs']:>6} pairs ({pct:.1f}%)")
    log()

    # Damage distribution (pixel-based)
    log("--- Damage Distribution (pixel counts) ---")
    total_pixels = sum(overall["damage_pixels"].values())
    for class_id in range(5):
        name = damage_classes.get(str(class_id), damage_classes.get(class_id, f"class_{class_id}"))
        count = overall["damage_pixels"].get(class_id, 0)
        pct = count / total_pixels * 100 if total_pixels > 0 else 0
        log(f"  {class_id} {name:<15} {count:>12} pixels ({pct:>5.1f}%)")
    log()

    # Damage distribution (building-based)
    log("--- Damage Distribution (building counts) ---")
    total_buildings = sum(overall["damage_buildings"].values())
    for class_id in range(1, 5):
        name = damage_classes.get(str(class_id), damage_classes.get(class_id, f"class_{class_id}"))
        count = overall["damage_buildings"].get(class_id, 0)
        pct = count / total_buildings * 100 if total_buildings > 0 else 0
        log(f"  {class_id} {name:<15} {count:>8} buildings ({pct:>5.1f}%)")
    log(f"  {'TOTAL':<17} {total_buildings:>8} buildings")
    log()

    # Per-split damage distribution
    for split_name in ["train", "val", "test"]:
        if split_name not in split_stats:
            continue
        s = split_stats[split_name]
        log(f"--- {split_name.upper()} Split ---")
        log(f"  Pairs: {s['pairs']}")
        log(f"  Events: {s['events']}")
        split_total = sum(s["damage_buildings"].values())
        for class_id in range(1, 5):
            name = damage_classes.get(str(class_id), damage_classes.get(class_id, f"class_{class_id}"))
            count = s["damage_buildings"].get(class_id, 0)
            pct = count / split_total * 100 if split_total > 0 else 0
            log(f"    {name:<15} {count:>6} ({pct:>5.1f}%)")
        log()

    # Event distribution
    log("--- Disaster Event Distribution ---")
    for event, count in overall["events"].most_common():
        pct = count / overall["total_pairs"] * 100
        log(f"  {event:<25} {count:>6} ({pct:>5.1f}%)")

    # Write text report
    report_file = reports_path / "dataset_statistics.txt"
    with open(report_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"\n[OK] Statistics report: {report_file}")

    # Write CSV
    csv_file = metadata_dir / "dataset_statistics.csv"
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["metric", "value"])
        writer.writerow(["total_pairs", overall["total_pairs"]])
        for split_name in ["train", "val", "test"]:
            if split_name in split_stats:
                writer.writerow([f"{split_name}_pairs", split_stats[split_name]["pairs"]])
        for class_id in range(1, 5):
            name = damage_classes.get(str(class_id), damage_classes.get(class_id, ""))
            writer.writerow([f"buildings_{name}", overall["damage_buildings"].get(class_id, 0)])
    print(f"[OK] Statistics CSV: {csv_file}")

    return overall, split_stats


# Need cv2 for connected components
import cv2

if __name__ == "__main__":
    config = load_config()
    run(config)
