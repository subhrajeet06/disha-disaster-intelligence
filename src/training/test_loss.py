import torch

from losses_v4 import CombinedLossV4


def main():
    device = torch.device(
        "cuda" if torch.cuda.is_available() else "cpu"
    )

    criterion = CombinedLossV4().to(device)

    # Simulated model output
    predictions = torch.randn(
        2,
        5,
        512,
        512,
        device=device,
    )

    # Simulated ground-truth mask
    targets = torch.randint(
        0,
        5,
        (2, 512, 512),
        device=device,
    )

    total_loss, ce_loss, dice_loss = criterion(
        predictions,
        targets,
    )

    print("Device:", device)

    print("\nLoss values:")
    print("Total:", total_loss.item())
    print("CE:", ce_loss.item())
    print("Dice:", dice_loss.item())

    assert torch.isfinite(total_loss)
    assert torch.isfinite(ce_loss)
    assert torch.isfinite(dice_loss)

    print("\nLoss test PASSED!")


if __name__ == "__main__":
    main()