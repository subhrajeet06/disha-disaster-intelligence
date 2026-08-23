import torch
from losses_v9 import CombinedLossV9

def test_v9_ohem():
    print("Testing V9 Damage-Aware OHEM Loss...")
    criterion = CombinedLossV9()
    
    # 1. Random logits & mask tests
    torch.manual_seed(42)
    predictions = torch.randn(2, 5, 8, 8, requires_grad=True)
    
    # Create targets with mostly background, some damage
    targets = torch.zeros(2, 8, 8, dtype=torch.int64)
    targets[0, 0:2, 0:2] = 2 # minor
    targets[0, 2:4, 2:4] = 3 # major
    targets[1, 0:2, 0:2] = 4 # destroyed
    
    total, ce, dice = criterion(predictions, targets)
    
    assert torch.isfinite(total), "Loss must be finite"
    assert not torch.isnan(total), "Loss must not be NaN"
    
    total.backward()
    
    assert predictions.grad is not None, "Gradients must exist"
    assert torch.isfinite(predictions.grad).all(), "Gradients must be finite"
    
    print("Diagnostics (with damage):", criterion.last_diagnostics)
    assert criterion.last_diagnostics["selected_damage"] > 0
    assert criterion.last_diagnostics["selected_non_damage"] > 0
    assert criterion.last_diagnostics["selected_minor"] > 0
    assert criterion.last_diagnostics["selected_major"] > 0
    assert criterion.last_diagnostics["selected_destroyed"] > 0
    
    # 2. Test batch without damage
    predictions_no_dmg = torch.randn(2, 5, 8, 8, requires_grad=True)
    targets_no_dmg = torch.zeros(2, 8, 8, dtype=torch.int64)
    total_no, ce_no, dice_no = criterion(predictions_no_dmg, targets_no_dmg)
    assert torch.isfinite(total_no)
    total_no.backward()
    print("Diagnostics (no damage):", criterion.last_diagnostics)
    assert criterion.last_diagnostics["selected_damage"] == 0
    assert criterion.last_diagnostics["selected_non_damage"] > 0
    
    # 3. Test batch with only one damage class
    targets_one_dmg = torch.zeros(2, 8, 8, dtype=torch.int64)
    targets_one_dmg[0, 0:2, 0:2] = 2
    total_one, ce_one, dice_one = criterion(predictions, targets_one_dmg)
    assert torch.isfinite(total_one)
    
    # 4. Sanity Test: Selection of explicitly high-loss pixels
    # Create an artificial scenario where one specific pixel has a terrible prediction
    # Predict everything as class 0 very confidently
    predictions_sanity = torch.zeros(1, 5, 4, 4, requires_grad=True)
    predictions_sanity.data[:, 0, :, :] = 10.0 
    
    targets_sanity = torch.zeros(1, 4, 4, dtype=torch.int64)
    # But one pixel is actually class 4 (destroyed)
    targets_sanity[0, 2, 2] = 4 
    
    total_sanity, ce_sanity, dice_sanity = criterion(predictions_sanity, targets_sanity)
    print("Diagnostics (sanity test):", criterion.last_diagnostics)
    
    # We should have selected exactly 1 destroyed pixel because it's the only damage pixel
    assert criterion.last_diagnostics["selected_destroyed"] == 1
    assert criterion.last_diagnostics["selected_damage"] == 1
    
    print("All V9 OHEM tests passed successfully!")

if __name__ == "__main__":
    test_v9_ohem()
