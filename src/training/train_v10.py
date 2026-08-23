"""
DISHA V10 - Imbalance-Aware Damage Segmentation Training

Usage:
    python src/training/train_v10.py --config configs/disha_v10.yaml

    # Resume training from last checkpoint:
    python src/training/train_v10.py --config configs/disha_v10.yaml --resume

    # Validation only:
    python src/training/train_v10.py --config configs/disha_v10.yaml --validate-only

Key differences from V9:
    - ResNet-34 encoder WITH ImageNet pretrained weights
    - Focal CE + Damage Tversky loss (replaces OHEM + Dice)
    - WeightedRandomSampler for minority-class image upweighting
    - Stronger, frequency-derived class weights
    - Visual validation snapshots every N epochs
    - Full per-class precision/recall/F1/IoU reporting
    - CSV training history
    - Early stopping on validation damage_miou
    - Comparison table vs V9 baseline at end
"""

import argparse
import csv
import json
import os
import random
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import yaml
from torch.utils.data import DataLoader

# -- allow running from project root ------------------------------------------
TRAINING_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(TRAINING_DIR))

from dataset import XBDDataset
from losses_v10 import CombinedLossV10
from metrics import confusion_matrix, calculate_metrics
from sampler_v10 import build_weighted_sampler

try:
    import segmentation_models_pytorch as smp
except ImportError:
    print("ERROR: segmentation_models_pytorch not installed.")
    print("  pip install segmentation-models-pytorch")
    sys.exit(1)

try:
    from PIL import Image
    import torchvision.transforms.functional as TF
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    VISUAL_OK = True
except Exception:
    VISUAL_OK = False


# -----------------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------------

CLASS_NAMES = ["background", "no_damage", "minor_damage", "major_damage", "destroyed"]

CLASS_COLORS = [
    (0,   0,   0),    # background  - black
    (0,   200, 0),    # no_damage   - green
    (255, 200, 0),    # minor_damage - yellow
    (255, 100, 0),    # major_damage - orange
    (220, 0,   0),    # destroyed   - red
]

# V9 reference baseline (3-epoch best)
V9_BASELINE = {
    "damage_miou":   0.0302,
    "damage_mf1":    0.0556,
    "minor_iou":     0.0007,
    "major_iou":     0.0009,
    "destroyed_iou": 0.0890,
    "bg_iou":        0.8183,
    "epochs":        3,
}


# -----------------------------------------------------------------------------
# Utilities
# -----------------------------------------------------------------------------

def set_seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def load_config(path: str) -> dict:
    with open(path, "r") as f:
        return yaml.safe_load(f)


def create_model_v10(cfg: dict):
    """Create U-Net with ResNet-34 encoder and ImageNet weights."""
    model = smp.Unet(
        encoder_name=cfg.get("encoder_name", "resnet34"),
        encoder_weights=cfg.get("encoder_weights", "imagenet"),
        in_channels=cfg.get("in_channels", 6),
        classes=cfg.get("num_classes", 5),
        activation=None,
    )
    return model


def mask_to_color(mask_np: np.ndarray) -> np.ndarray:
    """Convert [H,W] class index mask to [H,W,3] RGB image."""
    h, w = mask_np.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    for c, color in enumerate(CLASS_COLORS):
        rgb[mask_np == c] = color
    return rgb


# -----------------------------------------------------------------------------
# Loss setup
# -----------------------------------------------------------------------------

def build_loss(cfg: dict, device: torch.device) -> CombinedLossV10:
    cw = cfg.get("class_weights", None)
    if cw is not None:
        class_weights = torch.tensor(cw, dtype=torch.float32).to(device)
    else:
        class_weights = None

    criterion = CombinedLossV10(
        class_weights=class_weights,
        focal_gamma=cfg.get("focal_gamma", 2.0),
        focal_weight=cfg.get("loss_focal_ce_weight", 0.40),
        tversky_weight=cfg.get("loss_tversky_weight", 0.60),
        tversky_alpha=cfg.get("tversky_alpha", 0.30),
        tversky_beta=cfg.get("tversky_beta", 0.70),
    ).to(device)

    return criterion


# -----------------------------------------------------------------------------
# Sanity check
# -----------------------------------------------------------------------------

def run_sanity_check(model, criterion, train_loader, device, num_batches=3):
    print("\n" + "=" * 60)
    print("SANITY CHECK")
    print("=" * 60)

    model.train()
    optimizer_test = torch.optim.SGD(model.parameters(), lr=1e-4)
    scaler_test = torch.amp.GradScaler("cuda", enabled=device.type == "cuda")

    for i, batch in enumerate(train_loader):
        if i >= num_batches:
            break

        images = batch["image"].to(device)
        masks  = batch["mask"].to(device)

        print(f"\nBatch {i+1}:")
        print(f"  image shape : {images.shape}")
        print(f"  mask  shape : {masks.shape}")

        assert images.shape[1] == 6, f"Expected 6 input channels, got {images.shape[1]}"
        assert masks.ndim == 3,      f"Expected mask [B,H,W], got {masks.shape}"

        unique_vals = masks.unique().tolist()
        bad_vals = [v for v in unique_vals if v not in [0,1,2,3,4]]
        assert not bad_vals, f"Invalid mask class values: {bad_vals}"

        assert images.shape[2] == masks.shape[1], "H mismatch"
        assert images.shape[3] == masks.shape[2], "W mismatch"

        optimizer_test.zero_grad(set_to_none=True)

        with torch.amp.autocast("cuda", enabled=device.type == "cuda"):
            preds = model(images)
            total, fc, tv = criterion(preds, masks)

        print(f"  output shape: {preds.shape}")
        print(f"  focal_ce    : {fc.item():.4f}")
        print(f"  tversky     : {tv.item():.4f}")
        print(f"  total_loss  : {total.item():.4f}")

        assert torch.isfinite(total), "Loss is not finite!"
        assert preds.shape[1] == 5,  f"Expected 5 output classes, got {preds.shape[1]}"

        scaler_test.scale(total).backward()
        scaler_test.step(optimizer_test)
        scaler_test.update()

        # Check gradients are non-zero
        grad_norms = [
            p.grad.norm().item()
            for p in model.parameters()
            if p.grad is not None
        ]
        assert any(g > 0 for g in grad_norms), "All gradients are zero!"
        print(f"  grad norm   : {max(grad_norms):.4f}")

        # Check predicted classes are valid
        pred_classes = preds.argmax(dim=1)
        assert pred_classes.min() >= 0 and pred_classes.max() <= 4, \
            f"Predicted class out of range: [{pred_classes.min()}, {pred_classes.max()}]"

        if device.type == "cuda":
            mem = torch.cuda.memory_allocated(device) / 1e9
            print(f"  GPU memory  : {mem:.2f} GB")

    print("\n[PASS] Sanity check PASSED\n")


# -----------------------------------------------------------------------------
# Visual validation
# -----------------------------------------------------------------------------

def save_visual_grid(
    model,
    val_dataset,
    fixed_indices,
    device,
    output_path: Path,
    epoch: int,
):
    if not VISUAL_OK:
        return

    model.eval()
    n = len(fixed_indices)
    fig, axes = plt.subplots(n, 5, figsize=(20, 4 * n))

    if n == 1:
        axes = [axes]

    col_titles = ["Pre-disaster", "Post-disaster", "Ground Truth", "Prediction", "Error"]

    with torch.no_grad():
        for row, idx in enumerate(fixed_indices):
            sample = val_dataset[idx]
            image  = sample["image"].unsqueeze(0).to(device)

            # Get prediction
            with torch.amp.autocast("cuda", enabled=device.type == "cuda"):
                logits = model(image)
            pred_mask = logits.argmax(dim=1).squeeze(0).cpu().numpy()
            gt_mask   = sample["mask"].numpy()

            # Extract pre/post from the 6-channel tensor
            pre_img  = sample["image"][:3].permute(1, 2, 0).numpy()
            post_img = sample["image"][3:].permute(1, 2, 0).numpy()

            # Normalize for display
            pre_img  = (pre_img  - pre_img.min())  / (pre_img.max()  - pre_img.min() + 1e-8)
            post_img = (post_img - post_img.min()) / (post_img.max() - post_img.min() + 1e-8)

            gt_rgb   = mask_to_color(gt_mask)
            pred_rgb = mask_to_color(pred_mask)
            error_rgb = np.zeros_like(gt_rgb)
            error_rgb[gt_mask != pred_mask] = (255, 0, 255)   # magenta = wrong

            images_row = [pre_img, post_img, gt_rgb, pred_rgb, error_rgb]

            for col, (img, title) in enumerate(zip(images_row, col_titles)):
                ax = axes[row][col]
                ax.imshow(img)
                ax.set_title(title if row == 0 else "")
                ax.axis("off")

    # Legend
    patches = [
        mpatches.Patch(color=[c/255 for c in col], label=name)
        for name, col in zip(CLASS_NAMES, CLASS_COLORS)
    ]
    fig.legend(
        handles=patches,
        loc="lower center",
        ncol=5,
        fontsize=9,
        bbox_to_anchor=(0.5, -0.02),
    )

    fig.suptitle(f"DISHA V10 - Epoch {epoch} Validation", fontsize=14)
    plt.tight_layout()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path, bbox_inches="tight", dpi=100)
    plt.close(fig)


# -----------------------------------------------------------------------------
# Train one epoch
# -----------------------------------------------------------------------------

def train_one_epoch(model, loader, criterion, optimizer, scaler, device, epoch):
    model.train()

    running_loss = 0.0
    running_focal = 0.0
    running_tversky = 0.0
    start = time.time()

    for step, batch in enumerate(loader, start=1):
        images = batch["image"].to(device, non_blocking=True)
        masks  = batch["mask"].to(device, non_blocking=True)

        optimizer.zero_grad(set_to_none=True)

        with torch.amp.autocast("cuda", enabled=device.type == "cuda"):
            preds = model(images)
            total, focal, tversky = criterion(preds, masks)

        scaler.scale(total).backward()

        # Gradient clipping for stability
        scaler.unscale_(optimizer)
        nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)

        scaler.step(optimizer)
        scaler.update()

        running_loss    += total.item()
        running_focal   += focal.item()
        running_tversky += tversky.item()

        if step % 50 == 0 or step == len(loader):
            print(
                f"  Epoch {epoch} | Step {step}/{len(loader)} | "
                f"Loss {total.item():.4f} "
                f"(Focal {focal.item():.4f} | Tversky {tversky.item():.4f})"
            )

    elapsed = time.time() - start
    n = len(loader)

    return {
        "loss":    running_loss    / n,
        "focal":   running_focal   / n,
        "tversky": running_tversky / n,
        "time":    elapsed,
    }


# -----------------------------------------------------------------------------
# Validate
# -----------------------------------------------------------------------------

@torch.no_grad()
def validate(model, loader, criterion, device):
    model.eval()

    running_loss    = 0.0
    running_focal   = 0.0
    running_tversky = 0.0

    confusion = torch.zeros(5, 5, dtype=torch.int64, device=device)

    for batch in loader:
        images = batch["image"].to(device, non_blocking=True)
        masks  = batch["mask"].to(device, non_blocking=True)

        with torch.amp.autocast("cuda", enabled=device.type == "cuda"):
            preds = model(images)
            total, focal, tversky = criterion(preds, masks)

        running_loss    += total.item()
        running_focal   += focal.item()
        running_tversky += tversky.item()

        pred_classes = preds.argmax(dim=1)
        confusion += confusion_matrix(pred_classes, masks)

    results = calculate_metrics(confusion)
    n = len(loader)

    # Per-class precision/recall from confusion matrix
    tp = torch.diag(confusion).float()
    fp = (confusion.sum(0) - torch.diag(confusion)).float()
    fn = (confusion.sum(1) - torch.diag(confusion)).float()

    precision = tp / (tp + fp).clamp_min(1)
    recall    = tp / (tp + fn).clamp_min(1)

    return {
        "loss":    running_loss    / n,
        "focal":   running_focal   / n,
        "tversky": running_tversky / n,

        "iou":       results["iou"].cpu(),
        "f1":        results["f1"].cpu(),
        "precision": precision.cpu(),
        "recall":    recall.cpu(),

        "damage_miou":          results["damage_miou"].item(),
        "damage_mf1":           results["damage_mf1"].item(),
        "non_background_miou":  results["non_background_miou"].item(),
        "non_background_mf1":   results["non_background_mf1"].item(),
        "confusion":            confusion.cpu(),
    }


# -----------------------------------------------------------------------------
# Checkpoint
# -----------------------------------------------------------------------------

def save_checkpoint(path, model, optimizer, scheduler, scaler, epoch, metrics, cfg):
    torch.save({
        "epoch":              epoch,
        "model_state_dict":   model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "scheduler_state_dict": scheduler.state_dict(),
        "scaler_state_dict":  scaler.state_dict(),
        "metrics":            metrics,
        "config":             cfg,
    }, path)


def load_checkpoint(path, model, optimizer, scheduler, scaler, device):
    ckpt = torch.load(path, map_location=device)
    model.load_state_dict(ckpt["model_state_dict"])
    optimizer.load_state_dict(ckpt["optimizer_state_dict"])
    scheduler.load_state_dict(ckpt["scheduler_state_dict"])
    if "scaler_state_dict" in ckpt:
        scaler.load_state_dict(ckpt["scaler_state_dict"])
    return ckpt["epoch"], ckpt.get("metrics", {})


# -----------------------------------------------------------------------------
# Comparison report
# -----------------------------------------------------------------------------

def print_comparison(best_val_results, best_epoch):
    print("\n" + "=" * 70)
    print("V10 vs V9 BASELINE COMPARISON")
    print("=" * 70)

    v10 = {
        "damage_miou":   best_val_results["damage_miou"],
        "damage_mf1":    best_val_results["damage_mf1"],
        "minor_iou":     best_val_results["iou"][2].item(),
        "major_iou":     best_val_results["iou"][3].item(),
        "destroyed_iou": best_val_results["iou"][4].item(),
        "bg_iou":        best_val_results["iou"][0].item(),
    }

    rows = [
        ("Damage mIoU",    "damage_miou"),
        ("Damage mF1",     "damage_mf1"),
        ("Minor damage IoU", "minor_iou"),
        ("Major damage IoU", "major_iou"),
        ("Destroyed IoU",    "destroyed_iou"),
        ("Background IoU",   "bg_iou"),
    ]

    print(f"{'Metric':<22} {'V9 (3ep)':<12} {'V10':<12} {'Delta':<12}")
    print("-" * 58)

    for label, key in rows:
        v9_val = V9_BASELINE.get(key, 0.0)
        v10_val = v10[key]
        delta = v10_val - v9_val
        arrow = ">" if delta > 0 else ("<" if delta < 0 else "=")
        print(f"  {label:<20} {v9_val:<12.4f} {v10_val:<12.4f} {arrow}{abs(delta):.4f}")

    print("-" * 58)
    print(f"  V9 best epoch:  {V9_BASELINE['epochs']}")
    print(f"  V10 best epoch: {best_epoch}")


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="DISHA V10 Training")
    parser.add_argument("--config", type=str, default="configs/disha_v10.yaml")
    parser.add_argument("--resume",        action="store_true")
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()

    # -- Config ----------------------------------------------------------------
    cfg = load_config(args.config)

    seed = cfg.get("seed", 42)
    set_seed(seed)

    # -- Device ----------------------------------------------------------------
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    print("=" * 70)
    print("DISHA V10 - IMBALANCE-AWARE DAMAGE SEGMENTATION TRAINING")
    print("=" * 70)
    print(f"Config     : {args.config}")
    print(f"Device     : {device}")

    if device.type == "cuda":
        print(f"GPU        : {torch.cuda.get_device_name(0)}")
        print(f"VRAM total : {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    # -- Output dir ------------------------------------------------------------
    output_dir = Path(cfg.get("checkpoint_dir", "models/disha_v10"))
    output_dir.mkdir(parents=True, exist_ok=True)

    visual_dir = output_dir / "visuals"
    visual_dir.mkdir(exist_ok=True)

    # Save config snapshot
    with open(output_dir / "config.yaml", "w") as f:
        yaml.dump(cfg, f)

    # -- Datasets -------------------------------------------------------------
    dataset_root = cfg.get("dataset_root", "data/processed/xbd_disha")
    image_size   = cfg.get("image_size", 512)

    print(f"\nLoading datasets from: {dataset_root}")

    train_dataset = XBDDataset(
        root_dir=str(Path(dataset_root) / "train"),
        image_size=image_size,
        train_mode=True,
        damage_crop_probability=cfg.get("damage_crop_probability", 0.65),
        random_crop_probability=cfg.get("random_crop_probability", 0.20),
    )

    val_dataset = XBDDataset(
        root_dir=str(Path(dataset_root) / "val"),
        image_size=image_size,
        train_mode=False,
    )

    print(f"Train samples : {len(train_dataset)}")
    print(f"Val samples   : {len(val_dataset)}")

    # -- Weighted Sampler -----------------------------------------------------
    sampler = build_weighted_sampler(
        train_dataset,
        rare_class_weight=cfg.get("rare_class_weight", 3.0),
        destroyed_weight=cfg.get("destroyed_weight", 1.5),
        max_sample_weight=cfg.get("max_sample_weight", 5.0),
        seed=seed,
    )

    # -- DataLoaders -----------------------------------------------------------
    batch_size  = cfg.get("batch_size", 2)
    num_workers = cfg.get("num_workers", 0)

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        sampler=sampler,           # weighted sampler replaces shuffle=True
        num_workers=num_workers,
        pin_memory=True,
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True,
    )

    # -- Model -----------------------------------------------------------------
    print("\nCreating model...")
    model = create_model_v10(cfg).to(device)

    n_params = sum(p.numel() for p in model.parameters())
    print(f"Parameters : {n_params:,}")
    print(f"Encoder    : {cfg.get('encoder_name','resnet34')} + {cfg.get('encoder_weights','imagenet')}")

    # -- Loss ------------------------------------------------------------------
    criterion = build_loss(cfg, device)

    print(f"\nLoss: Focal CE (gamma={cfg.get('focal_gamma',2.0)}, weight={cfg.get('loss_focal_ce_weight',0.4)}) "
          f"+ Damage Tversky (alpha={cfg.get('tversky_alpha',0.3)}, beta={cfg.get('tversky_beta',0.7)}, "
          f"weight={cfg.get('loss_tversky_weight',0.6)})")

    # -- Optimizer / Scheduler -------------------------------------------------
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=cfg.get("lr", 1e-4),
        weight_decay=cfg.get("weight_decay", 1e-4),
    )

    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode="max",
        factor=cfg.get("scheduler_factor", 0.5),
        patience=cfg.get("scheduler_patience", 3),
        min_lr=cfg.get("scheduler_min_lr", 1e-7),
    )

    scaler = torch.amp.GradScaler("cuda", enabled=device.type == "cuda")

    # -- Fixed visual samples --------------------------------------------------
    n_vis = min(cfg.get("num_visual_samples", 4), len(val_dataset))
    rng = random.Random(seed)
    fixed_visual_indices = rng.sample(range(len(val_dataset)), n_vis)

    # -- Resume ----------------------------------------------------------------
    start_epoch = 1
    best_damage_miou = -1.0
    best_epoch = 0
    best_val_results = None
    history = []

    last_ckpt = output_dir / "last_model.pth"

    if args.resume and last_ckpt.exists():
        print(f"\nResuming from {last_ckpt}")
        start_epoch, prev_metrics = load_checkpoint(
            last_ckpt, model, optimizer, scheduler, scaler, device
        )
        start_epoch += 1
        best_damage_miou = prev_metrics.get("damage_miou", -1.0)

        hist_file = output_dir / "history.json"
        if hist_file.exists():
            with open(hist_file) as f:
                history = json.load(f)

        print(f"Resumed at epoch {start_epoch}, best damage_miou={best_damage_miou:.4f}")

    # -- Validate only ---------------------------------------------------------
    if args.validate_only:
        best_ckpt = output_dir / "best_model.pth"
        if best_ckpt.exists():
            print(f"\nLoading best checkpoint: {best_ckpt}")
            ckpt = torch.load(best_ckpt, map_location=device)
            model.load_state_dict(ckpt["model_state_dict"])
        else:
            print("No best checkpoint found. Running with current weights.")

        print("\nRunning validation...")
        val_results = validate(model, val_loader, criterion, device)
        _print_val_summary(val_results, epoch=0)
        return

    # -- Sanity check ---------------------------------------------------------
    if cfg.get("run_sanity_check", True) and start_epoch == 1:
        run_sanity_check(
            model, criterion, train_loader, device,
            num_batches=cfg.get("sanity_batches", 3),
        )

    # -- CSV history writer ----------------------------------------------------
    csv_path = output_dir / "training_history.csv"
    csv_fields = [
        "epoch", "train_loss", "train_focal", "train_tversky",
        "val_loss", "val_damage_miou", "val_damage_mf1",
        "val_non_bg_miou",
        "val_bg_iou", "val_no_damage_iou", "val_minor_iou",
        "val_major_iou", "val_destroyed_iou",
        "val_bg_f1", "val_no_damage_f1", "val_minor_f1",
        "val_major_f1", "val_destroyed_f1",
        "lr", "epoch_time_s",
    ]

    csv_file = open(csv_path, "a", newline="")
    csv_writer = csv.DictWriter(csv_file, fieldnames=csv_fields)
    if start_epoch == 1:
        csv_writer.writeheader()

    # -- Training loop ---------------------------------------------------------
    epochs      = cfg.get("epochs", 30)
    patience    = cfg.get("early_stopping_patience", 6)
    visual_int  = cfg.get("visual_interval", 5)
    no_improve  = 0

    print("\nStarting training...")
    print("=" * 70)

    for epoch in range(start_epoch, epochs + 1):
        epoch_start = time.time()

        train_results = train_one_epoch(
            model, train_loader, criterion, optimizer, scaler, device, epoch
        )

        val_results = validate(model, val_loader, criterion, device)

        scheduler.step(val_results["damage_miou"])
        current_lr = optimizer.param_groups[0]["lr"]
        epoch_time = time.time() - epoch_start

        # -- Print epoch summary -----------------------------------------------
        print(f"\n{'-'*70}")
        print(f"Epoch {epoch}/{epochs}  |  Time {epoch_time:.0f}s  |  LR {current_lr:.2e}")
        print(f"{'-'*70}")
        print(f"  Train  Loss    : {train_results['loss']:.4f}  "
              f"(Focal {train_results['focal']:.4f} | Tversky {train_results['tversky']:.4f})")
        print(f"  Val    Loss    : {val_results['loss']:.4f}")
        print(f"  Damage mIoU    : {val_results['damage_miou']:.4f}  "
              f"(V9 best: {V9_BASELINE['damage_miou']:.4f})")
        print(f"  Damage mF1     : {val_results['damage_mf1']:.4f}")
        print(f"  Non-bg mIoU    : {val_results['non_background_miou']:.4f}")

        _print_val_summary(val_results, epoch)

        # -- CSV row -----------------------------------------------------------
        iou = val_results["iou"]
        f1  = val_results["f1"]

        csv_writer.writerow({
            "epoch":             epoch,
            "train_loss":        round(train_results["loss"], 6),
            "train_focal":       round(train_results["focal"], 6),
            "train_tversky":     round(train_results["tversky"], 6),
            "val_loss":          round(val_results["loss"], 6),
            "val_damage_miou":   round(val_results["damage_miou"], 6),
            "val_damage_mf1":    round(val_results["damage_mf1"], 6),
            "val_non_bg_miou":   round(val_results["non_background_miou"], 6),
            "val_bg_iou":        round(iou[0].item(), 6),
            "val_no_damage_iou": round(iou[1].item(), 6),
            "val_minor_iou":     round(iou[2].item(), 6),
            "val_major_iou":     round(iou[3].item(), 6),
            "val_destroyed_iou": round(iou[4].item(), 6),
            "val_bg_f1":         round(f1[0].item(), 6),
            "val_no_damage_f1":  round(f1[1].item(), 6),
            "val_minor_f1":      round(f1[2].item(), 6),
            "val_major_f1":      round(f1[3].item(), 6),
            "val_destroyed_f1":  round(f1[4].item(), 6),
            "lr":                current_lr,
            "epoch_time_s":      round(epoch_time, 1),
        })
        csv_file.flush()

        # -- History JSON ------------------------------------------------------
        history.append({
            "epoch":  epoch,
            "train":  train_results,
            "val": {
                "loss":    val_results["loss"],
                "damage_miou":  val_results["damage_miou"],
                "damage_mf1":   val_results["damage_mf1"],
                "non_background_miou": val_results["non_background_miou"],
                "non_background_mf1":  val_results["non_background_mf1"],
                "iou": iou.tolist(),
                "f1":  f1.tolist(),
                "precision": val_results["precision"].tolist(),
                "recall":    val_results["recall"].tolist(),
            },
            "lr":    current_lr,
            "time":  epoch_time,
        })

        with open(output_dir / "history.json", "w") as f:
            json.dump(history, f, indent=2)

        # -- Last checkpoint ---------------------------------------------------
        save_checkpoint(
            output_dir / "last_model.pth",
            model, optimizer, scheduler, scaler, epoch, val_results, cfg,
        )

        # -- Best checkpoint ---------------------------------------------------
        if val_results["damage_miou"] > best_damage_miou:
            best_damage_miou = val_results["damage_miou"]
            best_epoch       = epoch
            best_val_results = val_results
            no_improve       = 0

            save_checkpoint(
                output_dir / "best_model.pth",
                model, optimizer, scheduler, scaler, epoch, val_results, cfg,
            )
            print(f"  [BEST] New best model! Damage mIoU = {best_damage_miou:.4f}")
        else:
            no_improve += 1

        # -- Visual snapshot ---------------------------------------------------
        if epoch % visual_int == 0:
            vis_path = visual_dir / f"epoch_{epoch:03d}.png"
            save_visual_grid(model, val_dataset, fixed_visual_indices, device, vis_path, epoch)
            print(f"  Visual saved: {vis_path}")

        # -- Early stopping ----------------------------------------------------
        if no_improve >= patience:
            print(f"\nEarly stopping triggered after {patience} epochs without improvement.")
            break

    csv_file.close()

    # -- Final summary ---------------------------------------------------------
    print("\n" + "=" * 70)
    print("V10 TRAINING COMPLETE")
    print("=" * 70)
    print(f"Best epoch        : {best_epoch}")
    print(f"Best damage mIoU  : {best_damage_miou:.4f}")

    if best_val_results is not None:
        _print_val_summary(best_val_results, epoch=best_epoch, label="BEST")
        print_comparison(best_val_results, best_epoch)

    print(f"\nBest checkpoint : {output_dir / 'best_model.pth'}")
    print(f"Training CSV    : {output_dir / 'training_history.csv'}")
    print(f"Visuals         : {visual_dir}")


def _print_val_summary(val_results, epoch, label="Val"):
    iou = val_results["iou"]
    f1  = val_results["f1"]
    prec = val_results.get("precision", torch.zeros(5))
    rec  = val_results.get("recall",    torch.zeros(5))

    print(f"\n  Per-class metrics ({label} epoch {epoch}):")
    header = f"    {'Class':<16} {'IoU':>7} {'F1':>7} {'Prec':>7} {'Recall':>7}"
    print(header)
    print("    " + "-" * (len(header) - 4))

    for i, name in enumerate(CLASS_NAMES):
        print(
            f"    {name:<16} "
            f"{iou[i].item():>7.4f} "
            f"{f1[i].item():>7.4f} "
            f"{prec[i].item():>7.4f} "
            f"{rec[i].item():>7.4f}"
        )


if __name__ == "__main__":
    main()
