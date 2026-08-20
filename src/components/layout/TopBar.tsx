import { Building2, Users, AlertTriangle, Route, Moon, Sun, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useKpi } from '../../api/mockApi'
import { fmtInt } from '../../lib/format'
import { SearchBar } from './SearchBar'
import type { FilterKey } from '../../types'

const PAGE_TITLE: Record<string, string> = {
  command: 'Command Overview',
  scenario: 'Scenario Management',
  reports: 'Analytics & Reports',
  audit: 'Audit & Verification Trail',
}

const CARDS: Array<{
  key: FilterKey | 'population' | 'confidence'
  icon: typeof Building2
  label: string
  accent: string
  value: (k: { buildingsAffected: number; roadsBlocked: number; servicesAtRisk: number; populationAffected: number }) => string
}> = [
  {
    key: 'damage',
    icon: Building2,
    label: 'Buildings affected',
    accent: 'var(--color-sev-critical)',
    value: (k) => fmtInt(k.buildingsAffected),
  },
  {
    key: 'roads',
    icon: Route,
    label: 'Roads blocked',
    accent: 'var(--color-sev-severe)',
    value: (k) => String(k.roadsBlocked),
  },
  {
    key: 'services',
    icon: AlertTriangle,
    label: 'Services at risk',
    accent: 'var(--color-sev-moderate)',
    value: (k) => String(k.servicesAtRisk),
  },
  {
    key: 'population',
    icon: Users,
    label: 'Population exposed',
    accent: 'var(--color-accent)',
    value: (k) => fmtInt(k.populationAffected),
  },
]

export function TopBar() {
  const { data: kpi } = useKpi()
  const activeEventId = useAppStore((s) => s.activeEventId)
  const kpiFilter = useAppStore((s) => s.kpiFilter)
  const setKpiFilter = useAppStore((s) => s.setKpiFilter)
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const scenarios = useAppStore((s) => s.scenarios)
  const activePage = useAppStore((s) => s.activePage)
  const setActivePage = useAppStore((s) => s.setActivePage)
  const event = scenarios.find((e) => e.id === activeEventId) ?? scenarios[0]

  const k = kpi ?? {
    buildingsAffected: 0,
    roadsBlocked: 0,
    servicesAtRisk: 0,
    populationAffected: 0,
  }

  return (
    <header className="shrink-0 relative z-30 border-b border-edge bg-[var(--color-panel)]/85 backdrop-blur px-3 sm:px-5 py-2.5">
      <div className={`flex items-center gap-3 ${activePage === 'command' ? 'mb-2' : ''}`}>
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <button
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex shrink-0 items-center justify-center w-8 h-8 rounded-full border border-edge bg-[var(--color-panel)] text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/50 transition-colors duration-200"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setActivePage('scenario')}
            aria-label="Change scenario"
            className="lg:hidden shrink-0 flex items-center justify-center w-8 h-8 rounded-full border border-edge bg-[var(--color-panel)] text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/50 transition-colors duration-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              {event.name} · {event.region}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight truncate">
              {PAGE_TITLE[activePage] ?? 'Command Overview'}
            </h1>
          </div>
        </div>

        <SearchBar />

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--color-edge)] bg-[var(--color-panel)] text-[var(--color-ink-soft)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/50 transition-colors duration-200"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[var(--color-panel-tint)] text-[var(--color-primary-deep)] px-3 py-1 text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
            {event.status === 'review' ? 'AI + human review active' : 'Processing'}
          </span>
        </div>
      </div>

      {activePage === 'command' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {CARDS.map((c) => {
            const clickable = c.key === 'damage' || c.key === 'roads' || c.key === 'services'
            const active = kpiFilter === c.key
            return (
              <button
                key={c.key}
                disabled={!clickable}
                onClick={() => setKpiFilter(active ? null : (c.key as FilterKey))}
                className={`group w-full flex items-center gap-3 rounded-[28px] px-4 sm:px-5 py-2 border text-left transition-all duration-200 ${
                  active
                    ? 'border-primary bg-primary text-white shadow-lg shadow-[#13735f]/20'
                    : 'border-edge bg-panel hover:border-primary/40'
                } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span
                  className="flex items-center justify-center w-8 h-8 rounded-[14px] shrink-0 transition-colors duration-200"
                  style={{
                    background: active ? 'rgba(255,255,255,0.18)' : `${c.accent}18`,
                    color: active ? '#fff' : c.accent,
                  }}
                >
                  <c.icon className="w-[16px] h-[16px]" />
                </span>
                <span className="leading-none min-w-0">
                  <span className={`block text-xl font-extrabold tabular-nums ${active ? 'text-white' : 'text-ink'}`}>
                    {c.value(k)}
                  </span>
                  <span className={`block mt-1 text-[11px] font-semibold truncate ${active ? 'text-white/75' : 'text-ink-soft'}`}>
                    {c.label}
                  </span>
                </span>
                {clickable && active && (
                  <span
                    className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold bg-white/20 text-white"
                  >
                    ON
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </header>
  )
}