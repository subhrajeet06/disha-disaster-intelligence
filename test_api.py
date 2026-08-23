import requests
import time
import os

API_URL = "http://localhost:8000/api/inference"
HEALTH_URL = "http://localhost:8000/api/health"

PRE_IMAGE = "train/images/guatemala-volcano_00000000_pre_disaster.png"
POST_IMAGE = "train/images/guatemala-volcano_00000000_post_disaster.png"

def test_health():
    print("Testing /api/health...")
    resp = requests.get(HEALTH_URL)
    print(f"Status: {resp.status_code}")
    print(resp.json())
    assert resp.status_code == 200

def test_missing_files():
    print("\nTesting missing files...")
    # Provide no files
    resp = requests.post(API_URL, files={})
    print(f"Status: {resp.status_code}")
    print(resp.json())
    assert resp.status_code == 422 # FastAPI built-in validation error for missing fields

def test_valid_inference():
    print("\nTesting valid inference...")
    
    if not os.path.exists(PRE_IMAGE) or not os.path.exists(POST_IMAGE):
        print(f"Test skipped: images not found at {PRE_IMAGE} or {POST_IMAGE}")
        return
        
    with open(PRE_IMAGE, "rb") as f_pre, open(POST_IMAGE, "rb") as f_post:
        files = {
            "pre_image": ("pre.png", f_pre, "image/png"),
            "post_image": ("post.png", f_post, "image/png"),
        }
        
        start_time = time.time()
        resp = requests.post(API_URL, files=files)
        elapsed = time.time() - start_time
        
        print(f"Status: {resp.status_code}")
        print(f"Time taken: {elapsed:.2f}s")
        result = resp.json()
        print(result)
        
        assert resp.status_code == 200
        assert "analysis_id" in result
        assert result["status"] == "completed"
        
        # Test output URL access
        overlay_url = result["outputs"]["overlay"]
        print(f"\nTesting output URL access: {overlay_url}")
        img_resp = requests.get(overlay_url)
        print(f"Image fetch status: {img_resp.status_code}")
        assert img_resp.status_code == 200
        
        print("\nAll tests passed successfully!")

if __name__ == "__main__":
    test_health()
    test_missing_files()
    test_valid_inference()
