import torch
from torch.utils.data import DataLoader

from dataset import XBDDataset
from model import create_model
from metrics import (
    confusion_matrix,
    calculate_metrics,
)


NUM_CLASSES = 5
IMAGE_SIZE = 512
BATCH_SIZE = 2

CHECKPOINT = (
    "models/disha_unet_v3_damage_crop_10ep/"
    "best_model.pth"
)

VAL_DIR = "data/processed/xbd_disha/val"


CLASS_NAMES = [
    "background",
    "no_damage",
    "minor_damage",
    "major_damage",
    "destroyed",
]


def main():

    # --------------------------------------------------
    # Device
    # --------------------------------------------------

    device = torch.device(
        "cuda" if torch.cuda.is_available()
        else "cpu"
    )

    print("=" * 70)
    print("V3 CHECKPOINT EVALUATION")
    print("=" * 70)

    print(f"Device: {device}")

    if torch.cuda.is_available():
        print(
            f"GPU: {torch.cuda.get_device_name(0)}"
        )

    # --------------------------------------------------
    # Dataset
    # --------------------------------------------------

    print("\nLoading validation dataset...")

    dataset = XBDDataset(
        VAL_DIR,
        image_size=IMAGE_SIZE,
        train_mode=False,
    )

    loader = DataLoader(
        dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=0,
        pin_memory=torch.cuda.is_available(),
    )

    print(
        f"Validation samples: {len(dataset)}"
    )

    # --------------------------------------------------
    # Model
    # --------------------------------------------------

    print("\nCreating model...")

    model = create_model().to(device)

    print(
        f"Parameters: "
        f"{sum(p.numel() for p in model.parameters()):,}"
    )

    # --------------------------------------------------
    # Load checkpoint
    # --------------------------------------------------

    print("\nLoading checkpoint...")

    checkpoint = torch.load(
        CHECKPOINT,
        map_location=device,
    )

    print(
        f"Checkpoint: {CHECKPOINT}"
    )

    # Support both common checkpoint formats.
    if isinstance(checkpoint, dict):

        if "model_state_dict" in checkpoint:

            model.load_state_dict(
                checkpoint["model_state_dict"]
            )

            epoch = checkpoint.get(
                "epoch",
                "unknown",
            )

        elif "state_dict" in checkpoint:

            model.load_state_dict(
                checkpoint["state_dict"]
            )

            epoch = checkpoint.get(
                "epoch",
                "unknown",
            )

        else:

            # Checkpoint may itself be a state_dict.
            model.load_state_dict(
                checkpoint
            )

            epoch = "unknown"

    else:

        model.load_state_dict(
            checkpoint
        )

        epoch = "unknown"

    print(f"Epoch: {epoch}")

    model.eval()

    # --------------------------------------------------
    # Confusion matrix
    # --------------------------------------------------

    confusion = torch.zeros(
        NUM_CLASSES,
        NUM_CLASSES,
        dtype=torch.long,
    )

    # --------------------------------------------------
    # Validation
    # --------------------------------------------------

    print("\nRunning validation...")

    with torch.no_grad():

        for step, batch in enumerate(
            loader,
            start=1,
        ):

            images = batch["image"].to(
                device,
                non_blocking=True,
            )

            masks = batch["mask"].to(
                device,
                non_blocking=True,
            )

            outputs = model(images)

            predictions = torch.argmax(
                outputs,
                dim=1,
            )

            batch_confusion = confusion_matrix(
                predictions.cpu(),
                masks.cpu(),
                NUM_CLASSES,
            )

            confusion += batch_confusion

            if step % 25 == 0:
                print(
                    f"Processed "
                    f"{step}/{len(loader)} batches"
                )

    # --------------------------------------------------
    # Metrics
    # --------------------------------------------------

    results = calculate_metrics(
        confusion
    )

    print("\n")
    print("=" * 70)
    print("V3 VALIDATION RESULTS")
    print("=" * 70)

    print("\nPer-class metrics:")

    for i, name in enumerate(
        CLASS_NAMES
    ):

        print(
            f"  {name:<15} "
            f"IoU={results['iou'][i].item():.4f} "
            f"F1={results['f1'][i].item():.4f}"
        )

    print("\n" + "-" * 70)

    print(
        f"Non-bg mIoU : "
        f"{results['non_background_miou'].item():.4f}"
    )

    print(
        f"Non-bg mF1  : "
        f"{results['non_background_mf1'].item():.4f}"
    )

    print(
        f"Damage mIoU : "
        f"{results['damage_miou'].item():.4f}"
    )

    print(
        f"Damage mF1  : "
        f"{results['damage_mf1'].item():.4f}"
    )

    # --------------------------------------------------
    # Confusion matrix
    # --------------------------------------------------

    print("\n")
    print("=" * 70)
    print("CONFUSION MATRIX")
    print("=" * 70)

    print(
        "Rows = Ground Truth"
    )

    print(
        "Columns = Prediction"
    )

    print()

    print(confusion)

    print("\nEvaluation complete!")


if __name__ == "__main__":
    main()