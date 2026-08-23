from pathlib import Path

import numpy as np
from PIL import Image


DATASET_ROOT = Path("data/processed/xbd_disha/train")

PRE_DIR = DATASET_ROOT / "pre"
POST_DIR = DATASET_ROOT / "post"
LABEL_DIR = DATASET_ROOT / "labels"

CLASS_NAMES = {
    0: "background",
    1: "no_damage",
    2: "minor_damage",
    3: "major_damage",
    4: "destroyed",
}


def main():
    label_files = sorted(LABEL_DIR.glob("*_label.png"))

    print(f"Found {len(label_files)} label files")

    if not label_files:
        raise RuntimeError("No label files found.")

    total_pixels = 0
    class_counts = np.zeros(5, dtype=np.int64)

    missing_pre = []
    missing_post = []

    for i, label_path in enumerate(label_files):
        sample_id = label_path.stem.replace("_label", "")

        pre_path = PRE_DIR / f"{sample_id}_pre.png"
        post_path = POST_DIR / f"{sample_id}_post.png"

        if not pre_path.exists():
            missing_pre.append(sample_id)

        if not post_path.exists():
            missing_post.append(sample_id)

        label = np.array(Image.open(label_path))

        values, counts = np.unique(label, return_counts=True)

        for value, count in zip(values, counts):
            if 0 <= value <= 4:
                class_counts[value] += count
            else:
                raise ValueError(
                    f"Unexpected class value {value} "
                    f"in {label_path}"
                )

        total_pixels += label.size

        if (i + 1) % 100 == 0:
            print(f"Processed {i + 1}/{len(label_files)}")

    print("\n" + "=" * 60)
    print("DATASET STATISTICS")
    print("=" * 60)

    print(f"Samples:       {len(label_files):,}")
    print(f"Total pixels:  {total_pixels:,}")

    print("\nClass distribution:")

    for class_id, class_name in CLASS_NAMES.items():
        count = class_counts[class_id]
        percentage = count / total_pixels * 100

        print(
            f"{class_id} ({class_name:12s}) : "
            f"{count:>15,} pixels "
            f"({percentage:8.4f}%)"
        )

    print("\n" + "=" * 60)
    print("PAIRING CHECK")
    print("=" * 60)

    print(f"Missing pre images : {len(missing_pre)}")
    print(f"Missing post images: {len(missing_post)}")

    if missing_pre:
        print("\nFirst missing pre images:")
        print(missing_pre[:10])

    if missing_post:
        print("\nFirst missing post images:")
        print(missing_post[:10])


if __name__ == "__main__":
    main()