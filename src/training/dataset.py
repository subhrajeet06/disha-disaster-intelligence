from pathlib import Path
import random

import numpy as np
import torch
from PIL import Image
from torch.utils.data import Dataset
import torchvision.transforms.functional as TF
from torchvision.transforms import InterpolationMode


class XBDDataset(Dataset):
    """
    DISHA xBD Dataset.

    Input:
        pre  : RGB pre-disaster image
        post : RGB post-disaster image

    Target:
        mask : class IDs 0-4

    Training mode:
        60% damage-aware crop
        20% random crop
        20% full-image resize

    Validation/test mode:
        Full-image resize only.
    """

    CLASS_NAMES = {
        0: "background",
        1: "no_damage",
        2: "minor_damage",
        3: "major_damage",
        4: "destroyed",
    }

    DAMAGE_CLASSES = (2, 3, 4)



    def __init__(
        self,
        root_dir,
        image_size=512,
        train_mode=False,
        damage_crop_probability=0.60,
        random_crop_probability=0.20,
    ):
        self.root_dir = Path(root_dir)

        self.pre_dir = self.root_dir / "pre"
        self.post_dir = self.root_dir / "post"
        self.label_dir = self.root_dir / "labels"

        self.image_size = image_size
        self.train_mode = train_mode

        self.damage_crop_probability = (
            damage_crop_probability
        )

        self.random_crop_probability = (
            random_crop_probability
        )

        self.label_files = sorted(
            self.label_dir.glob("*_label.png")
        )

        if not self.label_files:
            raise RuntimeError(
                f"No label files found in {self.label_dir}"
            )

        self.samples = []

        for label_path in self.label_files:
            sample_id = label_path.stem.replace(
                "_label",
                "",
            )

            pre_path = (
                self.pre_dir
                / f"{sample_id}_pre.png"
            )

            post_path = (
                self.post_dir
                / f"{sample_id}_post.png"
            )

            if not pre_path.exists():
                raise FileNotFoundError(
                    f"Missing pre image: {pre_path}"
                )

            if not post_path.exists():
                raise FileNotFoundError(
                    f"Missing post image: {post_path}"
                )

            self.samples.append(
                {
                    "id": sample_id,
                    "pre": pre_path,
                    "post": post_path,
                    "label": label_path,
                }
            )

    def __len__(self):
        return len(self.samples)

    def _full_image_resize(
        self,
        pre,
        post,
        mask,
    ):
        """
        Original DISHA behavior.

        Resize the complete 1024x1024 sample
        to image_size x image_size.
        """

        pre = TF.resize(
            pre,
            [self.image_size, self.image_size],
            interpolation=InterpolationMode.BILINEAR,
        )

        post = TF.resize(
            post,
            [self.image_size, self.image_size],
            interpolation=InterpolationMode.BILINEAR,
        )

        mask = TF.resize(
            mask,
            [self.image_size, self.image_size],
            interpolation=InterpolationMode.NEAREST,
        )

        return pre, post, mask

    def _random_crop(
        self,
        pre,
        post,
        mask,
    ):
        """
        Random spatial crop.

        The exact same crop is applied to
        pre, post and mask.
        """

        width, height = pre.size

        crop_size = self.image_size

        if (
            width < crop_size
            or height < crop_size
        ):
            return self._full_image_resize(
                pre,
                post,
                mask,
            )

        max_left = width - crop_size
        max_top = height - crop_size

        left = random.randint(
            0,
            max_left,
        )

        top = random.randint(
            0,
            max_top,
        )

        pre = TF.crop(
            pre,
            top,
            left,
            crop_size,
            crop_size,
        )

        post = TF.crop(
            post,
            top,
            left,
            crop_size,
            crop_size,
        )

        mask = TF.crop(
            mask,
            top,
            left,
            crop_size,
            crop_size,
        )

        return pre, post, mask

    def _damage_aware_crop(
        self,
        pre,
        post,
        mask,
    ):
        """
        V3-style moderate damage-aware crop.

        Select a random damage pixel from ANY of the
        damage classes (2, 3, 4) and center the crop
        around it.

        This does NOT force a custom class probability
        distribution. It simply exposes the model to
        useful damage regions.

        V6's forced class probabilities were rejected
        because they did not generalize well to full
        validation images.
        """

        width, height = pre.size
        crop_size = self.image_size

        if (
            width < crop_size
            or height < crop_size
        ):
            return self._full_image_resize(
                pre,
                post,
                mask,
            )

        mask_array = np.asarray(mask)

        # --------------------------------------------------
        # Find ALL damage pixels (classes 2, 3, 4)
        # --------------------------------------------------

        damage_mask = (
            (mask_array == 2)
            | (mask_array == 3)
            | (mask_array == 4)
        )

        damage_positions = np.argwhere(damage_mask)

        # No damage in this image.
        # Fall back to random crop.
        if len(damage_positions) == 0:
            return self._random_crop(
                pre,
                post,
                mask,
            )

        # --------------------------------------------------
        # Select a random damage pixel
        # (V3-style: no class-specific weighting)
        # --------------------------------------------------

        y, x = damage_positions[
            random.randrange(
                len(damage_positions)
            )
        ]

        # --------------------------------------------------
        # Place selected damage pixel near crop center
        # --------------------------------------------------

        half = crop_size // 2

        left = int(x) - half
        top = int(y) - half

        # Add random jitter.
        jitter = crop_size // 4

        left += random.randint(
            -jitter,
            jitter,
        )

        top += random.randint(
            -jitter,
            jitter,
        )

        # Keep crop inside image boundaries.
        left = max(
            0,
            min(
                left,
                width - crop_size,
            ),
        )

        top = max(
            0,
            min(
                top,
                height - crop_size,
            ),
        )

        # --------------------------------------------------
        # Apply identical crop
        # --------------------------------------------------

        pre = TF.crop(
            pre,
            top,
            left,
            crop_size,
            crop_size,
        )

        post = TF.crop(
            post,
            top,
            left,
            crop_size,
            crop_size,
        )

        mask = TF.crop(
            mask,
            top,
            left,
            crop_size,
            crop_size,
        )

        return pre, post, mask

    def _prepare_training_sample(
        self,
        pre,
        post,
        mask,
    ):
        """
        Select the V3 training sampling strategy.
        """

        probability = random.random()

        if (
            probability
            < self.damage_crop_probability
        ):
            return self._damage_aware_crop(
                pre,
                post,
                mask,
            )

        if (
            probability
            < (
                self.damage_crop_probability
                + self.random_crop_probability
            )
        ):
            return self._random_crop(
                pre,
                post,
                mask,
            )

        return self._full_image_resize(
            pre,
            post,
            mask,
        )

    def _apply_geometric_augmentation(
        self,
        pre,
        post,
        mask,
    ):
        """
        Apply synchronized geometric augmentation.

        The exact same transformation is applied
        to pre-disaster image, post-disaster image,
        and ground-truth mask.
        """

        # --------------------------------------------------
        # Horizontal flip
        # --------------------------------------------------

        if random.random() < 0.50:
            pre = TF.hflip(pre)
            post = TF.hflip(post)
            mask = TF.hflip(mask)

        # --------------------------------------------------
        # Vertical flip
        # --------------------------------------------------

        if random.random() < 0.50:
            pre = TF.vflip(pre)
            post = TF.vflip(post)
            mask = TF.vflip(mask)

        # --------------------------------------------------
        # Random 90-degree rotation
        # --------------------------------------------------

        rotation = random.randint(0, 3)

        if rotation > 0:
            angle = rotation * 90

            pre = TF.rotate(
                pre,
                angle,
                interpolation=InterpolationMode.BILINEAR,
            )

            post = TF.rotate(
                post,
                angle,
                interpolation=InterpolationMode.BILINEAR,
            )

            mask = TF.rotate(
                mask,
                angle,
                interpolation=InterpolationMode.NEAREST,
            )

        return pre, post, mask

    def __getitem__(self, index):
        sample = self.samples[index]

        # --------------------------------------------------
        # Load
        # --------------------------------------------------

        pre = Image.open(
            sample["pre"]
        ).convert("RGB")

        post = Image.open(
            sample["post"]
        ).convert("RGB")

        mask = Image.open(
            sample["label"]
        )

        # --------------------------------------------------
        # Training / validation behavior
        # --------------------------------------------------

        if self.train_mode:
            pre, post, mask = (
                self._prepare_training_sample(
                    pre,
                    post,
                    mask,
                )
            )

            pre, post, mask = (
                self._apply_geometric_augmentation(
                    pre,
                    post,
                    mask,
                )
            )

        else:
            pre, post, mask = (
                self._full_image_resize(
                    pre,
                    post,
                    mask,
                )
            )

        # --------------------------------------------------
        # Convert images to tensors
        # --------------------------------------------------

        pre = TF.to_tensor(pre)
        post = TF.to_tensor(post)

        # --------------------------------------------------
        # Convert mask
        # --------------------------------------------------

        mask = torch.from_numpy(
            np.array(
                mask,
                dtype=np.int64,
            )
        )

        # --------------------------------------------------
        # Concatenate pre + post
        # --------------------------------------------------

        image = torch.cat(
            [pre, post],
            dim=0,
        )

        return {
            "image": image,
            "mask": mask,
            "id": sample["id"],
        }