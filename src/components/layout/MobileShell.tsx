import { Radar, ListOrdered, ShieldCheck, Map } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useRankedLocations } from '../../store/useAppStore'
import { PriorityQueue } from '../priority/PriorityQueue'

export function MobileBottomNav() {
  const setMobileSheet = useAppStore((s) => s.setMobileSheet)
  const mobileSheetOpen = useAppStore((s) => s.mobileSheetOpen)
  const openDrawer = useAppStore((s) => s.openDrawer)
  const locations = useRankedLocations()
  const top = locations[0]

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--color-panel)]/92 backdrop-blur-lg border-t border-edge px-2 py-2 pb-[max(env(safe-area-inset-bottom),8px)]">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <button className="flex flex-col items-center gap-0.5 px-4 py-1 text-primary" aria-label="Map">
            <Map className="w-5 h-5" />
            <span className="text-[9px] font-bold">Map</span>
          </button>
          <button
            onClick={() => setMobileSheet(!mobileSheetOpen)}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-[16px] ${mobileSheetOpen ? 'text-primary' : 'text-ink-faint'}`}
            aria-label="Priorities"
          >
            <ListOrdered className="w-5 h-5" />
            <span className="text-[9px] font-bold">Priorities</span>
          </button>
          {top && (
            <button
              onClick={() => openDrawer(top.id)}
              className="flex flex-col items-center gap-0.5 px-4 py-1 text-ink-faint"
              aria-label="Review top priority"
            >
              <ShieldCheck className="w-5 h-5" />
              <span className="text-[9px] font-bold">Review</span>
            </button>
          )}
          <button className="flex flex-col items-center gap-0.5 px-4 py-1 text-ink-faint" aria-label="Status">
            <Radar className="w-5 h-5" />
            <span className="text-[9px] font-bold">Status</span>
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
    </>
  )
}
