import torch

from dataset import XBDDataset


def main():
    dataset = XBDDataset(
        root_dir="data/processed/xbd_disha/train",
        image_size=512,
    )

    print("Dataset size:", len(dataset))

    sample = dataset[0]

    image = sample["image"]
    mask = sample["mask"]

    print("\nSample ID:", sample["id"])

    print("Image shape:", image.shape)
    print("Image dtype:", image.dtype)

    print("Mask shape:", mask.shape)
    print("Mask dtype:", mask.dtype)

    print("Image min:", image.min().item())
    print("Image max:", image.max().item())

    print("Mask unique values:", torch.unique(mask))

    assert image.shape == (6, 512, 512)
    assert mask.shape == (512, 512)
    assert image.dtype == torch.float32
    assert mask.dtype == torch.int64

    assert set(torch.unique(mask).tolist()).issubset(
        {0, 1, 2, 3, 4}
    )

    print("\nDataset test PASSED!")


if __name__ == "__main__":
    main()