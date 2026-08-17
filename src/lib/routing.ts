import type { FeatureCollection } from 'geojson'

/**
 * Routing via the public OSRM demo server (OpenStreetMap road network).
 * Swap `OSRM_BASE` for a self-hosted OSRM/GraphHopper instance in production.
 */
export const OSRM_BASE = 'https://router.project-osrm.org'

export interface OsrmRouteResult {
  geojson: FeatureCollection
  distanceM: number
  durationS: number
  alternatives: number
}

export interface RouteRequest {
  from: [number, number]
  to: [number, number]
  alternatives?: boolean
}

export async function osrmRoute({ from, to, alternatives = true }: RouteRequest): Promise<OsrmRouteResult> {
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`
  const url =
    `${OSRM_BASE}/route/v1/driving/${coords}` +
    `?overview=full&geometries=geojson&alternatives=${alternatives}&steps=false`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Routing service unavailable (${res.status})`)

  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(data.message || 'No route found between these points')
  }

  const primary = data.routes[0]
  return {
    geojson: {
      type: 'FeatureCollection',
      features: data.routes.map((r: { geometry: FeatureCollection['features'][number]['geometry']; distance: number; duration: number }, i: number) => ({
        type: 'Feature',
        properties: {
          alt: i === 0 ? 'primary' : 'alternate',
          distance: r.distance,
          duration: r.duration,
        },
        geometry: r.geometry,
      })),
    },
    distanceM: primary.distance,
    durationS: primary.duration,
    alternatives: data.routes.length,
  }
}

export function fmtDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

export function fmtDuration(s: number): string {
  const min = Math.round(s / 60)
  if (min >= 60) return `${Math.floor(min / 60)} h ${min % 60} min`
  return `${min} min`
}
