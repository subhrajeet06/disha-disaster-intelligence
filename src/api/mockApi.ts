import { useQuery } from '@tanstack/react-query'
import type { DisasterEvent, KpiSummary, PriorityLocation } from '../types'
import { DISASTER_EVENTS, PRIORITIES } from '../data/mock'
import { deriveKpi, rankLocations, useAppStore, useRankedLocations } from '../store/useAppStore'

const LATENCY = 260

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export const mockApi = {
  fetchEvents: (): Promise<DisasterEvent[]> => delay(DISASTER_EVENTS),

  fetchPriorities: (eventId: string): Promise<PriorityLocation[]> => {
    const filtered = PRIORITIES.filter((p) => p.scenarioId === eventId)
    return delay(filtered)
  },

  fetchKpi: (eventId: string): Promise<KpiSummary> =>
    delay(deriveKpi(PRIORITIES.filter((p) => p.scenarioId === eventId))),

  runInference: async (_imageId: string): Promise<{ jobId: string; status: string }> =>
    delay({ jobId: `job-${Date.now()}`, status: 'queued' }, 400),
}

export function useEvents() {
  return useQuery({ queryKey: ['events'], queryFn: mockApi.fetchEvents })
}

export function usePriorities() {
  const activeEventId = useAppStore((s) => s.activeEventId)
  const overrides = useAppStore((s) => s.locationOverrides)

  return useQuery({
    queryKey: ['priorities', activeEventId],
    queryFn: () => mockApi.fetchPriorities(activeEventId),
    select: (data) => rankLocations(data, overrides),
  })
}

/** KPIs for the active scenario, derived live from its ranked locations so the
    numbers always match what is shown on the map and in the priority list. */
export function useKpi(): { data: KpiSummary } {
  const locations = useRankedLocations()
  return { data: deriveKpi(locations) }
}
