"""
DISHA V10 Weighted Sampler

Computes per-image sampling weights based on which damage classes
are present in each training sample's label mask.

Strategy:
    - Images with minor_damage (2) or major_damage (3) get `rare_class_weight`
    - Images with destroyed (4) only get `destroyed_weight`
    - All other images get weight 1.0 (baseline)
    - All weights are capped at `max_sample_weight`

This gives the DataLoader a higher probability of returning minority-class
images each batch, without hard-duplicating them (which risks overfitting).

The sampler is computed ONCE before training starts, using the label PNG files
directly. It operates on the training split ONLY.
"""

import numpy as np
import torch
from pathlib import Path
from PIL import Image
from torch.utils.data import WeightedRandomSampler


def build_weighted_sampler(
    dataset,
    rare_class_weight: float = 3.0,
    destroyed_weight: float = 1.5,
    max_sample_weight: float = 5.0,
    seed: int = 42,
) -> WeightedRandomSampler:
    """
    Build a WeightedRandomSampler for the given XBDDataset.

    Args:
        dataset:             XBDDataset instance (training split only)
        rare_class_weight:   multiplier for images with minor or major damage
        destroyed_weight:    multiplier for images with destroyed only
        max_sample_weight:   cap on any single image's weight
        seed:                random seed for reproducibility

    Returns:
        WeightedRandomSampler ready to use in DataLoader
    """

    print("Computing per-image sampling weights...")

    weights = []
    class_counts = {
        "baseline": 0,
        "destroyed_only": 0,
        "rare_damage": 0,
    }

    for sample in dataset.samples:
        label_path = sample["label"]

        # Load label mask efficiently
        label_arr = np.array(Image.open(label_path), dtype=np.uint8)

        unique_classes = set(np.unique(label_arr))

        has_minor  = 2 in unique_classes
        has_major  = 3 in unique_classes
        has_dest   = 4 in unique_classes

        if has_minor or has_major:
            w = rare_class_weight
            class_counts["rare_damage"] += 1
        elif has_dest:
            w = destroyed_weight
            class_counts["destroyed_only"] += 1
        else:
            w = 1.0
            class_counts["baseline"] += 1

        # Cap weight
        w = min(w, max_sample_weight)
        weights.append(w)

    print(f"  Baseline (bg/no_damage only): {class_counts['baseline']}")
    print(f"  Destroyed only:               {class_counts['destroyed_only']}")
    print(f"  Minor or major damage:        {class_counts['rare_damage']}")

    weights_tensor = torch.tensor(weights, dtype=torch.float64)

    sampler = WeightedRandomSampler(
        weights=weights_tensor,
        num_samples=len(weights),
        replacement=True,
        generator=torch.Generator().manual_seed(seed),
    )

    print(f"  Weight range: {min(weights):.2f} – {max(weights):.2f}")
    print(f"  Effective dataset upweight: {sum(weights)/len(weights):.2f}x average")

    return sampler
