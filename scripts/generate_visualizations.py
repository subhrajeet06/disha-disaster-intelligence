"""
DISHA — Visualization Generation Script
Creates sample visualizations showing pre/post/mask panels for quality verification.

Usage:
    python scripts/generate_visualizations.py
"""

import csv
import random
import sys
from pathlib import Path
from collections import defaultdict

import cv2
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import load_config, print_header


# Color map for damage classes
DAMAGE_COLORS = {
    0: (0, 0, 0),         # background — black
    1: (0, 255, 0),       # no_damage — green
    2: (255, 255, 0),     # minor_damage — yellow
    3: (255, 165, 0),     # major_damage — orange
    4: (255, 0, 0),       # destroyed — red
}

DAMAGE_NAMES = {
    0: "background",
    1: "no_damage",
    2: "minor_damage",
    3: "major_damage",
    4: "destroyed",
}


def create_mask_overlay(post_img, mask, alpha=0.4):
    """Create an overlay of the mask on the post-disaster image."""
    overlay = post_img.copy()
    for class_id, color in DAMAGE_COLORS.items():
        if class_id == 0:
            continue
        class_mask = mask == class_id
        if class_mask.any():
            overlay[class_mask] = (
                np.array(color[::-1]) * alpha + overlay[class_mask] * (1 - alpha)
            ).astype(np.uint8)
    return overlay


def create_colored_mask(mask):
    """Convert a class-ID mask to an RGB color mask."""
    h, w = mask.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    for class_id, color in DAMAGE_COLORS.items():
        rgb[mask == class_id] = color[::-1]  # RGB to BGR for consistency with OpenCV
    return rgb


def get_dominant_damage(mask):
    """Return the dominant non-background damage class in a mask."""
    unique, counts = np.unique(mask, return_counts=True)
    # Filter out background
    non_bg = [(cls, cnt) for cls, cnt in zip(unique, counts) if cls > 0]
    if not non_bg:
        return 0
    # Return class with most pixels
    return max(non_bg, key=lambda x: x[1])[0]


def run(config):
    """Generate sample visualizations organized by damage severity."""
    output_path = config["_output_path"]
    metadata_dir = output_path / "metadata"
    num_viz = config.get("num_visualizations", 30)
    seed = config["random_seed"]

    print_header("VISUALIZATION GENERATION")

    rng = random.Random(seed)

    # Collect all samples across splits with their damage info
    all_samples = []
    for split_name in ["train", "val", "test"]:
        pre_dir = output_path / split_name / "pre"
        post_dir = output_path / split_name / "post"
        labels_dir = output_path / split_name / "labels"

        csv_file = metadata_dir / f"{split_name}.csv"
        if not csv_file.exists():
            continue

        with open(csv_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                idx = f"{i:06d}"
                pre_path = pre_dir / f"sample_{idx}_pre.png"
                post_path = post_dir / f"sample_{idx}_post.png"
                label_path = labels_dir / f"sample_{idx}_label.png"

                if pre_path.exists() and post_path.exists() and label_path.exists():
                    all_samples.append({
                        "pre": pre_path,
                        "post": post_path,
                        "label": label_path,
                        "split": split_name,
                        "event": row["disaster_event"],
                        "sample_id": row["sample_id"],
                    })

    print(f"Total samples available: {len(all_samples)}")

    # Categorize by dominant damage
    by_damage = defaultdict(list)
    for s in all_samples:
        mask = np.array(Image.open(s["label"]))
        dominant = get_dominant_damage(mask)
        s["dominant_damage"] = dominant
        by_damage[dominant].append(s)

    # Select samples: try to get balanced representation
    # Allocate roughly equal per damage category
    selected = []
    per_category = max(num_viz // 4, 2)  # At least 2 per damage category

    for class_id in [1, 2, 3, 4]:
        candidates = by_damage.get(class_id, [])
        if candidates:
            # Also try to get diversity across events
            rng.shuffle(candidates)
            n = min(per_category, len(candidates))
            selected.extend(candidates[:n])

    # Fill remaining slots with any samples
    remaining = num_viz - len(selected)
    if remaining > 0:
        all_remaining = [s for s in all_samples if s not in selected]
        rng.shuffle(all_remaining)
        selected.extend(all_remaining[:remaining])

    print(f"Selected {len(selected)} samples for visualization")

    # Generate visualizations
    viz_base = output_path / "visualizations"
    for damage_name in ["no_damage", "minor_damage", "major_damage", "destroyed"]:
        (viz_base / damage_name).mkdir(parents=True, exist_ok=True)

    for idx, sample in enumerate(selected):
        pre_img = cv2.imread(str(sample["pre"]))
        post_img = cv2.imread(str(sample["post"]))
        mask = np.array(Image.open(sample["label"]))

        if pre_img is None or post_img is None:
            print(f"  WARNING: Could not read images for {sample['sample_id']}")
            continue

        # Create overlay and colored mask
        overlay = create_mask_overlay(post_img, mask)
        colored_mask = create_colored_mask(mask)

        # Create 2x2 figure
        fig, axes = plt.subplots(2, 2, figsize=(12, 12))
        fig.suptitle(
            f"{sample['sample_id']} | {sample['event']} | {sample['split']}",
            fontsize=14, fontweight="bold"
        )

        # Pre-disaster
        axes[0, 0].imshow(cv2.cvtColor(pre_img, cv2.COLOR_BGR2RGB))
        axes[0, 0].set_title("Pre-disaster", fontsize=12)
        axes[0, 0].axis("off")

        # Post-disaster
        axes[0, 1].imshow(cv2.cvtColor(post_img, cv2.COLOR_BGR2RGB))
        axes[0, 1].set_title("Post-disaster", fontsize=12)
        axes[0, 1].axis("off")

        # Ground truth mask (colored)
        axes[1, 0].imshow(cv2.cvtColor(colored_mask, cv2.COLOR_BGR2RGB))
        axes[1, 0].set_title("Ground Truth Mask", fontsize=12)
        axes[1, 0].axis("off")

        # Overlay
        axes[1, 1].imshow(cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB))
        axes[1, 1].set_title("Post + Mask Overlay", fontsize=12)
        axes[1, 1].axis("off")

        # Add legend
        legend_elements = [
            plt.Line2D([0], [0], marker="s", color="w", markerfacecolor=np.array(c) / 255,
                       markersize=10, label=DAMAGE_NAMES[cid])
            for cid, c in DAMAGE_COLORS.items() if cid > 0
        ]
        fig.legend(handles=legend_elements, loc="lower center", ncol=4,
                   fontsize=10, frameon=True, fancybox=True)

        plt.tight_layout(rect=[0, 0.04, 1, 0.96])

        # Save to appropriate category folder
        dominant = sample["dominant_damage"]
        category_name = DAMAGE_NAMES.get(dominant, "no_damage")
        if category_name == "background":
            category_name = "no_damage"
        save_path = viz_base / category_name / f"viz_{idx:03d}_{sample['event']}_{sample['sample_id']}.png"
        fig.savefig(save_path, dpi=100, bbox_inches="tight")
        plt.close(fig)

    print(f"\n[OK] Visualizations saved to: {viz_base}")

    # Count per category
    for category_name in ["no_damage", "minor_damage", "major_damage", "destroyed"]:
        cat_dir = viz_base / category_name
        count = len(list(cat_dir.glob("*.png")))
        print(f"  {category_name:<15} {count:>3} visualizations")


if __name__ == "__main__":
    config = load_config()
    run(config)
