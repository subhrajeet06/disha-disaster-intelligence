import { useQuery } from '@tanstack/react-query'
import type { DisasterEvent, KpiSummary, PriorityLocation } from '../types'
import { DISASTER_EVENTS, KPI, PRIORITIES } from '../data/mock'
import { rankLocations, useAppStore } from '../store/useAppStore'

const LATENCY = 260

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export const mockApi = {
  fetchEvents: (): Promise<DisasterEvent[]> => delay(DISASTER_EVENTS),

  fetchPriorities: (eventId: string): Promise<PriorityLocation[]> => {
    const filtered = PRIORITIES.filter(() => eventId === 'evt-cyclone-nivar' || true)
    return delay(filtered)
  },

  fetchKpi: (): Promise<KpiSummary> => delay(KPI),

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

export function useKpi() {
  return useQuery({ queryKey: ['kpi'], queryFn: mockApi.fetchKpi })
}
