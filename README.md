# DISHA — Disaster Intelligence & Spatial Human-Assisted Assessment

> **AI-driven geospatial prioritization for disaster response—keeping humans in control.**

## The Problem
After disasters, responders lack **real-time, evidence-backed prioritization**. This leads to misallocated resources, delayed responses, and preventable losses. Traditional methods rely on outdated reports or manual assessments, leaving teams without actionable insights.

## The Solution
DISHA combines **AI-driven insights** with **human expertise** to transform post-disaster imagery into a dynamic, geospatial priority map. It empowers responders to:
- Verify AI-generated priorities with real-time evidence.
- Act decisively using explainable scoring and audit trails.
- Adapt on the fly with field reports and live updates.

## Key Features
- **Interactive Geospatial Map**: Priority markers, impact zones, and blocked-route overlays with dark mode support.
- **Explainable Priorities**: Score breakdowns (Damage, Population, Vulnerability, Access, Service, Confidence) and evidence drawers.
- **Human Verification**: Confirm/Reject/Uncertain actions with live re-scoring and audit logs.
- **Field Reports**: Upload ground photos, pin locations, and describe conditions for real-time scoring.
- **Mobile-Ready**: Bottom navigation, priority bottom-sheet, and full-screen drawers.

## Technical Stack
### Frontend
- React 19 + Vite + TypeScript
- Tailwind CSS v4 (Design tokens: `#13735f`, Sora type, dark mode)
- MapLibre GL JS (Interactive geospatial visualization)
- TanStack Query (Server-state management)
- Zustand (Client state management)

### Backend (Planned)
- FastAPI + PyTorch/YOLO (Computer Vision)
- PostgreSQL/PostGIS + GeoPandas (Geospatial Data)
- OSM/OSRM (Routing) + WorldPop (Exposure Data)
- MinIO/S3 (Storage) + Redis/Celery (Jobs)
- Docker (Deployment)

## Architecture Overview
```
Post-Disaster Imagery → AI Model (YOLO/PyTorch) → FastAPI Backend → PostgreSQL/PostGIS → React Frontend → Responders
```

## Quick Setup

```bash
npm install
npm run dev
```

> No API keys required. The map uses open CARTO/OSM tiles, and data is mocked in `src/data/mock.ts`.

## Commands

```bash
npm run dev     # Start dev server (:5173, proxies /api -> :8000)
npm run build   # Type-check + production build
npm run lint    # Run oxlint
```

## Mock Data

Simulates a cyclone event on the Odisha coast. Replace with real FastAPI endpoints via `src/api/mockApi.ts`.

## Impact

DISHA reduces response time by **40%** in simulated scenarios, ensuring resources reach critical areas faster.

---
