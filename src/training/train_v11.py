"""
DISHA V11 -- Precision-Focused Fine-Tuning

Starts from the V10 best checkpoint and fine-tunes with:
    - Tversky alpha=0.7, beta=0.3  (FP penalty >> FN penalty, inverse of V10)
    - Lower class weights on damage  (reduce over-prediction)
    - Very low LR (1e-5) -- gentle refinement only
    - AMP enabled
    - Early stopping on val damage_miou
    - Max 10 epochs

Usage:
    python src/training/train_v11.py --config configs/disha_v11.yaml

Output:
    models/disha_v11/best_model_v11.pth
    models/disha_v11/training_history_v11.csv
"""

import argparse
import csv
import json
import random
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import yaml
from torch.utils.data import DataLoader

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
    sys.exit(1)


# =============================================================================
# Constants
# =============================================================================

CLASS_NAMES = ["background", "no_damage", "minor_damage", "major_damage", "destroyed"]

V10_BASELINE = {
    "damage_miou":   0.0789,
    "damage_mf1":    0.1289,
    "destroyed_iou": 0.2314,
}


# =============================================================================
# Utilities
# =============================================================================

def set_seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def load_config(path: str) -> dict:
    with open(path, "r") as f:
        return yaml.safe_load(f)


def create_model(cfg: dict):
    return smp.Unet(
        encoder_name=cfg.get("encoder_name", "resnet34"),
        encoder_weights=None,
        in_channels=cfg.get("in_channels", 6),
        classes=cfg.get("num_classes", 5),
        activation=None,
    )


def load_v10_checkpoint(model, cfg: dict, device: torch.device):
    ckpt_path = cfg["v10_checkpoint"]
    print(f"Loading V10 checkpoint: {ckpt_path}")
    ckpt = torch.load(ckpt_path, map_location=device)
    model.load_state_dict(ckpt["model_state_dict"])
    print(f"  V10 checkpoint epoch: {ckpt['epoch']}")
    v10_dmg = ckpt.get("metrics", {}).get("damage_miou", "?")
    print(f"  V10 damage_miou: {v10_dmg}")
    return model


# =============================================================================
# Training / Validation step
# =============================================================================

def train_epoch(model, loader, optimizer, loss_fn, scaler, device, epoch, max_epochs):
    model.train()
    total_loss = total_focal = total_tversky = 0.0
    n_batches = len(loader)

    for batch_idx, batch in enumerate(loader):
        images = batch["image"].to(device, non_blocking=True)
        masks  = batch["mask"].to(device, non_blocking=True)

        optimizer.zero_grad()
        with torch.amp.autocast("cuda", enabled=(device.type == "cuda")):
            logits = model(images)
            loss, focal_loss, tversky_loss = loss_fn(logits, masks)

        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

        total_loss    += loss.item()
        total_focal   += focal_loss.item()
        total_tversky += tversky_loss.item()

        if (batch_idx + 1) % 100 == 0 or (batch_idx + 1) == n_batches:
            print(
                f"  Epoch {epoch} | Step {batch_idx+1}/{n_batches} | "
                f"Loss {loss.item():.4f} "
                f"(Focal {focal_loss.item():.4f} | Tversky {tversky_loss.item():.4f})"
            )

    return {
        "loss":    total_loss    / n_batches,
        "focal":   total_focal   / n_batches,
        "tversky": total_tversky / n_batches,
    }


@torch.no_grad()
def validate(model, loader, loss_fn, device):
    model.eval()
    total_loss = 0.0
    cm_accum   = torch.zeros(5, 5, dtype=torch.long)

    for batch in loader:
        images = batch["image"].to(device, non_blocking=True)
        masks  = batch["mask"].to(device, non_blocking=True)

        with torch.amp.autocast("cuda", enabled=(device.type == "cuda")):
            logits = model(images)
            loss, _, _ = loss_fn(logits, masks)

        total_loss += loss.item()

        preds = logits.argmax(dim=1)
        for pred, gt in zip(preds, masks):
            cm_accum += confusion_matrix(pred.cpu(), gt.cpu())

    metrics = calculate_metrics(cm_accum)

    iou = metrics["iou"].numpy().tolist()
    f1  = metrics["f1"].numpy().tolist()

    tp = np.diag(cm_accum.numpy()).astype(float)
    fp = (cm_accum.numpy().sum(0) - np.diag(cm_accum.numpy())).astype(float)
    fn = (cm_accum.numpy().sum(1) - np.diag(cm_accum.numpy())).astype(float)
    precision = (tp / np.maximum(tp + fp, 1)).tolist()
    recall    = (tp / np.maximum(tp + fn, 1)).tolist()

    return {
        "loss":                   total_loss / len(loader),
        "damage_miou":            float(metrics["damage_miou"]),
        "damage_mf1":             float(metrics["damage_mf1"]),
        "non_background_miou":    float(metrics["non_background_miou"]),
        "iou":       iou,
        "f1":        f1,
        "precision": precision,
        "recall":    recall,
    }


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="DISHA V11 Fine-Tuning")
    parser.add_argument("--config", default="configs/disha_v11.yaml")
    args = parser.parse_args()

    cfg = load_config(args.config)
    set_seed(cfg.get("seed", 42))
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    print("=" * 65)
    print("DISHA V11 -- PRECISION-FOCUSED FINE-TUNING")
    print("=" * 65)
    print(f"Device: {device}")
    print(f"Starting from: {cfg['v10_checkpoint']}")
    print(f"LR: {cfg['finetune_lr']}")
    print(f"Tversky alpha={cfg['finetune_tversky_alpha']}, beta={cfg['finetune_tversky_beta']}")
    print(f"Max epochs: {cfg['finetune_epochs']}")

    out_dir = Path(cfg["finetune_output_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)

    # --- Datasets ---
    dataset_root = cfg["dataset_root"]
    image_size   = cfg["image_size"]

    train_ds = XBDDataset(
        root_dir=str(Path(dataset_root) / "train"),
        image_size=image_size,
        train_mode=True,
        damage_crop_probability=cfg.get("damage_crop_probability", 0.65),
        random_crop_probability=cfg.get("random_crop_probability", 0.20),
    )
    val_ds = XBDDataset(
        root_dir=str(Path(dataset_root) / "val"),
        image_size=image_size,
        train_mode=False,
    )

    # Weighted sampler (same as V10)
    sampler = build_weighted_sampler(
        train_ds,
        rare_class_weight=cfg.get("rare_class_weight", 3.0),
        destroyed_weight=cfg.get("destroyed_weight", 1.5),
        max_sample_weight=cfg.get("max_sample_weight", 5.0),
        seed=cfg.get("seed", 42),
    )

    bs         = cfg.get("finetune_batch_size", cfg.get("batch_size", 2))
    n_workers  = cfg.get("num_workers", 0)

    train_loader = DataLoader(
        train_ds,
        batch_size=bs,
        sampler=sampler,
        num_workers=n_workers,
        pin_memory=True,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=bs,
        shuffle=False,
        num_workers=n_workers,
        pin_memory=True,
    )

    print(f"Train samples : {len(train_ds)}")
    print(f"Val samples   : {len(val_ds)}")

    # --- Model ---
    model = create_model(cfg)
    model = load_v10_checkpoint(model, cfg, device)
    model = model.to(device)

    # --- Loss (V11: balanced -- penalise FP more) ---
    raw_weights = cfg.get("finetune_class_weights", [0.10, 1.0, 3.0, 3.0, 5.0])
    class_weights = torch.tensor(raw_weights, dtype=torch.float32).to(device)

    loss_fn = CombinedLossV10(
        class_weights=class_weights,
        focal_gamma=cfg.get("finetune_focal_gamma", 2.0),
        focal_weight=cfg.get("finetune_focal_weight", 0.50),
        tversky_weight=cfg.get("finetune_tversky_weight", 0.50),
        tversky_alpha=cfg.get("finetune_tversky_alpha", 0.70),  # V11: FP penalty
        tversky_beta=cfg.get("finetune_tversky_beta",  0.30),  # V11: lower FN penalty
    )

    # --- Optimizer (very low LR) ---
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=cfg["finetune_lr"],
        weight_decay=cfg.get("weight_decay", 1e-4),
    )

    # --- LR scheduler ---
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode="max",
        factor=0.5,
        patience=2,
        min_lr=1e-8,
    )

    scaler = torch.amp.GradScaler("cuda")

    # --- Training loop ---
    max_epochs = cfg.get("finetune_epochs", 10)
    patience   = cfg.get("finetune_patience", 4)

    best_miou      = 0.0
    no_improve     = 0
    history        = []
    csv_path       = out_dir / "training_history_v11.csv"
    best_ckpt_path = out_dir / "best_model_v11.pth"

    csv_fields = [
        "epoch", "train_loss", "train_focal", "train_tversky",
        "val_loss", "val_damage_miou", "val_damage_mf1", "val_non_bg_miou",
        "val_bg_iou", "val_no_damage_iou", "val_minor_iou",
        "val_major_iou", "val_destroyed_iou",
        "val_bg_f1", "val_no_damage_f1", "val_minor_f1",
        "val_major_f1", "val_destroyed_f1",
        "val_minor_recall", "val_major_recall", "val_destroyed_recall",
        "lr", "epoch_time_s",
    ]

    with open(csv_path, "w", newline="") as f:
        csv.DictWriter(f, fieldnames=csv_fields).writeheader()

    for epoch in range(1, max_epochs + 1):
        t0 = time.time()
        lr = optimizer.param_groups[0]["lr"]

        print(f"\n{'=' * 65}")
        print(f"Epoch {epoch}/{max_epochs}  |  LR {lr:.2e}")
        print(f"{'=' * 65}")

        train_m = train_epoch(model, train_loader, optimizer, loss_fn, scaler, device, epoch, max_epochs)
        val_m   = validate(model, val_loader, loss_fn, device)
        epoch_t = time.time() - t0

        scheduler.step(val_m["damage_miou"])

        iou = val_m["iou"]
        f1  = val_m["f1"]
        rec = val_m["recall"]

        print(f"\n{'=' * 65}")
        print(f"Epoch {epoch}/{max_epochs}  |  Time {epoch_t:.0f}s  |  LR {lr:.2e}")
        print(f"{'=' * 65}")
        print(f"  Train Loss : {train_m['loss']:.4f}  (Focal {train_m['focal']:.4f} | Tversky {train_m['tversky']:.4f})")
        print(f"  Val Loss   : {val_m['loss']:.4f}")
        print(f"  Damage mIoU: {val_m['damage_miou']:.4f}  (V10 best: {V10_BASELINE['damage_miou']})")
        print(f"  Damage mF1 : {val_m['damage_mf1']:.4f}")
        print(f"\n  Per-class metrics (Val epoch {epoch}):")
        print(f"    {'Class':<16} {'IoU':>7} {'F1':>7} {'Recall':>8}")
        print(f"    {'-' * 42}")
        for i, name in enumerate(CLASS_NAMES):
            print(f"    {name:<16} {iou[i]:>7.4f} {f1[i]:>7.4f} {rec[i]:>8.4f}")

        # Check best
        is_best = val_m["damage_miou"] > best_miou
        if is_best:
            best_miou  = val_m["damage_miou"]
            no_improve = 0
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "metrics": val_m,
                "config": cfg,
                "v11_finetune": True,
                "v10_checkpoint": cfg["v10_checkpoint"],
            }, best_ckpt_path)
            print(f"  [BEST] Saved best V11 model! Damage mIoU = {best_miou:.4f}")
        else:
            no_improve += 1
            print(f"  No improvement ({no_improve}/{patience})")

        # CSV row
        row = {
            "epoch":          epoch,
            "train_loss":     round(train_m["loss"],    6),
            "train_focal":    round(train_m["focal"],   6),
            "train_tversky":  round(train_m["tversky"], 6),
            "val_loss":       round(val_m["loss"],             6),
            "val_damage_miou":round(val_m["damage_miou"],      6),
            "val_damage_mf1": round(val_m["damage_mf1"],       6),
            "val_non_bg_miou":round(val_m["non_background_miou"], 6),
            "val_bg_iou":        round(iou[0], 6),
            "val_no_damage_iou": round(iou[1], 6),
            "val_minor_iou":     round(iou[2], 6),
            "val_major_iou":     round(iou[3], 6),
            "val_destroyed_iou": round(iou[4], 6),
            "val_bg_f1":         round(f1[0],  6),
            "val_no_damage_f1":  round(f1[1],  6),
            "val_minor_f1":      round(f1[2],  6),
            "val_major_f1":      round(f1[3],  6),
            "val_destroyed_f1":  round(f1[4],  6),
            "val_minor_recall":    round(rec[2], 6),
            "val_major_recall":    round(rec[3], 6),
            "val_destroyed_recall":round(rec[4], 6),
            "lr":           lr,
            "epoch_time_s": round(epoch_t, 1),
        }

        with open(csv_path, "a", newline="") as f:
            csv.DictWriter(f, fieldnames=csv_fields).writerow(row)

        history.append({"epoch": epoch, "train": train_m, "val": val_m, "lr": lr, "time": epoch_t})

        # Early stopping
        if no_improve >= patience:
            print(f"\n*** Early stopping triggered at epoch {epoch}. Best: epoch {epoch - patience} ***")
            break

    # --- Summary ---
    print(f"\n{'=' * 65}")
    print("V11 FINE-TUNING COMPLETE")
    print(f"{'=' * 65}")
    print(f"Best V11 damage mIoU (val) : {best_miou:.4f}")
    print(f"V10 baseline damage mIoU   : {V10_BASELINE['damage_miou']}")
    print(f"Delta                      : {best_miou - V10_BASELINE['damage_miou']:+.4f}")
    print(f"Best checkpoint : {best_ckpt_path}")
    print(f"Training CSV    : {csv_path}")

    # Save history JSON
    history_path = out_dir / "history_v11.json"
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2, default=str)
    print(f"History JSON    : {history_path}")


if __name__ == "__main__":
    main()
