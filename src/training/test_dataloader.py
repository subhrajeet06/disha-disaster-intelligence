import torch
from torch.utils.data import DataLoader

from dataset import XBDDataset


def main():
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

    batch = next(iter(loader))

    images = batch["image"]
    masks = batch["mask"]
    sample_ids = batch["id"]

    print("Batch verification")
    print("=" * 40)

    print("Images:")
    print("  Shape:", images.shape)
    print("  Dtype:", images.dtype)
    print("  Device:", images.device)

    print("\nMasks:")
    print("  Shape:", masks.shape)
    print("  Dtype:", masks.dtype)
    print("  Device:", masks.device)

    print("\nSample IDs:")
    print(" ", sample_ids)

    print("\nMask classes:")
    print(" ", torch.unique(masks))

    print("\nMoving batch to GPU...")

    if torch.cuda.is_available():
        images = images.cuda()
        masks = masks.cuda()

        print("GPU:", torch.cuda.get_device_name(0))
        print("Images device:", images.device)
        print("Masks device:", masks.device)

    else:
        print("CUDA is not available.")

    assert images.shape == (2, 6, 512, 512)
    assert masks.shape == (2, 512, 512)
    assert images.dtype == torch.float32
    assert masks.dtype == torch.int64

    print("\nDataLoader test PASSED!")


if __name__ == "__main__":
    main()