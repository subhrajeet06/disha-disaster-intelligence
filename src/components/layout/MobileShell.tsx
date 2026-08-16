import { useState } from 'react'
import { ListOrdered, ShieldCheck, Map, Menu, Layers, Activity, Warehouse, X } from 'lucide-react'
import { useAppStore, useRankedLocations, type PageKey } from '../../store/useAppStore'
import { PriorityQueue } from '../priority/PriorityQueue'

const MORE_ITEMS: Array<{ key: PageKey; label: string; icon: typeof Layers; hint: string }> = [
  { key: 'scenario', label: 'Scenario', icon: Layers, hint: 'Manage disaster events & imagery' },
  { key: 'imagery', label: 'Imagery', icon: Warehouse, hint: 'Ingestion & vision analytics' },
  { key: 'reports', label: 'Reports', icon: Activity, hint: 'Analytics, verification, exports' },
  { key: 'audit', label: 'Audit', icon: ShieldCheck, hint: 'Full verification trail' },
]

const PAGE_LABEL: Record<PageKey, string> = {
  command: 'Map',
  scenario: 'Scenario',
  imagery: 'Imagery',
  reports: 'Reports',
  audit: 'Audit',
}

/** Small icon matching the currently active non-command page, so the bottom tab keeps its identity. */
function ActivePageIcon({ page }: { page: PageKey }) {
  const Icon = MORE_ITEMS.find((m) => m.key === page)?.icon ?? Menu
  return <Icon className="w-5 h-5" />
}

export function MobileBottomNav() {
  const setMobileSheet = useAppStore((s) => s.setMobileSheet)
  const mobileSheetOpen = useAppStore((s) => s.mobileSheetOpen)
  const openDrawer = useAppStore((s) => s.openDrawer)
  const activePage = useAppStore((s) => s.activePage)
  const setActivePage = useAppStore((s) => s.setActivePage)
  const locations = useRankedLocations()
  const top = locations[0]
  const [moreOpen, setMoreOpen] = useState(false)

  const goCommand = () => {
    setMoreOpen(false)
    setActivePage('command')
  }

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--color-panel)]/92 backdrop-blur-lg border-t border-edge px-2 py-2 pb-[max(env(safe-area-inset-bottom),8px)]">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <button
            onClick={goCommand}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 ${activePage === 'command' ? 'text-primary' : 'text-ink-faint'}`}
            aria-label="Map"
          >
            <Map className="w-5 h-5" />
            <span className="text-[9px] font-bold">Map</span>
          </button>
          <button
            onClick={() => {
              if (activePage !== 'command') setActivePage('command')
              setMobileSheet(!mobileSheetOpen)
            }}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-[16px] ${mobileSheetOpen ? 'text-primary' : 'text-ink-faint'}`}
            aria-label="Priorities"
          >
            <ListOrdered className="w-5 h-5" />
            <span className="text-[9px] font-bold">Priorities</span>
          </button>
          {top && (
            <button
              onClick={() => {
                if (activePage !== 'command') setActivePage('command')
                openDrawer(top.id)
              }}
              className="flex flex-col items-center gap-0.5 px-4 py-1 text-ink-faint"
              aria-label="Review top priority"
            >
              <ShieldCheck className="w-5 h-5" />
              <span className="text-[9px] font-bold">Review</span>
            </button>
          )}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 ${activePage !== 'command' ? 'text-primary' : 'text-ink-faint'}`}
            aria-label="More pages"
          >
            {activePage !== 'command' ? <ActivePageIcon page={activePage} /> : <Menu className="w-5 h-5" />}
            <span className="text-[9px] font-bold truncate max-w-[52px]">
              {activePage !== 'command' ? PAGE_LABEL[activePage] : 'More'}
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile priority bottom sheet */}
      <div
        className={`lg:hidden fixed inset-0 z-50 bg-[#0b4d3f]/40 backdrop-blur-[2px] transition-opacity duration-300 ${
          mobileSheetOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileSheet(false)}
      >
        <div
          className={`absolute inset-x-0 bottom-0 max-h-[75vh] rounded-t-[40px] bg-panel overflow-hidden flex flex-col shadow-2xl transition-transform duration-300 ${
            mobileSheetOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          onClick={(e) => e.stopPropagation()}
          style={{ transform: mobileSheetOpen ? 'translateY(0)' : 'translateY(100%)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="pt-3 pb-0 flex justify-center">
            <span className="w-10 h-1.5 rounded-full bg-edge-strong" />
          </div>
          <PriorityQueue compact />
        </div>
      </div>

      {/* Mobile "more" pages sheet */}
      <div
        className={`lg:hidden fixed inset-0 z-50 bg-[#0b4d3f]/40 backdrop-blur-[2px] transition-opacity duration-300 ${
          moreOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMoreOpen(false)}
      >
        <div
          className={`absolute inset-x-0 bottom-0 rounded-t-[40px] bg-panel overflow-hidden flex flex-col shadow-2xl transition-transform duration-300 ${
            moreOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          onClick={(e) => e.stopPropagation()}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="pt-3 pb-1 flex justify-center">
            <span className="w-10 h-1.5 rounded-full bg-edge-strong" />
          </div>
          <div className="px-5 pt-2 pb-1 flex items-center justify-between">
            <p className="text-sm font-extrabold text-ink">More</p>
            <button
              onClick={() => setMoreOpen(false)}
              className="w-8 h-8 rounded-full bg-panel-soft flex items-center justify-center text-ink-soft"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-4 pb-6 pt-2 space-y-1.5">
            {MORE_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setActivePage(item.key)
                  setMoreOpen(false)
                }}
                className={`w-full flex items-center gap-3 rounded-[18px] px-4 py-3 text-left transition-colors duration-200 ${
                  activePage === item.key ? 'bg-panel-tint' : 'hover:bg-panel-soft'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-10 h-10 rounded-[13px] shrink-0 ${
                    activePage === item.key ? 'bg-primary text-white' : 'bg-panel-soft text-primary'
                  }`}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">{item.label}</span>
                  <span className="block text-[11px] text-ink-faint truncate">{item.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
