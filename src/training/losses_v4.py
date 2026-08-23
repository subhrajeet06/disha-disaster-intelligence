import torch
import torch.nn as nn
import segmentation_models_pytorch as smp


def create_class_weights():
    """
    V4 class weights.

    Classes:
        0 = background
        1 = no_damage
        2 = minor_damage
        3 = major_damage
        4 = destroyed
    """

    weights = torch.tensor(
        [
            0.25,  # background
            1.00,  # no_damage
            2.00,  # minor_damage
            2.00,  # major_damage
            3.00,  # destroyed
        ],
        dtype=torch.float32,
    )

    return weights


class FocalCrossEntropy(nn.Module):
    def __init__(
        self,
        weight=None,
        gamma=2.0,
    ):
        super().__init__()

        self.gamma = gamma

        self.register_buffer(
            "weight",
            weight,
        )

    def forward(self, predictions, targets):
        ce = nn.functional.cross_entropy(
            predictions,
            targets,
            weight=self.weight,
            reduction="none",
        )

        pt = torch.exp(-ce)

        focal_loss = (
            (1.0 - pt) ** self.gamma
            * ce
        )

        return focal_loss.mean()


class CombinedLossV4(nn.Module):
    def __init__(self):
        super().__init__()

        weights = create_class_weights()

        self.register_buffer(
            "class_weights",
            weights,
        )

        self.focal_ce = FocalCrossEntropy(
            weight=self.class_weights,
            gamma=2.0,
        )

        self.dice = smp.losses.DiceLoss(
            mode="multiclass",
            from_logits=True,
            classes=5,
        )

    def forward(self, predictions, targets):

        focal_ce_loss = self.focal_ce(
            predictions,
            targets,
        )

        dice_loss = self.dice(
            predictions,
            targets,
        )

        total_loss = (
            0.5 * focal_ce_loss
            + 0.5 * dice_loss
        )

        return (
            total_loss,
            focal_ce_loss,
            dice_loss,
        )