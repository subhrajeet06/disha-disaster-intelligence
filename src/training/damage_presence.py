from pathlib import Path

import numpy as np
from PIL import Image


def analyze(split):
    label_dir = Path(
        f"data/processed/xbd_disha/{split}/labels"
    )

    files = sorted(label_dir.glob("*.png"))

    any_damage = 0
    minor = 0
    major = 0
    destroyed = 0
    no_damage_only = 0

    for path in files:
        mask = np.array(Image.open(path))

        has_minor = np.any(mask == 2)
        has_major = np.any(mask == 3)
        has_destroyed = np.any(mask == 4)

        has_any_damage = (
            has_minor
            or has_major
            or has_destroyed
        )

        if has_any_damage:
            any_damage += 1
        else:
            no_damage_only += 1

        if has_minor:
            minor += 1

        if has_major:
            major += 1

        if has_destroyed:
            destroyed += 1

    total = len(files)

    print("\n" + "=" * 60)
    print(f"{split.upper()} DAMAGE PRESENCE")
    print("=" * 60)

    print(f"Total images       : {total}")

    print(
        f"Any damage         : {any_damage} "
        f"({any_damage / total * 100:.2f}%)"
    )

    print(
        f"No damage only     : {no_damage_only} "
        f"({no_damage_only / total * 100:.2f}%)"
    )

    print(
        f"Minor damage       : {minor} "
        f"({minor / total * 100:.2f}%)"
    )

    print(
        f"Major damage       : {major} "
        f"({major / total * 100:.2f}%)"
    )

    print(
        f"Destroyed          : {destroyed} "
        f"({destroyed / total * 100:.2f}%)"
    )


def main():
    analyze("train")
    analyze("val")
    analyze("test")


if __name__ == "__main__":
    main()