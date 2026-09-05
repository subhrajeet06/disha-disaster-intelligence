import requests
try:
    res = requests.get("http://localhost:8000/api/incidents", timeout=2)
    print(res.status_code, res.text[:200])
except Exception as e:
    print("Error:", e)
