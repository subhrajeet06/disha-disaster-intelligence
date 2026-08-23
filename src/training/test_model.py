import torch

from model import create_model


def main():
    device = torch.device(
        "cuda" if torch.cuda.is_available() else "cpu"
    )

    print("Device:", device)

    model = create_model()
    model = model.to(device)

    print("\nModel created successfully.")
    print("Parameters:", sum(p.numel() for p in model.parameters()))

    # Test input
    x = torch.randn(
        2,
        6,
        512,
        512,
        device=device,
    )

    print("\nInput:")
    print("Shape:", x.shape)
    print("Device:", x.device)

    print("\nRunning forward pass...")

    with torch.no_grad():
        output = model(x)

    print("\nOutput:")
    print("Shape:", output.shape)
    print("Device:", output.device)

    assert output.shape == (2, 5, 512, 512)

    print("\nModel test PASSED!")


if __name__ == "__main__":
    main()