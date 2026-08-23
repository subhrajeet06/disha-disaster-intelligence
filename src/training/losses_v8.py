"""
V8 Loss: Weighted Cross Entropy + Lovász-Softmax

Purpose:
    Test whether directly optimizing for the mIoU metric using Lovász-Softmax 
    improves actual damage segmentation, while returning to the proven V3 
    moderate class weights to prevent background collapse.

Components:
    1. Weighted Cross Entropy (all 5 classes)
    2. Lovász-Softmax (all 5 classes)

Total Loss = 0.5 * Weighted CE + 0.5 * Lovász-Softmax

Class weights for CE:
    background   = 0.25
    no_damage    = 1.00
    minor_damage = 2.0
    major_damage = 2.0
    destroyed    = 4.0
"""

import torch
import torch.nn as nn
import segmentation_models_pytorch as smp


def create_v8_class_weights():
    """
    V3-style moderate class weights for V8 weighted cross entropy.
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


class CombinedLossV8(nn.Module):
    """
    V8 Combined Loss:
        Total = 0.5 * Weighted CE + 0.5 * Lovász-Softmax

    Both components operate on all 5 classes.
    """

    def __init__(self):
        super().__init__()

        weights = create_v8_class_weights()

        self.register_buffer(
            "class_weights",
            weights,
        )

        self.ce = nn.CrossEntropyLoss(
            weight=self.class_weights,
        )

        self.lovasz = smp.losses.LovaszLoss(
            mode="multiclass",
            from_logits=True,
        )

    def forward(self, predictions, targets):
        ce_loss = self.ce(
            predictions,
            targets,
        )

        lovasz_loss = self.lovasz(
            predictions,
            targets,
        )

        total_loss = (
            0.5 * ce_loss
            + 0.5 * lovasz_loss
        )

        return total_loss, ce_loss, lovasz_loss
