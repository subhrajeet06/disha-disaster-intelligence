const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface V11HealthResponse {
  status: string;
  service: string;
  model: string;
  model_loaded: boolean;
  device: string;
}

export interface V11InferenceResponse {
  status: string;
  analysis_id: string;
  model_version: string;
  device: string;
  decision: {
    damage_detected: boolean;
    severity: 'none' | 'minor' | 'moderate' | 'severe' | 'critical';
  };
  statistics?: {
    total_pixels: number;
    damage_pixels: number;
    severe_pixels: number;
    damage_area_percent: number;
    severe_area_percent: number;
    damage_regions: number;
    severe_regions: number;
  };
  parameters: {
    damage_threshold: number;
    min_component_area: number;
  };
  outputs: {
    raw_mask: string;
    damage_mask: string;
    triage_mask: string;
    damage_probability: string;
    overlay: string;
    summary: string;
  };
  timing: {
    inference_seconds: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export const v11Api = {
  checkV11Health: async (): Promise<V11HealthResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      if (!response.ok) {
        throw new Error('Backend health check failed');
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to check V11 health:', error);
      throw error;
    }
  },

  runV11Inference: async (preFile: File, postFile: File): Promise<V11InferenceResponse> => {
    const formData = new FormData();
    formData.append('pre_image', preFile);
    formData.append('post_image', postFile);

    try {
      const response = await fetch(`${API_BASE_URL}/api/inference`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        // Attempt to parse JSON error message if possible
        let errorMsg = `Server error: ${response.status} ${response.statusText}`;
        try {
            const errorJson = await response.json();
            if (errorJson.error?.message) {
                errorMsg = errorJson.error.message;
            } else if (errorJson.detail) {
                // FastAPI default error structure
                errorMsg = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
            }
        } catch (e) {
            // Ignore parse errors on failed requests
        }
        throw new Error(errorMsg);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to run V11 inference:', error);
      throw error;
    }
  }
};
