import type { Incident } from '../../types/incident'
import { X, MapPin, Activity, Calendar } from 'lucide-react'

interface IncidentDetailsProps {
  incident: Incident
  onClose: () => void
}

export function IncidentDetails({ incident, onClose }: IncidentDetailsProps) {
  const hasCoords = typeof incident.area?.latitude === 'number' && typeof incident.area?.longitude === 'number'

  return (
    <div className="flex flex-col bg-panel">
      <div className="flex items-start justify-between px-4 py-3 border-b border-edge bg-primary/5">
        <div>
          <h3 className="font-bold text-sm text-ink pr-4 leading-tight">{incident.name}</h3>
          <p className="text-[11px] text-ink-soft capitalize mt-0.5">{incident.disaster_type}</p>
        </div>
        <button onClick={onClose} className="text-ink-soft hover:text-ink p-1 -mr-1 rounded hover:bg-black/5 dark:hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase text-ink-faint mb-1.5 flex items-center">
            <Activity className="w-3 h-3 mr-1" /> Status
          </p>
          <div className="text-xs font-semibold px-2 py-1 bg-black/5 dark:bg-white/10 text-ink inline-flex rounded">
            {incident.status}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase text-ink-faint mb-1.5 flex items-center">
            <MapPin className="w-3 h-3 mr-1" /> Location
          </p>
          {hasCoords ? (
            <div className="text-xs text-ink space-y-0.5">
              <p>{incident.area?.village ? `${incident.area.village}, ` : ''}{incident.area?.block ? `${incident.area.block}, ` : ''}{incident.area?.district}</p>
              <p>{incident.area?.state ? `${incident.area.state}, ` : ''}{incident.area?.country}</p>
              <p className="text-[10px] text-ink-soft mt-1 font-mono">
                {incident.area?.latitude?.toFixed(4)}, {incident.area?.longitude?.toFixed(4)}
              </p>
            </div>
          ) : (
            <p className="text-xs text-ink-soft italic">No geographic coordinates provided.</p>
          )}
        </div>

        {incident.description && (
          <div>
            <p className="text-[10px] font-bold uppercase text-ink-faint mb-1.5">Description</p>
            <p className="text-xs text-ink-soft leading-relaxed">{incident.description}</p>
          </div>
        )}

        <div className="pt-2 mt-2 border-t border-edge">
          <p className="text-[9px] text-ink-faint flex items-center">
            <Calendar className="w-3 h-3 mr-1" />
            Created: {new Date(incident.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
