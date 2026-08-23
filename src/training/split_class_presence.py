from pathlib import Path

import numpy as np
from PIL import Image


CLASS_NAMES = [
    "background",
    "no_damage",
    "minor_damage",
    "major_damage",
    "destroyed",
]


def analyze_split(split_name):
    label_dir = Path(
        f"data/processed/xbd_disha/{split_name}/labels"
    )

    files = sorted(label_dir.glob("*.png"))

    presence_counts = np.zeros(
        5,
        dtype=np.int64,
    )

    pixel_counts = np.zeros(
        5,
        dtype=np.int64,
    )

    for path in files:
        mask = np.array(
            Image.open(path)
        )

        present_classes = np.unique(mask)

        for class_id in present_classes:
            presence_counts[class_id] += 1

        for class_id in range(5):
            pixel_counts[class_id] += np.sum(
                mask == class_id
            )

    total_pixels = pixel_counts.sum()

    print("\n" + "=" * 65)
    print(f"{split_name.upper()} SPLIT")
    print("=" * 65)

    print(f"Samples: {len(files)}")

    print(
        f"\n{'Class':15s}"
        f"{'Images':>10s}"
        f"{'Image %':>12s}"
        f"{'Pixels':>15s}"
        f"{'Pixel %':>12s}"
    )

    for class_id, name in enumerate(CLASS_NAMES):
        image_percentage = (
            presence_counts[class_id]
            / len(files)
            * 100
        )

        pixel_percentage = (
            pixel_counts[class_id]
            / total_pixels
            * 100
        )

        print(
            f"{name:15s}"
            f"{presence_counts[class_id]:>10,}"
            f"{image_percentage:>11.2f}%"
            f"{pixel_counts[class_id]:>15,}"
            f"{pixel_percentage:>11.4f}%"
        )


def main():
    analyze_split("train")
    analyze_split("val")


if __name__ == "__main__":
    main()