import { useMemo, useState, useRef } from 'react'
import {
  Warehouse,
  Upload,
  ScanLine,
  Layers,
  Clock,
  MapPin,
  FileImage,
  ShieldCheck,
  Play,
  RotateCw,
  Building,
  Route,
  ArrowRight,
  ChevronDown,
  Check,
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { ScoreRing, StatusPill, SeverityPill } from '../ui'
import type { SourceType, Severity } from '../../types'

type AnalysisState = 'idle' | 'queued' | 'processing' | 'ready'

interface DemoImageItem {
  id: string
  title: string
  sourceType: SourceType
  locationName: string
  region: string
  scenarioName: string
  captureTime: string
  fileType: string
  resolution: string
  image: string
  description: string
  detectedStructures: number
  roadSignals: string
  damageSeverity: Severity
  confidence: number
  aiModel: string
  notes: string
}

export function ImageryPage() {
  const scenarios = useAppStore((s) => s.scenarios)
  const activeEventId = useAppStore((s) => s.activeEventId)
  const setActivePage = useAppStore((s) => s.setActivePage)
  const activeScenario = scenarios.find((e) => e.id === activeEventId) ?? scenarios[0]
  const [isScenarioDropdownOpen, setIsScenarioDropdownOpen] = useState<boolean>(false)

  const [selectedSource, setSelectedSource] = useState<SourceType | 'all'>('all')
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string>('')
  const [uploadedFileType, setUploadedFileType] = useState<string>('')
  const [uploadedDimensions, setUploadedDimensions] = useState<string>('')
  const [selectedImageId, setSelectedImageId] = useState<string>('demo-1')
  const [analysisState, setAnalysisState] = useState<AnalysisState>('ready')
  const [analysisProgress, setAnalysisProgress] = useState<number>(100)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Demo static images extracted from scenarios & priorities
  const demoImages: DemoImageItem[] = useMemo(() => {
    return [
      {
        id: 'demo-1',
        title: 'Paradeep Jetty Approach Grid',
        sourceType: 'drone',
        locationName: 'Paradeep Port Area',
        region: 'Coastal Odisha',
        scenarioName: activeScenario?.name ?? 'Cyclone Nivar',
        captureTime: '2026-08-14 07:15 IST (T+45m)',
        fileType: 'GeoTIFF / RGB',
        resolution: '4.2 cm/px (GSD)',
        image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
          <svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'>
            <defs>
              <radialGradient id='dg1' cx='50%' cy='45%' r='75%'>
                <stop offset='0%' stop-color='#3b8270'/>
                <stop offset='55%' stop-color='#265b4e'/>
                <stop offset='100%' stop-color='#153830'/>
              </radialGradient>
            </defs>
            <rect width='640' height='400' fill='url(#dg1)'/>
            <!-- Damaged structures boxes -->
            <rect x='110' y='80' width='90' height='60' fill='none' stroke='#c0392b' stroke-width='2.5' stroke-dasharray='4 2'/>
            <text x='115' y='74' fill='#ff7675' font-size='11' font-family='sans-serif' font-weight='bold'>ROOF COLLAPSE #104 [0.97]</text>
            <rect x='240' y='140' width='130' height='90' fill='none' stroke='#c0392b' stroke-width='2.5'/>
            <text x='245' y='134' fill='#ff7675' font-size='11' font-family='sans-serif' font-weight='bold'>STRUCTURAL BREACH [0.98]</text>
            <!-- Flooded road path -->
            <path d='M0 320 Q 200 280 400 330 T 640 260' stroke='#38bdf8' stroke-width='16' fill='none' stroke-opacity='0.75'/>
            <path d='M0 320 Q 200 280 400 330 T 640 260' stroke='#f43f5e' stroke-width='2' stroke-dasharray='6 4' fill='none'/>
            <text x='30' y='305' fill='#fecdd3' font-size='11' font-family='sans-serif' font-weight='bold'>NH-53A FLOOD EXTENT (BLOCKED)</text>
            <!-- Drone overlay HUD -->
            <circle cx='320' cy='200' r='40' stroke='rgba(255,255,255,0.4)' stroke-width='1.5' fill='none'/>
            <line x1='320' y1='150' x2='320' y2='250' stroke='rgba(255,255,255,0.4)' stroke-width='1.5'/>
            <line x1='270' y1='200' x2='370' y2='200' stroke='rgba(255,255,255,0.4)' stroke-width='1.5'/>
            <text x='20' y='30' fill='#a7f3d0' font-size='12' font-family='monospace' font-weight='bold'>DRONE-UAV 04 · ALT 120M · SENSOR 4K-OPTICAL</text>
          </svg>
        `)}`,
        description: 'Ultra-high-resolution aerial pass showing concentrated roof collapse polygons across jetty approach and industrial shoreline.',
        detectedStructures: 118,
        roadSignals: 'NH-53A Submerged (2 impassable segments)',
        damageSeverity: 'critical',
        confidence: 0.97,
        aiModel: 'yolo-v9-damage · r2026.08',
        notes: 'Dense cluster of masonry breaches. Corroborates field priority #1 Paradeep Port Area.',
      },
      {
        id: 'demo-2',
        title: 'Ersama Settlement Inundation Footprint',
        sourceType: 'satellite',
        locationName: 'Ersama Block Centre',
        region: 'Jagatsinghpur, Odisha',
        scenarioName: activeScenario?.name ?? 'Cyclone Nivar',
        captureTime: '2026-08-14 06:10 IST (T-20m)',
        fileType: 'Multispectral GeoTIFF (Sentinel-2)',
        resolution: '10.0 m/px (SWIR/NDWI)',
        image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
          <svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'>
            <defs>
              <linearGradient id='sg1' x1='0' y1='0' x2='1' y2='1'>
                <stop offset='0%' stop-color='#1b4965'/>
                <stop offset='40%' stop-color='#2b6f7a'/>
                <stop offset='100%' stop-color='#133c3a'/>
              </linearGradient>
            </defs>
            <rect width='640' height='400' fill='url(#sg1)'/>
            <!-- NDWI Water boundary -->
            <polygon points='80,120 220,90 380,180 520,160 600,280 410,360 190,320 60,240' fill='rgba(14,165,233,0.35)' stroke='#38bdf8' stroke-width='2'/>
            <text x='170' y='210' fill='#e0f2fe' font-size='12' font-family='sans-serif' font-weight='bold'>FLOOD EXTENT POLYGON [NDWI \u003e 0.38]</text>
            <!-- Settlement cluster -->
            <circle cx='320' cy='180' r='18' fill='#e2622b' fill-opacity='0.8' stroke='#fff' stroke-width='1.5'/>
            <circle cx='350' cy='200' r='12' fill='#e2622b' fill-opacity='0.8' stroke='#fff' stroke-width='1.5'/>
            <circle cx='290' cy='210' r='14' fill='#e2622b' fill-opacity='0.8' stroke='#fff' stroke-width='1.5'/>
            <text x='350' y='180' fill='#fef08a' font-size='10' font-family='sans-serif' font-weight='bold'>ERSAMA CHC (ISOLATED)</text>
            <text x='20' y='30' fill='#93c5fd' font-size='12' font-family='monospace' font-weight='bold'>SENTINEL-2 MSI · BAND 8A/11/4 · COMPOSITE NDWI</text>
          </svg>
        `)}`,
        description: 'Multi-spectral satellite water-index composite indicating 61 buildings inside waterlogged boundary.',
        detectedStructures: 74,
        roadSignals: 'Connecting Link Road Submerged (Uncertain Access)',
        damageSeverity: 'severe',
        confidence: 0.95,
        aiModel: 'segment-anything-flood-v2',
        notes: 'Water depth index rising around Ersama CHC. Corroborates priority #2.',
      },
      {
        id: 'demo-3',
        title: 'Puri Sea Front Debris Field',
        sourceType: 'street',
        locationName: 'Puri Sea Front',
        region: 'Puri, Odisha',
        scenarioName: activeScenario?.name ?? 'Cyclone Nivar',
        captureTime: '2026-08-14 08:30 IST (T+2h)',
        fileType: 'JPEG (Field Camera)',
        resolution: '1920 x 1080 px (Ground-level)',
        image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
          <svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'>
            <defs>
              <linearGradient id='stg1' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='0%' stop-color='#64748b'/>
                <stop offset='45%' stop-color='#94a3b8'/>
                <stop offset='100%' stop-color='#334155'/>
              </linearGradient>
            </defs>
            <rect width='640' height='400' fill='url(#stg1)'/>
            <!-- Road surface -->
            <polygon points='0,400 640,400 480,220 160,220' fill='#1e293b'/>
            <!-- Obstructions -->
            <rect x='210' y='250' width='80' height='45' fill='#991b1b' stroke='#f87171' stroke-width='2'/>
            <text x='215' y='244' fill='#fca5a5' font-size='10' font-family='sans-serif' font-weight='bold'>DOWNED TREE / POLE</text>
            <rect x='340' y='270' width='95' height='55' fill='#713f12' stroke='#facc15' stroke-width='2'/>
            <text x='345' y='264' fill='#fef08a' font-size='10' font-family='sans-serif' font-weight='bold'>DEBRIS OBSTRUCTION</text>
            <text x='20' y='30' fill='#f1f5f9' font-size='12' font-family='monospace' font-weight='bold'>RESPONDER DASHCAM · PURI MARINE DRIVE · STREET CAM 08</text>
          </svg>
        `)}`,
        description: 'First-responder ground verification photo showing treefall, sign debris, and narrow passable lane on Marine Drive.',
        detectedStructures: 41,
        roadSignals: 'Marine Drive partially blocked; 1 lane open',
        damageSeverity: 'moderate',
        confidence: 0.89,
        aiModel: 'yolo-v8-road-debris',
        notes: 'Ground camera confirms hospital corridor is cleared, verifying priority #4.',
      },
      {
        id: 'demo-4',
        title: 'Kujanga Coastal Hamlet Pass',
        sourceType: 'drone',
        locationName: 'Kujanga',
        region: 'Jagatsinghpur, Odisha',
        scenarioName: activeScenario?.name ?? 'Cyclone Nivar',
        captureTime: '2026-08-14 07:45 IST (T+1h)',
        fileType: 'GeoTIFF / Orthomosaic',
        resolution: '5.0 cm/px (GSD)',
        image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
          <svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'>
            <defs>
              <radialGradient id='dg2' cx='40%' cy='40%' r='70%'>
                <stop offset='0%' stop-color='#2d6a4f'/>
                <stop offset='60%' stop-color='#1b4332'/>
                <stop offset='100%' stop-color='#081c15'/>
              </radialGradient>
            </defs>
            <rect width='640' height='400' fill='url(#dg2)'/>
            <!-- Detected clusters -->
            <rect x='160' y='90' width='80' height='55' fill='none' stroke='#e2622b' stroke-width='2'/>
            <rect x='280' y='110' width='70' height='45' fill='none' stroke='#e2622b' stroke-width='2'/>
            <rect x='410' y='150' width='90' height='60' fill='none' stroke='#c0392b' stroke-width='2.5'/>
            <text x='160' y='82' fill='#fdba74' font-size='10' font-family='sans-serif' font-weight='bold'>55 DAMAGE DETECTIONS</text>
            <text x='20' y='30' fill='#a7f3d0' font-size='12' font-family='monospace' font-weight='bold'>DRONE ORTHO · KUJANGA COASTAL SECTOR · ALT 100M</text>
          </svg>
        `)}`,
        description: 'Drone orthomosaic covering fishing hamlet with 55 severe damaged roof detections and flooded canal bridge.',
        detectedStructures: 58,
        roadSignals: 'CS Coastal Road Flooded (Impassable)',
        damageSeverity: 'severe',
        confidence: 0.92,
        aiModel: 'yolo-v9-damage · r2026.08',
        notes: 'Isolated coastal community requiring boat intervention. Corresponds to priority #3.',
      },
    ]
  }, [activeScenario])

  // Filtered list
  const visibleImages = useMemo(() => {
    if (selectedSource === 'all') return demoImages
    return demoImages.filter((img) => img.sourceType === selectedSource)
  }, [demoImages, selectedSource])

  // Current active image item (uploaded or demo)
  const currentImage = useMemo(() => {
    if (uploadedImage && selectedImageId === 'uploaded') {
      return {
        id: 'uploaded',
        title: uploadedFileName || 'Custom Field Ingest',
        sourceType: 'drone' as SourceType,
        locationName: activeScenario?.region ?? 'Field Target',
        region: activeScenario?.region ?? 'Current Sector',
        scenarioName: activeScenario?.name ?? 'DISHA Scenario',
        captureTime: 'Ingested just now',
        fileType: uploadedFileType || 'Image / PNG',
        resolution: uploadedDimensions || '1920 x 1080 (Browser Preview)',
        image: uploadedImage,
        description: 'Locally previewed image payload. Analyzed with DISHA vision pipeline (client-side simulation).',
        detectedStructures: 48,
        roadSignals: 'Passable with cautious speed; localized debris',
        damageSeverity: 'moderate' as Severity,
        confidence: 0.91,
        aiModel: 'yolo-v9-damage · r2026.08 (simulated)',
        notes: 'Custom ingest metadata and simulated vision inferences generated locally.',
      }
    }
    return demoImages.find((img) => img.id === selectedImageId) ?? demoImages[0]
  }, [uploadedImage, selectedImageId, uploadedFileName, uploadedFileType, uploadedDimensions, activeScenario, demoImages])

  // Simulated analysis flow
  const runAnalysis = () => {
    setAnalysisState('queued')
    setAnalysisProgress(15)

    setTimeout(() => {
      setAnalysisState('processing')
      setAnalysisProgress(65)
    }, 600)

    setTimeout(() => {
      setAnalysisProgress(100)
      setAnalysisState('ready')
    }, 1400)
  }

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadedFileName(file.name)
    setUploadedFileType(file.type || 'image/jpeg')

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      setUploadedImage(result)
      setSelectedImageId('uploaded')

      // Measure dimensions
      const img = new Image()
      img.onload = () => {
        setUploadedDimensions(`${img.width} x ${img.height} px`)
      }
      img.src = result

      // Automatically queue simulated processing
      setAnalysisState('queued')
      setAnalysisProgress(20)
      setTimeout(() => {
        setAnalysisState('processing')
        setAnalysisProgress(70)
      }, 500)
      setTimeout(() => {
        setAnalysisProgress(100)
        setAnalysisState('ready')
      }, 1200)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="h-full overflow-y-auto scroll-thin">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-24 lg:pb-6 space-y-6">
        {/* Banner Header */}
        <div className="rounded-[28px] bg-gradient-to-br from-[#13735f] to-[#0b4d3f] text-white px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#9ad4c1] mb-2">
            <Warehouse className="w-3.5 h-3.5" />
            Disaster Imagery Ingestion & Vision Analytics
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
               <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                 Multimodal Imagery Workspace
               </h2>
               <div className="mt-2">
                 <button
                   onClick={() => setIsScenarioDropdownOpen(!isScenarioDropdownOpen)}
                   className="inline-flex items-center gap-1.5 bg-white/20 text-white font-bold text-sm px-3 py-1.5 rounded-full hover:bg-white/30 transition-colors duration-200"
                 >
                   {activeScenario?.name ?? 'Select Scenario'}
                   <ChevronDown className="w-4 h-4" />
                 </button>
                 {isScenarioDropdownOpen && (
                   <div className="mt-2 absolute z-10 bg-white rounded-[16px] shadow-lg border border-gray-200 w-64 p-2">
                     {scenarios.map((scenario) => (
                       <button
                         key={scenario.id}
                         onClick={() => {
                           useAppStore.getState().setActiveEvent(scenario.id)
                           setIsScenarioDropdownOpen(false)
                         }}
                         className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 rounded-[12px] transition-colors duration-200"
                       >
                         {scenario.id === activeEventId && <Check className="w-4 h-4 text-primary" />}
                         <span className={scenario.id === activeEventId ? 'font-bold text-primary' : ''}>{scenario.name}</span>
                       </button>
                     ))}
                   </div>
                 )}
               </div>
               <p className="text-sm text-white/70 mt-2 max-w-xl leading-relaxed">
                 Ingest drone orthomosaics, satellite passes, and ground-level street imagery for the selected scenario.
               </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActivePage('command')}
                className="inline-flex items-center gap-2 rounded-[18px] bg-white text-[#0b4d3f] font-bold text-xs px-4 py-2.5 hover:bg-white/90 shadow-md transition-all duration-200"
              >
                <ArrowRight className="w-4 h-4" />
                View on Command
              </button>
            </div>
          </div>
        </div>

        {/* Source selector & Upload toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-panel rounded-[24px] border border-edge p-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-ink-faint mr-2">Filter Source:</span>
            {(
              [
                { key: 'all', label: 'All Sources' },
                { key: 'drone', label: 'Drone (UAV)' },
                { key: 'satellite', label: 'Satellite' },
                { key: 'street', label: 'Street Camera' },
              ] as const
            ).map((s) => {
              const active = selectedSource === s.key
              return (
                <button
                  key={s.key}
                  onClick={() => setSelectedSource(s.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                    active
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-panel-soft text-ink-soft hover:bg-edge'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-[16px] bg-primary text-white text-xs font-bold px-4 py-2.5 hover:bg-primary-deep transition-colors duration-200 shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Upload local image
            </button>
          </div>
        </div>

        {/* Main 2-column workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Image Viewer & Analysis Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Main Image Display Box */}
            <div className="rounded-[24px] border border-edge bg-panel overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-edge flex items-center justify-between bg-panel-soft">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusPill
                    label={currentImage.sourceType.toUpperCase()}
                    tone={currentImage.sourceType === 'drone' ? 'success' : currentImage.sourceType === 'satellite' ? 'info' : 'warn'}
                  />
                  <p className="text-xs font-bold text-ink truncate">{currentImage.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-ink-faint hidden sm:inline">
                    {currentImage.resolution}
                  </span>
                </div>
              </div>

              {/* Visual Container */}
              <div className="relative aspect-[16/10] bg-slate-900 overflow-hidden flex items-center justify-center">
                <img
                  src={currentImage.image}
                  alt={currentImage.title}
                  className="w-full h-full object-cover"
                />

                {/* Processing overlay */}
                {analysisState !== 'ready' && (
                  <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center text-white px-6 text-center animate-fade-up">
                    <RotateCw className="w-8 h-8 text-primary animate-spin mb-3" />
                    <p className="text-sm font-bold tracking-wide">
                      {analysisState === 'queued' ? 'Queued in Vision Pipeline…' : 'Running YOLO & Flood Segmentation…'}
                    </p>
                    <p className="text-xs text-white/60 mt-1 max-w-xs">
                      Extracting building footprint breaches, road blockages, and NDWI water indices.
                    </p>
                    <div className="w-48 h-2 rounded-full bg-white/20 mt-4 overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${analysisProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Badge Overlay */}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md rounded-[12px] px-3 py-1.5 text-white text-[11px] flex items-center gap-2 border border-white/10">
                  <ScanLine className="w-3.5 h-3.5 text-[#9ad4c1]" />
                  <span>{currentImage.aiModel}</span>
                </div>

                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1 text-white text-[10px] font-mono border border-white/10">
                  PROTOTYPE SIMULATION
                </div>
              </div>

              {/* Analysis Trigger Bar */}
              <div className="p-4 bg-panel border-t border-edge flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-ink">Vision AI Model Pipeline</p>
                  <p className="text-[11px] text-ink-faint">
                    {analysisState === 'ready'
                      ? 'Analysis ready · 100% processed'
                      : analysisState === 'processing'
                      ? 'Processing computer vision models…'
                      : 'Queued for inference…'}
                  </p>
                </div>
                <button
                  onClick={runAnalysis}
                  disabled={analysisState !== 'ready'}
                  className="inline-flex items-center gap-2 rounded-[16px] bg-primary text-white text-xs font-bold px-4 py-2.5 hover:bg-primary-deep transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {analysisState === 'ready' ? <Play className="w-3.5 h-3.5" /> : <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  Analyze Image
                </button>
              </div>
            </div>

            {/* Thumbnail Carousel / Selector */}
            <div className="rounded-[24px] border border-edge bg-panel p-4">
              <p className="text-xs font-extrabold uppercase tracking-wider text-ink-faint mb-3">
                Ingested Demo & Field Imagery ({visibleImages.length + (uploadedImage ? 1 : 0)})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {uploadedImage && (
                  <button
                    onClick={() => setSelectedImageId('uploaded')}
                    className={`rounded-[16px] p-2 text-left border transition-all duration-200 flex flex-col gap-1.5 ${
                      selectedImageId === 'uploaded'
                        ? 'border-primary bg-panel-tint ring-2 ring-primary/20'
                        : 'border-edge bg-panel-soft hover:border-primary/40'
                    }`}
                  >
                    <div className="aspect-[16/10] rounded-[10px] overflow-hidden bg-slate-900">
                      <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[11px] font-bold text-ink truncate">{uploadedFileName || 'Custom Upload'}</p>
                    <span className="text-[9px] font-semibold text-primary">Custom Local File</span>
                  </button>
                )}

                {visibleImages.map((img) => {
                  const isSelected = selectedImageId === img.id
                  return (
                    <button
                      key={img.id}
                      onClick={() => {
                        setSelectedImageId(img.id)
                        setAnalysisState('ready')
                      }}
                      className={`rounded-[16px] p-2 text-left border transition-all duration-200 flex flex-col gap-1.5 ${
                        isSelected
                          ? 'border-primary bg-panel-tint ring-2 ring-primary/20'
                          : 'border-edge bg-panel-soft hover:border-primary/40'
                      }`}
                    >
                      <div className="aspect-[16/10] rounded-[10px] overflow-hidden bg-slate-900">
                        <img src={img.image} alt={img.title} className="w-full h-full object-cover" />
                      </div>
                      <p className="text-[11px] font-bold text-ink truncate">{img.title}</p>
                      <div className="flex items-center justify-between text-[9px] text-ink-faint">
                        <span className="capitalize">{img.sourceType}</span>
                        <span className="font-bold text-primary">{Math.round(img.confidence * 100)}%</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Metadata & AI Detection Results (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Metadata Card */}
            <div className="rounded-[24px] border border-edge bg-panel p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-edge pb-3">
                <p className="text-sm font-extrabold text-ink">Image & Sensor Metadata</p>
                <StatusPill label="Verified Ingest" tone="success" />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-[16px] bg-panel-soft p-3">
                  <div className="flex items-center gap-1.5 text-ink-faint text-[10px] font-bold uppercase">
                    <Layers className="w-3 h-3" />
                    Source Mode
                  </div>
                  <p className="font-bold text-ink mt-1 capitalize">{currentImage.sourceType}</p>
                </div>
                <div className="rounded-[16px] bg-panel-soft p-3">
                  <div className="flex items-center gap-1.5 text-ink-faint text-[10px] font-bold uppercase">
                    <MapPin className="w-3 h-3" />
                    Scenario / Region
                  </div>
                  <p className="font-bold text-ink mt-1 truncate">{currentImage.scenarioName}</p>
                  <p className="text-[10px] text-ink-faint truncate">{currentImage.region}</p>
                </div>
                <div className="rounded-[16px] bg-panel-soft p-3">
                  <div className="flex items-center gap-1.5 text-ink-faint text-[10px] font-bold uppercase">
                    <Clock className="w-3 h-3" />
                    Capture Time
                  </div>
                  <p className="font-bold text-ink mt-1">{currentImage.captureTime}</p>
                </div>
                <div className="rounded-[16px] bg-panel-soft p-3">
                  <div className="flex items-center gap-1.5 text-ink-faint text-[10px] font-bold uppercase">
                    <FileImage className="w-3 h-3" />
                    Format / GSD
                  </div>
                  <p className="font-bold text-ink mt-1 truncate">{currentImage.fileType}</p>
                  <p className="text-[10px] text-ink-faint">{currentImage.resolution}</p>
                </div>
              </div>

              <p className="text-[11px] text-ink-soft leading-relaxed bg-panel-soft p-3 rounded-[16px]">
                {currentImage.description}
              </p>
            </div>

            {/* Prototype Vision Analytics Output Card */}
            <div className="rounded-[24px] border border-edge bg-panel p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-edge pb-3">
                <div>
                  <p className="text-sm font-extrabold text-ink">Vision AI Detections</p>
                  <span className="text-[10px] font-bold text-primary bg-panel-tint px-2 py-0.5 rounded-full">
                    Model: {currentImage.aiModel}
                  </span>
                </div>
                <ScoreRing score={Math.round(currentImage.confidence * 100)} size={52} stroke={5} label="conf." />
              </div>

              {/* Detection Metrics */}
              <div className="space-y-3">
                <div className="rounded-[18px] bg-panel-soft p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-[12px] bg-[#c0392b]/15 text-[#c0392b]">
                      <Building className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-ink">Structure Breaches</p>
                      <p className="text-[10px] text-ink-faint">Roof collapsed or damaged</p>
                    </div>
                  </div>
                  <span className="text-base font-extrabold text-[#c0392b] tabular-nums">
                    {currentImage.detectedStructures} units
                  </span>
                </div>

                <div className="rounded-[18px] bg-panel-soft p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-[12px] bg-[#e2622b]/15 text-[#e2622b]">
                      <Route className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-ink">Road & Flood Signals</p>
                      <p className="text-[10px] text-ink-faint max-w-[190px] truncate">{currentImage.roadSignals}</p>
                    </div>
                  </div>
                  <SeverityPill severity={currentImage.damageSeverity} />
                </div>
              </div>

              {/* Context Note */}
              <div className="rounded-[16px] border border-edge bg-panel-soft/60 p-3 text-[11px] text-ink-soft space-y-1">
                <p className="font-bold text-ink flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  Operational Ground Truth
                </p>
                <p>{currentImage.notes}</p>
              </div>

              {/* Return to Command Button */}
              <button
                onClick={() => setActivePage('command')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-[16px] bg-primary text-white text-xs font-bold py-3 hover:bg-primary-deep transition-colors duration-200 shadow-sm"
              >
                <ArrowRight className="w-4 h-4" />
                View & Verify on Command Map
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
