from dataset import XBDDataset
import numpy as np


def main():
    dataset = XBDDataset(
        "data/processed/xbd_disha/train",
        image_size=512,
        train_mode=True,
    )

    print("=" * 60)
    print("V6 DAMAGE CROP VERIFICATION")
    print("=" * 60)

    print(f"Dataset size: {len(dataset)}")

    total = 100
    damage_crops = 0

    class_counts = {
        2: 0,
        3: 0,
        4: 0,
    }

    for i in range(total):
        sample = dataset[0]

        mask = sample["mask"].numpy()
        classes = np.unique(mask)

        if i < 10:
            print(
                f"Crop {i + 1:03d}: "
                f"classes = {classes.tolist()}"
            )

        for class_id in [2, 3, 4]:
            if class_id in classes:
                class_counts[class_id] += 1

        if any(
            class_id in classes
            for class_id in [2, 3, 4]
        ):
            damage_crops += 1

    print()
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)

    print(
        f"Damage-containing crops: "
        f"{damage_crops}/{total} "
        f"({damage_crops / total * 100:.1f}%)"
    )

    print()
    print("Class presence:")

    for class_id, count in class_counts.items():
        print(
            f"  {class_id}: {count}/{total} "
            f"({count / total * 100:.1f}%)"
        )


if __name__ == "__main__":
    main()