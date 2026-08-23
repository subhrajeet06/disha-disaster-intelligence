"""
DISHA V10 — Final Test Evaluation

IMPORTANT:
    This script evaluates the BEST V10 checkpoint on the TEST set.
    It must only be run ONCE, after model selection is complete.
    Do NOT use test results to tune hyperparameters.

Usage:
    python src/training/evaluate_v10.py --config configs/disha_v10.yaml

    # Evaluate a specific checkpoint:
    python src/training/evaluate_v10.py --config configs/disha_v10.yaml \
        --checkpoint models/disha_v10/best_model.pth
"""

import argparse
import sys
from pathlib import Path

import torch
import yaml

TRAINING_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(TRAINING_DIR))

from dataset import XBDDataset
from losses_v10 import CombinedLossV10
from metrics import confusion_matrix, calculate_metrics
from train_v10 import (
    build_loss, create_model_v10, validate, CLASS_NAMES, V9_BASELINE
)
from torch.utils.data import DataLoader


def main():
    parser = argparse.ArgumentParser(description="DISHA V10 Final Test Evaluation")
    parser.add_argument("--config",     type=str, default="configs/disha_v10.yaml")
    parser.add_argument("--checkpoint", type=str, default=None)
    args = parser.parse_args()

    with open(args.config) as f:
        cfg = yaml.safe_load(f)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("=" * 60)
    print("DISHA V10 — FINAL TEST EVALUATION")
    print("=" * 60)
    print(f"Device: {device}")

    # ── Dataset ───────────────────────────────────────────────────────────────
    dataset_root = cfg.get("dataset_root", "data/processed/xbd_disha")
    image_size   = cfg.get("image_size", 512)

    print(f"\nTest set: {Path(dataset_root) / 'test'}")

    test_dataset = XBDDataset(
        root_dir=str(Path(dataset_root) / "test"),
        image_size=image_size,
        train_mode=False,
    )

    print(f"Test samples: {len(test_dataset)}")

    test_loader = DataLoader(
        test_dataset,
        batch_size=cfg.get("batch_size", 2),
        shuffle=False,
        num_workers=cfg.get("num_workers", 0),
        pin_memory=True,
    )

    # ── Model ─────────────────────────────────────────────────────────────────
    model = create_model_v10(cfg).to(device)

    ckpt_path = args.checkpoint or str(
        Path(cfg.get("checkpoint_dir", "models/disha_v10")) / "best_model.pth"
    )

    if not Path(ckpt_path).exists():
        print(f"ERROR: Checkpoint not found: {ckpt_path}")
        sys.exit(1)

    print(f"\nLoading checkpoint: {ckpt_path}")
    ckpt = torch.load(ckpt_path, map_location=device)
    model.load_state_dict(ckpt["model_state_dict"])
    best_epoch = ckpt.get("epoch", "?")
    print(f"Checkpoint epoch: {best_epoch}")

    # ── Loss ──────────────────────────────────────────────────────────────────
    criterion = build_loss(cfg, device)

    # ── Evaluate ──────────────────────────────────────────────────────────────
    print("\nRunning test evaluation...")
    test_results = validate(model, test_loader, criterion, device)

    # ── Report ────────────────────────────────────────────────────────────────
    iou  = test_results["iou"]
    f1   = test_results["f1"]
    prec = test_results.get("precision", torch.zeros(5))
    rec  = test_results.get("recall",    torch.zeros(5))

    print("\n" + "=" * 60)
    print("TEST SET RESULTS")
    print("=" * 60)
    print(f"  Damage mIoU  : {test_results['damage_miou']:.4f}")
    print(f"  Damage mF1   : {test_results['damage_mf1']:.4f}")
    print(f"  Non-bg mIoU  : {test_results['non_background_miou']:.4f}")

    print("\n  {'Class':<16} {'IoU':>7} {'F1':>7} {'Prec':>7} {'Recall':>7}")
    print("  " + "-" * 50)

    for i, name in enumerate(CLASS_NAMES):
        print(
            f"  {name:<16} "
            f"{iou[i].item():>7.4f} "
            f"{f1[i].item():>7.4f} "
            f"{prec[i].item():>7.4f} "
            f"{rec[i].item():>7.4f}"
        )

    print("\n  Confusion Matrix (rows=GT, cols=Pred):")
    cm = test_results["confusion"]
    header = "  " + "".join(f"{n[:6]:>8}" for n in CLASS_NAMES)
    print(header)
    for i, row in enumerate(cm):
        print(f"  {CLASS_NAMES[i][:6]:<6}" + "".join(f"{v.item():>8}" for v in row))

    print("\n  V9 Baseline comparison:")
    print(f"    V9 damage_miou  (3ep): {V9_BASELINE['damage_miou']:.4f}")
    print(f"    V10 damage_miou (test): {test_results['damage_miou']:.4f}")
    delta = test_results["damage_miou"] - V9_BASELINE["damage_miou"]
    arrow = "> IMPROVED" if delta > 0 else "< REGRESSION"
    print(f"    Delta: {delta:+.4f} {arrow}")


if __name__ == "__main__":
    main()
