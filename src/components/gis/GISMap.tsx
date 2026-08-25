import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Incident } from '../../types/incident'
import { useAppStore } from '../../store/useAppStore'

const BASEMAPS = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const

interface GISMapProps {
  incidents: Incident[]
  selectedId: string | null
  onSelect: (id: string) => void
}

// Custom default center (India)
const MAP_CENTER = { lng: 78.9629, lat: 20.5937 }

function webgl2Supported(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(window.WebGL2RenderingContext && c.getContext('webgl2'))
  } catch {
    return false
  }
}

export function GISMap({ incidents, selectedId, onSelect }: GISMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])
  const theme = useAppStore((s) => s.theme)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [glSupported] = useState(() => webgl2Supported())

  // 1. Initialize Map
  useEffect(() => {
    const el = containerRef.current
    if (!el || !glSupported) return
    const map = new maplibregl.Map({
      container: el,
      style: BASEMAPS[theme],
      center: [MAP_CENTER.lng, MAP_CENTER.lat],
      zoom: 4,
      attributionControl: { compact: true }
    })
    
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left')
    mapRef.current = map

    map.on('load', () => setMapLoaded(true))

    return () => {
      try {
        map.remove()
      } catch {
        // ignore map removal errors during strict mode remounting
      }
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentTheme = useRef(theme)

  // 2. Handle Theme Changes
  useEffect(() => {
    if (!mapRef.current) return
    if (currentTheme.current === theme) return // Skip initial render
    
    currentTheme.current = theme
    mapRef.current.setStyle(BASEMAPS[theme])
  }, [theme])

  // 3. Render Markers
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return
    const map = mapRef.current

    // Clear existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    incidents.forEach(incident => {
      const lat = incident.area?.latitude
      const lng = incident.area?.longitude
      if (typeof lat !== 'number' || typeof lng !== 'number') return // Skip invalid

      const el = document.createElement('div')
      el.className = 'w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-110'
      
      const isSelected = incident.id === selectedId
      el.style.backgroundColor = isSelected ? '#13735f' : '#e9b949'
      el.style.transform = isSelected ? 'scale(1.2)' : 'scale(1)'
      el.style.zIndex = isSelected ? '10' : '1'

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onSelect(incident.id)
      })

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map)

      markersRef.current.push(marker)
    })
  }, [incidents, mapLoaded, selectedId, onSelect])

  // 4. Fly to selected incident or fit bounds
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return
    const map = mapRef.current

    if (selectedId) {
      const incident = incidents.find(i => i.id === selectedId)
      if (incident?.area?.latitude && incident?.area?.longitude) {
        map.flyTo({
          center: [incident.area.longitude, incident.area.latitude],
          zoom: 12,
          essential: true,
          duration: 1500
        })
      }
    } else if (incidents.length > 0) {
      // Fit to all valid incidents
      const bounds = new maplibregl.LngLatBounds()
      let hasValidCoords = false
      incidents.forEach(i => {
        if (i.area?.latitude && i.area?.longitude) {
          bounds.extend([i.area.longitude, i.area.latitude])
          hasValidCoords = true
        }
      })
      if (hasValidCoords) {
        map.fitBounds(bounds, { padding: 50, duration: 1000, maxZoom: 12 })
      }
    }
  }, [selectedId, incidents, mapLoaded])

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
            This browser does not expose WebGL2, which MapLibre GL JS needs to render the map.
          </p>
        </div>
      )}
    </div>
  )
}
