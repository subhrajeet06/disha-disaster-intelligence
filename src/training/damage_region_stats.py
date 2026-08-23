from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(
    "data/processed/xbd_disha/train/labels"
)


def percentile(values, p):
    if not values:
        return 0.0

    return float(
        np.percentile(
            np.asarray(values),
            p,
        )
    )


def main():
    files = sorted(ROOT.glob("*.png"))

    total_images = len(files)

    damage_pixels = []
    damage_percentages = []

    minor_pixels = []
    major_pixels = []
    destroyed_pixels = []

    for index, path in enumerate(files, start=1):

        mask = np.array(
            Image.open(path)
        )

        total = mask.size

        minor_count = np.sum(mask == 2)
        major_count = np.sum(mask == 3)
        destroyed_count = np.sum(mask == 4)

        damage_count = (
            minor_count
            + major_count
            + destroyed_count
        )

        if damage_count > 0:
            damage_pixels.append(
                int(damage_count)
            )

            damage_percentages.append(
                damage_count / total * 100
            )

        if minor_count > 0:
            minor_pixels.append(
                int(minor_count)
            )

        if major_count > 0:
            major_pixels.append(
                int(major_count)
            )

        if destroyed_count > 0:
            destroyed_pixels.append(
                int(destroyed_count)
            )

        if index % 200 == 0:
            print(
                f"Processed {index}/{total_images}"
            )

    print("\n" + "=" * 65)
    print("DAMAGE REGION STATISTICS")
    print("=" * 65)

    print(
        f"Total images: {total_images}"
    )

    print(
        f"Images containing damage: "
        f"{len(damage_pixels)}"
    )

    print("\nDamage pixels per damaged image:")

    print(
        f"Min    : "
        f"{min(damage_pixels):,}"
    )

    print(
        f"P25    : "
        f"{percentile(damage_pixels, 25):,.0f}"
    )

    print(
        f"Median : "
        f"{percentile(damage_pixels, 50):,.0f}"
    )

    print(
        f"P75    : "
        f"{percentile(damage_pixels, 75):,.0f}"
    )

    print(
        f"P90    : "
        f"{percentile(damage_pixels, 90):,.0f}"
    )

    print(
        f"P95    : "
        f"{percentile(damage_pixels, 95):,.0f}"
    )

    print(
        f"Max    : "
        f"{max(damage_pixels):,}"
    )

    print("\nDamage percentage per damaged image:")

    print(
        f"Min    : "
        f"{min(damage_percentages):.4f}%"
    )

    print(
        f"Median : "
        f"{percentile(damage_percentages, 50):.4f}%"
    )

    print(
        f"P75    : "
        f"{percentile(damage_percentages, 75):.4f}%"
    )

    print(
        f"P90    : "
        f"{percentile(damage_percentages, 90):.4f}%"
    )

    print(
        f"P95    : "
        f"{percentile(damage_percentages, 95):.4f}%"
    )

    print(
        f"Max    : "
        f"{max(damage_percentages):.4f}%"
    )

    print("\nPer-class pixel counts:")

    for name, values in [
        ("minor_damage", minor_pixels),
        ("major_damage", major_pixels),
        ("destroyed", destroyed_pixels),
    ]:

        print(
            f"\n{name}"
        )

        print(
            f"  Images: {len(values)}"
        )

        print(
            f"  Median pixels: "
            f"{percentile(values, 50):,.0f}"
        )

        print(
            f"  P90 pixels: "
            f"{percentile(values, 90):,.0f}"
        )

        print(
            f"  Max pixels: "
            f"{max(values):,}"
        )


if __name__ == "__main__":
    main()