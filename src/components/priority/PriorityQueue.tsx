import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Users, Route } from 'lucide-react'
import { useRankedLocations } from '../../store/useAppStore'
import { useAppStore } from '../../store/useAppStore'
import { ScoreRing, SeverityPill, StatusPill } from '../ui'
import { fmtInt, roadLabel } from '../../lib/format'
import type { PriorityLocation } from '../../types'

type Tab = 'all' | 'pending' | 'verified'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'verified', label: 'Verified' },
]

export function PriorityQueue({ compact = false }: { compact?: boolean }) {
  const [tab, setTab] = useState<Tab>('all')
  const locations = useRankedLocations()
  const openDrawer = useAppStore((s) => s.openDrawer)
  const highlightId = useAppStore((s) => s.highlightId)
  const setHighlight = useAppStore((s) => s.setHighlight)

  /* Auto-clear the search highlight after a short pulse */
  useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(() => setHighlight(null), 2600)
    return () => clearTimeout(t)
  }, [highlightId, setHighlight])

  const filtered = useMemo(() => {
    if (tab === 'all') return locations
    if (tab === 'verified') return locations.filter((l) => l.status !== 'pending')
    return locations.filter((l) => l.status === 'pending')
  }, [locations, tab])

  return (
    <div className="flex flex-col h-full bg-panel">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-ink tracking-tight">Response priorities</h2>
          <span className="text-[11px] font-bold text-primary bg-panel-tint rounded-full px-2.5 py-1">
            {locations.length} locations
          </span>
        </div>
        <div className="flex gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 ${
                tab === t.key ? 'bg-primary text-white shadow-sm' : 'bg-panel-soft text-ink-soft hover:bg-edge'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-3 pb-4 space-y-2.5">
        {filtered.map((loc) => (
          <PriorityCard
            key={loc.id}
            loc={loc}
            highlighted={highlightId === loc.id}
            onOpen={() => openDrawer(loc.id)}
          />
        ))}
        {!filtered.length && (
          <div className="text-center py-10 text-sm font-medium text-ink-faint">No locations in this view.</div>
        )}
      </div>

      {compact && (
        <div className="px-5 py-3 border-t border-edge">
          <button
            onClick={() => useAppStore.getState().setMobileSheet(false)}
            className="w-full rounded-[16px] bg-panel-tint text-primary-deep text-sm font-bold py-2.5"
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}

export function PriorityCard({
  loc,
  onOpen,
  highlighted = false,
}: {
  loc: PriorityLocation
  onOpen: () => void
  highlighted?: boolean
}) {
  const cardRef = useRef<HTMLButtonElement>(null)
  const verified = loc.status !== 'pending'

  useEffect(() => {
    if (highlighted) {
      cardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [highlighted])

  return (
    <button
      ref={cardRef}
      onClick={onOpen}
      className={`w-full text-left group rounded-[24px] border px-4 py-3.5 transition-all duration-200 ${
        highlighted
          ? 'border-primary bg-panel-tint shadow-lg shadow-primary/25 ring-2 ring-primary/60 scale-[1.02]'
          : 'border-edge bg-panel hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5'
      }`}
    >
      <div className="flex items-center gap-3">
        <ScoreRing score={loc.score} size={56} stroke={5} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-ink text-sm truncate">{loc.name}</p>
            {loc.isFieldReport && <StatusPill label="Field" tone="info" />}
            {verified && (
              <span className="shrink-0">
                <StatusPill
                  label={loc.status === 'corrected' ? 'Corrected' : loc.status === 'rejected' ? 'Rejected' : 'Verified'}
                  tone={loc.status === 'rejected' ? 'danger' : loc.status === 'corrected' ? 'info' : 'success'}
                />
              </span>
            )}
          </div>
          <p className="text-[11px] font-medium text-ink-faint mt-0.5 truncate">{loc.sub}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <SeverityPill severity={loc.damageLevel} />
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                loc.roadStatus === 'blocked'
                  ? 'text-danger-text'
                  : loc.roadStatus === 'uncertain'
                    ? 'text-warn-text'
                    : 'text-primary-deep'
              }`}
            >
              <Route className="w-3 h-3" />
              {roadLabel(loc.roadStatus)}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-soft">
              <Users className="w-3 h-3" />
              {fmtInt(loc.affectedPopulation)}
            </span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-ink-faint group-hover:text-primary transition-colors duration-200" />
      </div>
    </button>
  )
}
