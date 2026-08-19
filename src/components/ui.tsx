import { memo } from 'react'
import { sevBg, sevText, scoreTone } from '../lib/format'
import type { Severity } from '../types'

const TONES: Record<string, { stroke: string; text: string }> = {
  critical: { stroke: 'var(--color-sev-critical)', text: 'var(--color-sev-critical)' },
  high: { stroke: 'var(--color-sev-severe)', text: 'var(--color-sev-severe)' },
  medium: { stroke: 'var(--color-sev-moderate)', text: 'var(--color-sev-text-moderate)' },
  low: { stroke: 'var(--color-sev-mild)', text: 'var(--color-sev-text-mild)' },
}

export const ScoreRing = memo(function ScoreRing({
  score,
  size = 64,
  stroke = 6,
  label = '/ 100',
}: {
  score: number
  size?: number
  stroke?: number
  label?: string
}) {
  const tone = TONES[scoreTone(score)]
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (Math.min(100, Math.max(0, score)) / 100) * c
  const fs = size * 0.3

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in srgb, var(--color-ink) 12%, transparent)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-bold" style={{ fontSize: fs, color: tone.text }}>
          {score}
        </span>
        <span className="opacity-50 font-medium" style={{ fontSize: size * 0.13 }}>
          {label}
        </span>
      </div>
    </div>
  )
})

export function FactorBar({
  label,
  value,
  weight,
  color,
}: {
  label: string
  value: number
  weight: number
  color: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0">
        <p className="text-xs font-semibold text-ink-soft leading-tight">{label}</p>
        <p className="text-[10px] font-medium text-ink-faint">Weight {weight}%</p>
      </div>
      <div className="flex-1 h-2.5 rounded-full bg-panel-soft overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="w-8 text-right text-sm font-bold text-ink">{value}</span>
    </div>
  )
}

export function SeverityPill({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${sevBg(severity)} ${sevText(severity)}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: `var(--color-sev-${severity})` }} />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  )
}

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: 'neutral' | 'success' | 'warn' | 'info' | 'danger'
}) {
  const map: Record<string, string> = {
    neutral: 'bg-panel-soft text-ink-soft',
    success: 'bg-sev-bg-mild text-sev-text-mild',
    warn: 'bg-warn-bg text-warn-text',
    info: 'bg-info-bg text-info-text',
    danger: 'bg-danger-bg text-danger-text',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${map[tone]}`}>
      {label}
    </span>
  )
}

export function VerifiedDot({ status }: { status: string }) {
  if (status === 'confirmed') return <span className="w-2 h-2 rounded-full bg-[#13735f] animate-pulse-ring" />
  if (status === 'corrected') return <span className="w-2 h-2 rounded-full bg-[#0000ee]" />
  if (status === 'rejected') return <span className="w-2 h-2 rounded-full bg-[#c0392b]" />
  if (status === 'uncertain') return <span className="w-2 h-2 rounded-full bg-[#e9b949]" />
  return <span className="w-2 h-2 rounded-full bg-ink-faint" />
}
