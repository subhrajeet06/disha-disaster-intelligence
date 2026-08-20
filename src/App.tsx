import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Camera } from 'lucide-react'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { MobileBottomNav } from './components/layout/MobileShell'
import { Toasts } from './components/layout/Toasts'
import { DisasterMap } from './components/map/DisasterMap'
import { MapOverlay } from './components/map/MapOverlay'
import { PriorityQueue } from './components/priority/PriorityQueue'
import { EvidenceDrawer } from './components/evidence/EvidenceDrawer'
import { FieldReportModal } from './components/report/FieldReportModal'
import { InspectionRouteModal } from './components/map/InspectionRouteModal'
import { ScenarioPage } from './components/pages/ScenarioPage'
import { ImageryPage } from './components/pages/ImageryPage'
import { ReportsPage } from './components/pages/ReportsPage'
import { AuditPage } from './components/pages/AuditPage'
import { useAppStore } from './store/useAppStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

function App() {
  const setReportModal = useAppStore((s) => s.setReportModal)
  const setMobileSheet = useAppStore((s) => s.setMobileSheet)
  const theme = useAppStore((s) => s.theme)
  const activePage = useAppStore((s) => s.activePage)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0e1815' : '#13735f')
  }, [theme])

  const openReport = () => {
    setMobileSheet(false)
    setReportModal(true)
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen flex overflow-hidden bg-panel-soft font-sans text-ink">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />

          <div className="flex-1 flex min-h-0">
            {activePage === 'command' ? (
              <>
                <main className="relative flex-1 min-w-0 bg-[var(--color-map-bg)]">
                  <DisasterMap />
                  <MapOverlay />

                  {/* New field report floating action — raised above mobile bottom nav */}
                  <button
                    onClick={openReport}
                    className="absolute bottom-24 lg:bottom-6 right-4 lg:right-8 z-30 flex items-center gap-2 rounded-full bg-primary text-white font-bold text-sm px-5 py-3.5 shadow-xl shadow-primary/30 hover:bg-primary-deep hover:scale-[1.03] transition-all duration-200 active:scale-95"
                    aria-label="New field report"
                  >
                    <Camera className="w-4 h-4" />
                    <span className="hidden sm:inline">New field report</span>
                    <span className="sm:hidden">Report</span>
                  </button>
                </main>

                <aside className="hidden xl:flex w-[400px] flex-col min-h-0 border-l border-edge bg-panel">
                  <PriorityQueue />
                </aside>
              </>
            ) : (
              <main className="relative flex-1 min-w-0 bg-panel-soft">
                {activePage === 'scenario' && <ScenarioPage />}
                {activePage === 'imagery' && <ImageryPage />}
                {activePage === 'reports' && <ReportsPage />}
                {activePage === 'audit' && <AuditPage />}
              </main>
            )}
          </div>
        </div>

        <MobileBottomNav />
        <EvidenceDrawer />
        <FieldReportModal />
        <InspectionRouteModal />
        <Toasts />
      </div>
    </QueryClientProvider>
  )
}

export default App
