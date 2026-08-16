import { create } from 'zustand'
import type { AuditEntry, DataLayerKey, DisasterEvent, FilterKey, PriorityLocation, RouteInfo, Toast, VerificationStatus } from '../types'
import { AUDIT_LOG, DISASTER_EVENTS, PRIORITIES } from '../data/mock'

export type VerificationAction = 'confirmed' | 'rejected' | 'uncertain' | 'corrected'

/** Top-level pages reachable from the sidebar / mobile nav. */
export type PageKey = 'command' | 'scenario' | 'imagery' | 'reports' | 'audit'

export interface LocationState {
  status: VerificationStatus
  aiStatus: VerificationStatus
  score: number
  roadStatus?: PriorityLocation['roadStatus']
  roadLabel?: string
}

export type ThemeMode = 'light' | 'dark'

interface AppState {
  activeEventId: string
  activePage: PageKey
  scenarios: DisasterEvent[]
  selectedLocationId: string | null
  activeFilters: FilterKey[]
  locationOverrides: Record<string, LocationState>
  auditLog: AuditEntry[]
  toasts: Toast[]
  drawerOpen: boolean
  mobileSheetOpen: boolean
  sidebarCollapsed: boolean
  kpiFilter: FilterKey | null
  theme: ThemeMode
  dataLayers: DataLayerKey[]
  route: RouteInfo | null
  routeLoading: boolean
  routeError: string | null

  setActivePage: (p: PageKey) => void
  addScenario: (input: { name: string; type: DisasterEvent['type']; region: string }) => void
  simulateUpload: (eventId: string) => void
  setActiveEvent: (id: string) => void
  selectLocation: (id: string | null) => void
  openDrawer: (id: string) => void
  closeDrawer: () => void
  setMobileSheet: (open: boolean) => void
  toggleFilter: (f: FilterKey) => void
  setKpiFilter: (f: FilterKey | null) => void
  toggleSidebar: () => void

  applyVerification: (
    id: string,
    action: VerificationAction,
    meta?: { correctedRoad?: PriorityLocation['roadStatus'] },
  ) => void
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
  fieldReports: PriorityLocation[]
  reportModalOpen: boolean
  setReportModal: (open: boolean) => void
  addFieldReport: (report: PriorityLocation) => void
  removeFieldReport: (id: string) => void
  setTheme: (t: ThemeMode) => void
  toggleTheme: () => void
  toggleDataLayer: (k: DataLayerKey) => void
  setRouteState: (r: { route?: RouteInfo | null; loading?: boolean; error?: string | null }) => void
  clearRoute: () => void
}

let toastId = 0

function initialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem('disha-theme')
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useAppStore = create<AppState>((set) => ({
  activeEventId: 'evt-cyclone-nivar',
  activePage: 'command',
  scenarios: DISASTER_EVENTS,
  selectedLocationId: null,
  activeFilters: [],
  locationOverrides: {},
  auditLog: AUDIT_LOG,
  toasts: [],
  drawerOpen: false,
  mobileSheetOpen: false,
  sidebarCollapsed: false,
  kpiFilter: null,
  fieldReports: [],
  reportModalOpen: false,
  theme: initialTheme(),
  dataLayers: [],
  route: null,
  routeLoading: false,
  routeError: null,

  setActivePage: (p) => set({ activePage: p, mobileSheetOpen: false }),

  addScenario: ({ name, type, region }) =>
    set((s) => {
      const id = `evt-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`
      const scenario: DisasterEvent = {
        id,
        name,
        type,
        region,
        status: 'processing',
        startedAt: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' IST',
        imageryCount: 0,
        aiProgress: 0,
      }
      const now = new Date().toTimeString().slice(0, 5)
      return {
        scenarios: [scenario, ...s.scenarios],
        activeEventId: id,
        activePage: 'command',
        selectedLocationId: null,
        auditLog: [
          { id: `au${Date.now()}sc`, time: now, actor: 'You', action: 'Created disaster scenario', target: name },
          ...s.auditLog,
        ].slice(0, 60),
        toasts: [
          ...s.toasts,
          { id: ++toastId, tone: 'success', title: 'Scenario created', detail: `${name} · ready for imagery ingestion` },
        ],
      }
    }),

  simulateUpload: (eventId) =>
    set((s) => {
      const target = s.scenarios.find((e) => e.id === eventId)
      if (!target) return {}
      const now = new Date().toTimeString().slice(0, 5)
      const addedImages = 6 + Math.floor(Math.random() * 6)
      const nextProgress = Math.min(100, target.aiProgress + 15 + Math.floor(Math.random() * 10))
      const nextStatus: DisasterEvent['status'] = nextProgress >= 100 ? 'review' : 'processing'
      return {
        scenarios: s.scenarios.map((e) =>
          e.id === eventId
            ? { ...e, imageryCount: e.imageryCount + addedImages, aiProgress: nextProgress, status: nextStatus }
            : e,
        ),
        auditLog: [
          {
            id: `au${Date.now()}up`,
            time: now,
            actor: 'You',
            action: `Uploaded ${addedImages} images`,
            target: target.name,
          },
          {
            id: `au${Date.now()}ai`,
            time: now,
            actor: 'System',
            action: nextProgress >= 100 ? 'AI processing complete' : 'AI processing progressed',
            target: target.name,
          },
          ...s.auditLog,
        ].slice(0, 60),
        toasts: [
          ...s.toasts,
          {
            id: ++toastId,
            tone: 'success',
            title: `${addedImages} images queued`,
            detail: `${target.name} · AI processing at ${nextProgress}%`,
          },
        ],
      }
    }),

  setActiveEvent: (id) => set({ activeEventId: id, selectedLocationId: null }),

  selectLocation: (id) => set({ selectedLocationId: id }),

  openDrawer: (id) =>
    set({ selectedLocationId: id, drawerOpen: true, mobileSheetOpen: false }),

  closeDrawer: () => set({ drawerOpen: false, mobileSheetOpen: false }),

  setMobileSheet: (open) => set({ mobileSheetOpen: open }),

  toggleFilter: (f) =>
    set((s) => {
      const has = s.activeFilters.includes(f)
      return {
        activeFilters: has ? s.activeFilters.filter((x) => x !== f) : [...s.activeFilters, f],
      }
    }),

  setKpiFilter: (f) => set({ kpiFilter: f }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setReportModal: (open) => set({ reportModalOpen: open }),

  setTheme: (t) => {
    if (typeof window !== 'undefined') window.localStorage.setItem('disha-theme', t)
    set({ theme: t })
  },

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark'
      if (typeof window !== 'undefined') window.localStorage.setItem('disha-theme', next)
      return { theme: next }
    }),

  toggleDataLayer: (k) =>
    set((s) => ({
      dataLayers: s.dataLayers.includes(k)
        ? s.dataLayers.filter((x) => x !== k)
        : [...s.dataLayers, k],
    })),

  setRouteState: ({ route, loading, error }) =>
    set((s) => ({
      route: route !== undefined ? route : s.route,
      routeLoading: loading !== undefined ? loading : s.routeLoading,
      routeError: error !== undefined ? error : s.routeError,
    })),

  clearRoute: () => set({ route: null, routeLoading: false, routeError: null }),

  addFieldReport: (report) =>
    set((s) => ({
      fieldReports: [report, ...s.fieldReports],
      auditLog: [
        {
          id: `au${Date.now()}fr`,
          time: report.submittedAt ?? new Date().toTimeString().slice(0, 5),
          actor: 'You',
          action: 'Added field report',
          target: report.name,
        },
        ...s.auditLog,
      ].slice(0, 60),
      toasts: [
        ...s.toasts,
        {
          id: ++toastId,
          tone: 'success',
          title: 'Field report added',
          detail: `${report.name} scored ${report.score}/100 · priority recalculated`,
        },
      ],
    })),

  removeFieldReport: (id) => set((s) => ({ fieldReports: s.fieldReports.filter((r) => r.id !== id) })),

  applyVerification: (id, action, meta) =>
    set((s) => {
      const base = PRIORITIES.find((p) => p.id === id) ?? s.fieldReports.find((r) => r.id === id)
      const prev = s.locationOverrides[id] ?? {
        status: 'pending' as VerificationStatus,
        aiStatus: 'pending' as VerificationStatus,
        score: base?.score ?? 0,
        roadStatus: base?.roadStatus,
      }
      const now = new Date().toTimeString().slice(0, 5)

      let next: LocationState
      let toast: Omit<Toast, 'id'>
      let audit: AuditEntry

      switch (action) {
        case 'confirmed':
          next = { ...prev, status: 'confirmed', score: Math.min(100, Math.round(prev.score + 1)) }
          toast = { tone: 'success', title: 'Finding confirmed', detail: `${base?.name} verified by you` }
          audit = { id: `au${Date.now()}`, time: now, actor: 'You', action: 'Confirmed AI finding', target: base?.name ?? id }
          break
        case 'rejected':
          next = { ...prev, status: 'rejected', score: Math.max(0, Math.round(prev.score - 22)) }
          toast = { tone: 'warn', title: 'Finding rejected', detail: `${base?.name} demoted in priority` }
          audit = { id: `au${Date.now()}`, time: now, actor: 'You', action: 'Rejected AI finding', target: base?.name ?? id }
          break
        case 'uncertain':
          next = { ...prev, status: 'uncertain', score: prev.score }
          toast = { tone: 'info', title: 'Marked uncertain', detail: 'Field confirmation requested' }
          audit = { id: `au${Date.now()}`, time: now, actor: 'You', action: 'Marked uncertain', target: base?.name ?? id }
          break
        case 'corrected':
          if (meta?.correctedRoad) {
            const opened = meta.correctedRoad === 'open'
            next = {
              ...prev,
              status: 'corrected',
              roadStatus: meta.correctedRoad,
              roadLabel: opened ? 'Corrected to open' : 'Corrected to blocked',
              score: opened ? Math.min(100, prev.score + 9) : Math.max(0, prev.score - 14),
            }
            toast = {
              tone: 'success',
              title: opened ? 'Road corrected → open' : 'Road corrected → blocked',
              detail: `${base?.name} re-scored to ${next.score}/100`,
            }
            audit = {
              id: `au${Date.now()}`,
              time: now,
              actor: 'You',
              action: opened ? 'Corrected road → open' : 'Corrected road → blocked',
              target: base?.name ?? id,
            }
          } else {
            next = { ...prev, status: 'corrected', score: prev.score }
            toast = { tone: 'info', title: 'Correction stored', detail: 'Re-scored after review' }
            audit = { id: `au${Date.now()}`, time: now, actor: 'You', action: 'Corrected finding', target: base?.name ?? id }
          }
          break
      }

      const reAudit: AuditEntry = {
        id: `au${Date.now()}b`,
        time: now,
        actor: 'System',
        action: 'Priority recalculated',
        target: 'Cyclone Nivar',
      }

      return {
        locationOverrides: { ...s.locationOverrides, [id]: next },
        auditLog: [reAudit, audit, ...s.auditLog].slice(0, 60),
        toasts: [...s.toasts, { ...toast, id: ++toastId }],
      }
    }),

  pushToast: (t) => set((s) => ({ toasts: [...s.toasts, { ...t, id: ++toastId }] })),

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export function getEffectiveLocation(p: PriorityLocation, overrides: Record<string, LocationState>): PriorityLocation {
  const o = overrides[p.id]
  if (!o) return p
  return {
    ...p,
    status: o.status,
    score: o.score,
    roadStatus: o.roadStatus ?? p.roadStatus,
  }
}

export function rankLocations(p: PriorityLocation[], overrides: Record<string, LocationState>): PriorityLocation[] {
  return [...p]
    .map((l) => getEffectiveLocation(l, overrides))
    .sort((a, b) => b.score - a.score)
    .map((l, i) => ({ ...l, rank: i + 1 }))
}

export function useRankedLocations(): PriorityLocation[] {
  const overrides = useAppStore((s) => s.locationOverrides)
  const fieldReports = useAppStore((s) => s.fieldReports)
  return rankLocations([...PRIORITIES, ...fieldReports], overrides)
}

export function useMapLocations(): PriorityLocation[] {
  const all = useRankedLocations()
  const filter = useAppStore((s) => s.kpiFilter)
  if (!filter) return all
  switch (filter) {
    case 'damage':
      return all.filter((l) => l.damageLevel === 'severe' || l.damageLevel === 'critical')
    case 'roads':
      return all.filter((l) => l.roadStatus === 'blocked' || l.roadStatus === 'uncertain')
    case 'services':
      return all.filter((l) => l.serviceRisk === 'severe' || l.serviceRisk === 'critical')
  }
}
