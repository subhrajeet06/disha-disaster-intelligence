import torch
from torch.utils.data import DataLoader
from dataset import XBDDataset

def run_diagnostics():
    print("Loading training dataset...")
    train_dataset = XBDDataset(
        root_dir="data/processed/xbd_disha/train",
        image_size=512,
        train_mode=True,
    )
    
    print(f"Total training samples: {len(train_dataset)}")
    
    train_loader = DataLoader(
        train_dataset,
        batch_size=2,
        shuffle=False,  # Sequential to find the last batch
        num_workers=0,
    )
    
    print(f"Total batches: {len(train_loader)}")
    
    for step, batch in enumerate(train_loader, start=1):
        if step == len(train_loader):
            print(f"\n--- FINAL BATCH (Step {step}) ---")
            masks = batch["mask"]
            print(f"Batch shape: {masks.shape}")
            
            total_pixels = masks.numel()
            print(f"Total pixels: {total_pixels}")
            
            num_hard_total = int(total_pixels * 0.20)
            print(f"20% hard pixels: {num_hard_total}")
            
            damage_mask = (masks == 2) | (masks == 3) | (masks == 4)
            damage_count = damage_mask.sum().item()
            print(f"Actual damage pixels in this batch: {damage_count}")
            
            minor = (masks == 2).sum().item()
            major = (masks == 3).sum().item()
            destroyed = (masks == 4).sum().item()
            
            print(f"Minor: {minor}")
            print(f"Major: {major}")
            print(f"Destroyed: {destroyed}")

if __name__ == "__main__":
    run_diagnostics()
