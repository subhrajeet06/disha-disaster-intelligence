# DISHA — Frontend Command Dashboard

Frontend for **DISHA (Disaster Intelligence & Spatial Human-Assisted Assessment)** — the S34 IDEATHON entry.
A responder command dashboard that turns post-disaster imagery into an evidence-backed, geospatial priority map,
keeping humans in control of the final decision.

Built from the design tokens in `wilderness-international.design.md` and the feature map in the project outline.

## Stack

Frontend (in use):

- React 19 + Vite + TypeScript
- Tailwind CSS v4 (design tokens: `#13735f`, Sora type, class-based dark mode)
- MapLibre GL JS (`maplibre-gl`) — interactive geospatial visualization
- TanStack Query — server-state / mock API layer
- Zustand — client state (verification, filters, audit, toasts, theme)

Backend (planned, matches the project's FINAL TECH STACK):

- Python + FastAPI, PyTorch + YOLO-family CV, OpenCV + Albumentations
- PostgreSQL + PostGIS, GeoPandas / Shapely / Rasterio
- OSM / OSRM routing, WorldPop exposure, Google Open Buildings
- MinIO/S3 storage, Redis + Celery jobs, JWT + RBAC, ReportLab + Pandas reports
- Docker + Docker Compose deployment

## Setup

```bash
npm install
npm run dev
```

No API keys are required — the map uses open CARTO + OSM tiles and all data is
mocked in `src/data/mock.ts`.

## Commands

```bash
npm run dev     # start dev server on :5173 (proxies /api -> :8000)
npm run build   # type-check + production build
npm run lint    # oxlint
```

## What's inside

- **Command Overview** — clickable KPI strip (buildings / roads / services / population / confidence) that filters the map.
- **Map** — MapLibre map with ranked priority markers, impact zones, and blocked-route overlays. Dark mode swaps to a dark basemap.
- **Response priorities** — ranked list with explainable score rings; filter by pending / verified.
- **Evidence drawer** — "why #N", score-factor breakdown (Damage 30 / Population 20 / Vulnerability 20 /
  Access 15 / Service 10 / Confidence 5), imagery + detection + context evidence, and model audit.
- **Human verification** — Confirm / Reject / Uncertain / Correct-road actions that re-score, toast, and log to the
  live audit trail.
- **Field reports** — responders upload a ground photo, pin its location (tap the picker map, GPS, or manual
  coordinates), and describe the condition (damage severity, road status, service impact, population exposure).
  The report is scored live by the same priority engine, added to the map and queue as a distinct blue "Field report"
  marker, and stored as evidence.
- **Dark mode** — class-based theme, respects the saved preference / system `prefers-color-scheme`, toggled from the top bar.
- **Mobile** — bottom navigation, priority bottom-sheet, full-screen drawer, scrollable KPI cards.

## Mock data

All data in `src/data/mock.ts` simulates a cyclone event on the Odisha coast. Swap it for the real FastAPI
endpoints (see `/api` proxy in `vite.config.ts`) via `src/api/mockApi.ts`.
