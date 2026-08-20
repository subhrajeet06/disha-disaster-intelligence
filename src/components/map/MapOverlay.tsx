import { Building2, Route, AlertTriangle, Crosshair, Users, Warehouse, Navigation, X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { fmtDistance, fmtDuration } from '../../lib/routing'
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

  const inspectionPlan = useAppStore((s) => s.inspectionPlan)
  const setInspectionPlan = useAppStore((s) => s.setInspectionPlan)
  const setInspectionPlanningOpen = useAppStore((s) => s.setInspectionPlanningOpen)

  const isOn = (k: FilterKey) => kpiFilter === k

  const toggle = (k: FilterKey) => {
    toggleFilter(k)
    setKpiFilter(isOn(k) ? null : k)
  }

  return (
    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-sm">
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
        Coastal Odisha · Cyclone Fani
      </div>

      {/* Active Inspection Route Summary Banner */}
      {inspectionPlan && (
        <div className="bg-panel/95 backdrop-blur rounded-[20px] p-3.5 shadow-xl border border-primary/30 space-y-2 mt-1 animate-fade-up text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-extrabold text-ink">
              <Navigation className="w-3.5 h-3.5 text-primary" />
              Inspection Route Summary
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setInspectionPlanningOpen(true)}
                className="text-[10px] font-bold text-primary hover:underline px-1.5 py-0.5 rounded bg-panel-tint"
              >
                Modify Order
              </button>
              <button
                onClick={() => setInspectionPlan(null)}
                className="p-1 rounded-full text-ink-faint hover:text-ink hover:bg-panel-soft"
                title="Clear route"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="text-[11px] text-ink-soft space-y-1">
            <p><strong>Start Base:</strong> {inspectionPlan.baseName}</p>
            <p>
              <strong>Ordered Priority Stops ({inspectionPlan.stops.length}):</strong>{' '}
              {inspectionPlan.stops.map((s, idx) => `${idx + 1}. ${s.name}`).join(' → ')}
            </p>
            <p>
              <strong>Est. Route Metrics:</strong> {fmtDistance(inspectionPlan.totalDistanceM)} · {fmtDuration(inspectionPlan.totalDurationS)}
            </p>
          </div>

          {inspectionPlan.constraintNotes.length > 0 && (
            <div className="pt-1.5 border-t border-edge/60 text-[10px] text-amber-600 font-semibold space-y-0.5">
              {inspectionPlan.constraintNotes.map((note, i) => (
                <p key={i}>⚠ {note}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
