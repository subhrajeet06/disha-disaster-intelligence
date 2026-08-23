import torch
from torch.utils.data import DataLoader

from dataset import XBDDataset
from model import create_model
from losses import CombinedLoss


def main():
    # --------------------------------------------------
    # Device
    # --------------------------------------------------

    device = torch.device(
        "cuda" if torch.cuda.is_available() else "cpu"
    )

    print("Device:", device)

    if device.type == "cuda":
        print("GPU:", torch.cuda.get_device_name(0))

    # --------------------------------------------------
    # Dataset
    # --------------------------------------------------

    dataset = XBDDataset(
        root_dir="data/processed/xbd_disha/train",
        image_size=512,
    )

    loader = DataLoader(
        dataset,
        batch_size=2,
        shuffle=True,
        num_workers=0,
        pin_memory=True,
    )

    # --------------------------------------------------
    # Model
    # --------------------------------------------------

    model = create_model().to(device)

    # --------------------------------------------------
    # Loss
    # --------------------------------------------------

    criterion = CombinedLoss().to(device)

    # --------------------------------------------------
    # Optimizer
    # --------------------------------------------------

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=1e-4,
        weight_decay=1e-4,
    )

    # --------------------------------------------------
    # Get one REAL batch
    # --------------------------------------------------

    batch = next(iter(loader))

    images = batch["image"].to(
        device,
        non_blocking=True,
    )

    masks = batch["mask"].to(
        device,
        non_blocking=True,
    )

    print("\nReal batch:")
    print("Images:", images.shape)
    print("Masks :", masks.shape)
    print("IDs   :", batch["id"])

    # --------------------------------------------------
    # Forward pass
    # --------------------------------------------------

    optimizer.zero_grad(set_to_none=True)

    print("\nRunning forward pass...")

    predictions = model(images)

    print("Predictions:", predictions.shape)

    # --------------------------------------------------
    # Loss
    # --------------------------------------------------

    total_loss, ce_loss, dice_loss = criterion(
        predictions,
        masks,
    )

    print("\nLoss:")
    print("Total:", total_loss.item())
    print("CE   :", ce_loss.item())
    print("Dice :", dice_loss.item())

    # --------------------------------------------------
    # Backpropagation
    # --------------------------------------------------

    print("\nRunning backward pass...")

    total_loss.backward()

    # --------------------------------------------------
    # Check gradients
    # --------------------------------------------------

    gradient_count = 0
    gradient_norm = 0.0

    for parameter in model.parameters():
        if parameter.grad is not None:
            gradient_count += 1
            gradient_norm += parameter.grad.detach().norm().item()

    print("Parameters with gradients:", gradient_count)
    print("Gradient norm:", gradient_norm)

    # --------------------------------------------------
    # Optimizer update
    # --------------------------------------------------

    print("\nUpdating model weights...")

    optimizer.step()

    print("Optimizer step completed.")

    # --------------------------------------------------
    # Final checks
    # --------------------------------------------------

    assert predictions.shape == (
        2,
        5,
        512,
        512,
    )

    assert torch.isfinite(total_loss)

    assert gradient_count > 0

    print("\n" + "=" * 50)
    print("REAL TRAINING STEP PASSED!")
    print("=" * 50)


if __name__ == "__main__":
    main()