"""
DISHA — Event-Level Train/Val/Test Split Script
Splits selected samples by disaster event to prevent data leakage.

Usage:
    python scripts/split_dataset.py
"""

import csv
import sys
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import load_config, get_sample_pairs, print_header


def run(config):
    """Split selected samples by disaster event into train/val/test."""
    reports_path = config["_reports_path"]
    output_path = config["_output_path"]
    raw_path = config["_raw_path"]

    train_events = set(config["train_events"])
    val_events = set(config["val_events"])
    test_events = set(config["test_events"])

    metadata_dir = output_path / "metadata"
    metadata_dir.mkdir(parents=True, exist_ok=True)

    print_header("EVENT-LEVEL TRAIN/VAL/TEST SPLIT")

    # Load selected samples
    selected_file = reports_path / "selected_samples.csv"
    if not selected_file.exists():
        print("ERROR: selected_samples.csv not found. Run select_samples.py first.")
        return {}

    selected = []
    with open(selected_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            selected.append(row)

    # Get full paths
    pairs = get_sample_pairs(raw_path)

    # Assign splits based on event
    splits = {"train": [], "val": [], "test": []}
    unassigned = []

    for row in selected:
        key = row["sample_key"]
        event = row["event"]

        if event in train_events:
            split = "train"
        elif event in val_events:
            split = "val"
        elif event in test_events:
            split = "test"
        else:
            unassigned.append(key)
            split = "train"  # Default fallback

        sample = pairs.get(key, {})
        splits[split].append({
            "sample_id": key,
            "disaster_event": event,
            "pre_image_path": str(sample.get("pre_image", "")),
            "post_image_path": str(sample.get("post_image", "")),
            "pre_label_path": str(sample.get("pre_label", "")),
            "post_label_path": str(sample.get("post_label", "")),
            "pre_target_path": str(sample.get("pre_target", "")),
            "post_target_path": str(sample.get("post_target", "")),
            "split": split,
        })

    # Report
    total = sum(len(v) for v in splits.values())
    print(f"\nSplit assignment (event-level, no data leakage):")
    print(f"  Train events: {sorted(train_events)}")
    print(f"  Val events:   {sorted(val_events)}")
    print(f"  Test events:  {sorted(test_events)}")
    print()
    for split_name, samples in splits.items():
        pct = (len(samples) / total * 100) if total > 0 else 0
        print(f"  {split_name:<10} {len(samples):>6} pairs ({pct:.1f}%)")
    print(f"  {'TOTAL':<10} {total:>6} pairs")

    if unassigned:
        print(f"\n  WARNING: {len(unassigned)} samples from unknown events assigned to train")

    # Verify no overlap
    all_ids = set()
    for split_name, samples in splits.items():
        ids = {s["sample_id"] for s in samples}
        overlap = all_ids & ids
        if overlap:
            print(f"\n  ERROR: {len(overlap)} duplicates found in {split_name}!")
        all_ids |= ids
    print(f"\n  Overlap check: {'PASS OK' if len(all_ids) == total else 'FAIL FAIL'}")

    # Write split CSVs
    fieldnames = [
        "sample_id", "disaster_event", "pre_image_path", "post_image_path",
        "pre_label_path", "post_label_path", "pre_target_path", "post_target_path", "split"
    ]
    for split_name, samples in splits.items():
        csv_file = metadata_dir / f"{split_name}.csv"
        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(samples)
        print(f"[OK] {split_name}.csv: {csv_file}")

    # Event distribution per split
    print(f"\n--- Event distribution per split ---")
    for split_name, samples in splits.items():
        event_counts = defaultdict(int)
        for s in samples:
            event_counts[s["disaster_event"]] += 1
        print(f"\n  {split_name.upper()}:")
        for event in sorted(event_counts.keys()):
            print(f"    {event:<25} {event_counts[event]:>4}")

    return splits


if __name__ == "__main__":
    config = load_config()
    run(config)
