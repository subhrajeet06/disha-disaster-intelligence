from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import shutil
from typing import Optional
from contextlib import asynccontextmanager

from backend import inference_service

# The static output directory
OUTPUTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'outputs', 'inference'))
os.makedirs(OUTPUTS_DIR, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load model on startup
    try:
        inference_service.init_model()
    except Exception as e:
        print(f"Warning: Failed to load model on startup: {e}")
    yield
    # Cleanup on shutdown (if needed)

app = FastAPI(title="DISHA V11 Inference API", lifespan=lifespan)

# Allow CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the outputs folder statically
app.mount("/api/inference/outputs", StaticFiles(directory=OUTPUTS_DIR), name="outputs")

@app.get("/api/health")
async def health_check():
    return inference_service.get_health()

@app.post("/api/inference")
async def run_inference(
    request: Request,
    pre_image: UploadFile = File(...),
    post_image: UploadFile = File(...)
):
    if not pre_image.filename or not post_image.filename:
        raise HTTPException(status_code=400, detail="Both pre_image and post_image are required.")
    
    # Save the files temporarily for inference
    temp_dir = os.path.join(OUTPUTS_DIR, "temp_uploads")
    os.makedirs(temp_dir, exist_ok=True)
    
    pre_path = os.path.join(temp_dir, f"pre_{pre_image.filename}")
    post_path = os.path.join(temp_dir, f"post_{post_image.filename}")
    
    try:
        with open(pre_path, "wb") as buffer:
            shutil.copyfileobj(pre_image.file, buffer)
        with open(post_path, "wb") as buffer:
            shutil.copyfileobj(post_image.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded files: {str(e)}")
        
    try:
        # Run inference
        result, out_dir = inference_service.run_analysis(pre_path, post_path)
        
        # Modify result JSON to provide full HTTP URLs for outputs
        base_url = str(request.base_url).rstrip("/")
        # The result output paths are local relative (e.g. outputs/inference/DISHA-XXX/image.png)
        # Convert them to point to /api/inference/outputs/DISHA-XXX/image.png
        analysis_id = result.get("analysis_id")
        
        if "outputs" in result:
            for key, local_path in result["outputs"].items():
                filename = os.path.basename(local_path)
                result["outputs"][key] = f"{base_url}/api/inference/outputs/{analysis_id}/{filename}"
                
        return result
    except Exception as e:
        # Avoid exposing raw exception traces
        error_msg = str(e)
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": error_msg
                }
            }
        )
    finally:
        # Clean up temporary uploads
        if os.path.exists(pre_path):
            os.remove(pre_path)
        if os.path.exists(post_path):
            os.remove(post_path)
