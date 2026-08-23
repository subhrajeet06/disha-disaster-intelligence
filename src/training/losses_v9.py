import torch
import torch.nn as nn
import torch.nn.functional as F
import segmentation_models_pytorch as smp

def create_v9_class_weights():
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

class CombinedLossV9(nn.Module):
    def __init__(self, hard_ratio=0.20, damage_ratio=0.70):
        super().__init__()
        weights = create_v9_class_weights()
        self.register_buffer("class_weights", weights)
        
        self.dice = smp.losses.DiceLoss(
            mode="multiclass",
            from_logits=True,
            classes=5,
        )
        
        self.hard_ratio = hard_ratio
        self.damage_ratio = damage_ratio
        
        # Diagnostic tracking
        self.last_diagnostics = {
            "selected_damage": 0,
            "selected_non_damage": 0,
            "selected_minor": 0,
            "selected_major": 0,
            "selected_destroyed": 0,
        }

    def forward(self, predictions, targets):
        # 1. Pixel-wise Cross Entropy
        # reduction='none' yields loss of shape [B, H, W]
        ce_loss_map = F.cross_entropy(
            predictions, 
            targets, 
            weight=self.class_weights, 
            reduction='none'
        )
        
        B, H, W = targets.shape
        num_pixels = B * H * W
        
        # Flatten tensors
        ce_loss_flat = ce_loss_map.view(-1)
        targets_flat = targets.view(-1)
        
        # 2. Damage-Aware OHEM Selection
        damage_mask = (targets_flat == 2) | (targets_flat == 3) | (targets_flat == 4)
        non_damage_mask = (targets_flat == 0) | (targets_flat == 1)
        
        damage_losses = ce_loss_flat[damage_mask]
        non_damage_losses = ce_loss_flat[non_damage_mask]
        
        damage_targets = targets_flat[damage_mask]
        
        num_hard_total = int(num_pixels * self.hard_ratio)
        target_hard_damage = int(num_hard_total * self.damage_ratio)
        target_hard_non_damage = num_hard_total - target_hard_damage
        
        selected_losses = []
        
        # Select damage pixels
        if len(damage_losses) > 0:
            k_damage = min(target_hard_damage, len(damage_losses))
            topk_damage_losses, topk_damage_idx = torch.topk(damage_losses, k_damage)
            selected_losses.append(topk_damage_losses)
            
            # Diagnostics
            selected_damage_targets = damage_targets[topk_damage_idx]
            self.last_diagnostics["selected_damage"] = k_damage
            self.last_diagnostics["selected_minor"] = (selected_damage_targets == 2).sum().item()
            self.last_diagnostics["selected_major"] = (selected_damage_targets == 3).sum().item()
            self.last_diagnostics["selected_destroyed"] = (selected_damage_targets == 4).sum().item()
            
            # Re-adjust non_damage requirement if damage was insufficient
            if k_damage < target_hard_damage:
                target_hard_non_damage += (target_hard_damage - k_damage)
        else:
            target_hard_non_damage = num_hard_total
            self.last_diagnostics["selected_damage"] = 0
            self.last_diagnostics["selected_minor"] = 0
            self.last_diagnostics["selected_major"] = 0
            self.last_diagnostics["selected_destroyed"] = 0
            
        # Select non-damage pixels
        if len(non_damage_losses) > 0:
            k_non_damage = min(target_hard_non_damage, len(non_damage_losses))
            topk_non_damage_losses, _ = torch.topk(non_damage_losses, k_non_damage)
            selected_losses.append(topk_non_damage_losses)
            self.last_diagnostics["selected_non_damage"] = k_non_damage
        else:
            self.last_diagnostics["selected_non_damage"] = 0
            
        if len(selected_losses) > 0:
            ohem_ce_loss = torch.cat(selected_losses).mean()
        else:
            # Fallback
            ohem_ce_loss = ce_loss_flat.mean()
            
        # 3. Dice Loss
        dice_loss = self.dice(predictions, targets)
        
        # 4. Total Loss
        total_loss = 0.5 * ohem_ce_loss + 0.5 * dice_loss
        
        return total_loss, ohem_ce_loss, dice_loss
