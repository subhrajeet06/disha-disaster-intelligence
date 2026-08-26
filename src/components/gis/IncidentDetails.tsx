import type { Incident } from '../../types/incident'
import { X, MapPin, Activity, Calendar, Brain, AlertTriangle } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { assessIncident, getSpatialArtifactUrl, getIncidentImageryUrl, verifyIncident } from '../../services/incidentApi'
import { useState } from 'react'

interface IncidentDetailsProps {
  incident: Incident
  onClose: () => void
}

export function IncidentDetails({ incident, onClose }: IncidentDetailsProps) {
  const hasCoords = typeof incident.area?.latitude === 'number' && typeof incident.area?.longitude === 'number'
  const hasImagery = !!(incident.imagery?.before_image && incident.imagery?.after_image)
  const isAssessed = incident.ai_assessment?.status === 'AI_ASSESSED'
  const [showOverlay, setShowOverlay] = useState(true)
  
  const [reviewerName, setReviewerName] = useState('GIS Reviewer')
  const [notes, setNotes] = useState('')
  const [isEditingVerification, setIsEditingVerification] = useState(false)

  const queryClient = useQueryClient()
  const assessMutation = useMutation({
    mutationFn: () => assessIncident(incident.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
    }
  })

  const verifyMutation = useMutation({
    mutationFn: (decision: string) => verifyIncident(incident.id, { decision, reviewer_name: reviewerName, notes }),
    onSuccess: () => {
      setIsEditingVerification(false)
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

            {incident.ai_assessment.spatial_output && (
              <div className="mt-4 border border-edge rounded overflow-hidden">
                <div className="bg-black/5 dark:bg-white/5 p-2 border-b border-edge flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase text-ink flex items-center">
                    Spatial Analysis (Image-Space)
                  </p>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={showOverlay}
                      onChange={(e) => setShowOverlay(e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-3 w-3"
                    />
                    <span className="text-[10px] text-ink-soft">Show Overlay</span>
                  </label>
                </div>
                <div className="relative aspect-square w-full bg-black/90">
                  {/* Base Image */}
                  <img 
                    src={getIncidentImageryUrl(incident.id, 'after')}
                    className="absolute inset-0 w-full h-full object-contain"
                    alt="Post-disaster"
                    loading="lazy"
                  />
                  {/* Damage Overlay */}
                  <img 
                    src={getSpatialArtifactUrl(incident.id, 'damage_overlay.png')}
                    className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ${showOverlay ? 'opacity-100' : 'opacity-0'}`}
                    alt="Damage Overlay"
                    loading="lazy"
                  />
                </div>
              </div>
            )}
            
            {/* HUMAN VERIFICATION */}
            <div className="pt-4 mt-4 border-t border-edge space-y-3">
              <h4 className="text-[10px] font-bold uppercase text-ink-faint flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1" /> Human Verification
              </h4>
              
              {(incident.verification.status !== 'PENDING' && !isEditingVerification) ? (
                <div className="space-y-2">
                  <div className={`p-2 rounded border ${
                    incident.verification.status === 'CONFIRMED' ? 'bg-green-500/10 border-green-500/20' : 
                    incident.verification.status === 'CORRECTED' ? 'bg-yellow-500/10 border-yellow-500/20' : 
                    'bg-red-500/10 border-red-500/20'
                  }`}>
                    <p className="text-[10px] uppercase font-bold text-ink-soft mb-1 flex justify-between">
                      Decision 
                      <span className={
                        incident.verification.status === 'CONFIRMED' ? 'text-green-600 dark:text-green-400' : 
                        incident.verification.status === 'CORRECTED' ? 'text-yellow-600 dark:text-yellow-400' : 
                        'text-red-600 dark:text-red-400'
                      }>{incident.verification.status}</span>
                    </p>
                    <div className="text-[10px] text-ink space-y-0.5">
                      <p><span className="text-ink-soft">Reviewer:</span> {incident.verification.verified_by}</p>
                      <p><span className="text-ink-soft">Date:</span> {new Date(incident.verification.verified_at!).toLocaleString()}</p>
                      {incident.verification.correction_notes && (
                        <p className="mt-1 pt-1 border-t border-edge/50 italic text-ink-soft">
                          "{incident.verification.correction_notes}"
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setReviewerName(incident.verification.verified_by || 'GIS Reviewer')
                      setNotes(incident.verification.correction_notes || '')
                      setIsEditingVerification(true)
                    }}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Edit Verification
                  </button>
                </div>
              ) : (
                <div className="space-y-3 p-3 bg-black/5 dark:bg-white/5 rounded border border-edge">
                  <div>
                    <label className="text-[9px] text-ink-soft uppercase block mb-1">Reviewer Name</label>
                    <input 
                      type="text" 
                      value={reviewerName}
                      onChange={(e) => setReviewerName(e.target.value)}
                      className="w-full bg-panel border border-edge rounded px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-ink-soft uppercase block mb-1">Verification Notes</label>
                    <textarea 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-panel border border-edge rounded px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-primary resize-none"
                      placeholder="Add context to your decision..."
                    />
                  </div>
                  
                  {verifyMutation.isError && (
                    <p className="text-[10px] text-red-500 font-semibold">{verifyMutation.error?.message}</p>
                  )}
                  
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <button
                      onClick={() => verifyMutation.mutate('CONFIRMED')}
                      disabled={verifyMutation.isPending}
                      className="flex items-center justify-center py-2 rounded bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20 text-[10px] font-bold border border-green-500/20 disabled:opacity-50 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => verifyMutation.mutate('CORRECTED')}
                      disabled={verifyMutation.isPending}
                      className="flex items-center justify-center py-2 rounded bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20 text-[10px] font-bold border border-yellow-500/20 disabled:opacity-50 transition-colors"
                    >
                      Correct
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to REJECT this AI assessment?')) {
                          verifyMutation.mutate('REJECTED')
                        }
                      }}
                      disabled={verifyMutation.isPending}
                      className="flex items-center justify-center py-2 rounded bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 text-[10px] font-bold border border-red-500/20 disabled:opacity-50 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                  {isEditingVerification && (
                    <button
                      onClick={() => setIsEditingVerification(false)}
                      className="w-full text-[10px] text-ink-soft hover:text-ink text-center pt-1"
                    >
                      Cancel Editing
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
