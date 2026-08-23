import matplotlib.pyplot as plt
import numpy as np

from dataset import XBDDataset


def main():
    dataset = XBDDataset(
        root_dir="data/processed/xbd_disha/train",
        image_size=512,
        train_mode=True,
    )

    sample = dataset[0]

    image = sample["image"]
    mask = sample["mask"]
    sample_id = sample["id"]

    pre = image[:3].permute(1, 2, 0).numpy()
    post = image[3:].permute(1, 2, 0).numpy()
    mask = mask.numpy()

    print("Sample:", sample_id)
    print("Image shape:", image.shape)
    print("Mask shape:", mask.shape)
    print("Mask classes:", np.unique(mask))

    plt.figure(figsize=(16, 4))

    plt.subplot(1, 3, 1)
    plt.imshow(pre)
    plt.title("Pre-disaster crop")
    plt.axis("off")

    plt.subplot(1, 3, 2)
    plt.imshow(post)
    plt.title("Post-disaster crop")
    plt.axis("off")

    plt.subplot(1, 3, 3)
    plt.imshow(mask)
    plt.title("Ground Truth crop")
    plt.axis("off")

    plt.tight_layout()

    output = (
        "models/disha_unet_v3_damage_crop/"
        "training_crop_visualization.png"
    )

    plt.savefig(
        output,
        dpi=150,
        bbox_inches="tight",
    )

    print(
        f"\nSaved visualization to: {output}"
    )

    plt.show()


if __name__ == "__main__":
    main()