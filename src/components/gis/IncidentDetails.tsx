import type { Incident } from '../../types/incident'
import { X, MapPin, Activity, Calendar, Brain, AlertTriangle } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { assessIncident } from '../../services/incidentApi'

interface IncidentDetailsProps {
  incident: Incident
  onClose: () => void
}

export function IncidentDetails({ incident, onClose }: IncidentDetailsProps) {
  const hasCoords = typeof incident.area?.latitude === 'number' && typeof incident.area?.longitude === 'number'
  const hasImagery = !!(incident.imagery?.before_image && incident.imagery?.after_image)
  const isAssessed = incident.ai_assessment?.status === 'AI_ASSESSED'

  const queryClient = useQueryClient()
  const assessMutation = useMutation({
    mutationFn: () => assessIncident(incident.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
    }
  })

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

        {hasImagery && !isAssessed && (
          <div className="pt-4 border-t border-edge">
            <button
              onClick={() => assessMutation.mutate()}
              disabled={assessMutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-white font-bold text-xs px-4 py-3 shadow-md hover:bg-primary-deep transition-all disabled:opacity-50"
            >
              <Brain className="w-4 h-4" />
              {assessMutation.isPending ? 'Running V11 Assessment...' : 'Run V11 Assessment'}
            </button>
            {assessMutation.isError && (
              <p className="text-[10px] text-red-500 mt-2 font-semibold">
                Assessment failed: {assessMutation.error?.message}
              </p>
            )}
          </div>
        )}

        {isAssessed && (
          <div className="pt-4 border-t border-edge space-y-3">
            <h4 className="text-[10px] font-bold uppercase text-ink-faint flex items-center">
              <Brain className="w-3 h-3 mr-1" /> AI Assessment Results
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-black/5 dark:bg-white/5 p-2 rounded">
                <p className="text-[9px] text-ink-soft uppercase mb-0.5">Model</p>
                <p className="text-xs font-bold text-ink">{incident.ai_assessment.model_version || 'V11'}</p>
              </div>
              <div className="bg-black/5 dark:bg-white/5 p-2 rounded">
                <p className="text-[9px] text-ink-soft uppercase mb-0.5">Damage Area</p>
                <p className="text-xs font-bold text-ink">{incident.ai_assessment.damage_area_percent.toFixed(1)}%</p>
              </div>
              <div className="bg-black/5 dark:bg-white/5 p-2 rounded">
                <p className="text-[9px] text-ink-soft uppercase mb-0.5">Regions</p>
                <p className="text-xs font-bold text-ink">{incident.ai_assessment.damage_regions}</p>
              </div>
              <div className="bg-black/5 dark:bg-white/5 p-2 rounded">
                <p className="text-[9px] text-ink-soft uppercase mb-0.5">Severe Regions</p>
                <p className="text-xs font-bold text-ink">{incident.ai_assessment.severe_regions}</p>
              </div>
            </div>
            {incident.ai_assessment.severe_regions > 0 && (
              <div className="flex items-start gap-2 p-2 bg-red-500/10 rounded border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-600 dark:text-red-400">Severe Damage Detected</p>
                  <p className="text-[10px] text-red-600/80 dark:text-red-400/80">Immediate attention recommended for {incident.ai_assessment.severe_regions} regions.</p>
                </div>
              </div>
            )}
            <button
              onClick={() => assessMutation.mutate()}
              disabled={assessMutation.isPending}
              className="w-full flex items-center justify-center gap-2 rounded text-primary hover:bg-primary/5 font-bold text-xs px-4 py-2 mt-2 transition-colors disabled:opacity-50"
            >
              {assessMutation.isPending ? 'Updating...' : 'Re-run Assessment'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
