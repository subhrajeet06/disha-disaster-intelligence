import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { MapPin, LocateFixed } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { PICKER_BOUNDS, roundCoord } from '../../lib/geo'

interface Props {
  lat: number | null
  lng: number | null
  onPick: (lat: number, lng: number) => void
}

function pickerStyle(theme: 'light' | 'dark'): maplibregl.StyleSpecification {
  const tile = theme === 'dark' ? 'dark_all' : 'voyager'
  return {
    version: 8,
    sources: {
      'carto-basemap': {
        type: 'raster',
        tiles: [`https://basemaps.cartocdn.com/rastertiles/${tile}/{z}/{x}/{y}.png`],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
    },
    layers: [{ id: 'basemap', type: 'raster', source: 'carto-basemap' }],
  }
}

function pinSvg(): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='30' height='36'>
  <path d='M15 0 C6.7 0 0 6.7 0 15 c0 11 15 21 15 21 s15-10 15-21 C30 6.7 23.3 0 15 0 Z' fill='#0000ee' stroke='#fff' stroke-width='2.5'/>
  <circle cx='15' cy='14' r='6' fill='#fff'/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function webgl2Supported(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(window.WebGL2RenderingContext && c.getContext('webgl2'))
  } catch {
    return false
  }
}

export function MiniLocationMap({ lat, lng, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const pinRef = useRef<maplibregl.Marker | null>(null)
  const theme = useAppTheme()

  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [glSupported] = useState(() => webgl2Supported())

  /* Create picker map */
  useEffect(() => {
    const el = containerRef.current
    if (!el || !glSupported) return

    const center: [number, number] =
      lat != null && lng != null
        ? [lng, lat]
        : [
            (PICKER_BOUNDS.minLng + PICKER_BOUNDS.maxLng) / 2,
            (PICKER_BOUNDS.minLat + PICKER_BOUNDS.maxLat) / 2,
          ]

    const map = new maplibregl.Map({
      container: el,
      center,
      zoom: 10,
      style: pickerStyle(theme),
      attributionControl: false,
      maxZoom: 18,
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    map.on('click', (e) => {
      onPick(roundCoord(e.lngLat.lat), roundCoord(e.lngLat.lng))
    })

    map.on('load', () => {
      updatePin(map)
    })

    return () => {
      try {
        pinRef.current?.remove()
        pinRef.current = null
        map.remove()
      } catch {
        /* map failed to initialize (e.g. no WebGL2) */
      }
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glSupported])

  /* Theme switch */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setStyle(pickerStyle(theme))
    const onStyle = () => updatePin(map)
    if (map.isStyleLoaded()) onStyle()
    else map.once('style.load', onStyle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  /* Pin position */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    updatePin(map)
    if (lat != null && lng != null) {
      map.easeTo({ center: [lng, lat], duration: 500 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])

  function updatePin(map: maplibregl.Map) {
    if (lat == null || lng == null) return
    if (pinRef.current) {
      pinRef.current.setLngLat([lng, lat])
      return
    }
    const el = document.createElement('div')
    el.innerHTML = `<img src="${pinSvg()}" width="30" height="36" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3))"/>`
    pinRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(map)
  }

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation not supported by this browser.')
      return
    }
    setLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPick(roundCoord(pos.coords.latitude), roundCoord(pos.coords.longitude))
        setLocating(false)
      },
      () => {
        setGeoError('Could not read location. Pick the spot on the map instead.')
        setLocating(false)
      },
      { timeout: 8000 },
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative h-52 rounded-[24px] overflow-hidden border border-edge bg-[var(--color-map-bg)]">
        {glSupported ? (
          <div
            ref={containerRef}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="text-xs font-semibold text-ink-soft">
              Map preview needs WebGL2. You can still enter a location below.
            </p>
          </div>
        )}
        <span className="absolute top-2.5 left-2.5 z-10 text-[10px] font-bold text-[var(--color-primary,#13735f)] bg-[var(--color-panel)]/90 backdrop-blur rounded-full px-2.5 py-1 shadow-sm border border-edge">
          Tap the map to set the report location
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={useMyLocation}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#13735f] text-white text-xs font-bold px-3.5 py-2 hover:bg-[#0b5c4c] transition-colors duration-200 disabled:opacity-60"
          disabled={locating}
        >
          <LocateFixed className="w-3.5 h-3.5" />
          {locating ? 'Locating…' : 'Use my location'}
        </button>
        {lat != null && lng != null && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary-deep,#0b5c4c)] bg-[var(--color-panel-tint,#e6f2ef)] rounded-full px-3 py-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {roundCoord(lat)}, {roundCoord(lng)}
          </span>
        )}
        {geoError && <span className="text-xs font-medium text-danger-text">{geoError}</span>}
      </div>
    </div>
  )
}

function useAppTheme(): 'light' | 'dark' {
  return useAppStore((s) => s.theme)
}

