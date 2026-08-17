"""
DISHA — Annotation Processing & File Organization Script
Reads split CSVs, copies images with standardized names,
generates segmentation masks from JSON polygons, and creates metadata.

Usage:
    python scripts/process_annotations.py
"""

import csv
import json
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import load_config, print_header


def parse_wkt_polygon(wkt_str):
    """Parse a WKT POLYGON string into a list of (x, y) coordinate tuples."""
    # POLYGON ((x1 y1, x2 y2, ...))
    wkt_str = wkt_str.strip()
    if not wkt_str.startswith("POLYGON"):
        return None

    # Extract coordinate string
    inner = wkt_str.replace("POLYGON", "").strip()
    # Remove outer and inner parentheses
    inner = inner.strip("()")
    inner = inner.strip("()")

    coords = []
    for pair in inner.split(","):
        pair = pair.strip()
        parts = pair.split()
        if len(parts) >= 2:
            try:
                x = float(parts[0])
                y = float(parts[1])
                coords.append((x, y))
            except ValueError:
                continue

    return coords if coords else None


def generate_mask_from_json(json_path, width, height, damage_label_map):
    """
    Generate a segmentation mask from an xBD JSON annotation file.
    Returns a numpy array of shape (height, width) with pixel values 0-4.
    """
    mask = np.zeros((height, width), dtype=np.uint8)

    if json_path is None or not Path(json_path).exists():
        return mask

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return mask

    # Get features
    features = []
    if "features" in data:
        feat_data = data["features"]
        if isinstance(feat_data, dict) and "xy" in feat_data:
            features = feat_data["xy"]
        elif isinstance(feat_data, list):
            features = feat_data
    elif "xy" in data:
        features = data["xy"]

    for feat in features:
        props = feat.get("properties", {})
        wkt = feat.get("wkt", "")
        subtype = props.get("subtype", "")

        # Map damage label to class ID
        class_id = damage_label_map.get(subtype, 1)  # Default to no_damage if not post

        # Parse polygon
        coords = parse_wkt_polygon(wkt)
        if coords is None:
            continue

        # Convert to integer pixel coordinates for OpenCV
        pts = np.array(coords, dtype=np.int32)
        pts = pts.clip([0, 0], [width - 1, height - 1])

        # Fill polygon on mask
        cv2.fillPoly(mask, [pts], int(class_id))

    return mask


def run(config):
    """Process annotations and organize files into final dataset structure."""
    from tqdm import tqdm

    output_path = config["_output_path"]
    reports_path = config["_reports_path"]
    metadata_dir = output_path / "metadata"
    damage_label_map = config["damage_label_map"]
    width = config["expected_width"]
    height = config["expected_height"]

    print_header("ANNOTATION PROCESSING & FILE ORGANIZATION")

    # Create class_mapping.json
    class_mapping = config["damage_classes"]
    mapping_file = metadata_dir / "class_mapping.json"
    with open(mapping_file, "w", encoding="utf-8") as f:
        json.dump(class_mapping, f, indent=2)
    print(f"[OK] Class mapping: {mapping_file}")

    # Process each split
    cross_validation_issues = []

    for split_name in ["train", "val", "test"]:
        csv_file = metadata_dir / f"{split_name}.csv"
        if not csv_file.exists():
            print(f"WARNING: {csv_file} not found, skipping {split_name}")
            continue

        # Read split CSV
        samples = []
        with open(csv_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                samples.append(row)

        print(f"\nProcessing {split_name}: {len(samples)} samples")

        # Ensure directories exist
        pre_dir = output_path / split_name / "pre"
        post_dir = output_path / split_name / "post"
        labels_dir = output_path / split_name / "labels"
        pre_dir.mkdir(parents=True, exist_ok=True)
        post_dir.mkdir(parents=True, exist_ok=True)
        labels_dir.mkdir(parents=True, exist_ok=True)

        for i, sample in enumerate(tqdm(samples, desc=f"  {split_name}")):
            sample_id = sample["sample_id"]

            # Create deterministic new names
            idx = f"{i:06d}"
            new_pre = pre_dir / f"sample_{idx}_pre.png"
            new_post = post_dir / f"sample_{idx}_post.png"
            new_label = labels_dir / f"sample_{idx}_label.png"

            # Copy pre-disaster image
            src_pre = Path(sample["pre_image_path"])
            if src_pre.exists():
                shutil.copy2(src_pre, new_pre)
            else:
                print(f"  WARNING: Missing pre-image for {sample_id}")

            # Copy post-disaster image
            src_post = Path(sample["post_image_path"])
            if src_post.exists():
                shutil.copy2(src_post, new_post)
            else:
                print(f"  WARNING: Missing post-image for {sample_id}")

            # Generate mask from post-disaster JSON annotation
            post_label_path = sample.get("post_label_path", "")
            if config.get("generate_masks", True):
                mask = generate_mask_from_json(post_label_path, width, height, damage_label_map)
                cv2.imwrite(str(new_label), mask)

                # Cross-validate with existing target mask
                if config.get("cross_validate_masks", True):
                    post_target_path = sample.get("post_target_path", "")
                    if post_target_path and Path(post_target_path).exists():
                        try:
                            existing_mask = np.array(Image.open(post_target_path))
                            # Compare unique values
                            our_classes = set(np.unique(mask))
                            their_classes = set(np.unique(existing_mask))

                            # Check if masks have significant differences
                            if existing_mask.shape == mask.shape:
                                diff_pixels = np.sum(mask != existing_mask)
                                diff_pct = diff_pixels / (width * height) * 100
                                if diff_pct > 15:  # More than 15% different
                                    cross_validation_issues.append({
                                        "sample_id": sample_id,
                                        "split": split_name,
                                        "diff_pct": f"{diff_pct:.1f}%",
                                        "our_classes": str(our_classes),
                                        "target_classes": str(their_classes),
                                    })
                        except Exception:
                            pass
            else:
                # Just copy existing target if available
                post_target_path = sample.get("post_target_path", "")
                if post_target_path and Path(post_target_path).exists():
                    shutil.copy2(post_target_path, new_label)

    # Write cross-validation report
    if cross_validation_issues:
        xval_file = reports_path / "mask_cross_validation.csv"
        with open(xval_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["sample_id", "split", "diff_pct", "our_classes", "target_classes"])
            writer.writeheader()
            writer.writerows(cross_validation_issues)
        print(f"\n[!!] Cross-validation issues: {len(cross_validation_issues)}")
        print(f"    Report: {xval_file}")
    else:
        print(f"\n[OK] Cross-validation: No significant discrepancies found")

    # Create dataset_config.json
    dataset_config = {
        "source": "xView2 / xBD Challenge Training Set",
        "project": "DISHA - Disaster Intelligence & Spatial Human-Assisted Assessment",
        "image_size": [width, height],
        "image_format": "PNG",
        "mask_format": "PNG (single-channel, values 0-4)",
        "num_classes": 5,
        "classes": config["damage_classes"],
        "splits": ["train", "val", "test"],
        "naming_convention": "sample_{NNNNNN}_{pre|post|label}.png",
        "processing_seed": config["random_seed"],
        "target_samples": config["target_samples"],
    }
    config_file = metadata_dir / "dataset_config.json"
    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(dataset_config, f, indent=2)
    print(f"[OK] Dataset config: {config_file}")

    print(f"\n[OK] Annotation processing complete!")


if __name__ == "__main__":
    config = load_config()
    from utils import ensure_dirs
    ensure_dirs(config)
    run(config)
