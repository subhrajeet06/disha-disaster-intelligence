import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { useAppStore } from '../../store/useAppStore'
import { useMapLocations, useRankedLocations } from '../../store/useAppStore'
import { sevHex, fmtInt } from '../../lib/format'
import { MAP_CENTER } from './constants'
import { FACILITIES } from '../../data/mock'
import type { PriorityLocation } from '../../types'

const BASEMAPS = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const

function baseStyle(theme: 'light' | 'dark'): string {
  return BASEMAPS[theme]
}

function emptyFC(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

function webgl2Supported(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(window.WebGL2RenderingContext && c.getContext('webgl2'))
  } catch {
    return false
  }
}

function markerSvg(loc: PriorityLocation): string {
  if (loc.isFieldReport) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='54' height='54'>
  <circle cx='27' cy='27' r='24' fill='#0000ee' stroke='#ffffff' stroke-width='4'/>
  <rect x='18' y='21' width='18' height='13' rx='2' fill='#ffffff'/>
  <circle cx='27' cy='27.5' r='4' fill='#0000ee'/>
  <rect x='34' y='22' width='2' height='4' rx='1' fill='#ffffff'/>
</svg>`
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }
  const color = sevHex(loc.damageLevel)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='54' height='54'>
  <circle cx='27' cy='27' r='24' fill='${color}' stroke='#ffffff' stroke-width='4'/>
  <circle cx='27' cy='27' r='24' fill='none' stroke='${color}' stroke-opacity='0.35' stroke-width='2'/>
  <text x='27' y='33' text-anchor='middle' font-family='Sora, Arial, sans-serif' font-size='17' font-weight='700' fill='#ffffff'>${loc.rank}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function impactCircleSvg(color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
  <circle cx='80' cy='80' r='78' fill='${color}' fill-opacity='0.14' stroke='${color}' stroke-opacity='0.3' stroke-width='2'/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function facilitySvg(): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>
  <path d='M16 2 L28 27 H4 Z' fill='#13735f' stroke='#ffffff' stroke-width='2.5'/>
  <circle cx='16' cy='18' r='4.5' fill='#ffffff'/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function buildRoadsGeo(locations: PriorityLocation[], fieldReports: PriorityLocation[]): FeatureCollection {
  const links: Array<{ from: [number, number]; to: [number, number]; blocked: 'yes' | 'no' }> = []
  const linkFor = (l: PriorityLocation) => {
    if (l.roadStatus !== 'blocked') return
    const f = FACILITIES[l.nearestFacility]
    const to: [number, number] = f
      ? f
      : [l.lng + (Math.random() * 0.14 + 0.06), l.lat - (Math.random() * 0.1 + 0.04)]
    links.push({ from: [l.lng, l.lat], to, blocked: 'yes' })
  }
  locations.forEach(linkFor)
  fieldReports.forEach((r) => {
    if (r.roadStatus !== 'blocked') return
    const f = FACILITIES[r.nearestFacility]
    links.push({
      from: [r.lng, r.lat],
      to: f ?? [r.lng + 0.08, r.lat - 0.06],
      blocked: 'yes',
    })
  })
  return {
    type: 'FeatureCollection',
    features: links.map((link) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [link.from, link.to],
      },
      properties: { blocked: link.blocked },
    })),
  }
}

/* WorldPop population-exposure layer (sample grid from the scenario data). */
function buildPopulationGeo(locations: PriorityLocation[], fieldReports: PriorityLocation[]): FeatureCollection {
  const all = [...locations, ...fieldReports]
  return {
    type: 'FeatureCollection',
    features: all.map((l) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [l.lng, l.lat] },
      properties: { population: l.affectedPopulation, name: l.name },
    })),
  }
}

/* Google Open Buildings footprint layer — squares scaled by affected footprint count. */
function buildBuildingsGeo(locations: PriorityLocation[], fieldReports: PriorityLocation[]): FeatureCollection {
  const all = [...locations, ...fieldReports]
  return {
    type: 'FeatureCollection',
    features: all.map((l) => {
      const half = 0.0007 + Math.sqrt(l.buildingsAffected) * 0.0011
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [l.lng - half, l.lat - half],
              [l.lng + half, l.lat - half],
              [l.lng + half, l.lat + half],
              [l.lng - half, l.lat + half],
              [l.lng - half, l.lat - half],
            ],
          ],
        },
        properties: { buildings: l.buildingsAffected, name: l.name },
      }
    }),
  }
}

function setLayerVisibility(map: maplibregl.Map, id: string, visible: boolean) {
  if (!map.getLayer(id)) return
  map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
}

function addOverlayLayers(map: maplibregl.Map) {
  if (!map.getSource('roads')) {
    map.addSource('roads', { type: 'geojson', data: emptyFC() })
    map.addLayer({
      id: 'roads-line',
      type: 'line',
      source: 'roads',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#c0392b',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 6],
        'line-opacity': 0.9,
      },
    })
  }

  if (!map.getSource('population')) {
    map.addSource('population', { type: 'geojson', data: emptyFC() })
    map.addLayer({
      id: 'population-circle',
      type: 'circle',
      source: 'population',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 'population']], 50, 10, 205, 48],
        'circle-color': '#7a5aa8',
        'circle-opacity': 0.5,
        'circle-stroke-color': '#7a5aa8',
        'circle-stroke-width': 1.2,
      },
    })
    map.addLayer({
      id: 'population-label',
      type: 'symbol',
      source: 'population',
      minzoom: 9,
      layout: {
        visibility: 'none',
        'text-field': [
          'concat',
          ['to-string', ['number-format', ['/', ['get', 'population'], 1000], { 'max-fraction-digits': 1 }]],
          'k',
        ],
        'text-size': 10,
        'text-font': ['Noto Sans Bold'],
        'text-offset': [0, -1.2],
      },
      paint: {
        'text-color': '#7a5aa8',
        'text-halo-color': 'rgba(255,255,255,0.85)',
        'text-halo-width': 1.2,
      },
    })
  }

  if (!map.getSource('buildings')) {
    map.addSource('buildings', { type: 'geojson', data: emptyFC() })
    map.addLayer({
      id: 'buildings-fill',
      type: 'fill',
      source: 'buildings',
      layout: { visibility: 'none' },
      paint: {
        'fill-color': ['interpolate', ['linear'], ['get', 'buildings'], 0, '#e9b949', 120, '#d9822b', 350, '#c0392b'],
        'fill-opacity': 0.55,
        'fill-outline-color': '#8a6a12',
      },
    })
    map.addLayer({
      id: 'buildings-label',
      type: 'symbol',
      source: 'buildings',
      minzoom: 9.5,
      layout: {
        visibility: 'none',
        'text-field': ['to-string', ['get', 'buildings']],
        'text-size': 10,
        'text-font': ['Noto Sans Bold'],
      },
      paint: {
        'text-color': '#8a6a12',
        'text-halo-color': 'rgba(255,255,255,0.85)',
        'text-halo-width': 1.2,
      },
    })
  }

  if (!map.getSource('route')) {
    map.addSource('route', { type: 'geojson', data: emptyFC() })
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-color': ['match', ['get', 'alt'], 'primary', '#13735f', '#0000ee'],
        'line-width': ['match', ['get', 'alt'], 'primary', 5, 3.5],
        'line-opacity': ['match', ['get', 'alt'], 'primary', 0.95, 0.7],
        'line-dasharray': ['match', ['get', 'alt'], 'primary', ['literal', [1, 0]], ['literal', [1, 1.6]]],
      },
    })
  }
}

function applyOverlayState(
  map: maplibregl.Map,
  locations: PriorityLocation[],
  fieldReports: PriorityLocation[],
  dataLayers: string[],
  route: { geojson: FeatureCollection } | null,
) {
  const roads = map.getSource('roads') as maplibregl.GeoJSONSource | undefined
  if (roads) roads.setData(buildRoadsGeo(locations, fieldReports))

  const popVisible = dataLayers.includes('population')
  setLayerVisibility(map, 'population-circle', popVisible)
  setLayerVisibility(map, 'population-label', popVisible)
  const pop = map.getSource('population') as maplibregl.GeoJSONSource | undefined
  if (popVisible && pop) pop.setData(buildPopulationGeo(locations, fieldReports))

  const bldVisible = dataLayers.includes('buildings')
  setLayerVisibility(map, 'buildings-fill', bldVisible)
  setLayerVisibility(map, 'buildings-label', bldVisible)
  const bld = map.getSource('buildings') as maplibregl.GeoJSONSource | undefined
  if (bldVisible && bld) bld.setData(buildBuildingsGeo(locations, fieldReports))

  const hasRoute = Boolean(route)
  setLayerVisibility(map, 'route-line', hasRoute)
  const routeSrc = map.getSource('route') as maplibregl.GeoJSONSource | undefined
  if (hasRoute && route && routeSrc) routeSrc.setData(route.geojson)
}

export function DisasterMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const popupRef = useRef<maplibregl.Popup | null>(null)

  const theme = useAppStore((s) => s.theme)
  const locations = useMapLocations()
  const activeEventId = useAppStore((s) => s.activeEventId)
  const rankedLocations = useRankedLocations()
  const selectedId = useAppStore((s) => s.selectedLocationId)
  const drawerOpen = useAppStore((s) => s.drawerOpen)
  const openDrawer = useAppStore((s) => s.openDrawer)
  const selectLocation = useAppStore((s) => s.selectLocation)
  const fieldReports = useAppStore((s) => s.fieldReports)
  const dataLayers = useAppStore((s) => s.dataLayers)
  const route = useAppStore((s) => s.route)
  const focusRequest = useAppStore((s) => s.focusRequest)
  const inspectionPlan = useAppStore((s) => s.inspectionPlan)

  const activeRouteData = useMemo(() => {
    if (inspectionPlan?.routeGeojson) return { geojson: inspectionPlan.routeGeojson }
    if (route?.geojson) return { geojson: route.geojson }
    return null
  }, [route, inspectionPlan])

  const [glSupported] = useState(() => webgl2Supported())

  const scenarioFieldReports = useMemo(
    () => fieldReports.filter((r) => r.scenarioId === activeEventId),
    [fieldReports, activeEventId],
  )

  const selected = useMemo(
    () => locations.find((l) => l.id === selectedId) ?? null,
    [locations, selectedId],
  )

  /* Create map once */
  useEffect(() => {
    const el = containerRef.current
    if (!el || !glSupported) return

    const map = new maplibregl.Map({
      container: el,
      center: [MAP_CENTER.lng, MAP_CENTER.lat],
      zoom: 9,
      style: baseStyle(theme),
      attributionControl: { compact: true },
      maxZoom: 18,
    })
    mapRef.current = map

    map.on('error', (e) => {
      if (e.error) console.warn('[map]', e.error.message)
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left')

    map.on('load', () => {
      addOverlayLayers(map)
      applyOverlayState(map, locations, scenarioFieldReports, dataLayers, route)
      buildMarkers()
    })

    return () => {
      try {
        markersRef.current.forEach((m) => m.remove())
        markersRef.current = []
        popupRef.current?.remove()
        popupRef.current = null
        map.remove()
      } catch {
        /* map failed to initialize (e.g. no WebGL2) — nothing to tear down */
      }
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glSupported])

  /* Theme switch */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(baseStyle(theme))
    const onStyle = () => {
      addOverlayLayers(map)
      applyOverlayState(map, locations, scenarioFieldReports, dataLayers, route)
      buildMarkers()
    }
    if (map.isStyleLoaded()) {
      onStyle()
    } else {
      map.once('style.load', onStyle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  /* Recenter the viewport when the active scenario changes */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded() || !rankedLocations.length) return
    const lat = rankedLocations.reduce((sum, l) => sum + l.lat, 0) / rankedLocations.length
    const lng = rankedLocations.reduce((sum, l) => sum + l.lng, 0) / rankedLocations.length
    map.flyTo({ center: [lng, lat], zoom: 9, essential: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEventId])

  /* Pan/zoom to a location requested from the global search bar */
  useEffect(() => {
    if (!focusRequest) return
    const map = mapRef.current
    if (!map) return
    if (!map.isStyleLoaded()) {
      map.once('load', () =>
        map.flyTo({ center: [focusRequest.lng, focusRequest.lat], zoom: 12, essential: true, duration: 1600 }),
      )
      return
    }
    map.flyTo({ center: [focusRequest.lng, focusRequest.lat], zoom: 12, essential: true, duration: 1600 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest])

  /* Locations / data layers / route sync */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    applyOverlayState(map, locations, scenarioFieldReports, dataLayers, activeRouteData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, scenarioFieldReports, dataLayers, activeRouteData])

  /* Route endpoint marker */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current
      .filter((m) => (m.getElement() as HTMLElement).dataset.kind === 'route-end')
      .forEach((m) => m.remove())
    markersRef.current = markersRef.current.filter(
      (m) => (m.getElement() as HTMLElement).dataset.kind !== 'route-end',
    )
    if (route) {
      const el = document.createElement('div')
      el.dataset.kind = 'route-end'
      el.style.cssText = 'pointer-events:none;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3))'
      el.innerHTML = `<img src="${facilitySvg()}" width="32" height="32" style="transform:translate(-50%,-50%)"/>`
      const m = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(route.facilityLngLat)
        .addTo(map)
      markersRef.current.push(m)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route])

  /* Selected popup */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (popupRef.current) {
      popupRef.current.remove()
      popupRef.current = null
    }
    if (selected && !drawerOpen) {
      const onClose = () => {
        /* A map click can close the popup right after a marker click opened the
           drawer; don't clear the selection while the drawer is showing it. */
        if (!useAppStore.getState().drawerOpen) selectLocation(null)
      }
      const popup = new maplibregl.Popup({ offset: 30, closeButton: false, maxWidth: '240px' })
        .setLngLat([selected.lng, selected.lat])
        .setHTML(
          `<div style="font-family:Sora,Arial,sans-serif">
            <p style="margin:0;font-size:10px;font-weight:700;color:var(--color-primary,#13735f)">Priority #${selected.rank}</p>
            <p style="margin:2px 0 0;font-size:13px;font-weight:700;color:var(--color-ink,#333)">${selected.name}</p>
            <p style="margin:2px 0 0;font-size:11px;color:var(--color-ink-soft,#5c6b66)">${fmtInt(selected.affectedPopulation)} exposed · ${selected.score}/100</p>
          </div>`,
        )
      popup.on('open', () => selectLocation(selected.id))
      popup.on('close', onClose)
      popup.addTo(map)
      popupRef.current = popup
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, drawerOpen])

  function buildMarkers() {
    const map = mapRef.current
    if (!map) return

    markersRef.current
      .filter((m) => (m.getElement() as HTMLElement).dataset.kind === 'impact')
      .forEach((m) => m.remove())
    markersRef.current = markersRef.current.filter(
      (m) => (m.getElement() as HTMLElement).dataset.kind !== 'impact',
    )
    locations
      .filter((l) => !l.isFieldReport)
      .forEach((l) => {
        const el = document.createElement('div')
        el.dataset.kind = 'impact'
        el.style.cssText = 'cursor:pointer;filter:drop-shadow(0 0 2px rgba(0,0,0,0.15))'
        el.setAttribute('aria-label', `Show details for ${l.name}`)
        el.innerHTML = `<img src="${impactCircleSvg(sevHex(l.damageLevel))}" width="110" height="110" style="transform:translate(-50%,-50%) scale(${l.damageLevel === 'critical' || l.damageLevel === 'severe' ? 1 : 0.75})"/>`
        el.addEventListener('click', () => openDrawer(l.id))
        const m = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([l.lng, l.lat])
          .addTo(map)
        markersRef.current.push(m)
      })

    markersRef.current
      .filter((m) => (m.getElement() as HTMLElement).dataset.kind === 'loc')
      .forEach((m) => m.remove())
    markersRef.current = markersRef.current.filter(
      (m) => (m.getElement() as HTMLElement).dataset.kind !== 'loc',
    )

    locations.forEach((loc) => {
      const btn = document.createElement('button')
      btn.dataset.kind = 'loc'
      btn.setAttribute('aria-label', `Priority ${loc.rank}: ${loc.name}`)
      btn.style.cssText =
        'border:none;background:transparent;cursor:pointer;padding:0;line-height:0;outline:none;'
      btn.innerHTML = `<img src="${markerSvg(loc)}" width="54" height="54" style="display:block;filter:drop-shadow(0 6px 10px rgba(0,0,0,0.28));transition:transform 160ms ease-in-out"/>`
      const img = btn.querySelector('img') as HTMLImageElement
      let hoverPopup: maplibregl.Popup | null = null
      btn.addEventListener('mouseenter', () => {
        img.style.transform = 'scale(1.12)'
        if (useAppStore.getState().selectedLocationId !== loc.id) {
          hoverPopup = new maplibregl.Popup({ offset: 30, closeButton: false, maxWidth: '240px', closeOnClick: false })
            .setLngLat([loc.lng, loc.lat])
            .setHTML(
              `<div style="font-family:Sora,Arial,sans-serif">
                <p style="margin:0;font-size:10px;font-weight:700;color:var(--color-primary,#13735f)">Priority #${loc.rank}</p>
                <p style="margin:2px 0 0;font-size:13px;font-weight:700;color:var(--color-ink,#333)">${loc.name}</p>
                <p style="margin:2px 0 0;font-size:11px;color:var(--color-ink-soft,#5c6b66)">${fmtInt(loc.affectedPopulation)} exposed · ${loc.score}/100</p>
              </div>`,
            )
            .addTo(map)
        }
      })
      btn.addEventListener('mouseleave', () => {
        img.style.transform = 'scale(1)'
        if (hoverPopup) {
          hoverPopup.remove()
          hoverPopup = null
        }
      })
      btn.addEventListener('click', () => {
        if (hoverPopup) {
          hoverPopup.remove()
          hoverPopup = null
        }
        openDrawer(loc.id)
      })
      const marker = new maplibregl.Marker({ element: btn, anchor: 'center' })
        .setLngLat([loc.lng, loc.lat])
        .addTo(map)
      markersRef.current.push(marker)
    })
  }

  return (
    <div className="absolute inset-0">
      {glSupported ? (
        <>
          <div
            ref={containerRef}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              background: 'var(--color-map-bg)',
            }}
          />
          {/* fallback grid while tiles load */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage:
                'linear-gradient(rgba(19,115,95,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(19,115,95,0.08) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6"
          style={{ background: 'var(--color-map-bg)' }}
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-panel)] border border-edge flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary)' }}>
              <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-sm font-bold text-ink">3D map unavailable</p>
          <p className="text-xs text-ink-soft leading-relaxed max-w-xs">
            This browser does not expose WebGL2, which MapLibre GL JS needs to render the map. Locations and
            priority data are still available in the list panel.
          </p>
        </div>
      )}
    </div>
  )
}
