import { useMemo, useState } from 'react'
import { X, Check, ThumbsDown, HelpCircle, MapPin, Users, Route, ShieldCheck, FileText, ImageIcon, ScanLine, Navigation, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore, type VerificationAction } from '../../store/useAppStore'
import { useRankedLocations } from '../../store/useAppStore'
import { FACILITIES, FACTOR_META, FACTOR_ORDER } from '../../data/mock'
import { ScoreRing, FactorBar, SeverityPill, StatusPill } from '../ui'
import { fmtInt, pct, roadLabel } from '../../lib/format'
import { osrmRoute, fmtDistance, fmtDuration } from '../../lib/routing'
import type { Evidence, PriorityLocation } from '../../types'

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLng = ((b[0] - a[0]) * Math.PI) / 180
  const la1 = (a[1] * Math.PI) / 180
  const la2 = (b[1] * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const KIND_META: Record<Evidence['kind'], { icon: typeof ImageIcon; label: string; color: string }> = {
  imagery: { icon: ImageIcon, label: 'Imagery', color: '#13735f' },
  detection: { icon: ScanLine, label: 'AI detection', color: '#a4311f' },
  access: { icon: Route, label: 'Access', color: '#d9822b' },
  context: { icon: Users, label: 'Context', color: '#2e7d9e' },
  audit: { icon: FileText, label: 'Audit', color: '#7a5aa8' },
}

export function EvidenceDrawer() {
  const drawerOpen = useAppStore((s) => s.drawerOpen)
  const closeDrawer = useAppStore((s) => s.closeDrawer)
  const openDrawer = useAppStore((s) => s.openDrawer)
  const selectedId = useAppStore((s) => s.selectedLocationId)
  const locations = useRankedLocations()
  const loc = useMemo(() => locations.find((l) => l.id === selectedId), [locations, selectedId])
  const currentIndex = useMemo(() => locations.findIndex((l) => l.id === selectedId), [locations, selectedId])
  
  const prevLoc = currentIndex > 0 ? locations[currentIndex - 1] : null
  const nextLoc = currentIndex !== -1 && currentIndex < locations.length - 1 ? locations[currentIndex + 1] : null

  const applyVerification = useAppStore((s) => s.applyVerification)
  const routeLoading = useAppStore((s) => s.routeLoading)
  const routeError = useAppStore((s) => s.routeError)
  const route = useAppStore((s) => s.route)
  const setRouteState = useAppStore((s) => s.setRouteState)
  const clearRoute = useAppStore((s) => s.clearRoute)

  const nearestFacility = useMemo(() => {
    if (!loc) return null
    let best: { name: string; coords: [number, number]; km: number } | null = null
    for (const [name, coords] of Object.entries(FACILITIES)) {
      const km = haversineKm([loc.lng, loc.lat], coords)
      if (!best || km < best.km) best = { name, coords, km }
    }
    return best
  }, [loc])

  const planRoute = async () => {
    if (!loc || !nearestFacility) return
    clearRoute()
    setRouteState({ loading: true, error: null })
    try {
      const res = await osrmRoute({ from: [loc.lng, loc.lat], to: nearestFacility.coords })
      setRouteState({
        route: {
          facility: nearestFacility.name,
          geojson: res.geojson,
          distanceM: res.distanceM,
          durationS: res.durationS,
          alternatives: res.alternatives,
          facilityLngLat: nearestFacility.coords,
        },
        loading: false,
        error: null,
      })
    } catch (err) {
      setRouteState({
        route: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Routing failed',
      })
    }
  }

  const [touchStart, setTouchStart] = useState<number | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return
    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStart - touchEnd

    if (Math.abs(diff) > 50) {
      if (diff > 0 && nextLoc) {
        openDrawer(nextLoc.id)
      } else if (diff < 0 && prevLoc) {
        openDrawer(prevLoc.id)
      }
    }
    setTouchStart(null)
  }

  if (!drawerOpen || !loc) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#0b4d3f]/40 backdrop-blur-[2px] animate-fade-up" onClick={closeDrawer}>
      <div
        className="w-full max-w-[520px] h-full bg-panel shadow-2xl overflow-hidden flex flex-col animate-drawer-in"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-[#13735f] to-[#0b4d3f] text-white px-6 pt-6 pb-5 relative">
          <div className="absolute right-14 top-4 flex gap-1">
            <button
              onClick={() => prevLoc && openDrawer(prevLoc.id)}
              disabled={!prevLoc}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30 disabled:hover:bg-white/15 transition-colors flex items-center justify-center"
              aria-label="Previous priority"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => nextLoc && openDrawer(nextLoc.id)}
              disabled={!nextLoc}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-30 disabled:hover:bg-white/15 transition-colors flex items-center justify-center"
              aria-label="Next priority"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={closeDrawer}
            className="absolute right-4 top-4 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#9ad4c1] mb-2">
            <MapPin className="w-3.5 h-3.5" />
            Priority #{loc.rank} of {locations.length}
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight pr-8">{loc.name}</h2>
          <p className="text-[13px] text-white/70 mt-1">{loc.sub}</p>

          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <StatusPill label={loc.status === 'pending' ? 'Awaiting review' : loc.status} tone={loc.status === 'pending' ? 'warn' : 'success'} />
            <SeverityPill severity={loc.damageLevel} />
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                loc.roadStatus === 'blocked'
                  ? 'bg-white/20 text-white'
                  : loc.roadStatus === 'uncertain'
                    ? 'bg-[#e9b949]/90 text-[#4a3a05]'
                    : 'bg-white/20 text-white'
              }`}
            >
              <Route className="w-3 h-3" />
              Road: {roadLabel(loc.roadStatus)}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin">
          {/* Score overview */}
          <div className="flex items-center gap-4 px-6 py-5 border-b border-edge">
            <ScoreRing score={loc.score} size={84} stroke={7} />
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">Why #{loc.rank}?</p>
              <p className="text-sm font-medium text-ink-soft mt-1 leading-snug">{loc.note}</p>
              <p className="text-[11px] font-semibold text-primary mt-2">
                <ShieldCheck className="inline w-3.5 h-3.5 mr-1" />
                Evidence-backed · advisory recommendation
              </p>
            </div>
          </div>

          {/* Factors */}
          <div className="px-6 py-5 border-b border-edge">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint mb-4">Score factors</p>
            <div className="space-y-3.5">
              {FACTOR_ORDER.map((k) => {
                const m = FACTOR_META[k]
                return (
                  <FactorBar key={k} label={m.label} value={loc.factors[k]} weight={m.weight} color={m.color} />
                )
              })}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2.5 px-6 py-5 border-b border-edge">
            {[
              { label: 'Buildings affected', value: String(loc.buildingsAffected) },
              { label: 'Population exposed', value: fmtInt(loc.affectedPopulation) },
              { label: 'AI confidence', value: pct(loc.aiConfidence) },
            ].map((s) => (
              <div key={s.label} className="rounded-[20px] bg-panel-soft px-3 py-3 text-center">
                <p className="text-xl font-extrabold text-ink">{s.value}</p>
                <p className="text-[10px] font-semibold text-ink-faint mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Routing */}
          <div className="px-6 py-5 border-b border-edge">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">OSM route · nearest facility</p>
              {route?.facility && (
                <button onClick={clearRoute} className="text-[11px] font-bold text-primary hover:text-primary-deep">
                  Clear
                </button>
              )}
            </div>

            {route ? (
              <div className="rounded-[20px] bg-panel-soft px-4 py-3 space-y-2">
                <p className="text-sm font-bold text-ink">
                  <Navigation className="inline w-4 h-4 mr-1.5 text-primary" />
                  {route.facility}
                </p>
                <div className="flex items-center gap-4 text-xs font-semibold text-ink-soft">
                  <span>
                    <Route className="inline w-3.5 h-3.5 mr-1" />
                    {fmtDistance(route.distanceM)}
                  </span>
                  <span>{fmtDuration(route.durationS)}</span>
                  {route.alternatives > 1 && <span>{route.alternatives} alternatives</span>}
                </div>
              </div>
            ) : (
              <button
                onClick={planRoute}
                disabled={routeLoading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-[18px] border border-primary/40 bg-panel-tint text-primary text-sm font-bold py-3 hover:bg-primary/10 transition-colors duration-200 disabled:opacity-60"
              >
                {routeLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Routing via OSRM…
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" />
                    Route to {nearestFacility?.name ?? 'nearest facility'}
                    {nearestFacility ? ` (${nearestFacility.km.toFixed(1)} km)` : ''}
                  </>
                )}
              </button>
            )}

            {routeError && (
              <p className="text-[11px] font-semibold text-danger-text mt-2">{routeError}</p>
            )}
          </div>

          {/* Evidence */}
          <div className="px-6 py-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint mb-3">
              Evidence · {loc.evidence.length} items
            </p>
            <div className="space-y-3">
              {loc.evidence.map((ev) => {
                const meta = KIND_META[ev.kind]
                const Icon = meta.icon
                return (
                  <div key={ev.id} className="rounded-[24px] border border-edge overflow-hidden">
                    {ev.image ? (
                      <img src={ev.image} alt={ev.label} className="w-full h-36 object-cover" loading="lazy" />
                    ) : (
                      <div className="h-14 bg-gradient-to-r from-[var(--color-panel-tint)] to-[var(--color-panel-soft)] flex items-center px-4">
                        <span className="text-[11px] font-semibold text-primary">
                          {ev.kind === 'context' ? 'Geospatial dataset attached' : 'Reference record attached'}
                        </span>
                      </div>
                    )}
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: `${meta.color}16`, color: meta.color }}
                        >
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </span>
                        {ev.confidence != null && (
                          <span className="text-[10px] font-bold text-ink-faint">{pct(ev.confidence)} confidence</span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-ink mt-1.5">{ev.label}</p>
                      <p className="text-xs text-ink-soft mt-0.5 leading-relaxed">{ev.caption}</p>
                      {ev.model && <p className="text-[10px] font-medium text-ink-faint mt-1">Model {ev.model}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Verification footer */}
        <VerifyFooter
          locId={loc.id}
          roadStatus={loc.roadStatus}
          status={loc.status}
          onVerify={applyVerification}
        />
      </div>
    </div>
  )
}

function VerifyFooter({
  locId,
  roadStatus,
  status,
  onVerify,
}: {
  locId: string
  roadStatus: PriorityLocation['roadStatus']
  status: string
  onVerify: (id: string, action: VerificationAction, meta?: { correctedRoad?: 'open' | 'blocked' | 'uncertain' }) => void
}) {
  const verified = status !== 'pending'
  const correctedRoad = useRankedLocations().find((l) => l.id === locId)?.roadStatus

  return (
    <div className="shrink-0 border-t border-edge bg-panel px-6 py-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-faint">
        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
        AI recommends — you decide. Every action is audited.
      </div>

      {verified && (
        <div className="rounded-[20px] bg-panel-soft px-4 py-3 text-[13px]">
          <span className="font-bold text-primary-deep">Status: {status}</span>
          <span className="text-ink-soft"> · original AI finding preserved</span>
        </div>
      )}

      {!verified && (
        <div className="flex gap-2">
          <button
            onClick={() => onVerify(locId, 'confirmed')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[18px] bg-primary text-white text-sm font-bold py-3 hover:bg-primary-deep transition-colors duration-200"
          >
            <Check className="w-4 h-4" /> Confirm
          </button>
          <button
            onClick={() => onVerify(locId, 'uncertain')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[18px] bg-warn-bg text-warn-text text-sm font-bold py-3 hover:brightness-95 transition-all duration-200"
          >
            <HelpCircle className="w-4 h-4" /> Uncertain
          </button>
          <button
            onClick={() => onVerify(locId, 'rejected')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[18px] bg-danger-bg text-danger-text text-sm font-bold py-3 hover:brightness-95 transition-all duration-200"
          >
            <ThumbsDown className="w-4 h-4" /> Reject
          </button>
        </div>
      )}

      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint mb-1.5">Correct road status</p>
        <div className="flex gap-1.5">
          {(['open', 'blocked', 'uncertain'] as const).map((r) => {
            const active = correctedRoad === r
            return (
              <button
                key={r}
                onClick={() => onVerify(locId, 'corrected', { correctedRoad: r })}
                className={`flex-1 rounded-[14px] py-2 text-xs font-bold border transition-all duration-200 ${
                  active
                    ? r === 'blocked'
                      ? 'bg-[#a4311f] border-[#a4311f] text-white'
                      : r === 'uncertain'
                        ? 'bg-[#e9b949] border-[#e9b949] text-white'
                        : 'bg-primary border-primary text-white'
                    : 'bg-panel border-edge text-ink-soft hover:border-primary/40'
                }`}
              >
                {roadLabel(r)}
              </button>
            )
          })}
        </div>
        {roadStatus === 'blocked' && !verified && (
          <p className="text-[10px] text-ink-faint mt-1.5">Correcting a road re-runs the priority engine.</p>
        )}
      </div>
    </div>
  )
}
