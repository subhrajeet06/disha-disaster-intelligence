import torch
import torch.nn as nn
import segmentation_models_pytorch as smp


def create_class_weights():
    """
    Moderated class weights for the highly imbalanced
    xBD damage segmentation problem.

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
            4.00,  # destroyed
        ],
        dtype=torch.float32,
    )

    return weights


class CombinedLoss(nn.Module):
    def __init__(self):
        super().__init__()

        weights = create_class_weights()

        self.register_buffer(
            "class_weights",
            weights,
        )

        self.ce = nn.CrossEntropyLoss(
            weight=self.class_weights
        )

        self.dice = smp.losses.DiceLoss(
            mode="multiclass",
            from_logits=True,
            classes=5,
        )

    def forward(self, predictions, targets):
        ce_loss = self.ce(
            predictions,
            targets,
        )

        dice_loss = self.dice(
            predictions,
            targets,
        )

        total_loss = (
            0.5 * ce_loss
            + 0.5 * dice_loss
        )

        return total_loss, ce_loss, dice_loss