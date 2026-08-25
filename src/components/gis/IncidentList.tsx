import type { Incident } from '../../types/incident'
import { MapPin, AlertCircle, RefreshCw } from 'lucide-react'

interface IncidentListProps {
  incidents: Incident[]
  isLoading: boolean
  error: Error | null
  selectedId: string | null
  onSelect: (id: string) => void
}

export function IncidentList({ incidents, isLoading, error, selectedId, onSelect }: IncidentListProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-ink-soft p-6 text-center">
        <RefreshCw className="w-8 h-8 animate-spin mb-4 opacity-50" />
        <p className="font-semibold">Loading incidents...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-red-500 p-6 text-center">
        <AlertCircle className="w-8 h-8 mb-4 opacity-80" />
        <p className="font-semibold text-sm">Unable to load incidents.</p>
        <p className="text-xs mt-2 opacity-70">{error.message}</p>
      </div>
    )
  }

  if (incidents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-ink-soft p-6 text-center">
        <MapPin className="w-8 h-8 mb-4 opacity-30" />
        <p className="font-semibold text-sm">No incidents available.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-panel">
      <div className="px-5 py-4 border-b border-edge">
        <h2 className="font-bold text-lg text-ink">Incidents ({incidents.length})</h2>
      </div>
      <div className="flex-1 overflow-y-auto scroll-thin">
        {incidents.map((incident) => {
          const hasCoords = typeof incident.area?.latitude === 'number' && typeof incident.area?.longitude === 'number'
          const isSelected = incident.id === selectedId
          
          return (
            <button
              key={incident.id}
              onClick={() => onSelect(incident.id)}
              className={`w-full text-left px-5 py-4 border-b border-edge transition-colors ${
                isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-panel-soft border-l-4 border-l-transparent'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="font-bold text-sm text-ink truncate pr-2">{incident.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-black/10 dark:bg-white/10 text-ink-soft px-2 py-0.5 rounded-full shrink-0">
                  {incident.status}
                </span>
              </div>
              <p className="text-xs text-ink-soft capitalize mb-2">{incident.disaster_type}</p>
              
              <div className="flex items-center text-[11px] text-ink-faint">
                <MapPin className="w-3 h-3 mr-1 opacity-70" />
                {hasCoords ? (
                  <span>
                    {incident.area?.district || 'Unknown District'} · {incident.area?.state || 'Unknown State'}
                  </span>
                ) : (
                  <span className="italic">Location unavailable</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
