import { Building2, Route, AlertTriangle, Crosshair, Users, Warehouse } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { DataLayerKey, FilterKey } from '../../types'

const LAYERS: Array<{ key: FilterKey; icon: typeof Building2; label: string }> = [
  { key: 'damage', icon: Building2, label: 'Damage' },
  { key: 'roads', icon: Route, label: 'Roads' },
  { key: 'services', icon: AlertTriangle, label: 'Services' },
]

const DATA_LAYERS: Array<{ key: DataLayerKey; icon: typeof Users; label: string }> = [
  { key: 'population', icon: Users, label: 'WorldPop' },
  { key: 'buildings', icon: Warehouse, label: 'Open Buildings' },
]

export function MapOverlay() {
  const kpiFilter = useAppStore((s) => s.kpiFilter)
  const toggleFilter = useAppStore((s) => s.toggleFilter)
  const setKpiFilter = useAppStore((s) => s.setKpiFilter)
  const dataLayers = useAppStore((s) => s.dataLayers)
  const toggleDataLayer = useAppStore((s) => s.toggleDataLayer)

  const isOn = (k: FilterKey) => kpiFilter === k

  const toggle = (k: FilterKey) => {
    toggleFilter(k)
    setKpiFilter(isOn(k) ? null : k)
  }

  /*return (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 bg-[var(--color-panel)]/90 backdrop-blur rounded-full p-1.5 shadow-lg border border-edge">
        {LAYERS.map((l) => (
          <button
            key={l.key}
            onClick={() => toggle(l.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
              isOn(l.key) ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:bg-panel-tint'
            }`}
          >
            <l.icon className="w-3.5 h-3.5" />
            {l.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 bg-[var(--color-panel)]/90 backdrop-blur rounded-full p-1.5 shadow-lg border border-edge">
        {DATA_LAYERS.map((l) => (
          <button
            key={l.key}
            onClick={() => toggleDataLayer(l.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
              dataLayers.includes(l.key) ? 'bg-primary text-white shadow-sm' : 'text-ink-soft hover:bg-panel-tint'
            }`}
          >
            <l.icon className="w-3.5 h-3.5" />
            {l.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft bg-[var(--color-panel)]/85 backdrop-blur rounded-full px-3 py-1.5 shadow border border-edge w-fit">
        <Crosshair className="w-3 h-3 text-primary" />
        Coastal Odisha · Cyclone Nivar
      </div>
    </div>
  )*/
}
