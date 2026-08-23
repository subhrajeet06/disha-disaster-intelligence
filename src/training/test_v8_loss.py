"""
V8 Loss Sanity Test

Verifies:
    - Loss returns a finite scalar
    - No NaN
    - No Inf
    - Backward pass works
    - Gradients are created
    - Prediction shape is [B, 5, 512, 512]
    - Mask shape is [B, 512, 512]
"""

import torch

from losses_v8 import CombinedLossV8


def main():
    device = torch.device(
        "cuda" if torch.cuda.is_available() else "cpu"
    )

    print("Device:", device)

    criterion = CombinedLossV8().to(device)

    # --------------------------------------------------
    # Simulated model output
    # Expected shape: [B, 5, 512, 512]
    # --------------------------------------------------

    predictions = torch.randn(
        2,
        5,
        512,
        512,
        device=device,
        requires_grad=True,
    )

    # --------------------------------------------------
    # Simulated ground-truth mask
    # Expected shape: [B, 512, 512]
    # --------------------------------------------------

    targets = torch.randint(
        0,
        5,
        (2, 512, 512),
        device=device,
    )

    print(
        "\nPrediction shape:",
        predictions.shape,
    )

    print("Mask shape:", targets.shape)

    # --------------------------------------------------
    # Forward pass
    # --------------------------------------------------

    total_loss, ce_loss, lovasz_loss = criterion(
        predictions,
        targets,
    )

    print("\nLoss values:")
    print(f"  Total:   {total_loss.item():.6f}")
    print(f"  CE:      {ce_loss.item():.6f}")
    print(f"  Lovasz:  {lovasz_loss.item():.6f}")

    # --------------------------------------------------
    # Verify finite values
    # --------------------------------------------------

    assert torch.isfinite(total_loss), (
        f"Total loss is not finite: {total_loss.item()}"
    )

    assert torch.isfinite(ce_loss), (
        f"CE loss is not finite: {ce_loss.item()}"
    )

    assert torch.isfinite(lovasz_loss), (
        f"Lovasz loss is not finite: "
        f"{lovasz_loss.item()}"
    )

    assert not torch.isnan(total_loss), (
        "Total loss is NaN"
    )

    assert not torch.isinf(total_loss), (
        "Total loss is Inf"
    )

    print("\n[PASS] All loss values are finite")

    # --------------------------------------------------
    # Backward pass
    # --------------------------------------------------

    total_loss.backward()

    assert predictions.grad is not None, (
        "No gradients created"
    )

    assert torch.isfinite(predictions.grad).all(), (
        "Gradients contain NaN or Inf"
    )

    print("[PASS] Backward pass successful")
    print("[PASS] Gradients created")

    # --------------------------------------------------
    # Shape verification
    # --------------------------------------------------

    assert predictions.shape == (2, 5, 512, 512), (
        f"Wrong prediction shape: {predictions.shape}"
    )

    assert targets.shape == (2, 512, 512), (
        f"Wrong mask shape: {targets.shape}"
    )

    print("[PASS] Shapes correct")

    print("\nV8 Loss test PASSED!")


if __name__ == "__main__":
    main()
