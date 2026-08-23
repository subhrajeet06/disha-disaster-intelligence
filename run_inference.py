import argparse
import json
import os
import time


import sys
from datetime import datetime

try:
    import numpy as np
    import torch
    import torchvision.transforms.functional as TF
    from torchvision.transforms import InterpolationMode
    import cv2
    import matplotlib.pyplot as plt
    from scipy.ndimage import label
    import yaml
except ImportError as e:
    print(f"ERROR: {e}")
    print("\nIt looks like you are not running in the virtual environment.")
    print("Please activate the virtual environment or run the script using:")
    print("    .venv\\Scripts\\python.exe run_inference.py --pre \"before.png\" --post \"after.png\"")
    sys.exit(1)

from PIL import Image

# Add project root to sys path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

try:
    import segmentation_models_pytorch as smp
except ImportError:
    print("ERROR: Could not import segmentation_models_pytorch. Make sure you are using the virtual environment.")
    sys.exit(1)

def load_config(config_path="models/disha_v11/config.yaml"):
    try:
        with open(config_path, "r") as f:
            return yaml.safe_load(f)
    except Exception as e:
        print(f"WARNING: Could not load config from {config_path}. Using defaults. Error: {e}")
        return {
            "v10_checkpoint": "models/disha_v11/best_model_v11.pth",
            "encoder_name": "resnet34",
            "in_channels": 6,
            "num_classes": 5,
            "image_size": 512,
            "selected_threshold": 0.70,
            "min_component_area": 200,
            "grouping_3level": {
                "no_damage": [0, 1],
                "damage": [2],
                "severe": [3, 4]
            }
        }

def load_v11_model(config, device):
    checkpoint_path = config.get("v10_checkpoint", "models/disha_v11/best_model_v11.pth")
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"V11 checkpoint not found: {checkpoint_path}")
    
    encoder_name = config.get("encoder_name", "resnet34")
    in_channels = config.get("in_channels", 6)
    num_classes = config.get("num_classes", 5)

    model = smp.Unet(
        encoder_name=encoder_name,
        encoder_weights=None,
        in_channels=in_channels,
        classes=num_classes
    )
    
    checkpoint = torch.load(checkpoint_path, map_location=device)
    if "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    else:
        model.load_state_dict(checkpoint)
        
    model.to(device)
    model.eval()
    return model, checkpoint_path

def preprocess_pair(pre_path, post_path, image_size):
    try:
        pre_img = Image.open(pre_path).convert('RGB')
        post_img = Image.open(post_path).convert('RGB')
    except Exception as e:
        raise ValueError(f"Could not decode image: {e}")

    orig_size = pre_img.size # (W, H)
    if pre_img.size != post_img.size:
        print(f"WARNING: Incompatible pre/post dimensions. Pre: {pre_img.size}, Post: {post_img.size}. Using pre-disaster dimensions as base.")
        post_img = post_img.resize(pre_img.size, Image.Resampling.BILINEAR)

    pre_resized = TF.resize(pre_img, [image_size, image_size], interpolation=InterpolationMode.BILINEAR)
    post_resized = TF.resize(post_img, [image_size, image_size], interpolation=InterpolationMode.BILINEAR)
    
    pre_tensor = TF.to_tensor(pre_resized)
    post_tensor = TF.to_tensor(post_resized)
    
    # Concatenate to [6, H, W]
    image_tensor = torch.cat([pre_tensor, post_tensor], dim=0)
    
    # Add batch dimension [1, 6, H, W]
    image_tensor = image_tensor.unsqueeze(0)
    
    return image_tensor, pre_img, post_img, orig_size

def predict(model, input_tensor, device):
    input_tensor = input_tensor.to(device)
    with torch.no_grad():
        logits = model(input_tensor)
        # Apply softmax to get probabilities across classes
        probs = torch.softmax(logits, dim=1)
    return probs.squeeze(0).cpu().numpy() # [5, H, W]

def calculate_damage_score(probs, config):
    # damage_score = P(minor) + P(major) + P(destroyed)
    # classes: 2, 3, 4
    damage_classes = config.get("damage_classes", [2, 3, 4])
    severe_classes = config.get("severe_classes", [3, 4])
    
    damage_score = np.sum(probs[damage_classes, :, :], axis=0)
    severe_score = np.sum(probs[severe_classes, :, :], axis=0)
    
    return damage_score, severe_score

def apply_threshold_and_morphology(damage_score, probs, config):
    threshold = config.get("selected_threshold", 0.70)
    min_area = config.get("min_component_area", 200)
    
    # 1. Apply threshold
    binary_damage = (damage_score >= threshold).astype(np.uint8)
    
    # 2. Morphological filtering (remove connected components < min_area)
    labeled_array, num_features = label(binary_damage)
    cleaned_binary_damage = np.zeros_like(binary_damage)
    
    for i in range(1, num_features + 1):
        component_mask = (labeled_array == i)
        if np.sum(component_mask) >= min_area:
            cleaned_binary_damage[component_mask] = 1
            
    # 3. Create Triage Mask
    # 0 = GREEN (No Damage)
    # 1 = ORANGE (Damage)
    # 2 = RED (Severe Damage)
    triage_mask = np.zeros_like(cleaned_binary_damage, dtype=np.uint8)
    
    # We resolve the damage severity among candidate damage regions
    # using the original probabilities
    severe_prob = np.sum(probs[config.get("severe_classes", [3, 4]), :, :], axis=0)
    damage_prob = np.sum(probs[config.get("damage_classes", [2, 3, 4]), :, :], axis=0)
    
    # If it is damaged (cleaned_binary_damage == 1), decide if it's severe or minor
    # We can decide severe if severe_prob > minor_prob, or if severe_prob >= threshold/something.
    # V11 logic typically assigns argmax among the damage classes, or checks if severe_score > minor_score.
    # We'll use: if P(severe) > P(minor) then severe, else minor.
    minor_prob = probs[2, :, :]
    
    is_severe = (severe_prob > minor_prob) & (cleaned_binary_damage == 1)
    is_minor = (minor_prob >= severe_prob) & (cleaned_binary_damage == 1)
    
    triage_mask[is_minor] = 1
    triage_mask[is_severe] = 2
    
    # 4. Raw 5-class mask
    raw_5class = np.argmax(probs, axis=0).astype(np.uint8)
    
    return cleaned_binary_damage, triage_mask, raw_5class

def generate_outputs(pre_img, post_img, probs, damage_score, binary_mask, triage_mask, raw_5class, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    
    # Resize masks back to original image size
    orig_w, orig_h = post_img.size
    
    def resize_mask(mask, interpolation=cv2.INTER_NEAREST):
        return cv2.resize(mask, (orig_w, orig_h), interpolation=interpolation)
        
    binary_mask_resized = resize_mask(binary_mask)
    triage_mask_resized = resize_mask(triage_mask)
    raw_5class_resized = resize_mask(raw_5class)
    damage_score_resized = cv2.resize(damage_score, (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)
    
    # Save raw 5-class mask
    cv2.imwrite(os.path.join(out_dir, "raw_5class_mask.png"), raw_5class_resized)
    
    # Save binary damage mask (scale by 255 to make it visible as black/white)
    cv2.imwrite(os.path.join(out_dir, "damage_mask.png"), binary_mask_resized * 255)
    
    # Save triage mask as a colored RGB map matching green/orange/red legend
    triage_color = np.zeros((orig_h, orig_w, 3), dtype=np.uint8)
    triage_color[triage_mask_resized == 0] = [34, 197, 94]  # Green: No Damage
    triage_color[triage_mask_resized == 1] = [251, 146, 60] # Orange: Damage
    triage_color[triage_mask_resized == 2] = [220, 38, 38]  # Red: Severe Damage
    Image.fromarray(triage_color).save(os.path.join(out_dir, "triage_mask.png"))
    
    # Save probability map (heatmap)
    plt.imsave(os.path.join(out_dir, "damage_probability.png"), damage_score_resized, cmap='jet', vmin=0.0, vmax=1.0)
    
    # Generate overlay
    # GREEN = no meaningful detected damage (we won't overlay green, keep transparent)
    # ORANGE = candidate damage
    # RED = severe damage
    
    post_np = np.array(post_img)
    overlay = np.zeros_like(post_np, dtype=np.uint8)
    
    overlay[triage_mask_resized == 1] = [251, 146, 60] # Orange
    overlay[triage_mask_resized == 2] = [220, 38, 38]  # Red
    
    alpha = 0.5
    mask_indices = triage_mask_resized > 0
    final_overlay = post_np.copy()
    final_overlay[mask_indices] = cv2.addWeighted(post_np, 1 - alpha, overlay, alpha, 0)[mask_indices]
    
    Image.fromarray(final_overlay).save(os.path.join(out_dir, "damage_overlay.png"))
    
    # Generate 6-panel summary
    fig, axs = plt.subplots(2, 3, figsize=(15, 10))
    axs[0, 0].imshow(pre_img)
    axs[0, 0].set_title("Pre-disaster")
    axs[0, 0].axis("off")
    
    axs[0, 1].imshow(post_img)
    axs[0, 1].set_title("Post-disaster")
    axs[0, 1].axis("off")
    
    axs[0, 2].imshow(raw_5class_resized, cmap='viridis', vmin=0, vmax=4)
    axs[0, 2].set_title("Raw 5-class Prediction")
    axs[0, 2].axis("off")
    
    im_prob = axs[1, 0].imshow(damage_score_resized, cmap='jet', vmin=0, vmax=1)
    axs[1, 0].set_title("Damage Probability")
    axs[1, 0].axis("off")
    
    axs[1, 1].imshow(triage_mask_resized, cmap='Set1', vmin=0, vmax=2)
    axs[1, 1].set_title("Final Triage")
    axs[1, 1].axis("off")
    
    axs[1, 2].imshow(final_overlay)
    axs[1, 2].set_title("Final Overlay")
    axs[1, 2].axis("off")
    
    plt.tight_layout()
    plt.savefig(os.path.join(out_dir, "inference_summary.png"))
    plt.close()
    
    return binary_mask_resized, triage_mask_resized

def build_result_json(config, out_dir, pre_path, post_path, device_name, inference_time, binary_mask, triage_mask, orig_size):
    total_pixels = orig_size[0] * orig_size[1]
    damage_pixels = np.sum(binary_mask == 1)
    severe_pixels = np.sum(triage_mask == 2)
    
    _, num_damage_regions = label(binary_mask == 1)
    _, num_severe_regions = label(triage_mask == 2)
    
    result = {
        "status": "completed",
        "model_version": "V11",
        "checkpoint": config.get("v10_checkpoint", ""),
        "device": device_name,
        "input": {
            "pre_image": pre_path,
            "post_image": post_path
        },
        "preprocessing": {
            "input_channels": 6,
            "input_size": [config.get("image_size", 512), config.get("image_size", 512)]
        },
        "decision": {
            "damage_detected": bool(damage_pixels > 0),
            "severity": "severe" if severe_pixels > 0 else ("damage" if damage_pixels > 0 else "none"),
        },
        "statistics": {
            "total_pixels": int(total_pixels),
            "damage_pixels": int(damage_pixels),
            "severe_pixels": int(severe_pixels),
            "damage_area_percent": round(float(damage_pixels / total_pixels * 100), 2),
            "severe_area_percent": round(float(severe_pixels / total_pixels * 100), 2),
            "damage_regions": int(num_damage_regions),
            "severe_regions": int(num_severe_regions)
        },
        "parameters": {
            "damage_threshold": config.get("selected_threshold", 0.70),
            "min_component_area": config.get("min_component_area", 200)
        },
        "outputs": {
            "raw_mask": "raw_5class_mask.png",
            "damage_mask": "damage_mask.png",
            "triage_mask": "triage_mask.png",
            "damage_probability": "damage_probability.png",
            "overlay": "damage_overlay.png",
            "summary": "inference_summary.png"
        },
        "timing": {
            "inference_seconds": round(inference_time, 3)
        }
    }
    
    with open(os.path.join(out_dir, "result.json"), "w") as f:
        json.dump(result, f, indent=2)
        
    return result

def main():
    parser = argparse.ArgumentParser(description="DISHA V11 Local Inference")
    parser.add_argument("--pre", required=True, help="Path to pre-disaster image")
    parser.add_argument("--post", required=True, help="Path to post-disaster image")
    parser.add_argument("--output", default="outputs/inference", help="Base output directory")
    args = parser.parse_args()

    analysis_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = os.path.join(args.output, analysis_id)
    
    print("DISHA V11 Inference")
    print("-------------------")
    
    if not os.path.exists(args.pre):
        print(f"ERROR: Pre-disaster image not found: {args.pre}")
        sys.exit(1)
    if not os.path.exists(args.post):
        print(f"ERROR: Post-disaster image not found: {args.post}")
        sys.exit(1)
        
    config = load_config()
    
    device_name = "cuda" if torch.cuda.is_available() else "cpu"
    device = torch.device(device_name)
    if device_name == "cuda":
        gpu_name = torch.cuda.get_device_name(0)
        print(f"Device: CUDA")
        print(f"GPU: {gpu_name}")
    else:
        print("INFO: CUDA unavailable. Falling back to CPU.")
        print(f"Device: CPU")
        
    print(f"Model: V11")
    
    try:
        model, ckpt_path = load_v11_model(config, device)
        print(f"Checkpoint: {ckpt_path}")
    except Exception as e:
        print(f"ERROR: V11 checkpoint not found or failed to load: {e}")
        sys.exit(1)

    print(f"Pre image: {args.pre}")
    print(f"Post image: {args.post}")
    print(f"Input size: {config.get('image_size', 512)}")
    print(f"Threshold: {config.get('selected_threshold', 0.70)}")
    print(f"Min component area: {config.get('min_component_area', 200)}")
    print("\nRunning inference...")
    
    try:
        input_tensor, pre_img, post_img, orig_size = preprocess_pair(args.pre, args.post, config.get("image_size", 512))
    except Exception as e:
        print(f"ERROR: Could not decode image or preprocess: {e}")
        sys.exit(1)
        
    start_time = time.time()
    probs = predict(model, input_tensor, device)
    inference_time = time.time() - start_time
    
    damage_score, severe_score = calculate_damage_score(probs, config)
    
    binary_mask, triage_mask, raw_5class = apply_threshold_and_morphology(damage_score, probs, config)
    
    binary_mask_resized, triage_mask_resized = generate_outputs(
        pre_img, post_img, probs, damage_score, binary_mask, triage_mask, raw_5class, out_dir
    )
    
    result = build_result_json(
        config, out_dir, args.pre, args.post, device_name, inference_time, 
        binary_mask_resized, triage_mask_resized, orig_size
    )
    
    print("\nInference complete.")
    print(f"Damage detected: {'YES' if result['decision']['damage_detected'] else 'NO'}")
    print(f"Severity: {result['decision']['severity'].upper()}")
    # Calculate a rough mean damage score across candidate regions to print
    mean_ai_score = float(np.mean(damage_score[binary_mask == 1])) if np.any(binary_mask == 1) else 0.0
    print(f"AI Damage Score (mean over affected): {mean_ai_score:.4f}")
    print(f"Damage area: {result['statistics']['damage_area_percent']}%")
    print(f"Severe area: {result['statistics']['severe_area_percent']}%")
    print(f"Regions: {result['statistics']['damage_regions']}")
    print(f"Inference time: {result['timing']['inference_seconds']} seconds")
    print(f"\nOutputs saved to: {out_dir}")

if __name__ == "__main__":
    main()
