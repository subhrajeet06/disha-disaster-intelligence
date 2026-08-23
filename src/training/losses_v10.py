"""
DISHA V10 Loss: Focal Cross Entropy + Damage-focused Tversky

Components:
    1. Focal Cross Entropy  — hard pixel mining, minority class emphasis
    2. Damage Tversky Loss  — overlap loss on classes 2,3,4 only
                             alpha=0.3 (FP), beta=0.7 (FN)
                             Penalizes false negatives strongly.

Total Loss = focal_weight * FocalCE + tversky_weight * DamageTversky

Design rationale:
    - Focal loss reduces the gradient contribution of easy (background)
      pixels, letting the optimizer focus on hard minority-class pixels.
    - Tversky with high beta (0.7) penalizes the model for MISSING damage
      regions, combating the skip-to-background failure mode seen in V9.
    - Dice was removed because it does not discriminate by class severity.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ─────────────────────────────────────────────────────────────────────────────
# Focal Cross Entropy
# ─────────────────────────────────────────────────────────────────────────────

class FocalCELoss(nn.Module):
    """
    Numerically stable Focal Cross Entropy for multi-class segmentation.

    Reduces the loss contribution of easily classified pixels,
    forcing the optimizer to focus on hard/rare samples.

    Args:
        gamma:         focusing exponent (2.0 recommended)
        class_weights: optional tensor [num_classes] for per-class scaling
        reduction:     'mean' | 'sum' | 'none'
    """

    def __init__(
        self,
        gamma: float = 2.0,
        class_weights: torch.Tensor | None = None,
        reduction: str = "mean",
    ):
        super().__init__()
        self.gamma = gamma
        self.reduction = reduction

        if class_weights is not None:
            self.register_buffer("class_weights", class_weights)
        else:
            self.class_weights = None

    def forward(
        self,
        predictions: torch.Tensor,   # [B, C, H, W] raw logits
        targets: torch.Tensor,        # [B, H, W] class indices
    ) -> torch.Tensor:

        # Standard CE per pixel — no reduction yet
        # Shape: [B, H, W]
        ce = F.cross_entropy(
            predictions,
            targets,
            weight=self.class_weights,
            reduction="none",
        )

        # p_t = exp(-ce)  = probability of correct class
        pt = torch.exp(-ce)

        # Focal weight: down-weight easy pixels
        focal_weight = (1.0 - pt) ** self.gamma

        focal_loss = focal_weight * ce

        if self.reduction == "mean":
            return focal_loss.mean()
        elif self.reduction == "sum":
            return focal_loss.sum()
        return focal_loss


# ─────────────────────────────────────────────────────────────────────────────
# Damage Tversky Loss
# ─────────────────────────────────────────────────────────────────────────────

class DamageTverskyLoss(nn.Module):
    """
    Tversky overlap loss applied ONLY to damage classes (2, 3, 4).

    Args:
        alpha:   FP weight  (0.3 → lighter FP penalty)
        beta:    FN weight  (0.7 → stronger FN penalty, recovers missed damage)
        epsilon: numerical stability
    """

    DAMAGE_CLASSES = (2, 3, 4)

    def __init__(
        self,
        alpha: float = 0.3,
        beta: float = 0.7,
        epsilon: float = 1e-6,
    ):
        super().__init__()
        self.alpha = alpha
        self.beta = beta
        self.epsilon = epsilon

    def forward(
        self,
        predictions: torch.Tensor,   # [B, C, H, W]
        targets: torch.Tensor,        # [B, H, W]
    ) -> torch.Tensor:

        num_classes = predictions.shape[1]
        B = predictions.shape[0]

        probs = F.softmax(predictions, dim=1)   # [B, C, H, W]

        one_hot = F.one_hot(
            targets.long(),
            num_classes=num_classes,
        )  # [B, H, W, C]

        one_hot = one_hot.permute(0, 3, 1, 2).float()  # [B, C, H, W]

        tversky_scores = []

        for c in self.DAMAGE_CLASSES:
            p = probs[:, c].reshape(B, -1)       # [B, N]
            g = one_hot[:, c].reshape(B, -1)     # [B, N]

            tp = (p * g).sum(dim=1)
            fp = (p * (1.0 - g)).sum(dim=1)
            fn = ((1.0 - p) * g).sum(dim=1)

            tversky = tp / (
                tp
                + self.alpha * fp
                + self.beta * fn
                + self.epsilon
            )

            tversky_scores.append(tversky.mean())

        mean_tversky = torch.stack(tversky_scores).mean()
        return 1.0 - mean_tversky


# ─────────────────────────────────────────────────────────────────────────────
# Combined V10 Loss
# ─────────────────────────────────────────────────────────────────────────────

class CombinedLossV10(nn.Module):
    """
    V10 Combined Loss:

        total = focal_weight * FocalCE + tversky_weight * DamageTversky

    Args:
        class_weights:   tensor [5] for per-class CE scaling
        focal_gamma:     Focal focusing exponent (default 2.0)
        focal_weight:    scalar weight for focal CE term (default 0.4)
        tversky_weight:  scalar weight for Tversky term (default 0.6)
        tversky_alpha:   FP weight in Tversky (default 0.3)
        tversky_beta:    FN weight in Tversky (default 0.7)
    """

    def __init__(
        self,
        class_weights: torch.Tensor | None = None,
        focal_gamma: float = 2.0,
        focal_weight: float = 0.40,
        tversky_weight: float = 0.60,
        tversky_alpha: float = 0.30,
        tversky_beta: float = 0.70,
    ):
        super().__init__()

        self.focal_weight = focal_weight
        self.tversky_weight = tversky_weight

        if class_weights is not None:
            self.register_buffer("class_weights", class_weights)
        else:
            self.class_weights = None

        self.focal = FocalCELoss(
            gamma=focal_gamma,
            class_weights=self.class_weights,
        )

        self.tversky = DamageTverskyLoss(
            alpha=tversky_alpha,
            beta=tversky_beta,
        )

    def forward(
        self,
        predictions: torch.Tensor,
        targets: torch.Tensor,
    ):
        focal_loss = self.focal(predictions, targets)
        tversky_loss = self.tversky(predictions, targets)

        total = (
            self.focal_weight * focal_loss
            + self.tversky_weight * tversky_loss
        )

        return total, focal_loss, tversky_loss
