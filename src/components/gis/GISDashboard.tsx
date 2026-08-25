import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchIncidents } from '../../services/incidentApi'
import { IncidentList } from './IncidentList'
import { GISMap } from './GISMap'
import { IncidentDetails } from './IncidentDetails'

export function GISDashboard() {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  
  const { data: incidents, isLoading, error } = useQuery({
    queryKey: ['incidents'],
    queryFn: fetchIncidents
  })

  const selectedIncident = incidents?.find(i => i.id === selectedIncidentId) ?? null

  return (
    <div className="absolute inset-0 flex bg-[var(--color-map-bg)] flex-col lg:flex-row">
      {/* Sidebar / List - absolute on mobile, relative on desktop */}
      <div className="w-full lg:w-[320px] h-[40%] lg:h-full flex flex-col border-b lg:border-b-0 lg:border-r border-edge bg-panel z-10 shrink-0">
        <IncidentList 
          incidents={incidents ?? []} 
          isLoading={isLoading}
          error={error as Error}
          selectedId={selectedIncidentId}
          onSelect={setSelectedIncidentId}
        />
      </div>

      {/* Map Area */}
      <div className="flex-1 relative min-w-0 h-[60%] lg:h-full">
        <GISMap 
          incidents={incidents ?? []}
          selectedId={selectedIncidentId}
          onSelect={setSelectedIncidentId}
        />
        
        {/* Incident Details Floating Panel */}
        {selectedIncident && (
          <div className="absolute top-4 right-4 z-20 w-80 shadow-2xl rounded-2xl bg-panel overflow-hidden border border-edge">
            <IncidentDetails 
              incident={selectedIncident} 
              onClose={() => setSelectedIncidentId(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
