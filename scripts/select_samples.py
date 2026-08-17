"""
DISHA — Intelligent Sample Selection Script
Selects ~TARGET_SAMPLES pairs with stratified sampling across disaster events
and damage diversity. Uses deterministic random seed for reproducibility.

Usage:
    python scripts/select_samples.py
"""

import csv
import random
import json
import sys
from pathlib import Path
from collections import Counter, defaultdict

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import load_config, get_sample_pairs, print_header


def get_sample_damage_profile(sample):
    """Read the post-disaster JSON and return a damage profile for the sample."""
    post_label = sample.get("post_label")
    if post_label is None or not post_label.exists():
        return Counter()

    try:
        with open(post_label, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return Counter()

    features = []
    if "features" in data:
        feat_data = data["features"]
        if isinstance(feat_data, dict) and "xy" in feat_data:
            features = feat_data["xy"]
        elif isinstance(feat_data, list):
            features = feat_data
    elif "xy" in data:
        features = data["xy"]

    damage = Counter()
    for feat in features:
        subtype = feat.get("properties", {}).get("subtype", "")
        if subtype in ("no-damage", "minor-damage", "major-damage", "destroyed"):
            damage[subtype] += 1

    return damage


def run(config):
    """Select ~TARGET_SAMPLES pairs with diversity preservation."""
    raw_path = config["_raw_path"]
    reports_path = config["_reports_path"]
    reports_path.mkdir(parents=True, exist_ok=True)
    target = config["target_samples"]
    seed = config["random_seed"]

    print_header("SAMPLE SELECTION")

    # Load valid samples
    valid_file = reports_path / "valid_samples.csv"
    if not valid_file.exists():
        print("ERROR: valid_samples.csv not found. Run validate_xbd.py first.")
        return []

    valid_keys = set()
    valid_events = {}
    with open(valid_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            valid_keys.add(row["sample_key"])
            valid_events[row["sample_key"]] = row["event"]

    print(f"Valid samples available: {len(valid_keys)}")
    print(f"Target selection:        {target}")

    # Get full sample data for damage profiling
    pairs = get_sample_pairs(raw_path)
    valid_pairs = {k: pairs[k] for k in valid_keys if k in pairs}

    # Group by event
    event_groups = defaultdict(list)
    for key in valid_keys:
        event = valid_events[key]
        event_groups[event].append(key)

    print(f"\n--- Samples per event ---")
    for event in sorted(event_groups.keys()):
        print(f"  {event:<25} {len(event_groups[event]):>6}")

    # Calculate proportional allocation
    total_valid = len(valid_keys)
    ratio = min(target / total_valid, 1.0)

    allocation = {}
    for event, keys in event_groups.items():
        n = max(len(keys), 1)  # At least 1
        alloc = max(round(n * ratio), min(n, 1))  # At least 1, at most all
        allocation[event] = min(alloc, len(keys))

    # Adjust to hit target
    current_total = sum(allocation.values())
    diff = target - current_total
    events_sorted = sorted(allocation.keys(), key=lambda e: len(event_groups[e]), reverse=True)

    while diff != 0 and events_sorted:
        for event in events_sorted:
            if diff == 0:
                break
            max_available = len(event_groups[event])
            if diff > 0 and allocation[event] < max_available:
                allocation[event] += 1
                diff -= 1
            elif diff < 0 and allocation[event] > 1:
                allocation[event] -= 1
                diff += 1

        # Avoid infinite loop
        if diff == target - sum(allocation.values()):
            break

    print(f"\n--- Selection allocation ---")
    for event in sorted(allocation.keys()):
        avail = len(event_groups[event])
        print(f"  {event:<25} {allocation[event]:>4} / {avail}")
    print(f"  {'TOTAL':<25} {sum(allocation.values()):>4} / {total_valid}")

    # Select samples from each event with damage diversity
    rng = random.Random(seed)
    selected = []
    selection_records = []

    for event in sorted(event_groups.keys()):
        keys = sorted(event_groups[event])
        n_select = allocation[event]

        if n_select >= len(keys):
            # Take all
            for k in keys:
                selected.append(k)
                selection_records.append({
                    "sample_id": k,
                    "disaster_event": event,
                    "selected": "yes",
                    "reason": "all_available_selected",
                })
        else:
            # Score samples by damage diversity to prefer interesting ones
            scored = []
            for k in keys:
                if k in valid_pairs:
                    dmg = get_sample_damage_profile(valid_pairs[k])
                    # Higher score for rarer damage types
                    diversity_score = len(dmg)  # Number of different damage types present
                    has_damage = sum(v for subtype, v in dmg.items() if subtype != "no-damage")
                    scored.append((k, diversity_score, has_damage))
                else:
                    scored.append((k, 0, 0))

            # Sort by diversity (desc), then shuffle within tiers for randomness
            rng.shuffle(scored)
            scored.sort(key=lambda x: (x[1], x[2]), reverse=True)

            chosen = set()
            for k, _, _ in scored[:n_select]:
                chosen.add(k)
                selected.append(k)

            for k in keys:
                selection_records.append({
                    "sample_id": k,
                    "disaster_event": event,
                    "selected": "yes" if k in chosen else "no",
                    "reason": "stratified_diverse" if k in chosen else "not_selected",
                })

    print(f"\nTotal selected: {len(selected)}")

    # Write selection report
    csv_file = reports_path / "selection_report.csv"
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["sample_id", "disaster_event", "selected", "reason"])
        writer.writeheader()
        writer.writerows(selection_records)
    print(f"[OK] Selection report: {csv_file}")

    # Write selected samples list
    selected_file = reports_path / "selected_samples.csv"
    with open(selected_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["sample_key", "event"])
        for k in selected:
            writer.writerow([k, valid_events[k]])
    print(f"[OK] Selected samples: {selected_file}")

    return selected


if __name__ == "__main__":
    config = load_config()
    run(config)
