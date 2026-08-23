import os
import time
import torch
from datetime import datetime
import traceback

# Import the existing V11 inference functions
# Ensure we can import run_inference
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import run_inference

# Global state for loaded model
MODEL = None
CONFIG = None
DEVICE = None
DEVICE_NAME = None

def init_model():
    global MODEL, CONFIG, DEVICE, DEVICE_NAME
    if MODEL is not None:
        return
        
    print("Loading V11 model configuration...")
    CONFIG = run_inference.load_config()
    
    DEVICE_NAME = "cuda" if torch.cuda.is_available() else "cpu"
    DEVICE = torch.device(DEVICE_NAME)
    
    print(f"Loading V11 checkpoint onto {DEVICE_NAME}...")
    MODEL, _ = run_inference.load_v11_model(CONFIG, DEVICE)
    print("Model loaded successfully.")

def run_analysis(pre_path: str, post_path: str):
    global MODEL, CONFIG, DEVICE, DEVICE_NAME
    if MODEL is None:
        init_model()
        
    analysis_id = f"DISHA-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    out_dir = os.path.join("outputs", "inference", analysis_id)
    os.makedirs(out_dir, exist_ok=True)
    
    try:
        # Preprocess
        input_tensor, pre_img, post_img, orig_size = run_inference.preprocess_pair(
            pre_path, post_path, CONFIG.get("image_size", 512)
        )
        
        # Predict
        start_time = time.time()
        probs = run_inference.predict(MODEL, input_tensor, DEVICE)
        inference_time = time.time() - start_time
        
        # Threshold and Morphology
        damage_score, severe_score = run_inference.calculate_damage_score(probs, CONFIG)
        binary_mask, triage_mask, raw_5class = run_inference.apply_threshold_and_morphology(
            damage_score, probs, CONFIG
        )
        
        # Generate Outputs
        binary_mask_resized, triage_mask_resized = run_inference.generate_outputs(
            pre_img, post_img, probs, damage_score, binary_mask, triage_mask, raw_5class, out_dir
        )
        
        # Build JSON
        result = run_inference.build_result_json(
            CONFIG, out_dir, pre_path, post_path, DEVICE_NAME, inference_time,
            binary_mask_resized, triage_mask_resized, orig_size
        )
        
        # Add analysis ID to result dynamically
        result["analysis_id"] = analysis_id
        
        return result, out_dir
        
    except Exception as e:
        traceback.print_exc()
        raise RuntimeError(f"Inference failed: {str(e)}")

def get_health():
    global MODEL, DEVICE_NAME
    return {
        "status": "ok",
        "service": "DISHA inference backend",
        "model": "V11",
        "model_loaded": MODEL is not None,
        "device": DEVICE_NAME if DEVICE_NAME else ("cuda" if torch.cuda.is_available() else "cpu")
    }
