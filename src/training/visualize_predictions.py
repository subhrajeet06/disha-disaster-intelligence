from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
import torch
from torch.utils.data import DataLoader

from dataset import XBDDataset
from model import create_model


CLASS_NAMES = [
    "background",
    "no_damage",
    "minor_damage",
    "major_damage",
    "destroyed",
]


def main():
    device = torch.device(
        "cuda" if torch.cuda.is_available() else "cpu"
    )

    checkpoint_path = Path(
    "models/disha_unet_v3_damage_crop_10ep/best_model.pth"
    )

    # --------------------------------------------------
    # Load validation dataset
    # --------------------------------------------------

    dataset = XBDDataset(
        root_dir="data/processed/xbd_disha/val",
        image_size=512,
    )

    loader = DataLoader(
        dataset,
        batch_size=2,
        shuffle=False,
        num_workers=0,
    )

    # --------------------------------------------------
    # Load model
    # --------------------------------------------------

    model = create_model().to(device)

    checkpoint = torch.load(
        checkpoint_path,
        map_location=device,
        weights_only=False,
    )

    model.load_state_dict(
        checkpoint["model_state_dict"]
    )

    model.eval()

    print("Loaded checkpoint:")
    print("Epoch:", checkpoint["epoch"])

    # --------------------------------------------------
    # Get validation batch
    # --------------------------------------------------

    batch = next(iter(loader))

    images = batch["image"].to(device)
    masks = batch["mask"].to(device)

    # --------------------------------------------------
    # Prediction
    # --------------------------------------------------

    with torch.no_grad():
        logits = model(images)
        predictions = logits.argmax(dim=1)

    # --------------------------------------------------
    # Print prediction distribution
    # --------------------------------------------------

    print("\nPrediction distribution:")

    for class_id, class_name in enumerate(CLASS_NAMES):
        count = (
            predictions == class_id
        ).sum().item()

        percentage = (
            count / predictions.numel()
        ) * 100

        print(
            f"{class_id} ({class_name:12s}): "
            f"{count:>10,} pixels "
            f"({percentage:7.3f}%)"
        )

    print("\nGround-truth distribution:")

    for class_id, class_name in enumerate(CLASS_NAMES):
        count = (
            masks == class_id
        ).sum().item()

        percentage = (
            count / masks.numel()
        ) * 100

        print(
            f"{class_id} ({class_name:12s}): "
            f"{count:>10,} pixels "
            f"({percentage:7.3f}%)"
        )

    # --------------------------------------------------
    # Visualization
    # --------------------------------------------------

    # First sample in batch
    image = images[0].detach().cpu()

    pre = image[:3].permute(1, 2, 0).numpy()
    post = image[3:].permute(1, 2, 0).numpy()

    ground_truth = masks[0].cpu().numpy()
    prediction = predictions[0].cpu().numpy()

    fig, axes = plt.subplots(
        1,
        4,
        figsize=(20, 5),
    )

    axes[0].imshow(pre)
    axes[0].set_title("Pre-disaster")
    axes[0].axis("off")

    axes[1].imshow(post)
    axes[1].set_title("Post-disaster")
    axes[1].axis("off")

    axes[2].imshow(
        ground_truth,
        vmin=0,
        vmax=4,
    )
    axes[2].set_title("Ground Truth")
    axes[2].axis("off")

    axes[3].imshow(
        prediction,
        vmin=0,
        vmax=4,
    )
    axes[3].set_title("Prediction")
    axes[3].axis("off")

    plt.tight_layout()

    output_path = Path(
    "models/disha_unet_v3_damage_crop_10ep/"
    "prediction_visualization.png"
    )

    plt.savefig(
        output_path,
        dpi=150,
        bbox_inches="tight",
    )

    print(
        "\nVisualization saved to:",
        output_path,
    )

    plt.show()


if __name__ == "__main__":
    main()