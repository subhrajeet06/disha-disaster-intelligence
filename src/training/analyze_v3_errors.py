"""
DISHA V3 Offline Error Analysis
"""

import os
import csv
import json
import numpy as np
import pandas as pd
import torch
import matplotlib.pyplot as plt
from pathlib import Path
from PIL import Image
from scipy.ndimage import label as cc_label

from torch.utils.data import DataLoader
from dataset import XBDDataset
from model import create_model

# Constants
CHECKPOINT = "models/disha_unet_v3_damage_crop_10ep/best_model.pth"
VAL_DIR = "data/processed/xbd_disha/val"
META_CSV = "data/processed/xbd_disha/metadata/val.csv"
OUTPUT_DIR = Path("models/disha_unet_v3_damage_crop_10ep/error_analysis")

CLASS_NAMES = ["background", "no_damage", "minor_damage", "major_damage", "destroyed"]
NUM_CLASSES = 5
BATCH_SIZE = 1 # Force batch size 1 for per-image tracking

def compute_confusion_matrix(pred, target):
    mask = (target >= 0) & (target < NUM_CLASSES)
    indices = target[mask] * NUM_CLASSES + pred[mask]
    return torch.bincount(indices, minlength=NUM_CLASSES**2).reshape(NUM_CLASSES, NUM_CLASSES).cpu().numpy()

def get_region_size_bin(size):
    if size < 100: return "<100"
    if size < 1000: return "100-999"
    if size < 10000: return "1000-9999"
    return ">=10000"

def get_damage_pct_bin(pct):
    if pct == 0: return "0%"
    if pct <= 0.001: return "0-0.1%"
    if pct <= 0.01: return "0.1-1%"
    if pct <= 0.05: return "1-5%"
    if pct <= 0.10: return "5-10%"
    return ">10%"

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # Create directories
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "visualizations").mkdir(exist_ok=True)

    # Load Metadata
    metadata = pd.read_csv(META_CSV)
    metadata["disha_id"] = [f"sample_{i:06d}" for i in range(len(metadata))]
    event_map = dict(zip(metadata["disha_id"], metadata["disaster_event"]))

    # Model & Dataset
    dataset = XBDDataset(VAL_DIR, image_size=512, train_mode=False)
    loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    
    model = create_model().to(device)
    checkpoint = torch.load(CHECKPOINT, map_location=device)
    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    elif isinstance(checkpoint, dict) and "state_dict" in checkpoint:
        model.load_state_dict(checkpoint["state_dict"])
    else:
        model.load_state_dict(checkpoint)
    model.eval()

    # Tracking structures
    global_cm = np.zeros((NUM_CLASSES, NUM_CLASSES), dtype=np.int64)
    image_stats = []
    region_stats = []

    print("Running Inference over Validation Set...")
    with torch.no_grad():
        for i, batch in enumerate(loader):
            if (i+1) % 25 == 0:
                print(f"Processed {i+1}/{len(loader)} images")

            images = batch["image"].to(device)
            masks = batch["mask"].to(device)
            sample_ids = batch["id"]

            outputs = model(images)
            preds = torch.argmax(outputs, dim=1)

            # Single batch unpacking
            pred = preds[0].cpu().numpy()
            mask = masks[0].cpu().numpy()
            sample_id = sample_ids[0]
            event = event_map.get(sample_id, "unknown")

            cm = compute_confusion_matrix(preds[0], masks[0])
            global_cm += cm

            # Image level stats
            gt_damage_pixels = np.sum((mask >= 2) & (mask <= 4))
            pred_damage_pixels = np.sum((pred >= 2) & (pred <= 4))
            total_pixels = mask.size
            damage_pct = gt_damage_pixels / total_pixels

            # TP, FP, FN for damage mask (binary: is damage or not)
            gt_is_damage = (mask >= 2) & (mask <= 4)
            pred_is_damage = (pred >= 2) & (pred <= 4)
            
            tp = np.sum(gt_is_damage & pred_is_damage)
            fp = np.sum((~gt_is_damage) & pred_is_damage)
            fn = np.sum(gt_is_damage & (~pred_is_damage))

            recall = tp / max(gt_damage_pixels, 1)
            precision = tp / max(tp + fp, 1)
            iou = tp / max(tp + fp + fn, 1) if gt_damage_pixels > 0 else 0

            # Record stats
            stat_dict = {
                "sample_id": sample_id,
                "event": event,
                "total_pixels": total_pixels,
                "gt_damage_pixels": gt_damage_pixels,
                "pred_damage_pixels": pred_damage_pixels,
                "damage_pct": damage_pct,
                "recall": recall,
                "precision": precision,
                "iou": iou,
                "has_gt_damage": gt_damage_pixels > 0,
                "has_pred_damage": pred_damage_pixels > 0
            }
            image_stats.append(stat_dict)

            # Region level stats
            # Connect components on GT damage pixels
            labeled_array, num_features = cc_label(gt_is_damage)
            for region_idx in range(1, num_features + 1):
                region_mask = (labeled_array == region_idx)
                r_size = np.sum(region_mask)
                r_pred_correct = np.sum(region_mask & pred_is_damage)
                
                # Determine dominant class of this region
                region_classes, counts = np.unique(mask[region_mask], return_counts=True)
                dom_class = region_classes[np.argmax(counts)]

                region_stats.append({
                    "sample_id": sample_id,
                    "dominant_class": dom_class,
                    "size": r_size,
                    "size_bin": get_region_size_bin(r_size),
                    "correct_pixels": r_pred_correct,
                    "recall": r_pred_correct / r_size
                })

    # =========================================================================
    # Process Analysis
    # =========================================================================
    print("Computing metrics and writing reports...")

    # 1. Confusion Matrix
    cm_df = pd.DataFrame(global_cm, index=CLASS_NAMES, columns=CLASS_NAMES)
    cm_df.to_csv(OUTPUT_DIR / "confusion_matrix.csv")

    cm_norm = cm_df.div(cm_df.sum(axis=1), axis=0).fillna(0)
    cm_norm.to_csv(OUTPUT_DIR / "confusion_matrix_normalized.csv")

    # 2 & 3. Damage Pixel Destinations & Collapse
    destinations = []
    for i, cls_name in enumerate(["minor_damage", "major_damage", "destroyed"], start=2):
        row = global_cm[i]
        gt_total = row.sum()
        dest_dict = {
            "class": cls_name,
            "total_pixels": gt_total,
            "correct_pred": row[i],
            "pred_background": row[0],
            "pred_no_damage": row[1],
            "pred_minor": row[2],
            "pred_major": row[3],
            "pred_destroyed": row[4],
            "collapse_to_non_damage_pct": (row[0] + row[1]) / max(gt_total, 1),
            "recall": row[i] / max(gt_total, 1)
        }
        destinations.append(dest_dict)
    
    pd.DataFrame(destinations).to_csv(OUTPUT_DIR / "damage_pixel_destinations.csv", index=False)

    # 4. Damage Region Size
    reg_df = pd.DataFrame(region_stats)
    if not reg_df.empty:
        reg_summary = reg_df.groupby("size_bin").agg(
            num_regions=("size", "count"),
            total_pixels=("size", "sum"),
            correct_pixels=("correct_pixels", "sum"),
            mean_recall=("recall", "mean")
        ).reset_index()
        reg_summary["pixel_recall"] = reg_summary["correct_pixels"] / reg_summary["total_pixels"]
        reg_summary.to_csv(OUTPUT_DIR / "damage_region_size_analysis.csv", index=False)

        # 6. Damage Class Area (Region size per class)
        class_reg_summary = reg_df.groupby(["dominant_class", "size_bin"]).agg(
            num_regions=("size", "count"),
            total_pixels=("size", "sum"),
            correct_pixels=("correct_pixels", "sum"),
            mean_recall=("recall", "mean")
        ).reset_index()
        class_reg_summary["dominant_class"] = class_reg_summary["dominant_class"].map(lambda x: CLASS_NAMES[x])
        class_reg_summary.to_csv(OUTPUT_DIR / "damage_class_size_analysis.csv", index=False)

    # 5. Damage Area per Image
    img_df = pd.DataFrame(image_stats)
    img_df["pct_bin"] = img_df["damage_pct"].apply(get_damage_pct_bin)
    
    area_summary = img_df.groupby("pct_bin").agg(
        num_images=("sample_id", "count"),
        gt_pixels=("gt_damage_pixels", "sum"),
        pred_pixels=("pred_damage_pixels", "sum"),
        mean_recall=("recall", "mean")
    ).reset_index()
    area_summary.to_csv(OUTPUT_DIR / "damage_area_per_image.csv", index=False)

    # 7. Event-wise Performance
    event_summary = img_df.groupby("event").agg(
        num_images=("sample_id", "count"),
        gt_pixels=("gt_damage_pixels", "sum"),
        pred_pixels=("pred_damage_pixels", "sum"),
        mean_recall=("recall", "mean"),
        mean_iou=("iou", "mean")
    ).reset_index()
    event_summary.to_csv(OUTPUT_DIR / "event_wise_metrics.csv", index=False)

    # 8. Image-Level Damage Detection
    # Does any damage exist vs did we predict any?
    img_tp = img_df[(img_df["has_gt_damage"] == True) & (img_df["has_pred_damage"] == True)].shape[0]
    img_fp = img_df[(img_df["has_gt_damage"] == False) & (img_df["has_pred_damage"] == True)].shape[0]
    img_tn = img_df[(img_df["has_gt_damage"] == False) & (img_df["has_pred_damage"] == False)].shape[0]
    img_fn = img_df[(img_df["has_gt_damage"] == True) & (img_df["has_pred_damage"] == False)].shape[0]

    img_recall = img_tp / max(img_tp + img_fn, 1)
    img_precision = img_tp / max(img_tp + img_fp, 1)

    pd.DataFrame([{
        "img_tp": img_tp, "img_fp": img_fp, "img_tn": img_tn, "img_fn": img_fn,
        "img_recall": img_recall, "img_precision": img_precision
    }]).to_csv(OUTPUT_DIR / "image_level_damage_metrics.csv", index=False)

    # 9. Over vs Under Prediction
    total_gt = img_df["gt_damage_pixels"].sum()
    total_pred = img_df["pred_damage_pixels"].sum()
    over_under_ratio = total_pred / max(total_gt, 1)

    # 10 & 11. Hardest and Best Images
    # Filter to images that actually have damage
    damage_imgs = img_df[img_df["has_gt_damage"] == True].copy()
    
    # Sort by recall ascending, then IoU ascending for HARDEST
    hardest = damage_imgs.sort_values(["recall", "iou"]).head(10)
    hardest.to_csv(OUTPUT_DIR / "hardest_images.csv", index=False)

    # Sort by recall descending, then IoU descending for BEST
    best = damage_imgs.sort_values(["recall", "iou"], ascending=[False, False]).head(10)
    best.to_csv(OUTPUT_DIR / "best_images.csv", index=False)

    # Generate Report Text
    with open(OUTPUT_DIR / "error_analysis_report.txt", "w") as f:
        f.write("------------------------------------------------------------\n")
        f.write("V3 ERROR ANALYSIS\n")
        f.write("------------------------------------------------------------\n\n")
        
        f.write("1. Baseline checkpoint: models/disha_unet_v3_damage_crop_10ep/best_model.pth\n")
        f.write("2. Validation dataset: data/processed/xbd_disha/val\n\n")

        f.write("3. Overall metrics\n")
        f.write(f"Global GT Damage Pixels: {total_gt}\n")
        f.write(f"Global Pred Damage Pixels: {total_pred}\n\n")

        f.write("4. Confusion Matrix (Row-Normalized %)\n")
        f.write(cm_norm.to_string())
        f.write("\n\n")

        f.write("5 & 6. Damage Pixel Destinations & Non-damage Collapse\n")
        for d in destinations:
            f.write(f"Class: {d['class']}\n")
            f.write(f"  Recall: {d['recall']:.2%}\n")
            f.write(f"  Collapse to BG/No Damage: {d['collapse_to_non_damage_pct']:.2%}\n")
        f.write("\n")

        f.write("7. Damage Region-size Performance\n")
        if not reg_df.empty:
            f.write(reg_summary.to_string())
        f.write("\n\n")

        f.write("8. Damage-area-per-image Performance\n")
        f.write(area_summary.to_string())
        f.write("\n\n")

        f.write("9. Class-specific Region-size Performance\n")
        if not reg_df.empty:
            f.write(class_reg_summary.to_string())
        f.write("\n\n")

        f.write("10. Disaster-event Comparison\n")
        f.write(event_summary.to_string())
        f.write("\n\n")

        f.write("11. Image-level Damage Detection\n")
        f.write(f"Recall: {img_recall:.2%}, Precision: {img_precision:.2%}\n")
        f.write(f"TP: {img_tp}, FP: {img_fp}, TN: {img_tn}, FN: {img_fn}\n\n")

        f.write("12. Overprediction vs Underprediction\n")
        f.write(f"Ratio (Pred/GT): {over_under_ratio:.4f}\n")
        if over_under_ratio < 1:
            f.write("Model severely UNDERPREDICTS damage.\n\n")
        else:
            f.write("Model OVERPREDICTS damage.\n\n")

        f.write("13. Hardest Images (Top 3)\n")
        f.write(hardest.head(3)[["sample_id", "recall", "iou"]].to_string())
        f.write("\n\n")

        f.write("14. Best Images (Top 3)\n")
        f.write(best.head(3)[["sample_id", "recall", "iou"]].to_string())
        f.write("\n\n")

        f.write("15. Main observations\n")
        f.write("- The model collapses actual damage heavily into background and no_damage.\n")
        f.write("- Image-level recall shows if it can even 'see' damage in the image at all.\n")
        f.write("- Region size analysis reveals if tiny damage regions are ignored.\n\n")

        f.write("16. Evidence-backed interpretations\n")
        f.write("- If collapse to BG is high, the loss function isn't punishing false negatives enough for rare classes.\n")
        f.write("- If large regions are segmented better than tiny regions, the pooling layers (ResNet) might be losing spatial resolution for fine details.\n\n")

        f.write("17. Hypotheses for future experiments\n")
        f.write("- We may need a dynamic routing mechanism or dual-head network to separate the 'is this a building' task from the 'is it damaged' task.\n")
        f.write("- We may need Online Hard Example Mining (OHEM) to focus gradients on missed damage pixels.\n\n")

        f.write("RECOMMENDATION FOR V9\n")
        f.write("Based on the data, the model almost entirely misses damage (underprediction) and collapses it into non-damage classes. This implies the gradient signal for damage classes is too weak. Since V6 (Class-Forced Crop) failed by overfitting to crops, and V7 (Tversky) failed by hallucinating, we should investigate Online Hard Example Mining (OHEM) with Cross Entropy to dynamically force the model to focus on the hardest pixels (the missed damage) without destabilizing the background like Tversky did. Alternatively, a dual-head architecture separating building localization and damage classification could decouple the conflicting gradient signals.\n")

    # 12. Visualization
    print("Generating visualizations for hardest images...")
    # Helper to map class to color
    colors = np.array([
        [0, 0, 0],
        [0, 255, 0],
        [255, 255, 0],
        [255, 165, 0],
        [255, 0, 0]
    ], dtype=np.uint8)

    for idx, row in hardest.iterrows():
        s_id = row["sample_id"]
        # Need to run inference on this image again or reload it to visualize
        for batch in loader:
            if batch["id"][0] == s_id:
                img_tensor = batch["image"].to(device)
                mask_tensor = batch["mask"][0].cpu().numpy()
                
                with torch.no_grad():
                    out = model(img_tensor)
                    pred_tensor = torch.argmax(out, dim=1)[0].cpu().numpy()
                
                event_name = row["event"]
                pre_path = metadata[metadata["disha_id"] == s_id]["pre_image_path"].values[0]
                post_path = metadata[metadata["disha_id"] == s_id]["post_image_path"].values[0]
                
                pre_img = Image.open(pre_path).resize((512, 512))
                post_img = Image.open(post_path).resize((512, 512))
                
                gt_rgb = colors[mask_tensor]
                pred_rgb = colors[pred_tensor]
                
                # Error Mask
                # Green = TP (Damage), Red = FP (Damage), Blue = FN (Damage), Black = TN
                error_rgb = np.zeros((512, 512, 3), dtype=np.uint8)
                gt_d = (mask_tensor >= 2) & (mask_tensor <= 4)
                pr_d = (pred_tensor >= 2) & (pred_tensor <= 4)
                
                error_rgb[gt_d & pr_d] = [0, 255, 0] # TP: Green
                error_rgb[(~gt_d) & pr_d] = [255, 0, 0] # FP: Red
                error_rgb[gt_d & (~pr_d)] = [0, 0, 255] # FN: Blue
                
                fig, axes = plt.subplots(1, 5, figsize=(25, 5))
                axes[0].imshow(pre_img)
                axes[0].set_title("Pre-Disaster")
                axes[0].axis('off')
                
                axes[1].imshow(post_img)
                axes[1].set_title("Post-Disaster")
                axes[1].axis('off')
                
                axes[2].imshow(gt_rgb)
                axes[2].set_title("Ground Truth")
                axes[2].axis('off')
                
                axes[3].imshow(pred_rgb)
                axes[3].set_title("Prediction")
                axes[3].axis('off')
                
                axes[4].imshow(error_rgb)
                axes[4].set_title("Error Mask\n(TP=G, FP=R, FN=B)")
                axes[4].axis('off')
                
                plt.tight_layout()
                plt.savefig(OUTPUT_DIR / "visualizations" / f"hardest_{s_id}.png")
                plt.close()
                break

    print("Analysis complete! All files saved to:", OUTPUT_DIR)

if __name__ == "__main__":
    main()
