import { useState, useMemo } from 'react'
import { X, Navigation, ArrowUp, ArrowDown, Check, Loader2 } from 'lucide-react'
import { useAppStore, useRankedLocations } from '../../store/useAppStore'
import { osrmRoute } from '../../lib/routing'
import type { InspectionStop, InspectionRoutePlan, PriorityLocation } from '../../types'

export function InspectionRouteModal() {
  const open = useAppStore((s) => s.inspectionPlanningOpen)
  const setOpen = useAppStore((s) => s.setInspectionPlanningOpen)
  const setPlan = useAppStore((s) => s.setInspectionPlan)

  const locations = useRankedLocations()
  const [baseId, setBaseId] = useState<string>(locations[0]?.id ?? '')
  const [selectedStopIds, setSelectedStopIds] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  // Initialize selected stops (top 4 highest priority locations excluding chosen base)
  useMemo(() => {
    if (!baseId && locations.length) {
      setBaseId(locations[0].id)
    }
  }, [locations, baseId])

  const defaultStops = useMemo(() => {
    return locations
      .filter((l: PriorityLocation) => l.id !== baseId)
      .slice(0, 4)
      .map((l: PriorityLocation) => l.id)
  }, [locations, baseId])

  const currentStopsList = useMemo(() => {
    const activeIds = selectedStopIds.length ? selectedStopIds : defaultStops
    return activeIds
      .map((id: string) => locations.find((l: PriorityLocation) => l.id === id))
      .filter((l: PriorityLocation | undefined): l is PriorityLocation => Boolean(l))
  }, [locations, selectedStopIds, defaultStops])

  const moveStop = (index: number, direction: 'up' | 'down') => {
    const list = [...currentStopsList.map((s: PriorityLocation) => s.id)]
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= list.length) return
    const temp = list[index]
    list[index] = list[targetIdx]
    list[targetIdx] = temp
    setSelectedStopIds(list)
  }

  const toggleStopSelection = (id: string) => {
    const current = currentStopsList.map((s: PriorityLocation) => s.id)
    if (current.includes(id)) {
      if (current.length <= 1) return // Keep at least 1 stop
      setSelectedStopIds(current.filter((x: string) => x !== id))
    } else {
      setSelectedStopIds([...current, id])
    }
  }

  const generateRoutePlan = async () => {
    const baseLoc = locations.find((l: PriorityLocation) => l.id === baseId) ?? locations[0]
    if (!baseLoc) return

    setIsGenerating(true)

    const stops: InspectionStop[] = currentStopsList.map((l: PriorityLocation) => ({
      id: l.id,
      name: l.name,
      rank: l.rank,
      score: l.score,
      roadStatus: l.roadStatus,
      lat: l.lat,
      lng: l.lng,
      isBlockedConstraint: l.roadStatus === 'blocked' || l.roadStatus === 'uncertain',
    }))

    const constraintNotes: string[] = []
    let totalDist = 0
    let totalDur = 0

    // Build multi-leg OSRM routing along base -> stop1 -> stop2...
    const waypoints: Array<[number, number]> = [[baseLoc.lng, baseLoc.lat], ...stops.map((s: InspectionStop) => [s.lng, s.lat] as [number, number])]
    const lineCoordinates: Array<[number, number]> = []

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i]
      const to = waypoints[i + 1]
      const stopInfo = stops[i]

      if (stopInfo.roadStatus === 'blocked') {
        constraintNotes.push(`Leg to ${stopInfo.name}: Direct access is BLOCKED (${stopInfo.roadStatus}). Alternative route/boat dispatch suggested.`)
      } else if (stopInfo.roadStatus === 'uncertain') {
        constraintNotes.push(`Leg to ${stopInfo.name}: Road status UNCERTAIN. Caution advised.`)
      }

      try {
        const res = await osrmRoute({ from, to, alternatives: true })
        totalDist += res.distanceM
        totalDur += res.durationS

        // Collect coordinates from primary route feature
        const featureGeom = res.geojson.features[0]?.geometry
        if (featureGeom && 'coordinates' in featureGeom) {
          lineCoordinates.push(...(featureGeom.coordinates as Array<[number, number]>))
        } else {
          lineCoordinates.push(from, to)
        }
      } catch {
        // Fallback straight segment if OSRM fails offline
        lineCoordinates.push(from, to)
        totalDist += 4500
        totalDur += 420
      }
    }

    const routePlan: InspectionRoutePlan = {
      baseLocationId: baseLoc.id,
      baseName: baseLoc.name,
      stops,
      totalDistanceM: totalDist,
      totalDurationS: totalDur,
      routeGeojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { alt: 'primary' },
            geometry: {
              type: 'LineString',
              coordinates: lineCoordinates,
            },
          },
        ],
      },
      constraintNotes,
    }

    setPlan(routePlan)
    setIsGenerating(false)
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b4d3f]/40 backdrop-blur-[2px] p-4 animate-fade-up">
      <div className="w-full max-w-lg bg-panel rounded-[28px] border border-edge shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#13735f] to-[#0b4d3f] text-white px-6 py-5 relative">
          <button
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#9ad4c1] mb-1">
            <Navigation className="w-3.5 h-3.5" />
            Response Planning · Priority Inspection Route
          </div>
          <h3 className="text-xl font-extrabold tracking-tight">Plan Inspection Sequence</h3>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 scroll-thin">
          {/* Base selection */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-ink-faint block mb-2">
              Select Starting Point / Command Base
            </label>
            <select
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              className="w-full rounded-[16px] border border-edge bg-panel-soft px-4 py-2.5 text-sm font-bold text-ink focus:outline-none focus:border-primary"
            >
              {locations.map((l: PriorityLocation) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.sub})
                </option>
              ))}
            </select>
          </div>

          {/* Priority Stop Selection & Reordering */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Ordered Priority Inspection Stops ({currentStopsList.length})
              </label>
              <span className="text-[10px] text-ink-faint">Click arrows to reorder</span>
            </div>

            <div className="space-y-2">
              {currentStopsList.map((stop: PriorityLocation, idx: number) => (
                <div
                  key={stop.id}
                  className="flex items-center justify-between rounded-[18px] border border-edge bg-panel-soft px-4 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink truncate">{stop.name}</p>
                      <p className="text-[10px] text-ink-faint">
                        Priority #{stop.rank} · Score: {stop.score}/100 · Road: {stop.roadStatus}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveStop(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-panel border border-edge text-ink-soft disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveStop(idx, 'down')}
                      disabled={idx === currentStopsList.length - 1}
                      className="p-1 rounded hover:bg-panel border border-edge text-ink-soft disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Available locations checklist */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-ink-faint block mb-2">
              Add / Remove Locations for Inspection
            </label>
            <div className="flex flex-wrap gap-1.5">
              {locations
                .filter((l: PriorityLocation) => l.id !== baseId)
                .map((loc: PriorityLocation) => {
                  const isSelected = currentStopsList.some((s: PriorityLocation) => s.id === loc.id)
                  return (
                    <button
                      key={loc.id}
                      onClick={() => toggleStopSelection(loc.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-primary text-white border-transparent'
                          : 'bg-panel-soft border-edge text-ink-soft hover:border-primary/40'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      {loc.name} (#{loc.rank})
                    </button>
                  )
                })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-edge flex items-center justify-end gap-3 bg-panel-soft/40">
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-2.5 rounded-[16px] text-xs font-bold text-ink-soft hover:bg-panel"
          >
            Cancel
          </button>
          <button
            onClick={generateRoutePlan}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 rounded-[16px] bg-primary text-white text-xs font-bold px-5 py-2.5 hover:bg-primary-deep transition-colors disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
            Generate Route Plan
          </button>
        </div>
      </div>
    </div>
  )
}
