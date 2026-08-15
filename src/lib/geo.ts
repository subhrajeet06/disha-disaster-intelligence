export const PICKER_BOUNDS = {
  minLng: 85.4,
  maxLng: 87.1,
  minLat: 19.4,
  maxLat: 20.9,
}

export interface Projected {
  x: number
  y: number
}

export function project(lat: number, lng: number): Projected {
  const x = (lng + 180) / 360
  const latRad = (lat * Math.PI) / 180
  const y =
    1 - (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2
  return { x, y }
}

export function unproject(x: number, y: number): { lat: number; lng: number } {
  const clampedY = Math.min(0.999, Math.max(0.001, y))
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * clampedY)))
  return { lat: (latRad * 180) / Math.PI, lng: x * 360 - 180 }
}

/** Convert a screen position inside a container (0..1) to lat/lng within the picker bounds. */
export function pickToLatLng(px: number, py: number): { lat: number; lng: number } {
  const b = PICKER_BOUNDS
  const pMin = project(b.minLat, b.minLng)
  const pMax = project(b.maxLat, b.maxLng)
  const nx = (pMax.x - pMin.x) * px + pMin.x
  const ny = (pMax.y - pMin.y) * py + pMin.y
  return unproject(nx, ny)
}

export function latLngToPick(lat: number, lng: number): { left: number; top: number } {
  const b = PICKER_BOUNDS
  const p = project(lat, lng)
  const pMin = project(b.minLat, b.minLng)
  const pMax = project(b.maxLat, b.maxLng)
  return {
    left: ((p.x - pMin.x) / (pMax.x - pMin.x)) * 100,
    top: ((p.y - pMin.y) / (pMax.y - pMin.y)) * 100,
  }
}

export function roundCoord(n: number): number {
  return Math.round(n * 100000) / 100000
}
