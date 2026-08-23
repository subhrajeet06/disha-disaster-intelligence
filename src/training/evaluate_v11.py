"""
DISHA V11 -- Triage Evaluation Script

Workflow:
    # Step 1 -- validation threshold search (no test data used)
    python src/training/evaluate_v11.py --config configs/disha_v11.yaml --split val

    # Step 2 -- freeze config (edit selected_threshold in yaml), then:
    python src/training/evaluate_v11.py --config configs/disha_v11.yaml --split test

This script:
    1. Loads best V10 checkpoint (read-only)
    2. Runs inference on val or test set
    3. Computes softmax damage_score and severe_score per pixel
    4. Evaluates threshold grid (val only) -- saves threshold_results.csv
    5. Applies connected-component filtering
    6. Generates 6-panel demo visuals (pre/post/gt/pred/prob/triage)
    7. Saves application-level and 5-class metrics to JSON
"""

import argparse
import csv
import json
import os
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
import yaml
from PIL import Image
from torch.utils.data import DataLoader

# Allow running from project root
TRAINING_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(TRAINING_DIR))

from dataset import XBDDataset
from metrics import confusion_matrix as build_confusion, calculate_metrics

try:
    import segmentation_models_pytorch as smp
except ImportError:
    print("ERROR: segmentation_models_pytorch not installed.")
    sys.exit(1)

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    from scipy import ndimage as ndi
    SCIPY_OK = True
except ImportError:
    SCIPY_OK = False
    print("WARNING: scipy not available -- connected-component filtering disabled.")


# =============================================================================
# Constants
# =============================================================================

CLASS5_NAMES  = ["background", "no_damage", "minor_damage", "major_damage", "destroyed"]
CLASS5_COLORS = [
    (15,  23,  42),   # background  -- dark navy
    (34, 197,  94),   # no_damage   -- green
    (250, 204,  21),  # minor_damage -- yellow
    (251, 146,  60),  # major_damage -- orange
    (220,  38,  38),  # destroyed   -- red
]

TRIAGE3_NAMES  = ["no_damage", "DAMAGE", "SEVERE"]
TRIAGE2_NAMES  = ["no_damage", "DAMAGE"]


# =============================================================================
# Utilities
# =============================================================================

def load_config(path: str) -> dict:
    with open(path, "r") as f:
        return yaml.safe_load(f)


def load_model(cfg: dict, device: torch.device):
    model = smp.Unet(
        encoder_name=cfg["encoder_name"],
        encoder_weights=None,          # weights loaded from checkpoint
        in_channels=cfg["in_channels"],
        classes=cfg["num_classes"],
        activation=None,
    )
    ckpt_path = cfg["v10_checkpoint"]
    print(f"Loading V10 checkpoint: {ckpt_path}")
    ckpt = torch.load(ckpt_path, map_location=device)
    model.load_state_dict(ckpt["model_state_dict"])
    model = model.to(device)
    model.eval()
    print(f"  Checkpoint epoch: {ckpt['epoch']}")
    return model


def mask5_to_rgb(mask_np: np.ndarray) -> np.ndarray:
    """Convert [H,W] 5-class mask to [H,W,3] RGB."""
    h, w = mask_np.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    for c, color in enumerate(CLASS5_COLORS):
        rgb[mask_np == c] = color
    return rgb


def triage3_to_rgb(triage_np: np.ndarray, cfg: dict) -> np.ndarray:
    """Convert 3-level triage mask [H,W] to [H,W,3] RGB."""
    tc = cfg["triage_colors"]
    color_map = {
        0: tc["no_damage"],
        1: tc["damage"],
        2: tc["severe"],
    }
    h, w = triage_np.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    for v, color in color_map.items():
        rgb[triage_np == v] = color
    return rgb


def triage2_to_rgb(triage_np: np.ndarray, cfg: dict) -> np.ndarray:
    """Convert binary triage mask [H,W] to [H,W,3] RGB."""
    tc = cfg["triage_colors"]
    h, w = triage_np.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    rgb[triage_np == 0] = tc["no_damage"]
    rgb[triage_np == 1] = tc["damage"]
    return rgb


def damage_prob_to_rgb(prob: np.ndarray) -> np.ndarray:
    """Convert [H,W] float 0-1 damage probability to a heatmap RGB."""
    # viridis-like: dark purple -> cyan -> yellow
    cmap = plt.cm.inferno
    rgba = (cmap(prob) * 255).astype(np.uint8)
    return rgba[:, :, :3]


def remove_small_components(binary: np.ndarray, min_area: int) -> np.ndarray:
    """Remove connected components smaller than min_area pixels."""
    if not SCIPY_OK or min_area <= 0:
        return binary

    labeled, n_features = ndi.label(binary)
    sizes = ndi.sum(binary, labeled, range(1, n_features + 1))
    remove_labels = [
        i + 1 for i, s in enumerate(sizes) if s < min_area
    ]
    clean = binary.copy()
    for lbl in remove_labels:
        clean[labeled == lbl] = 0
    return clean


def apply_morphology(binary: np.ndarray, kernel_size: int) -> np.ndarray:
    """Optional morphological closing."""
    if not SCIPY_OK or kernel_size <= 0:
        return binary
    struct = ndi.generate_binary_structure(2, 1)
    iterations = kernel_size // 2
    if iterations < 1:
        return binary
    closed = ndi.binary_closing(binary.astype(bool), structure=struct,
                                 iterations=iterations).astype(np.uint8)
    return closed


# =============================================================================
# Score computation
# =============================================================================

def compute_scores(logits: torch.Tensor, cfg: dict):
    """
    logits: [B, 5, H, W]
    Returns dicts of [B, H, W] numpy arrays (float32)
    """
    probs = F.softmax(logits.float(), dim=1)   # [B, 5, H, W]
    probs_np = probs.cpu().numpy()

    damage_cls  = cfg["damage_classes"]   # [2, 3, 4]
    severe_cls  = cfg["severe_classes"]   # [3, 4]

    damage_score = np.zeros(probs_np.shape[:1] + probs_np.shape[2:], dtype=np.float32)
    severe_score = np.zeros_like(damage_score)

    for c in damage_cls:
        damage_score += probs_np[:, c, :, :]
    for c in severe_cls:
        severe_score += probs_np[:, c, :, :]

    return damage_score, severe_score, probs_np


def apply_grouping_3level(argmax_np: np.ndarray) -> np.ndarray:
    """
    5-class argmax -> 3-level triage from argmax labels.
    0 = no_damage   (classes 0, 1)
    1 = DAMAGE      (class 2)
    2 = SEVERE      (classes 3, 4)
    """
    triage = np.zeros_like(argmax_np)
    triage[argmax_np == 2] = 1
    triage[(argmax_np == 3) | (argmax_np == 4)] = 2
    return triage


def apply_grouping_3level_threshold(
    damage_score: np.ndarray,
    severe_score: np.ndarray,
    threshold: float,
    min_area: int,
    morph_size: int,
) -> np.ndarray:
    """
    Probability-based 3-level triage:
      - damage_score >= threshold  -> 1 (DAMAGE) or 2 (SEVERE)
      - severe_score >= threshold  -> 2 (SEVERE)
      - else                       -> 0 (no_damage)
    """
    triage = np.zeros(damage_score.shape, dtype=np.uint8)

    damage_binary = (damage_score >= threshold).astype(np.uint8)
    damage_binary = apply_morphology(damage_binary, morph_size)
    damage_binary = remove_small_components(damage_binary, min_area)

    severe_binary = (severe_score >= threshold).astype(np.uint8)
    severe_binary = apply_morphology(severe_binary, morph_size)
    severe_binary = remove_small_components(severe_binary, min_area)

    triage[damage_binary == 1] = 1
    triage[severe_binary == 1] = 2   # severe overwrites damage

    return triage


def apply_grouping_binary_threshold(
    damage_score: np.ndarray,
    threshold: float,
    min_area: int,
    morph_size: int,
) -> np.ndarray:
    """
    Binary triage from damage probability threshold.
    0 = no_damage, 1 = DAMAGE
    """
    binary = (damage_score >= threshold).astype(np.uint8)
    binary = apply_morphology(binary, morph_size)
    binary = remove_small_components(binary, min_area)
    return binary


# =============================================================================
# Metrics
# =============================================================================

def binary_metrics(gt_binary: np.ndarray, pred_binary: np.ndarray):
    """Compute precision, recall, F1, IoU, FPR, FNR for binary damage."""
    tp = int(((gt_binary == 1) & (pred_binary == 1)).sum())
    fp = int(((gt_binary == 0) & (pred_binary == 1)).sum())
    fn = int(((gt_binary == 1) & (pred_binary == 0)).sum())
    tn = int(((gt_binary == 0) & (pred_binary == 0)).sum())

    precision = tp / max(tp + fp, 1)
    recall    = tp / max(tp + fn, 1)
    f1        = 2 * precision * recall / max(precision + recall, 1e-8)
    iou       = tp / max(tp + fp + fn, 1)
    fpr       = fp / max(fp + tn, 1)
    fnr       = fn / max(fn + tp, 1)

    return {
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        "precision": precision, "recall": recall,
        "f1": f1, "iou": iou,
        "fpr": fpr, "fnr": fnr,
    }


def triage3_metrics(gt3: np.ndarray, pred3: np.ndarray):
    """Per-class metrics for 3-level triage (0/1/2)."""
    results = {}
    for c, name in enumerate(TRIAGE3_NAMES):
        gt_c   = (gt3  == c).astype(np.int64)
        pred_c = (pred3 == c).astype(np.int64)
        tp = int((gt_c & pred_c).sum())
        fp = int(((1 - gt_c) & pred_c).sum())
        fn = int((gt_c & (1 - pred_c)).sum())
        precision = tp / max(tp + fp, 1)
        recall    = tp / max(tp + fn, 1)
        f1        = 2 * precision * recall / max(precision + recall, 1e-8)
        iou       = tp / max(tp + fp + fn, 1)
        results[name] = {
            "precision": precision, "recall": recall,
            "f1": f1, "iou": iou,
        }
    macro_f1  = float(np.mean([v["f1"]  for v in results.values()]))
    macro_iou = float(np.mean([v["iou"] for v in results.values()]))
    results["macro_f1"]  = macro_f1
    results["macro_iou"] = macro_iou
    return results


# =============================================================================
# Visualisation
# =============================================================================

def save_visual_grid(
    pre_t: torch.Tensor,
    post_t: torch.Tensor,
    gt_mask: np.ndarray,
    pred_mask: np.ndarray,
    damage_score: np.ndarray,
    triage3: np.ndarray,
    triage2: np.ndarray,
    out_path: Path,
    sample_id: str,
    cfg: dict,
):
    """Save a 7-panel demo grid for one sample."""
    fig, axes = plt.subplots(1, 7, figsize=(35, 5))

    pre_np  = pre_t.cpu().permute(1, 2, 0).numpy().astype(np.float32)
    post_np = post_t.cpu().permute(1, 2, 0).numpy().astype(np.float32)

    # Normalize to [0,1] for display
    pre_np  = (pre_np  - pre_np.min())  / max(pre_np.max()  - pre_np.min(),  1e-8)
    post_np = (post_np - post_np.min()) / max(post_np.max() - post_np.min(), 1e-8)

    panels = [
        (pre_np,                        "Pre-Disaster"),
        (post_np,                       "Post-Disaster"),
        (mask5_to_rgb(gt_mask),         "Ground Truth (5-class)"),
        (mask5_to_rgb(pred_mask),       "V10 Prediction (5-class)"),
        (damage_prob_to_rgb(damage_score), "Damage Probability"),
        (triage3_to_rgb(triage3, cfg),  "DISHA Triage (3-level)"),
        (triage2_to_rgb(triage2, cfg),  "DISHA Triage (binary)"),
    ]

    for ax, (img, title) in zip(axes, panels):
        ax.imshow(img)
        ax.set_title(title, fontsize=9, fontweight="bold")
        ax.axis("off")

    # Legend for triage
    tc = cfg["triage_colors"]
    triage_patches = [
        mpatches.Patch(color=[c / 255 for c in tc["no_damage"]], label="No Damage"),
        mpatches.Patch(color=[c / 255 for c in tc["damage"]],    label="DAMAGE"),
        mpatches.Patch(color=[c / 255 for c in tc["severe"]],    label="SEVERE"),
    ]
    # Legend for 5-class
    class5_patches = [
        mpatches.Patch(color=[c / 255 for c in col], label=name)
        for name, col in zip(CLASS5_NAMES, CLASS5_COLORS)
    ]

    fig.legend(handles=triage_patches + class5_patches, loc="lower center",
               ncol=8, fontsize=7, bbox_to_anchor=(0.5, -0.05))
    fig.suptitle(f"DISHA V11 -- Sample: {sample_id}", fontsize=11, fontweight="bold")
    plt.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out_path, bbox_inches="tight", dpi=100)
    plt.close(fig)


def save_confusion_matrix_fig(cm: np.ndarray, class_names: list, title: str, out_path: Path):
    """Save a confusion matrix as a heatmap."""
    fig, ax = plt.subplots(figsize=(6, 5))
    im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
    plt.colorbar(im, ax=ax)
    ax.set(
        xticks=np.arange(len(class_names)),
        yticks=np.arange(len(class_names)),
        xticklabels=class_names,
        yticklabels=class_names,
        title=title,
        xlabel="Predicted",
        ylabel="Ground Truth",
    )
    plt.setp(ax.get_xticklabels(), rotation=30, ha="right", fontsize=8)
    thresh = cm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(j, i, format(int(cm[i, j]), "d"),
                    ha="center", va="center",
                    color="white" if cm[i, j] > thresh else "black",
                    fontsize=7)
    plt.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out_path, dpi=100)
    plt.close(fig)


# =============================================================================
# Inference + threshold search (validation)
# =============================================================================

@torch.no_grad()
def run_inference(model, loader, cfg, device):
    """
    Run model on all samples in loader.
    Returns lists of (damage_score, severe_score, probs, argmax, gt_mask) arrays.
    """
    all_damage_scores = []
    all_severe_scores = []
    all_argmax        = []
    all_gt            = []
    all_probs         = []
    sample_ids        = []

    for batch in loader:
        images = batch["image"].to(device, non_blocking=True)
        masks  = batch["mask"]
        ids    = batch["id"]

        with torch.amp.autocast("cuda", enabled=(device.type == "cuda")):
            logits = model(images)

        damage_score, severe_score, probs_np = compute_scores(logits, cfg)
        argmax = logits.argmax(dim=1).cpu().numpy()

        all_damage_scores.append(damage_score)
        all_severe_scores.append(severe_score)
        all_argmax.append(argmax)
        all_gt.append(masks.numpy())
        all_probs.append(probs_np)
        sample_ids.extend(list(ids))

    # Flatten batch dimension
    all_damage_scores = np.concatenate(all_damage_scores, axis=0)   # [N, H, W]
    all_severe_scores = np.concatenate(all_severe_scores, axis=0)
    all_argmax        = np.concatenate(all_argmax,        axis=0)
    all_gt            = np.concatenate(all_gt,            axis=0)
    all_probs         = np.concatenate(all_probs,         axis=0)    # [N, 5, H, W]

    return all_damage_scores, all_severe_scores, all_argmax, all_gt, all_probs, sample_ids


def run_threshold_search(all_damage_scores, all_severe_scores, all_gt, cfg):
    """
    Evaluate threshold grid on the full validation/test set.
    Returns list of dicts with per-threshold metrics.
    """
    thresholds = cfg["threshold_grid"]
    min_area   = cfg["min_component_area"]
    morph_size = cfg.get("morphology_close_size", 0)

    # Ground truth binary damage map (any damage class = 1)
    gt_binary3_flat   = np.zeros_like(all_gt, dtype=np.uint8)
    gt_binary_flat    = np.zeros_like(all_gt, dtype=np.uint8)
    gt_severe_flat    = np.zeros_like(all_gt, dtype=np.uint8)

    for c in cfg["damage_classes"]:
        gt_binary_flat[all_gt == c] = 1

    gt_binary3_flat[all_gt == 2] = 1                   # minor = DAMAGE
    gt_binary3_flat[(all_gt == 3) | (all_gt == 4)] = 1 # major+destroyed = DAMAGE
    gt_severe_flat[(all_gt == 3) | (all_gt == 4)] = 1

    results = []

    for thr in thresholds:
        # Binary triage
        pred_binary_list = []
        for i in range(all_damage_scores.shape[0]):
            b = apply_grouping_binary_threshold(
                all_damage_scores[i], thr, min_area, morph_size
            )
            pred_binary_list.append(b)

        pred_binary = np.stack(pred_binary_list)

        bin_metrics = binary_metrics(
            gt_binary_flat.reshape(-1),
            pred_binary.reshape(-1),
        )

        # 3-level triage for severe
        pred3_list = []
        for i in range(all_damage_scores.shape[0]):
            t3 = apply_grouping_3level_threshold(
                all_damage_scores[i], all_severe_scores[i], thr, min_area, morph_size
            )
            pred3_list.append(t3)

        pred3 = np.stack(pred3_list)
        t3m = triage3_metrics(
            # convert gt to 3-level
            np.where(all_gt <= 1, 0, np.where(all_gt == 2, 1, 2)).reshape(-1),
            pred3.reshape(-1),
        )

        results.append({
            "threshold":         thr,
            "binary_precision":  bin_metrics["precision"],
            "binary_recall":     bin_metrics["recall"],
            "binary_f1":         bin_metrics["f1"],
            "binary_iou":        bin_metrics["iou"],
            "fpr":               bin_metrics["fpr"],
            "fnr":               bin_metrics["fnr"],
            "t3_macro_f1":       t3m["macro_f1"],
            "t3_macro_iou":      t3m["macro_iou"],
            "t3_damage_f1":      t3m["DAMAGE"]["f1"],
            "t3_damage_recall":  t3m["DAMAGE"]["recall"],
            "t3_severe_f1":      t3m["SEVERE"]["f1"],
            "t3_severe_recall":  t3m["SEVERE"]["recall"],
        })

        print(
            f"  thr={thr:.2f}  "
            f"bin_P={bin_metrics['precision']:.3f}  "
            f"bin_R={bin_metrics['recall']:.3f}  "
            f"bin_F1={bin_metrics['f1']:.3f}  "
            f"bin_IoU={bin_metrics['iou']:.3f}  "
            f"FPR={bin_metrics['fpr']:.3f}  "
            f"3lv_macF1={t3m['macro_f1']:.3f}"
        )

    return results


def select_best_threshold(threshold_results: list) -> float:
    """
    Select threshold with best binary F1.
    If multiple thresholds are within 0.005 F1, prefer the higher (more conservative) one.
    """
    best_f1   = max(r["binary_f1"] for r in threshold_results)
    candidates = [r for r in threshold_results if r["binary_f1"] >= best_f1 - 0.005]
    # Prefer higher threshold (less false positives)
    best = max(candidates, key=lambda r: r["threshold"])
    return best["threshold"]


# =============================================================================
# 5-class reference metrics (unchanged from V10 metric pipeline)
# =============================================================================

def compute_5class_metrics(all_gt, all_argmax):
    """Reference 5-class metrics in the same format as V10."""
    gt_t    = torch.from_numpy(all_gt.reshape(-1))
    pred_t  = torch.from_numpy(all_argmax.reshape(-1))
    cm      = build_confusion(pred_t, gt_t)
    metrics = calculate_metrics(cm)

    iou = metrics["iou"].numpy().tolist()
    f1  = metrics["f1"].numpy().tolist()

    tp = np.diag(cm.numpy()).astype(float)
    fp = (cm.numpy().sum(0) - np.diag(cm.numpy())).astype(float)
    fn = (cm.numpy().sum(1) - np.diag(cm.numpy())).astype(float)
    precision = tp / np.maximum(tp + fp, 1)
    recall    = tp / np.maximum(tp + fn, 1)

    return {
        "damage_miou":         float(metrics["damage_miou"]),
        "damage_mf1":          float(metrics["damage_mf1"]),
        "non_background_miou": float(metrics["non_background_miou"]),
        "iou":  iou,
        "f1":   f1,
        "precision": precision.tolist(),
        "recall":    recall.tolist(),
    }


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="DISHA V11 Evaluation")
    parser.add_argument("--config", default="configs/disha_v11.yaml")
    parser.add_argument("--split",  default="val", choices=["val", "test"],
                        help="'val' = threshold search; 'test' = frozen final eval")
    args = parser.parse_args()

    cfg    = load_config(args.config)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    print("=" * 65)
    print(f"DISHA V11 -- {'VALIDATION THRESHOLD SEARCH' if args.split == 'val' else 'FINAL TEST EVALUATION'}")
    print("=" * 65)
    print(f"Split  : {args.split}")
    print(f"Device : {device}")

    out_dir = Path(cfg["output_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    vis_dir = out_dir / "visuals" / args.split
    vis_dir.mkdir(parents=True, exist_ok=True)

    # --- Save frozen config snapshot ---
    import shutil
    shutil.copy(args.config, out_dir / "config.yaml")

    # --- Load model ---
    model = load_model(cfg, device)

    # --- Dataset ---
    dataset_root = cfg["dataset_root"]
    image_size   = cfg["image_size"]

    dataset = XBDDataset(
        root_dir=str(Path(dataset_root) / args.split),
        image_size=image_size,
        train_mode=False,
    )
    loader = DataLoader(
        dataset,
        batch_size=cfg["batch_size"],
        shuffle=False,
        num_workers=cfg["num_workers"],
        pin_memory=True,
    )
    print(f"Samples: {len(dataset)}")

    # --- Inference ---
    print("\nRunning inference...")
    (
        all_damage_scores, all_severe_scores,
        all_argmax, all_gt, all_probs, sample_ids
    ) = run_inference(model, loader, cfg, device)

    print(f"Done. Shape: {all_damage_scores.shape}")

    # =========================================================================
    # VALIDATION: threshold grid search
    # =========================================================================
    if args.split == "val":
        print("\nThreshold grid search on VALIDATION set:")
        print(f"  {'thr':<6} {'bin_P':<8} {'bin_R':<8} {'bin_F1':<8} {'bin_IoU':<9} {'FPR':<7} {'3lv_mF1':<9}")
        print("  " + "-" * 60)

        thr_results = run_threshold_search(
            all_damage_scores, all_severe_scores, all_gt, cfg
        )

        # Save CSV
        csv_path = out_dir / "threshold_results.csv"
        if thr_results:
            fields = list(thr_results[0].keys())
            with open(csv_path, "w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fields)
                writer.writeheader()
                writer.writerows(thr_results)
        print(f"\nThreshold results saved: {csv_path}")

        best_thr = select_best_threshold(thr_results)
        print(f"\n*** Selected best threshold: {best_thr} ***")
        print("(Update 'selected_threshold' in disha_v11.yaml before running --split test)")

        # Use selected or best for visuals
        threshold = best_thr

    else:
        # TEST: use frozen threshold from config
        threshold = cfg.get("selected_threshold")
        if threshold is None:
            print("ERROR: 'selected_threshold' is null in config. Run --split val first.")
            sys.exit(1)
        print(f"\nUsing frozen threshold: {threshold}")

    # =========================================================================
    # Apply chosen threshold to whole dataset
    # =========================================================================
    min_area   = cfg["min_component_area"]
    morph_size = cfg.get("morphology_close_size", 0)

    all_triage3 = []
    all_triage2 = []

    for i in range(all_damage_scores.shape[0]):
        t3 = apply_grouping_3level_threshold(
            all_damage_scores[i], all_severe_scores[i],
            threshold, min_area, morph_size,
        )
        t2 = apply_grouping_binary_threshold(
            all_damage_scores[i], threshold, min_area, morph_size,
        )
        all_triage3.append(t3)
        all_triage2.append(t2)

    all_triage3 = np.stack(all_triage3)
    all_triage2 = np.stack(all_triage2)

    # =========================================================================
    # Application-level metrics
    # =========================================================================
    gt_binary = np.zeros_like(all_gt, dtype=np.uint8)
    for c in cfg["damage_classes"]:
        gt_binary[all_gt == c] = 1

    bin_m = binary_metrics(gt_binary.reshape(-1), all_triage2.reshape(-1))

    gt3 = np.where(all_gt <= 1, 0, np.where(all_gt == 2, 1, 2))
    t3m = triage3_metrics(gt3.reshape(-1), all_triage3.reshape(-1))

    # 5-class reference
    five_cls_m = compute_5class_metrics(all_gt, all_argmax)

    # =========================================================================
    # Print metrics
    # =========================================================================
    print("\n" + "=" * 65)
    print(f"APPLICATION METRICS ({args.split.upper()})")
    print("=" * 65)
    print(f"\n--- Binary Damage (any damage vs no damage) ---")
    print(f"  Precision : {bin_m['precision']:.4f}")
    print(f"  Recall    : {bin_m['recall']:.4f}")
    print(f"  F1        : {bin_m['f1']:.4f}")
    print(f"  IoU       : {bin_m['iou']:.4f}")
    print(f"  FPR       : {bin_m['fpr']:.4f}")
    print(f"  FNR       : {bin_m['fnr']:.4f}")

    print(f"\n--- 3-Level Triage (no_damage / DAMAGE / SEVERE) ---")
    for cls_name in TRIAGE3_NAMES:
        m = t3m[cls_name]
        print(f"  {cls_name:<12}  P={m['precision']:.4f}  R={m['recall']:.4f}  "
              f"F1={m['f1']:.4f}  IoU={m['iou']:.4f}")
    print(f"  Macro F1  : {t3m['macro_f1']:.4f}")
    print(f"  Macro IoU : {t3m['macro_iou']:.4f}")

    print(f"\n--- 5-Class Reference (V10 unchanged) ---")
    for i, name in enumerate(CLASS5_NAMES):
        print(f"  {name:<14}  IoU={five_cls_m['iou'][i]:.4f}  "
              f"F1={five_cls_m['f1'][i]:.4f}  "
              f"Rec={five_cls_m['recall'][i]:.4f}")
    print(f"  Damage mIoU  : {five_cls_m['damage_miou']:.4f}")
    print(f"  Damage mF1   : {five_cls_m['damage_mf1']:.4f}")

    # =========================================================================
    # Save metrics JSON
    # =========================================================================
    metrics_out = {
        "split":     args.split,
        "threshold": threshold,
        "min_component_area": min_area,
        "morphology_close_size": morph_size,
        "binary_damage": bin_m,
        "triage_3level": t3m,
        "5class_reference": five_cls_m,
    }

    json_name = "validation_metrics.json" if args.split == "val" else "test_metrics.json"
    json_path = out_dir / json_name
    with open(json_path, "w") as f:
        json.dump(metrics_out, f, indent=2)
    print(f"\nMetrics saved: {json_path}")

    # =========================================================================
    # Confusion matrix figures
    # =========================================================================
    # Binary
    cm_bin = np.array([
        [bin_m["tn"], bin_m["fp"]],
        [bin_m["fn"], bin_m["tp"]],
    ])
    save_confusion_matrix_fig(
        cm_bin, ["no_damage", "damage"],
        f"Binary Triage CM ({args.split})",
        out_dir / f"confusion_binary_{args.split}.png",
    )

    # 3-level
    gt3_t   = torch.from_numpy(gt3.reshape(-1).astype(np.int64))
    pred3_t = torch.from_numpy(all_triage3.reshape(-1).astype(np.int64))
    from metrics import confusion_matrix as _cm
    cm3 = _cm(pred3_t, gt3_t, num_classes=3)
    save_confusion_matrix_fig(
        cm3.numpy(), TRIAGE3_NAMES,
        f"3-Level Triage CM ({args.split})",
        out_dir / f"confusion_3level_{args.split}.png",
    )

    print(f"Confusion matrix figures saved to {out_dir}/")

    # =========================================================================
    # Visual grids
    # =========================================================================
    import random
    rng = random.Random(cfg.get("seed", 42))
    n_vis = min(cfg.get("num_visual_samples", 8), len(dataset))
    vis_indices = rng.sample(range(len(dataset)), n_vis)

    print(f"\nGenerating {n_vis} visual grids...")
    for idx in vis_indices:
        sample = dataset[idx]
        sid    = sample["id"]

        # Get pre/post from the 6-channel tensor
        pre_t  = sample["image"][:3]
        post_t = sample["image"][3:]

        vis_path = vis_dir / f"sample_{sid}.png"
        save_visual_grid(
            pre_t, post_t,
            gt_mask=all_gt[idx],
            pred_mask=all_argmax[idx],
            damage_score=all_damage_scores[idx],
            triage3=all_triage3[idx],
            triage2=all_triage2[idx],
            out_path=vis_path,
            sample_id=sid,
            cfg=cfg,
        )
    print(f"Visuals saved: {vis_dir}/")

    print("\n" + "=" * 65)
    if args.split == "val":
        print("VALIDATION COMPLETE")
        print(f"Next step: set 'selected_threshold: {best_thr}' in configs/disha_v11.yaml")
        print("Then run: python src/training/evaluate_v11.py --split test")
    else:
        print("FINAL TEST EVALUATION COMPLETE")
        print(f"Results: {json_path}")
    print("=" * 65)


if __name__ == "__main__":
    main()
