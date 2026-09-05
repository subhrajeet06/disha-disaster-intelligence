import requests
try:
    res = requests.post("http://localhost:8000/api/incidents/e502649d-9ff2-4509-adb8-087dc839a01c/assess", timeout=5)
    print(res.status_code)
    print(res.text)
except Exception as e:
    print("Error:", e)
