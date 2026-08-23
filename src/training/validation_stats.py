from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path("data/processed/xbd_disha/val/labels")

CLASS_NAMES = [
    "background",
    "no_damage",
    "minor_damage",
    "major_damage",
    "destroyed",
]


def main():
    files = sorted(ROOT.glob("*.png"))

    print("Validation labels:", len(files))

    total_pixels = 0
    counts = np.zeros(5, dtype=np.int64)

    for index, path in enumerate(files, start=1):
        mask = np.array(Image.open(path))

        total_pixels += mask.size

        for class_id in range(5):
            counts[class_id] += np.sum(
                mask == class_id
            )

        if index % 50 == 0:
            print(
                f"Processed {index}/{len(files)}"
            )

    print("\n" + "=" * 60)
    print("VALIDATION DATASET STATISTICS")
    print("=" * 60)

    print(f"Samples: {len(files):,}")
    print(f"Pixels : {total_pixels:,}")

    print("\nClass distribution:")

    for class_id, name in enumerate(CLASS_NAMES):
        percentage = (
            counts[class_id]
            / total_pixels
            * 100
        )

        print(
            f"{class_id} ({name:12s}): "
            f"{counts[class_id]:,} pixels "
            f"({percentage:.5f}%)"
        )


if __name__ == "__main__":
    main()