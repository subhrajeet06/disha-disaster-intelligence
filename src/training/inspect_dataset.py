from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
from PIL import Image


DATASET_ROOT = Path("data/processed/xbd_disha/train")

PRE_DIR = DATASET_ROOT / "pre"
POST_DIR = DATASET_ROOT / "post"
LABEL_DIR = DATASET_ROOT / "labels"


def load_sample(sample_id: str):
    pre_path = PRE_DIR / f"{sample_id}_pre.png"
    post_path = POST_DIR / f"{sample_id}_post.png"
    label_path = LABEL_DIR / f"{sample_id}_label.png"

    if not pre_path.exists():
        raise FileNotFoundError(f"Missing pre image: {pre_path}")

    if not post_path.exists():
        raise FileNotFoundError(f"Missing post image: {post_path}")

    if not label_path.exists():
        raise FileNotFoundError(f"Missing label: {label_path}")

    pre = np.array(Image.open(pre_path).convert("RGB"))
    post = np.array(Image.open(post_path).convert("RGB"))
    label = np.array(Image.open(label_path))

    return pre, post, label


def main():
    sample_id = "sample_000000"

    pre, post, label = load_sample(sample_id)

    print("Sample:", sample_id)
    print("Pre shape:", pre.shape)
    print("Post shape:", post.shape)
    print("Label shape:", label.shape)
    print("Pre dtype:", pre.dtype)
    print("Post dtype:", post.dtype)
    print("Label dtype:", label.dtype)
    print("Label classes:", np.unique(label))

    class_names = {
        0: "background",
        1: "no_damage",
        2: "minor_damage",
        3: "major_damage",
        4: "destroyed",
    }

    print("\nPixel counts:")
    for class_id, class_name in class_names.items():
        count = int(np.sum(label == class_id))
        percentage = count / label.size * 100
        print(
            f"{class_id} ({class_name:12s}): "
            f"{count:>8,} pixels ({percentage:6.2f}%)"
        )

    fig, axes = plt.subplots(1, 3, figsize=(18, 6))

    axes[0].imshow(pre)
    axes[0].set_title("Pre-disaster")
    axes[0].axis("off")

    axes[1].imshow(post)
    axes[1].set_title("Post-disaster")
    axes[1].axis("off")

    axes[2].imshow(label, vmin=0, vmax=4)
    axes[2].set_title("Ground Truth Mask")
    axes[2].axis("off")

    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()