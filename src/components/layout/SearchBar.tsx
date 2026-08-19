import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { KeyboardEvent as ReactKeyboardEvent, Ref } from 'react'
import { Search, X, MapPin, Building2, Route, AlertTriangle, ChevronRight } from 'lucide-react'
import { useAppStore, useRankedLocations } from '../../store/useAppStore'
import { roadLabel, scoreTone } from '../../lib/format'
import type { PriorityLocation } from '../../types'

type Category = 'locations' | 'buildings' | 'roads' | 'services'

interface SearchEntry {
  id: string
  category: Category
  name: string
  detail: string
  lat: number
  lng: number
  score: number
  keywords: string
}

const TEXT_TONES: Record<string, string> = {
  critical: 'text-sev-text-critical',
  high: 'text-sev-text-severe',
  medium: 'text-sev-text-moderate',
  low: 'text-sev-text-mild',
}

const CATEGORIES: Array<{
  key: Category
  label: string
  icon: typeof MapPin
  iconBg: string
  iconText: string
  dot: string
}> = [
  { key: 'locations', label: 'Locations', icon: MapPin, iconBg: 'bg-panel-tint', iconText: 'text-primary', dot: 'var(--color-primary)' },
  { key: 'buildings', label: 'Buildings', icon: Building2, iconBg: 'bg-sev-bg-critical', iconText: 'text-sev-text-critical', dot: 'var(--color-sev-critical)' },
  { key: 'roads', label: 'Roads', icon: Route, iconBg: 'bg-sev-bg-severe', iconText: 'text-sev-text-severe', dot: 'var(--color-sev-severe)' },
  { key: 'services', label: 'Services', icon: AlertTriangle, iconBg: 'bg-sev-bg-moderate', iconText: 'text-sev-text-moderate', dot: 'var(--color-sev-moderate)' },
]

function locEntry(loc: PriorityLocation): SearchEntry {
  return {
    id: loc.id,
    category: 'locations',
    name: loc.name,
    detail: loc.sub,
    lat: loc.lat,
    lng: loc.lng,
    score: loc.score,
    keywords: `${loc.name} ${loc.sub} ${loc.nearestFacility} ${loc.type}`.toLowerCase(),
  }
}

function allEntries(loc: PriorityLocation): SearchEntry[] {
  const base = locEntry(loc).keywords
  const out: SearchEntry[] = [locEntry(loc)]
  if (loc.buildingsAffected > 0) {
    out.push({
      ...locEntry(loc),
      category: 'buildings',
      detail: `${loc.buildingsAffected} buildings affected`,
      keywords: `${base} ${loc.buildingsAffected} buildings ${loc.damageLevel}`,
    })
  }
  if (loc.roadStatus !== 'open') {
    out.push({
      ...locEntry(loc),
      category: 'roads',
      detail: `Road ${roadLabel(loc.roadStatus).toLowerCase()}`,
      keywords: `${base} road ${roadLabel(loc.roadStatus).toLowerCase()} blocked uncertain`,
    })
  }
  if (loc.serviceRisk === 'severe' || loc.serviceRisk === 'critical') {
    out.push({
      ...locEntry(loc),
      category: 'services',
      detail: `${loc.serviceRisk} service risk`,
      keywords: `${base} service risk ${loc.serviceRisk}`,
    })
  }
  return out
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase()
  if (!q) return <>{text}</>
  const i = text.toLowerCase().indexOf(q)
  if (i === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[4px] bg-panel-tint text-primary px-0.5 font-bold">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  )
}

const DESKTOP_QUERY = '(min-width: 1024px)'

export function SearchBar() {
  const locations = useRankedLocations()
  const focusLocation = useAppStore((s) => s.focusLocation)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const desktopRef = useRef<HTMLInputElement>(null)
  const mobileRef = useRef<HTMLInputElement>(null)

  const q = query.trim().toLowerCase()

  const entries = useMemo(() => locations.flatMap(allEntries), [locations])

  const groups = useMemo(() => {
    if (!q) {
      return [{ key: 'locations' as const, entries: locations.slice(0, 5).map(locEntry) }]
    }
    return CATEGORIES.map((c) => ({
      key: c.key,
      entries: entries.filter((e) => e.category === c.key && e.keywords.includes(q)).slice(0, 6),
    })).filter((g) => g.entries.length > 0)
  }, [q, entries, locations])

  const flat = useMemo(() => groups.flatMap((g) => g.entries), [groups])

  useEffect(() => setActiveIndex(-1), [q])

  /* Close the dropdown when clicking anywhere outside the search area.
     The mobile overlay is portaled to <body>, so it must be checked too. */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      const inside = containerRef.current?.contains(t) || overlayRef.current?.contains(t)
      if (!inside) {
        setOpen(false)
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  /* Global keyboard shortcut: press "/" to jump into the search bar */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      e.preventDefault()
      if (window.matchMedia(DESKTOP_QUERY).matches) {
        setOpen(true)
        desktopRef.current?.focus()
      } else {
        setMobileOpen(true)
        setOpen(true)
        requestAnimationFrame(() => mobileRef.current?.focus())
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const select = (e: SearchEntry) => {
    focusLocation(e.id, e.lat, e.lng)
    setQuery('')
    setOpen(false)
    setMobileOpen(false)
    desktopRef.current?.blur()
    mobileRef.current?.blur()
  }

  const clear = () => {
    setQuery('')
    setActiveIndex(-1)
  }

  const handleInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => (i + 1) % Math.max(flat.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? flat.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (open && flat[activeIndex]) {
        e.preventDefault()
        select(flat[activeIndex])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        setOpen(false)
        return
      }
      setQuery('')
      setMobileOpen(false)
      e.currentTarget.blur()
    }
  }

  const renderInput = (ref: Ref<HTMLInputElement>) => (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-ink-faint pointer-events-none" />
      <input
        ref={ref}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleInputKeyDown}
        placeholder="Search locations, roads, buildings..."
        aria-label="Search locations, roads, buildings"
        role="combobox"
        aria-expanded={open}
        aria-controls="search-results"
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-full border border-edge bg-panel-soft/80 pl-11 pr-11 py-2.5 text-sm font-medium text-ink placeholder:font-normal placeholder:text-ink-faint focus:bg-panel focus:border-primary/60 focus:shadow-lg focus:shadow-[#13735f]/10 focus:outline-none transition-all duration-200"
      />
      {query ? (
        <button
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full text-ink-faint hover:text-primary hover:bg-panel-tint transition-colors duration-150"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : (
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-md border border-edge bg-panel text-[10px] font-bold text-ink-faint leading-none">
          /
        </kbd>
      )}
    </div>
  )

  const dropdown = open ? (
    <div
      id="search-results"
      style={{ animation: 'search-drop-in 160ms ease-out' }}
      className="max-h-[min(58vh,420px)] overflow-y-auto scroll-thin rounded-[22px] border border-edge bg-panel shadow-2xl shadow-black/15 p-2"
    >
      {groups.length === 0 ? (
        <div className="px-4 py-9 flex flex-col items-center gap-2 text-center">
          <span className="w-11 h-11 rounded-2xl bg-panel-soft flex items-center justify-center">
            <Search className="w-5 h-5 text-ink-faint" />
          </span>
          <p className="text-sm font-bold text-ink">No matches</p>
          <p className="text-xs text-ink-faint">Try “roads”, “critical” or a place name.</p>
        </div>
      ) : (
        (() => {
          let flatIdx = 0
          return groups.map((g) => {
            const cat = CATEGORIES.find((c) => c.key === g.key)!
            return (
              <div key={g.key} className="mb-1 last:mb-0">
                <div className="px-2.5 pt-2 pb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      className={`flex items-center justify-center w-5 h-5 rounded-md shrink-0 ${cat.iconBg} ${cat.iconText}`}
                    >
                      <cat.icon className="w-3 h-3" />
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-ink-soft">
                      {cat.label}
                    </span>
                  </span>
                  <span className="text-[9px] font-bold text-ink-faint tabular-nums">{g.entries.length}</span>
                </div>
                {g.entries.map((e) => {
                  const idx = flatIdx++
                  return (
                    <button
                      key={`${g.key}-${e.id}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => select(e)}
                      className={`group/item relative w-full flex items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors duration-150 ${
                        idx === activeIndex ? 'bg-panel-tint' : 'hover:bg-panel-soft'
                      }`}
                    >
                      {idx === activeIndex && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-primary" />
                      )}
                      <span
                        className={`flex items-center justify-center w-9 h-9 rounded-[12px] shrink-0 ${cat.iconBg} ${cat.iconText}`}
                      >
                        <cat.icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-ink truncate">
                          <Highlighted text={e.name} query={query} />
                        </span>
                        <span className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: cat.dot }}
                          />
                          <span className="text-[11px] font-semibold truncate" style={{ color: cat.dot }}>
                            {e.detail}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 flex items-center gap-1">
                        <span className={`text-[10px] font-extrabold tabular-nums rounded-full bg-panel-soft px-2 py-1 ${TEXT_TONES[scoreTone(e.score)]}`}>
                          {e.score}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-ink-faint group-hover/item:text-primary transition-colors duration-150" />
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })
        })()
      )}

      <div className="mt-1.5 pt-2 px-2.5 pb-1 border-t border-edge/70 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-ink-faint tabular-nums">
          {flat.length} result{flat.length !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-2 text-[10px] font-semibold text-ink-faint">
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded border border-edge bg-panel-soft leading-none">
              ↑
            </kbd>
            <kbd className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded border border-edge bg-panel-soft leading-none">
              ↓
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded border border-edge bg-panel-soft leading-none">
              ↵
            </kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded border border-edge bg-panel-soft leading-none">
              esc
            </kbd>
            close
          </span>
        </span>
      </div>
    </div>
  ) : null

  const mobileOverlay = mobileOpen
    ? createPortal(
        <div ref={overlayRef} className="lg:hidden fixed inset-0 z-[70]">
          <div
            className="absolute inset-0 bg-[#0b4d3f]/40 backdrop-blur-[2px]"
            onClick={() => {
              setMobileOpen(false)
              setOpen(false)
            }}
          />
          <div className="absolute inset-x-0 top-0 bg-panel border-b border-edge shadow-2xl rounded-b-[28px] p-3 pt-[max(env(safe-area-inset-top),10px)]">
            {renderInput(mobileRef)}
            {open && <div className="relative mt-2">{dropdown}</div>}
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div ref={containerRef} className="relative flex-1 flex items-center justify-center min-w-0">
      {/* Desktop pill + dropdown */}
      <div className="relative hidden lg:block w-full max-w-md">
        {renderInput(desktopRef)}
        {open && <div className="absolute left-0 right-0 top-full mt-2 z-50">{dropdown}</div>}
      </div>

      {/* Mobile collapsed icon */}
      {!mobileOpen && (
        <button
          onClick={() => {
            setMobileOpen(true)
            setOpen(true)
            requestAnimationFrame(() => mobileRef.current?.focus())
          }}
          aria-label="Search"
          className="lg:hidden flex items-center justify-center w-8 h-8 rounded-full border border-edge bg-panel text-ink-soft hover:text-primary hover:border-primary/50 transition-colors duration-200"
        >
          <Search className="w-4 h-4" />
        </button>
      )}

      {mobileOverlay}
    </div>
  )
}
