import { Activity, ChevronDown, Layers, Map, Radar, ShieldCheck, Warehouse, Waves, Flame, Zap, Camera } from 'lucide-react'
import { useAppStore, type PageKey } from '../../store/useAppStore'
import type { DisasterEvent } from '../../types'
import { useState } from 'react'

const NAV: Array<{ label: string; icon: typeof Radar; page?: PageKey; disabled?: boolean }> = [
  { label: 'Command', icon: Radar, page: 'command' },
  { label: 'Scenario', icon: Layers, page: 'scenario' },
  { label: 'Imagery', icon: Warehouse, page: 'imagery' },
  { label: 'Reports', icon: Activity, page: 'reports' },
  { label: 'Audit', icon: ShieldCheck, page: 'audit' },
]

/** One source of truth for every collapsed tile → identical 40x40 square */
const TILE = 'w-10 h-10 p-0 justify-center shrink-0'

export function EventIcon({ type }: { type: DisasterEvent['type'] }) {
  const cls = 'w-4 h-4'
  switch (type) {
    case 'cyclone':
      return <Waves className={cls} />
    case 'flood':
      return <Waves className={cls} />
    case 'fire':
      return <Flame className={cls} />
    default:
      return <Zap className={cls} />
  }
}

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError] = useState(false)

  if (hasError) {
    return <div className="text-red-500 p-4">Something went wrong in the sidebar.</div>
  }

  return <>{children}</>
}

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const activeEventId = useAppStore((s) => s.activeEventId)
  const setActiveEvent = useAppStore((s) => s.setActiveEvent)
  const setReportModal = useAppStore((s) => s.setReportModal)
  const scenarios = useAppStore((s) => s.scenarios)
  const activeEvent = scenarios.find((e) => e.id === activeEventId) ?? scenarios[0]
  const auditLog = useAppStore((s) => s.auditLog)
  const activePage = useAppStore((s) => s.activePage)
  const setActivePage = useAppStore((s) => s.setActivePage)
  const [isLiveAuditExpanded, setIsLiveAuditExpanded] = useState<boolean>(false)
  const [isScenarioDropdownOpen, setIsScenarioDropdownOpen] = useState<boolean>(false)

  return (
    <ErrorBoundary>
      <aside
        className={`hidden lg:flex shrink-0 flex-col h-screen transition-[width] duration-200 border-r border-transparent dark:border-edge
          bg-gradient-to-b from-primary to-primary-deep text-white
          dark:bg-none dark:bg-panel
          ${collapsed ? 'w-16' : 'w-[268px]'}
        `}
      >
        {/* Brand */}
        <div
          className={`pt-7 pb-6 border-b border-white/10 flex items-center $
            ${collapsed ? 'justify-center px-3' : 'px-6 gap-3'}
          `}
        >
          <div
            className={`rounded-[14px] bg-white/15 backdrop-blur flex items-center justify-center shrink-0 $
              ${collapsed ? 'w-10 h-10' : 'w-11 h-11'}
            `}
          >
            <Map className={collapsed ? 'w-5 h-5 text-white dark:text-ink' : 'w-6 h-6 text-white dark:text-ink'} />
          </div>
          {!collapsed && (
            <div className="leading-none">
              <p className="font-extrabold text-xl tracking-tight dark:text-ink">DISHA</p>
              <p className="text-[10px] font-medium text-white/60 dark:text-ink-soft mt-1 tracking-wide uppercase">
                Disaster Intelligence
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin">
          {/* Nav */}
          <nav className="px-3 pt-4 space-y-1">
            {NAV.map((n) => {
              const active = n.page ? activePage === n.page : false
              return (
                <button
                  key={n.label}
                  disabled={n.disabled}
                  onClick={n.page ? () => setActivePage(n.page as PageKey) : undefined}
                  title={collapsed ? n.label : n.disabled ? 'Coming soon' : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center rounded-[16px] text-sm font-semibold transition-colors duration-200 $
                    ${collapsed ? TILE : 'w-full h-10 gap-3 px-4'}
                    ${active
                      ? 'bg-white/15 text-white dark:bg-panel-tint dark:text-primary'
                      : n.disabled
                        ? 'text-white/30 dark:text-ink-faint cursor-not-allowed'
                        : 'text-white/65 hover:bg-white/8 hover:text-white dark:text-ink-soft dark:hover:bg-panel-soft dark:hover:text-ink'
                    }`}
                >
                  <n.icon className="w-[18px] h-[18px] shrink-0" />
                  {!collapsed && n.label}
                  {!collapsed && n.disabled && (
                    <span className="ml-auto text-[9px] font-bold text-white/35">SOON</span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* New field report */}
          <div className="px-3 pt-5">
            <button
              onClick={() => setReportModal(true)}
              title={collapsed ? 'New field report' : undefined}
              className={`flex items-center rounded-[16px] bg-white text-primary-deep dark:bg-primary dark:text-white font-bold text-sm shadow-md hover:bg-white/95 dark:hover:bg-primary-deep hover:shadow-lg transition-all duration-200 $
                ${collapsed ? TILE : 'w-full gap-3 px-4 py-3 rounded-[20px]'}
              `}
            >
              {collapsed ? (
                <Camera className="w-[18px] h-[18px]" />
              ) : (
                <>
                  <span className="flex items-center justify-center w-8 h-8 rounded-[12px] bg-primary text-white shrink-0">
                    <Camera className="w-4 h-4" />
                  </span>
                  <span className="whitespace-nowrap">New field report</span>
                  <span className="ml-auto text-[9px] font-extrabold bg-[#e9b949] text-[#4a3a05] rounded-full px-2 py-0.5 shrink-0">
                    GPS
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Active scenario */}
          <div className="mt-6 px-3">
            {!collapsed && (
              <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                Active scenario
              </p>
            )}
            <div className="relative">
              <button
                onClick={() => setIsScenarioDropdownOpen(!isScenarioDropdownOpen)}
                title={collapsed ? activeEvent.name : undefined}
                className={`flex items-center bg-white/10 border border-white/15 $
                  ${collapsed ? `${TILE} rounded-[16px]` : 'w-full rounded-[20px] px-4 py-3.5 gap-3'}
                `}
              >
                {collapsed ? (
                  <EventIcon type={activeEvent.type} />
                ) : (
                  <>
                    <span className="flex items-center justify-center w-9 h-9 rounded-[12px] bg-white/15 shrink-0">
                      <EventIcon type={activeEvent.type} />
                    </span>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold truncate">{activeEvent.name}</p>
                      <p className="text-[11px] text-white/55 truncate">
                        {activeEvent.region} · {activeEvent.status === 'review' ? 'In review' : activeEvent.status}
                      </p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-white/50 shrink-0 transform transition-transform duration-200 ${isScenarioDropdownOpen ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>

              {!collapsed && isScenarioDropdownOpen && (
                <div className="absolute inset-x-4 top-full mt-1.5 z-30 space-y-1">
                  {scenarios
                    .filter((e) => e.id !== activeEventId)
                    .map((e) => (
                      <button
                        key={e.id}
                        onClick={() => {
                          setActiveEvent(e.id)
                          setIsScenarioDropdownOpen(false)
                        }}
                        className="w-full text-left bg-[#0b4d3f] rounded-[16px] px-4 py-2.5 text-xs font-semibold text-white/80 hover:bg-[#105a48]"
                      >
                        {e.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Audit trail */}
        {!collapsed && (
          <div className="px-6 pb-5 pt-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setIsLiveAuditExpanded(!isLiveAuditExpanded)}
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors duration-200"
              >
                Live audit
                <ChevronDown className={`w-3 h-3 transform transition-transform duration-200 ${isLiveAuditExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isLiveAuditExpanded && (
                <button
                  onClick={() => setActivePage('audit')}
                  className="text-[10px] font-bold text-[#9ad4c1] hover:text-white transition-colors duration-200"
                >
                  View all
                </button>
              )}
            </div>
            {isLiveAuditExpanded && (
              <div className="space-y-2.5">
                {auditLog.slice(0, 4).map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5">
                    <span
                      className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 $
                        ${a.actor === 'System' ? 'bg-[#e9b949]' : 'bg-[#7fd0b8]'}
                      `}
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-white/85 leading-snug truncate">{a.action}</p>
                      <p className="text-[10px] text-white/45">
                        {a.target} · {a.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </ErrorBoundary>
  )
}