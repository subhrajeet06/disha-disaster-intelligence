import { useMemo, useState } from 'react'
import { ShieldCheck, Search, Bot, UserRound, Check, ThumbsDown, HelpCircle, PenLine, Sparkles } from 'lucide-react'
import { useAppStore, useRankedLocations } from '../../store/useAppStore'
import { PageFooter } from '../layout/PageFooter'

type ActorFilter = 'all' | 'system' | 'people'

const SAFEGUARDS = [
  { title: 'AI error', detail: 'Confidence, uncertainty and human verification for every important finding.' },
  { title: 'Overclaiming', detail: 'Findings use "estimated" and "likely" language when evidence is indirect.' },
  { title: 'Privacy', detail: 'Aggregate geographic data is preferred; no unnecessary personal data is stored.' },
  { title: 'Unauthorized edits', detail: 'JWT + role-based access, with every change written to the audit log.' },
  { title: 'Evidence loss', detail: 'Original AI outputs are preserved even after a responder correction.' },
  { title: 'Operational risk', detail: 'The system stays advisory — the responder retains final authority.' },
]

const ACTION_ICON: Array<{ match: (s: string) => boolean; icon: typeof Check; tone: string }> = [
  { match: (s) => s.includes('Confirmed'), icon: Check, tone: '#13735f' },
  { match: (s) => s.includes('Rejected'), icon: ThumbsDown, tone: '#c0392b' },
  { match: (s) => s.includes('uncertain') || s.includes('Uncertain'), icon: HelpCircle, tone: '#e9b949' },
  { match: (s) => s.includes('Corrected') || s.includes('correct'), icon: PenLine, tone: '#0000ee' },
  { match: (s) => s.includes('scenario') || s.includes('Scenario'), icon: Sparkles, tone: '#7a5aa8' },
]

function iconFor(action: string) {
  return ACTION_ICON.find((a) => a.match(action)) ?? { icon: ShieldCheck, tone: '#13735f' }
}

export function AuditPage() {
  const auditLog = useAppStore((s) => s.auditLog)
  const locations = useRankedLocations()
  const [actorFilter, setActorFilter] = useState<ActorFilter>('all')
  const [query, setQuery] = useState('')

  const stats = useMemo(() => {
    const counts = { confirmed: 0, corrected: 0, rejected: 0, uncertain: 0, pending: 0 }
    for (const l of locations) counts[l.status] += 1
    const systemEntries = auditLog.filter((a) => a.actor === 'System').length
    return { ...counts, systemEntries, humanEntries: auditLog.length - systemEntries }
  }, [locations, auditLog])

  const filtered = useMemo(() => {
    return auditLog.filter((a) => {
      if (actorFilter === 'system' && a.actor !== 'System') return false
      if (actorFilter === 'people' && a.actor === 'System') return false
      if (query.trim()) {
        const q = query.toLowerCase()
        return a.action.toLowerCase().includes(q) || a.target.toLowerCase().includes(q) || a.actor.toLowerCase().includes(q)
      }
      return true
    })
  }, [auditLog, actorFilter, query])

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Golden rule banner */}
        <div className="rounded-[28px] bg-gradient-to-br from-[#13735f] to-[#0b4d3f] text-white px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#9ad4c1] mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Responsible AI · advisory operation
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            AI recommends. Evidence explains. Humans verify. The system records.
          </h2>
          <p className="text-sm text-white/70 mt-2 max-w-xl leading-relaxed">
            Every confirmation, correction and rejection below is preserved alongside the original AI output —
            nothing is silently overwritten.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Confirmed by responders" value={stats.confirmed} tone="#13735f" />
          <StatCard label="Corrected" value={stats.corrected} tone="#0000ee" />
          <StatCard label="Rejected" value={stats.rejected} tone="#c0392b" />
          <StatCard label="Awaiting review" value={stats.pending} tone="#8aa099" />
        </div>

        {/* Safeguards */}
        <div className="rounded-[24px] border border-edge bg-panel px-5 py-5">
          <p className="text-sm font-extrabold text-ink mb-4">Safety & responsible-AI safeguards</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SAFEGUARDS.map((s) => (
              <div key={s.title} className="rounded-[18px] bg-panel-soft px-4 py-3">
                <p className="text-xs font-extrabold text-ink">{s.title}</p>
                <p className="text-[11px] text-ink-soft mt-1 leading-relaxed">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Log */}
        <div className="rounded-[24px] border border-edge bg-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-edge flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <p className="text-sm font-extrabold text-ink">Full audit trail</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1.5 shrink-0">
                {(
                  [
                    { key: 'all', label: 'All' },
                    { key: 'people', label: 'Responders' },
                    { key: 'system', label: 'System' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setActorFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 ${
                      actorFilter === f.key ? 'bg-primary text-white shadow-sm' : 'bg-panel-soft text-ink-soft hover:bg-edge'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-[140px]">
                <Search className="w-3.5 h-3.5 text-ink-faint absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search actions…"
                  className="w-full pl-8 pr-3 py-1.5 rounded-full text-xs font-semibold bg-panel-soft border border-transparent focus:border-primary/40 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="divide-y divide-[var(--color-edge)]">
            {filtered.map((a) => {
              const { icon: Icon, tone } = iconFor(a.action)
              return (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <span
                    className="flex items-center justify-center w-8 h-8 rounded-[12px] shrink-0 mt-0.5"
                    style={{ background: `${tone}18`, color: tone }}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink leading-snug">{a.action}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-soft">
                        {a.actor === 'System' ? <Bot className="w-3 h-3" /> : <UserRound className="w-3 h-3" />}
                        {a.actor}
                      </span>
                      <span className="text-[11px] text-ink-faint">· {a.target}</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-ink-faint shrink-0 tabular-nums">{a.time}</span>
                </div>
              )
            })}
            {!filtered.length && (
              <div className="text-center py-10 text-sm font-medium text-ink-faint">
                No audit entries match this view.
              </div>
            )}
          </div>
        </div>

        <PageFooter />
      </div>
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[22px] border border-edge bg-panel px-4 py-4">
      <p className="text-2xl font-extrabold tabular-nums" style={{ color: tone }}>
        {value}
      </p>
      <p className="text-[11px] font-semibold text-ink-soft mt-1">{label}</p>
    </div>
  )
}
