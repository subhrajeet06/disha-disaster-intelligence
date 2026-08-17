"""
DISHA — Duplicate Detection Script
Detects exact and near-duplicate images using file hashes and perceptual hashing.

Usage:
    python scripts/check_duplicates.py
"""

import csv
import hashlib
import sys
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import load_config, get_sample_pairs, print_header


def compute_file_hash(file_path):
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def compute_image_hash(file_path):
    """Compute perceptual hash (pHash) of an image."""
    import imagehash
    from PIL import Image
    with Image.open(file_path) as im:
        return str(imagehash.phash(im))


def run(config):
    """Run duplicate detection and generate report."""
    from tqdm import tqdm

    raw_path = config["_raw_path"]
    reports_path = config["_reports_path"]
    reports_path.mkdir(parents=True, exist_ok=True)

    print_header("DUPLICATE DETECTION")

    pairs = get_sample_pairs(raw_path)
    print(f"Checking {len(pairs)} samples for duplicates...\n")

    # Track hashes
    file_hashes = defaultdict(list)  # hash -> [(sample_key, file_type, path)]
    phashes = defaultdict(list)      # phash -> [(sample_key, file_type, path)]
    duplicates = []

    # Hash all images
    for key in tqdm(sorted(pairs.keys()), desc="Hashing images"):
        sample = pairs[key]
        for file_type in ["pre_image", "post_image"]:
            fpath = sample[file_type]
            if fpath and fpath.exists():
                # File hash
                fhash = compute_file_hash(fpath)
                file_hashes[fhash].append((key, file_type, str(fpath)))

                # Perceptual hash
                try:
                    phash = compute_image_hash(fpath)
                    phashes[phash].append((key, file_type, str(fpath)))
                except Exception:
                    pass

    # Find exact duplicates
    exact_dupes = {h: entries for h, entries in file_hashes.items() if len(entries) > 1}
    print(f"\nExact duplicate groups (SHA-256): {len(exact_dupes)}")

    for h, entries in exact_dupes.items():
        for i, (key1, ftype1, path1) in enumerate(entries):
            for key2, ftype2, path2 in entries[i + 1:]:
                duplicates.append({
                    "sample_id_1": key1,
                    "file_type_1": ftype1,
                    "sample_id_2": key2,
                    "file_type_2": ftype2,
                    "duplicate_type": "exact",
                    "hash": h[:16] + "...",
                    "path_1": path1,
                    "path_2": path2,
                })

    # Find near-duplicates (same perceptual hash, different file hash)
    near_dupes = {h: entries for h, entries in phashes.items() if len(entries) > 1}
    near_dupe_count = 0
    for h, entries in near_dupes.items():
        for i, (key1, ftype1, path1) in enumerate(entries):
            for key2, ftype2, path2 in entries[i + 1:]:
                # Skip if already recorded as exact
                if key1 == key2:
                    continue
                fh1 = compute_file_hash(Path(path1))
                fh2 = compute_file_hash(Path(path2))
                if fh1 != fh2:
                    near_dupe_count += 1
                    duplicates.append({
                        "sample_id_1": key1,
                        "file_type_1": ftype1,
                        "sample_id_2": key2,
                        "file_type_2": ftype2,
                        "duplicate_type": "near_duplicate",
                        "hash": h,
                        "path_1": path1,
                        "path_2": path2,
                    })

    print(f"Near-duplicate groups (pHash):    {len([h for h, e in near_dupes.items() if len(e) > 1])}")

    # Check for duplicate sample IDs across dataset
    sample_ids = list(pairs.keys())
    id_counts = defaultdict(int)
    for sid in sample_ids:
        id_counts[sid] += 1
    dup_ids = {k: v for k, v in id_counts.items() if v > 1}
    print(f"Duplicate sample IDs:             {len(dup_ids)}")

    # Write report
    csv_file = reports_path / "duplicate_report.csv"
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "sample_id_1", "file_type_1", "sample_id_2", "file_type_2",
            "duplicate_type", "hash", "path_1", "path_2"
        ])
        writer.writeheader()
        writer.writerows(duplicates)

    print(f"\n[OK] Duplicate report: {csv_file}")
    print(f"    Total duplicate pairs found: {len(duplicates)}")

    return duplicates


if __name__ == "__main__":
    config = load_config()
    run(config)
