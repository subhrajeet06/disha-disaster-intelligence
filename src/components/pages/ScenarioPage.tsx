import { useMemo, useState } from 'react'
import { Plus, Waves, Flame, Zap, Upload, CheckCircle2, Layers, X, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { EventIcon } from '../layout/Sidebar'
import { StatusPill } from '../ui'
import { fmtInt } from '../../lib/format'
import type { DisasterEvent } from '../../types'
import { PageFooter } from '../layout/PageFooter'

const TYPES: Array<{ key: DisasterEvent['type']; label: string; icon: typeof Waves }> = [
  { key: 'cyclone', label: 'Cyclone', icon: Waves },
  { key: 'flood', label: 'Flood', icon: Waves },
  { key: 'fire', label: 'Fire', icon: Flame },
  { key: 'earthquake', label: 'Earthquake', icon: Zap },
]

const STATUS_TONE: Record<DisasterEvent['status'], 'success' | 'warn' | 'info'> = {
  ready: 'success',
  review: 'info',
  processing: 'warn',
}

const STATUS_LABEL: Record<DisasterEvent['status'], string> = {
  ready: 'Ready',
  review: 'In review',
  processing: 'Processing',
}

export function ScenarioPage() {
  const scenarios = useAppStore((s) => s.scenarios)
  const activeEventId = useAppStore((s) => s.activeEventId)
  const setActiveEvent = useAppStore((s) => s.setActiveEvent)
  const simulateUpload = useAppStore((s) => s.simulateUpload)
  const [formOpen, setFormOpen] = useState(false)

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-24 lg:pb-6 space-y-6">
        {/* Intro */}
        <div className="rounded-[28px] bg-gradient-to-br from-[#13735f] to-[#0b4d3f] text-white px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#9ad4c1] mb-2">
            <Layers className="w-3.5 h-3.5" />
            Disaster scenario management
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight max-w-xl">
            Every image, detection and priority belongs to a scenario.
          </h2>
          <p className="text-sm text-white/70 mt-2 max-w-xl leading-relaxed">
            Create a scenario to scope imagery, AI processing and response priorities to a specific event and
            region. Switch the active scenario any time from here or the sidebar.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-soft">
            {scenarios.length} scenario{scenarios.length === 1 ? '' : 's'}
          </p>
          <button
            onClick={() => setFormOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-[18px] bg-primary text-white text-sm font-bold px-4 py-2.5 hover:bg-primary-deep transition-colors duration-200 shadow-md shadow-[#13735f]/20"
          >
            {formOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {formOpen ? 'Cancel' : 'New scenario'}
          </button>
        </div>

        {formOpen && <NewScenarioForm onDone={() => setFormOpen(false)} />}

        {/* Scenario grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenarios.map((e) => (
            <ScenarioCard
              key={e.id}
              event={e}
              active={e.id === activeEventId}
              onActivate={() => setActiveEvent(e.id)}
              onUpload={() => simulateUpload(e.id)}
            />
          ))}
        </div>

        {!scenarios.length && (
          <div className="text-center py-16 text-sm font-medium text-ink-faint">
            No scenarios yet. Create one to begin ingesting imagery.
          </div>
        )}

        <PageFooter />
      </div>
    </div>
  )
}

function ScenarioCard({
  event,
  active,
  onActivate,
  onUpload,
}: {
  event: DisasterEvent
  active: boolean
  onActivate: () => void
  onUpload: () => void
}) {
  return (
    <div
      className={`rounded-[24px] border bg-panel px-5 py-5 transition-all duration-200 ${
        active ? 'border-primary shadow-lg shadow-[#13735f]/10' : 'border-edge hover:border-primary/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex items-center justify-center w-11 h-11 rounded-[14px] shrink-0 ${
            active ? 'bg-primary text-white' : 'bg-panel-tint text-primary'
          }`}
        >
          <EventIcon type={event.type} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-ink text-[15px] truncate">{event.name}</p>
            {active && <StatusPill label="Active" tone="success" />}
          </div>
          <p className="text-[12px] font-medium text-ink-faint mt-0.5">{event.region}</p>
        </div>
        <StatusPill label={STATUS_LABEL[event.status]} tone={STATUS_TONE[event.status]} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 mt-4">
        <div className="rounded-[16px] bg-panel-soft px-3 py-2.5">
          <p className="text-lg font-extrabold text-ink">{fmtInt(event.imageryCount)}</p>
          <p className="text-[10px] font-semibold text-ink-faint">Images ingested</p>
        </div>
        <div className="rounded-[16px] bg-panel-soft px-3 py-2.5">
          <p className="text-lg font-extrabold text-ink">{event.startedAt.split(' ')[0]}</p>
          <p className="text-[10px] font-semibold text-ink-faint">Started</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">AI processing</p>
          <span className="text-xs font-extrabold text-primary">{event.aiProgress}%</span>
        </div>
        <div className="h-2 rounded-full bg-panel-soft overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${event.aiProgress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={onUpload}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[16px] border border-edge text-ink-soft text-xs font-bold py-2.5 hover:border-primary/40 hover:text-primary transition-colors duration-200"
        >
          <Upload className="w-3.5 h-3.5" />
          Simulate imagery upload
        </button>
        <button
          onClick={onActivate}
          disabled={active}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-[16px] text-xs font-bold py-2.5 transition-colors duration-200 ${
            active
              ? 'bg-panel-tint text-primary-deep cursor-default'
              : 'bg-primary text-white hover:bg-primary-deep'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {active ? 'Active scenario' : 'Set active'}
        </button>
      </div>
    </div>
  )
}

function NewScenarioForm({ onDone }: { onDone: () => void }) {
  const addScenario = useAppStore((s) => s.addScenario)
  const [name, setName] = useState('')
  const [type, setType] = useState<DisasterEvent['type']>('cyclone')
  const [region, setRegion] = useState('')

  const canSubmit = name.trim().length > 1 && region.trim().length > 1

  const missing = useMemo(() => {
    const parts: string[] = []
    if (name.trim().length <= 1) parts.push('a scenario name')
    if (region.trim().length <= 1) parts.push('a region')
    return parts
  }, [name, region])

  const submit = () => {
    if (!canSubmit) return
    addScenario({ name: name.trim(), type, region: region.trim() })
    onDone()
  }

  return (
    <div className="rounded-[24px] border border-edge bg-panel px-5 py-5 space-y-4 animate-fade-up">
      <p className="text-sm font-extrabold text-ink">Create disaster scenario</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Scenario name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cyclone Fani"
            className="w-full mt-1 rounded-[14px] border border-edge px-3 py-2 text-sm font-semibold text-ink bg-panel focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Region</label>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. Ganjam, Odisha"
            className="w-full mt-1 rounded-[14px] border border-edge px-3 py-2 text-sm font-semibold text-ink bg-panel focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint mb-2">Event type</p>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => {
            const active = type === t.key
            return (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 ${
                  active ? 'bg-primary text-white border-transparent' : 'bg-panel border-edge text-ink-soft hover:border-primary/40'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={onDone}
          className="rounded-[16px] px-4 py-2.5 text-xs font-bold text-ink-soft hover:bg-panel-soft transition-colors duration-200"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 rounded-[16px] bg-primary text-white text-xs font-bold px-5 py-2.5 hover:bg-primary-deep transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-3.5 h-3.5" />
          Create scenario
        </button>
      </div>
      {!canSubmit && (
        <p className="text-[11px] font-medium text-warn-text flex items-center gap-1.5 -mt-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Add {missing.join(' and ')} to create this scenario.
        </p>
      )}
    </div>
  )
}
