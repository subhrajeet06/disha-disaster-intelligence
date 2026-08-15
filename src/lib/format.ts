import type { Severity } from '../types'

export const SEV_ORDER: Severity[] = ['none', 'mild', 'moderate', 'severe', 'critical']

export const sevLabel: Record<Severity, string> = {
  none: 'No damage',
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
  critical: 'Critical',
}

export function sevColor(sev: Severity): string {
  switch (sev) {
    case 'critical':
      return 'var(--color-sev-critical)'
    case 'severe':
      return 'var(--color-sev-severe)'
    case 'moderate':
      return 'var(--color-sev-moderate)'
    case 'mild':
      return 'var(--color-sev-mild)'
    default:
      return 'var(--color-sev-none)'
  }
}

/** Hex color values for use in SVG data URIs where CSS variables don't resolve. */
export const SEV_HEX: Record<Severity, string> = {
  none: '#13735f',
  mild: '#7fb069',
  moderate: '#e9b949',
  severe: '#e2622b',
  critical: '#c0392b',
}

/** Returns a hex color suitable for SVG data URIs (CSS variables don't work in data URIs). */
export function sevHex(sev: Severity): string {
  return SEV_HEX[sev]
}

export function sevText(sev: Severity): string {
  switch (sev) {
    case 'critical':
      return 'text-sev-text-critical'
    case 'severe':
      return 'text-sev-text-severe'
    case 'moderate':
      return 'text-sev-text-moderate'
    case 'mild':
      return 'text-sev-text-mild'
    default:
      return 'text-sev-text-none'
  }
}

export function sevBg(sev: Severity): string {
  switch (sev) {
    case 'critical':
      return 'bg-sev-bg-critical'
    case 'severe':
      return 'bg-sev-bg-severe'
    case 'moderate':
      return 'bg-sev-bg-moderate'
    case 'mild':
      return 'bg-sev-bg-mild'
    default:
      return 'bg-sev-bg-none'
  }
}

export function roadLabel(status: 'open' | 'blocked' | 'uncertain' | undefined): string {
  switch (status) {
    case 'open':
      return 'Open'
    case 'blocked':
      return 'Blocked'
    case 'uncertain':
      return 'Uncertain'
    default:
      return 'Unknown'
  }
}

export function fmtPop(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

export function fmtInt(n: number): string {
  return n.toLocaleString('en-IN')
}

export function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

export function scoreTone(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 85) return 'critical'
  if (score >= 70) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}
