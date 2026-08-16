import { useMemo } from 'react'
import { FileDown, FileJson, FileText, Building2, Route, AlertTriangle, Users, ShieldCheck, ChevronRight } from 'lucide-react'
import { useAppStore, useRankedLocations } from '../../store/useAppStore'
import { useKpi } from '../../api/mockApi'
import { ScoreRing, SeverityPill, StatusPill } from '../ui'
import { fmtInt, pct } from '../../lib/format'
import { exportPrioritiesCsv, exportPrioritiesGeoJson, exportSituationReport } from '../../lib/exportReport'

const STATS = [
  { key: 'buildingsAffected', label: 'Buildings affected', icon: Building2, accent: 'var(--color-sev-critical)' },
  { key: 'roadsBlocked', label: 'Roads blocked', icon: Route, accent: 'var(--color-sev-severe)' },
  { key: 'servicesAtRisk', label: 'Services at risk', icon: AlertTriangle, accent: 'var(--color-sev-moderate)' },
  { key: 'populationAffected', label: 'Population exposed', icon: Users, accent: 'var(--color-accent)', fmt: fmtInt },
] as const

export function ReportsPage() {
  const { data: kpi } = useKpi()
  const locations = useRankedLocations()
  const fieldReports = useAppStore((s) => s.fieldReports)
  const auditLog = useAppStore((s) => s.auditLog)
  const scenarios = useAppStore((s) => s.scenarios)
  const activeEventId = useAppStore((s) => s.activeEventId)
  const openDrawer = useAppStore((s) => s.openDrawer)
  const event = scenarios.find((e) => e.id === activeEventId) ?? scenarios[0]

  const verificationBreakdown = useMemo(() => {
    const counts = { confirmed: 0, corrected: 0, rejected: 0, uncertain: 0, pending: 0 }
    for (const l of locations) counts[l.status] += 1
    return counts
  }, [locations])

  const totalLocations = locations.length || 1

  const k = kpi ?? {
    buildingsAffected: 0,
    buildingsVerified: 0,
    roadsBlocked: 0,
    roadsChecked: 0,
    servicesAtRisk: 0,
    populationAffected: 0,
    avgConfidence: 0,
    verifiedShare: 0,
  }

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATS.map((s) => (
            <div key={s.key} className="rounded-[22px] border border-edge bg-panel px-4 py-4">
              <span
                className="flex items-center justify-center w-9 h-9 rounded-[13px] mb-3"
                style={{ background: `${s.accent}18`, color: s.accent }}
              >
                <s.icon className="w-4 h-4" />
              </span>
              <p className="text-xl font-extrabold text-ink tabular-nums">
                {'fmt' in s && s.fmt ? s.fmt(k[s.key]) : k[s.key]}
              </p>
              <p className="text-[11px] font-semibold text-ink-soft mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Verification + confidence */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 rounded-[24px] border border-edge bg-panel px-5 py-5">
            <p className="text-sm font-extrabold text-ink mb-1">AI vs. human verification</p>
            <p className="text-[12px] text-ink-faint mb-4">
              {fmtInt(totalLocations)} tracked locations · {pct(verificationBreakdown.pending / totalLocations)} still
              pending review
            </p>
            <div className="space-y-3">
              {(
                [
                  { key: 'confirmed', label: 'Confirmed', tone: '#13735f' },
                  { key: 'corrected', label: 'Corrected', tone: '#0000ee' },
                  { key: 'rejected', label: 'Rejected', tone: '#c0392b' },
                  { key: 'uncertain', label: 'Uncertain', tone: '#e9b949' },
                  { key: 'pending', label: 'Pending review', tone: '#8aa099' },
                ] as const
              ).map((row) => {
                const count = verificationBreakdown[row.key]
                const width = Math.round((count / totalLocations) * 100)
                return (
                  <div key={row.key} className="flex items-center gap-3">
                    <div className="w-28 shrink-0 text-xs font-semibold text-ink-soft">{row.label}</div>
                    <div className="flex-1 h-2.5 rounded-full bg-panel-soft overflow-hidden">
                      <div
                        className="h-full rounded-full transition-[width] duration-700 ease-out"
                        style={{ width: `${width}%`, background: row.tone }}
                      />
                    </div>
                    <span className="w-6 text-right text-sm font-bold text-ink">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-[24px] border border-edge bg-panel px-5 py-5 flex flex-col items-center justify-center text-center">
            <ScoreRing score={Math.round(k.avgConfidence * 100)} size={92} stroke={7} label="avg conf." />
            <p className="text-sm font-extrabold text-ink mt-3">Average AI confidence</p>
            <p className="text-[12px] text-ink-faint mt-1 leading-relaxed">
              Across all detections in {event?.name ?? 'this scenario'}. Findings below confidence thresholds route
              to responder review.
            </p>
          </div>
        </div>

        {/* Export */}
        <div className="rounded-[24px] border border-edge bg-panel px-5 py-5">
          <p className="text-sm font-extrabold text-ink mb-1">Situation report & exports</p>
          <p className="text-[12px] text-ink-faint mb-4">
            Generate a shareable summary or export the current priority list for GIS tools and spreadsheets.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => exportSituationReport(event?.name ?? 'DISHA', event?.region ?? '', event?.id ?? activeEventId, k, locations, auditLog)}
              disabled={!kpi}
              className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-primary text-white text-xs font-bold py-3 hover:bg-primary-deep transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" />
              Situation report (.pdf)
            </button>
            <button
              onClick={() => exportPrioritiesCsv(locations, event?.name ?? 'DISHA')}
              className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-primary text-white text-xs font-bold py-3 hover:bg-primary-deep transition-colors duration-200"
            >
              <FileDown className="w-4 h-4" />
              Priorities (.csv)
            </button>
            <button
              onClick={() => exportPrioritiesGeoJson(locations, event?.name ?? 'DISHA')}
              className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-primary text-white text-xs font-bold py-3 hover:bg-primary-deep transition-colors duration-200"
            >
              <FileJson className="w-4 h-4" />
              Map layer (.geojson)
            </button>
          </div>
        </div>

        {/* Priority table */}
        <div className="rounded-[24px] border border-edge bg-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-edge flex items-center justify-between">
            <p className="text-sm font-extrabold text-ink">Ranked response priorities</p>
            <span className="text-[11px] font-bold text-primary bg-panel-tint rounded-full px-2.5 py-1">
              {locations.length} locations
            </span>
          </div>
          <div className="divide-y divide-[var(--color-edge)]">
            {locations.map((l) => (
              <button
                key={l.id}
                onClick={() => openDrawer(l.id)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-panel-soft transition-colors duration-200"
              >
                <span className="w-6 text-xs font-extrabold text-ink-faint tabular-nums">#{l.rank}</span>
                <ScoreRing score={l.score} size={38} stroke={4} label="" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink truncate">{l.name}</p>
                  <p className="text-[11px] text-ink-faint truncate">{l.sub}</p>
                </div>
                <SeverityPill severity={l.damageLevel} />
                <StatusPill
                  label={l.status === 'pending' ? 'Pending' : l.status}
                  tone={l.status === 'pending' ? 'neutral' : l.status === 'rejected' ? 'danger' : 'success'}
                />
                <ChevronRight className="w-4 h-4 text-ink-faint" />
              </button>
            ))}
          </div>
        </div>

        {/* Field reports */}
        {fieldReports.length > 0 && (
          <div className="rounded-[24px] border border-edge bg-panel px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <p className="text-sm font-extrabold text-ink">Responder field reports</p>
            </div>
            <div className="space-y-2">
              {fieldReports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openDrawer(r.id)}
                  className="w-full flex items-center justify-between gap-3 rounded-[16px] bg-panel-soft px-4 py-2.5 text-left hover:bg-panel-tint transition-colors duration-200"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink truncate">{r.name}</p>
                    <p className="text-[10px] text-ink-faint">
                      {r.reporter ?? 'Field responder'} · {r.submittedAt}
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-primary shrink-0">{r.score}/100</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
