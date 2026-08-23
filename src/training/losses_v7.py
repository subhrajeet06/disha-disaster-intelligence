"""
V7 Loss: Weighted Cross Entropy + Damage-focused Tversky

Purpose:
    Test whether a damage-focused overlap loss combined with
    the proven V3 moderate damage-aware sampling strategy
    improves actual damage segmentation.

Components:
    1. Weighted Cross Entropy (all 5 classes)
    2. Damage-focused Tversky (classes 2, 3, 4 ONLY)

Total Loss = 0.5 * Weighted CE + 0.5 * Damage Tversky

Tversky parameters:
    alpha = 0.3  (FP weight — lower)
    beta  = 0.7  (FN weight — higher)

    This intentionally penalizes false negatives more strongly
    because the current model misses small damage regions.

    Tversky = TP / (TP + alpha * FP + beta * FN)
    Tversky Loss = 1 - mean(Tversky over damage classes)

Class weights for CE:
    background   = 0.05
    no_damage    = 0.50
    minor_damage = 2.0
    major_damage = 2.0
    destroyed    = 4.0
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# Damage classes only: minor_damage, major_damage, destroyed
DAMAGE_CLASSES = (2, 3, 4)


def create_v7_class_weights():
    """
    Moderate class weights for V7 weighted cross entropy.

    These weights prevent the model from ignoring rare damage
    classes without completely dominating training with them.
    """

    weights = torch.tensor(
        [
            0.05,  # background
            0.50,  # no_damage
            2.00,  # minor_damage
            2.00,  # major_damage
            4.00,  # destroyed
        ],
        dtype=torch.float32,
    )

    return weights


class DamageTverskyLoss(nn.Module):
    """
    Numerically stable Tversky-style loss focused ONLY on
    damage classes (2 = minor_damage, 3 = major_damage,
    4 = destroyed).

    Does NOT include background (0) or no_damage (1).

    Parameters:
        alpha: weight for false positives (0.3)
        beta:  weight for false negatives (0.7)
        epsilon: numerical stability term

    Why alpha=0.3, beta=0.7:
        The current model misses small damage regions
        (high false negatives). By weighting FN more heavily,
        we encourage the model to recover those regions.
    """

    def __init__(
        self,
        alpha=0.3,
        beta=0.7,
        epsilon=1e-6,
    ):
        super().__init__()

        self.alpha = alpha
        self.beta = beta
        self.epsilon = epsilon

        # Only classes 2, 3, 4 are included
        self.damage_classes = DAMAGE_CLASSES

    def forward(self, predictions, targets):
        """
        Args:
            predictions: [B, 5, H, W] raw logits
            targets:     [B, H, W] class indices (0-4)

        Returns:
            Scalar Tversky loss averaged over damage classes.
        """

        num_classes = predictions.shape[1]
        batch_size = predictions.shape[0]

        # Softmax probabilities
        probs = F.softmax(predictions, dim=1)

        # One-hot encoded targets: [B, 5, H, W]
        one_hot = F.one_hot(
            targets.long(),
            num_classes=num_classes,
        )

        # [B, H, W, 5] -> [B, 5, H, W]
        one_hot = one_hot.permute(0, 3, 1, 2).float()

        tversky_scores = []

        for class_id in self.damage_classes:
            # Extract probability and ground truth
            # for this damage class
            p = probs[:, class_id]       # [B, H, W]
            g = one_hot[:, class_id]     # [B, H, W]

            # Flatten spatial dimensions
            p_flat = p.reshape(batch_size, -1)  # [B, N]
            g_flat = g.reshape(batch_size, -1)  # [B, N]

            # True positives, false positives, false negatives
            tp = (p_flat * g_flat).sum(dim=1)
            fp = (p_flat * (1 - g_flat)).sum(dim=1)
            fn = ((1 - p_flat) * g_flat).sum(dim=1)

            # Tversky index per sample
            tversky = tp / (
                tp
                + self.alpha * fp
                + self.beta * fn
                + self.epsilon
            )

            # Average over batch
            tversky_scores.append(tversky.mean())

        # Mean Tversky over damage classes (2, 3, 4)
        mean_tversky = torch.stack(tversky_scores).mean()

        # Tversky loss = 1 - mean(Tversky)
        return 1.0 - mean_tversky


class CombinedLossV7(nn.Module):
    """
    V7 Combined Loss:
        Total = 0.5 * Weighted CE + 0.5 * Damage Tversky

    The Weighted CE operates on all 5 classes.
    The Damage Tversky operates ONLY on classes 2, 3, 4.
    """

    def __init__(self):
        super().__init__()

        weights = create_v7_class_weights()

        self.register_buffer(
            "class_weights",
            weights,
        )

        self.ce = nn.CrossEntropyLoss(
            weight=self.class_weights,
        )

        self.tversky = DamageTverskyLoss(
            alpha=0.3,
            beta=0.7,
        )

    def forward(self, predictions, targets):
        ce_loss = self.ce(
            predictions,
            targets,
        )

        tversky_loss = self.tversky(
            predictions,
            targets,
        )

        total_loss = (
            0.5 * ce_loss
            + 0.5 * tversky_loss
        )

        return total_loss, ce_loss, tversky_loss
