import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X, Upload, ImageIcon, Camera, Trash2, ShieldCheck, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { buildFieldReport, computeScore, severityToScore, roadToScore } from '../../lib/fieldReport'
import { ScoreRing } from '../ui'
import { MiniLocationMap } from './MiniLocationMap'
import { roundCoord } from '../../lib/geo'
import type { RoadStatus, Severity } from '../../types'

const SEVERITIES: Array<{ key: Severity; label: string }> = [
  { key: 'none', label: 'None' },
  { key: 'mild', label: 'Mild' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'severe', label: 'Severe' },
  { key: 'critical', label: 'Critical' },
]

const ROADS: Array<{ key: RoadStatus; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'uncertain', label: 'Uncertain' },
]

function Segmented<T extends string>({
  options,
  value,
  onChange,
  activeClass,
}: {
  options: Array<{ key: T; label: string }>
  value: T
  onChange: (v: T) => void
  activeClass?: (v: T) => string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.key
        const cls = activeClass ? activeClass(o.key) : 'bg-primary text-white shadow-sm'
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 ${
              active
                ? `${cls} border-transparent`
                : 'bg-panel border-edge text-ink-soft hover:border-primary/40'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

const sevActive = (v: Severity) =>
  v === 'critical'
    ? 'bg-[#c0392b] text-white'
    : v === 'severe'
      ? 'bg-[#e2622b] text-white'
      : v === 'moderate'
        ? 'bg-[#e9b949] text-white'
        : v === 'mild'
          ? 'bg-[#7fb069] text-white'
          : 'bg-primary text-white'

const roadActive = (v: RoadStatus) =>
  v === 'blocked' ? 'bg-[#c0392b] text-white' : v === 'uncertain' ? 'bg-[#e9b949] text-white' : 'bg-primary text-white'

export function FieldReportModal() {
  const open = useAppStore((s) => s.reportModalOpen)
  const setReportModal = useAppStore((s) => s.setReportModal)
  const addFieldReport = useAppStore((s) => s.addFieldReport)

  const [name, setName] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoName, setPhotoName] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [latInput, setLatInput] = useState('')
  const [lngInput, setLngInput] = useState('')
  const [damageLevel, setDamageLevel] = useState<Severity>('moderate')
  const [roadStatus, setRoadStatus] = useState<RoadStatus>('uncertain')
  const [serviceRisk, setServiceRisk] = useState<Severity>('mild')
  const [population, setPopulation] = useState(50)
  const [buildings, setBuildings] = useState(1)
  const [criticalNearby, setCriticalNearby] = useState(false)
  const [vulnerableNearby, setVulnerableNearby] = useState(false)
  const [description, setDescription] = useState('')
  const [reporter, setReporter] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [coordError, setCoordError] = useState<string | null>(null)

  const liveScore = useMemo(
    () =>
      computeScore(
        severityToScore(damageLevel),
        population,
        Math.min(100, 25 + (criticalNearby ? 40 : 0) + (vulnerableNearby ? 25 : 0)),
        roadToScore(roadStatus),
        severityToScore(serviceRisk),
        93,
      ),
    [damageLevel, population, criticalNearby, vulnerableNearby, roadStatus, serviceRisk],
  )

  const canSubmit = useMemo(
    () => Boolean(photo) && lat != null && lng != null && damageLevel !== 'none',
    [photo, lat, lng, damageLevel],
  )

  const handleFile = useCallback((file: File | undefined) => {
    if (!file) return
    setFileError(null)
    if (!file.type.startsWith('image/')) {
      setFileError('Please choose an image file (JPEG, PNG, WebP).')
      return
    }
    if (file.size > 6 * 1024 * 1024) {
      setFileError('Image is larger than 6 MB. Please pick a smaller photo.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setPhoto(String(reader.result))
      setPhotoName(file.name)
    }
    reader.readAsDataURL(file)
  }, [])

  const applyManualCoords = () => {
    const a = parseFloat(latInput)
    const b = parseFloat(lngInput)
    if (Number.isFinite(a) && Number.isFinite(b) && a >= -90 && a <= 90 && b >= -180 && b <= 180) {
      setLat(roundCoord(a))
      setLng(roundCoord(b))
      setCoordError(null)
    } else {
      setCoordError('Enter valid latitude (-90…90) and longitude (-180…180).')
    }
  }

  const handlePick = useCallback((l: number, n: number) => {
    setLat(l)
    setLng(n)
    setLatInput(String(l))
    setLngInput(String(n))
    setCoordError(null)
  }, [])

  const reset = () => {
    setName('')
    setPhoto(null)
    setPhotoName('')
    setLat(null)
    setLng(null)
    setLatInput('')
    setLngInput('')
    setDamageLevel('moderate')
    setRoadStatus('uncertain')
    setServiceRisk('mild')
    setPopulation(50)
    setBuildings(1)
    setCriticalNearby(false)
    setVulnerableNearby(false)
    setDescription('')
    setReporter('')
    setFileError(null)
    setCoordError(null)
  }

  const close = useCallback(() => {
    setReportModal(false)
    reset()
  }, [setReportModal])

  useEffect(() => {
    if (open) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const submit = () => {
    if (!photo || lat == null || lng == null) return
    const now = new Date().toTimeString().slice(0, 5)
    const report = buildFieldReport(
      {
        name,
        lat,
        lng,
        damageLevel,
        roadStatus,
        serviceRisk,
        populationExposure: population,
        criticalFacilityNearby: criticalNearby,
        vulnerableGroupsNearby: vulnerableNearby,
        affectedBuildings: Math.max(0, buildings),
        photo,
        photoName,
        description,
        reporter,
      },
      now,
    )
    addFieldReport(report)
    close()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-[#0b4d3f]/45 backdrop-blur-[2px] p-0 sm:p-6 animate-fade-up"
      onClick={close}
    >
      <div
        className="w-full max-w-2xl max-h-[92dvh] sm:max-h-[90vh] bg-panel rounded-t-[36px] sm:rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 bg-gradient-to-br from-[#13735f] to-[#0b4d3f] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-11 h-11 rounded-[16px] bg-white/15">
              <Camera className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight">New field report</h2>
              <p className="text-xs text-white/65 mt-0.5">
                Upload photo · set location · describe the condition
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin px-6 py-5 space-y-7">
          {/* Photo */}
          <section>
            <SectionTitle step="1" title="Photo" hint="A picture from the ground. Kept as immutable evidence." />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {!photo ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  handleFile(e.dataTransfer.files?.[0])
                }}
                className="w-full rounded-[28px] border-2 border-dashed border-primary/30 bg-panel-soft hover:border-primary/60 hover:bg-panel-tint transition-all duration-200 px-6 py-10 flex flex-col items-center gap-2 group"
              >
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-panel shadow-sm text-primary group-hover:scale-105 transition-transform duration-200">
                  <Upload className="w-5 h-5" />
                </span>
                <span className="text-sm font-bold text-primary-deep">Click or drag &amp; drop a photo</span>
                <span className="text-xs font-medium text-ink-faint">JPEG · PNG · WebP — up to 6 MB</span>
              </button>
            ) : (
              <div className="relative rounded-[28px] overflow-hidden border border-edge">
                <img src={photo} alt="Uploaded report" className="w-full h-44 object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    {photoName || 'photo'}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white rounded-full px-2.5 py-1"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null)
                        setPhotoName('')
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white rounded-full px-2.5 py-1"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            )}
            {fileError && <p className="text-xs font-semibold text-danger-text mt-1.5">{fileError}</p>}
          </section>

          {/* Location */}
          <section>
            <SectionTitle step="2" title="Location" hint="Tap the map, use GPS, or type coordinates." />
            <MiniLocationMap lat={lat} lng={lng} onPick={handlePick} />
            <div className="mt-2.5 flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Latitude</label>
                <input
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 20.2856"
                  className="w-full mt-1 rounded-[14px] border border-edge px-3 py-2 text-sm font-semibold text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Longitude</label>
                <input
                  value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 86.6120"
                  className="w-full mt-1 rounded-[14px] border border-edge px-3 py-2 text-sm font-semibold text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                type="button"
                onClick={applyManualCoords}
                className="rounded-[14px] bg-primary text-white text-xs font-bold px-4 py-2 hover:bg-primary-deep transition-colors"
              >
                Set
              </button>
            </div>
            {coordError && <p className="text-xs font-semibold text-danger-text mt-1.5">{coordError}</p>}
          </section>

          {/* Condition */}
          <section>
            <SectionTitle step="3" title="Condition" hint="What did you observe on the ground?" />

            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold text-ink-soft mb-2">Building / damage severity</p>
                <Segmented options={SEVERITIES} value={damageLevel} onChange={setDamageLevel} activeClass={sevActive} />
              </div>
              <div>
                <p className="text-xs font-bold text-ink-soft mb-2">Road status</p>
                <Segmented options={ROADS} value={roadStatus} onChange={setRoadStatus} activeClass={roadActive} />
              </div>
              <div>
                <p className="text-xs font-bold text-ink-soft mb-2">Likely service impact</p>
                <Segmented options={SEVERITIES} value={serviceRisk} onChange={setServiceRisk} activeClass={sevActive} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-ink-soft">Population exposure</p>
                  <span className="text-sm font-extrabold text-primary">{population}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={population}
                  onChange={(e) => setPopulation(Number(e.target.value))}
                  className="w-full accent-[#13735f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Affected buildings</label>
                  <input
                    type="number"
                    min={0}
                    value={buildings}
                    onChange={(e) => setBuildings(Number(e.target.value))}
                    className="w-full mt-1 rounded-[14px] border border-edge px-3 py-2 text-sm font-semibold text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Reporter (optional)</label>
                  <input
                    value={reporter}
                    onChange={(e) => setReporter(e.target.value)}
                    placeholder="e.g. Operator 06"
                    className="w-full mt-1 rounded-[14px] border border-edge px-3 py-2 text-sm font-semibold text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2.5 rounded-[18px] border border-edge px-4 py-3 cursor-pointer hover:border-primary/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={criticalNearby}
                    onChange={(e) => setCriticalNearby(e.target.checked)}
                    className="w-4 h-4 accent-[#13735f]"
                  />
                  <span className="text-xs font-semibold text-ink-soft">Critical facility nearby</span>
                </label>
                <label className="flex items-center gap-2.5 rounded-[18px] border border-edge px-4 py-3 cursor-pointer hover:border-primary/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={vulnerableNearby}
                    onChange={(e) => setVulnerableNearby(e.target.checked)}
                    className="w-4 h-4 accent-[#13735f]"
                  />
                  <span className="text-xs font-semibold text-ink-soft">Vulnerable groups nearby</span>
                </label>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Location name (optional)</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. NH-53A flood point near Paradeep"
                  className="w-full mt-1 rounded-[14px] border border-edge px-3 py-2 text-sm font-semibold text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What you observed — roof damage, flooding, debris on the road…"
                  className="w-full mt-1 rounded-[14px] border border-edge px-3 py-2 text-sm font-semibold text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-edge bg-panel px-6 py-4 flex items-center gap-4">
          <ScoreRing score={liveScore} size={56} stroke={5} label="preview" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">Estimated priority score</p>
            <p className="text-xs font-semibold text-ink-soft mt-0.5 leading-snug">
              Weighted from your conditions using the explainable priority engine.
            </p>
          </div>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-[18px] bg-primary text-white text-sm font-bold px-6 py-3 hover:bg-primary-deep transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#13735f]/20"
          >
            <ShieldCheck className="w-4 h-4" />
            Submit report
          </button>
        </div>

        {!canSubmit && (
          <div className="px-6 pb-3 -mt-1 text-[11px] font-medium text-warn-text flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Add a photo, pick a location, and choose a damage level to submit.
          </div>
        )}
      </div>
    </div>
  )
}

function SectionTitle({ step, title, hint }: { step: string; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-panel-tint text-primary text-xs font-extrabold">
        {step}
      </span>
      <div>
        <p className="text-sm font-extrabold text-ink leading-tight">{title}</p>
        <p className="text-[11px] font-medium text-ink-faint">{hint}</p>
      </div>
    </div>
  )
}
