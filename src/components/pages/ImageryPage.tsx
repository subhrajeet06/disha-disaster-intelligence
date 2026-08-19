import { useMemo, useState, useRef, useEffect } from 'react'
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
import { PageFooter } from '../layout/PageFooter'

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

  // Demo static images categorized by scenario ID
  const demoImages: DemoImageItem[] = useMemo(() => {
    if (activeEventId === 'evt-flood-mahanadi') {
      return [
        {
          id: 'demo-mh-1',
          title: 'Cuttack – Mahanadi River Surge Ortho',
          sourceType: 'drone',
          locationName: 'Cuttack–Chandni Junction',
          region: 'Cuttack – Banki',
          scenarioName: activeScenario?.name ?? 'Mahanadi Flood Surge',
          captureTime: '2026-07-28 23:15 IST (T+1h)',
          fileType: 'GeoTIFF / Thermal RGB',
          resolution: '3.8 cm/px (GSD)',
          image: '/evidence/odisha_hadr_aerial.jpg',
          description: 'High-altitude aerial survey over Mahanadi river bank depicting bank overflow, embankment breach, and submerged arterial roads (Source: Indian Air Force HADR aerial pass).',
          detectedStructures: 92,
          roadSignals: 'Ring Road embankment partially eroded; 1 lane closed',
          damageSeverity: 'severe',
          confidence: 0.94,
          aiModel: 'yolo-v9-flood · r2026.07',
          notes: 'Water depth rising rapidly around Cuttack hospital corridor. Priority #1 for Mahanadi scenario.',
        },
        {
          id: 'demo-mh-2',
          title: 'Banki PHC Inundation Radar Pass',
          sourceType: 'satellite',
          locationName: 'Banki CHC',
          region: 'Cuttack – Banki',
          scenarioName: activeScenario?.name ?? 'Mahanadi Flood Surge',
          captureTime: '2026-07-28 22:40 IST (T+30m)',
          fileType: 'SAR Sentinel-1 (C-Band)',
          resolution: '10.0 m/px (VV/VH)',
          image: '/evidence/modis_cyclone_mocha.jpg',
          description: 'Synthetic Aperture Radar satellite pass capturing complete flood extent over Banki CHC surrounding agricultural fields (Source: NASA EOSDIS / MODIS).',
          detectedStructures: 43,
          roadSignals: 'Banki–Athagarh State Highway inundated (Impassable)',
          damageSeverity: 'critical',
          confidence: 0.91,
          aiModel: 'segment-anything-flood-v2',
          notes: 'Creek overflow isolates PHC corridor; medical transport requiring amphibious boats.',
        },
        {
          id: 'demo-mh-3',
          title: 'Cuttack Ground Rescue Operation Camera',
          sourceType: 'street',
          locationName: 'Naraj Health Centre',
          region: 'Cuttack – Banki',
          scenarioName: activeScenario?.name ?? 'Mahanadi Flood Surge',
          captureTime: '2026-07-29 01:10 IST (T+3h)',
          fileType: 'JPEG (NDRF Dashcam)',
          resolution: '1920 x 1080 px (Ground-level)',
          image: '/evidence/ndrf_rescue_boat.jpg',
          description: 'Ground responder image showing NDRF motorboat evacuation operations along waterlogged village approach road (Source: NDRF flood operations team).',
          detectedStructures: 28,
          roadSignals: 'Village access road submerged under 1.2m water',
          damageSeverity: 'moderate',
          confidence: 0.88,
          aiModel: 'yolo-v8-road-debris',
          notes: 'Ground unit confirms boats are successfully transferring patients across flooded section.',
        },
        {
          id: 'demo-mh-4',
          title: 'Athagarh Agricultural Sector Survey',
          sourceType: 'drone',
          locationName: 'Athagarh PHC',
          region: 'Cuttack – Banki',
          scenarioName: activeScenario?.name ?? 'Mahanadi Flood Surge',
          captureTime: '2026-07-29 02:00 IST (T+4h)',
          fileType: 'GeoTIFF / Orthomosaic',
          resolution: '4.5 cm/px (GSD)',
          image: '/evidence/odisha_villagers_flood_ground.jpg',
          description: 'Low-altitude drone footage covering marooned hamlet and damaged livestock shelters (Source: Odisha Disaster Management Authority survey drone).',
          detectedStructures: 35,
          roadSignals: 'Local feeder road washed out',
          damageSeverity: 'moderate',
          confidence: 0.89,
          aiModel: 'yolo-v9-damage · r2026.07',
          notes: 'Relief distribution point established at Athagarh high ground.',
        },
      ]
    }

    // Default: Cyclone Fani
    return [
      {
        id: 'demo-fn-1',
        title: 'Paradeep Jetty Approach Grid',
        sourceType: 'drone',
        locationName: 'Paradeep Port Area',
        region: 'Coastal Odisha',
        scenarioName: activeScenario?.name ?? 'Cyclone Fani',
        captureTime: '2026-08-14 07:15 IST (T+45m)',
        fileType: 'GeoTIFF / RGB',
        resolution: '4.2 cm/px (GSD)',
        image: '/evidence/balasore_flood_aerial.jpg',
        description: 'Ultra-high-resolution aerial pass showing concentrated roof collapse and inundation along the coastal settlement grid (Source: Balasore aerial survey / Govt of Odisha).',
        detectedStructures: 118,
        roadSignals: 'NH-53A Submerged (2 impassable segments)',
        damageSeverity: 'critical',
        confidence: 0.97,
        aiModel: 'yolo-v9-damage · r2026.08',
        notes: 'Dense cluster of masonry breaches. Corroborates field priority #1 Paradeep Port Area.',
      },
      {
        id: 'demo-fn-2',
        title: 'Ersama Settlement Inundation Footprint',
        sourceType: 'satellite',
        locationName: 'Ersama Block Centre',
        region: 'Jagatsinghpur, Odisha',
        scenarioName: activeScenario?.name ?? 'Cyclone Fani',
        captureTime: '2026-08-14 06:10 IST (T-20m)',
        fileType: 'Multispectral GeoTIFF (Sentinel-2)',
        resolution: '10.0 m/px (SWIR/NDWI)',
        image: '/evidence/sentinel2_flood_satellite.jpg',
        description: 'Multi-spectral satellite water-index composite indicating 61 buildings inside waterlogged boundary (Source: Copernicus Sentinel-2 MSI).',
        detectedStructures: 74,
        roadSignals: 'Connecting Link Road Submerged (Uncertain Access)',
        damageSeverity: 'severe',
        confidence: 0.95,
        aiModel: 'segment-anything-flood-v2',
        notes: 'Water depth index rising around Ersama CHC. Corroborates priority #2.',
      },
      {
        id: 'demo-fn-3',
        title: 'Puri Sea Front Debris Field',
        sourceType: 'street',
        locationName: 'Puri Sea Front',
        region: 'Puri, Odisha',
        scenarioName: activeScenario?.name ?? 'Cyclone Fani',
        captureTime: '2026-08-14 08:30 IST (T+2h)',
        fileType: 'JPEG (Field Camera)',
        resolution: '1920 x 1080 px (Ground-level)',
        image: '/evidence/fani_ground_damage.jpg',
        description: 'First-responder ground verification photo showing treefall, sign debris, and structural damage along coastal corridor (Source: Wikimedia / Bikash Ojha).',
        detectedStructures: 41,
        roadSignals: 'Marine Drive partially blocked; 1 lane open',
        damageSeverity: 'moderate',
        confidence: 0.89,
        aiModel: 'yolo-v8-road-debris',
        notes: 'Ground camera confirms hospital corridor is cleared, verifying priority #4.',
      },
      {
        id: 'demo-fn-4',
        title: 'Kujanga Coastal Hamlet Pass',
        sourceType: 'drone',
        locationName: 'Kujanga',
        region: 'Jagatsinghpur, Odisha',
        scenarioName: activeScenario?.name ?? 'Cyclone Fani',
        captureTime: '2026-08-14 07:45 IST (T+1h)',
        fileType: 'GeoTIFF / Orthomosaic',
        resolution: '5.0 cm/px (GSD)',
        image: '/evidence/chennai_iaf_aerial.jpg',
        description: 'Aerial disaster orthomosaic covering inundated hamlet with 55 severe damaged roof detections and flooded canal bridge (Source: Indian Air Force aerial disaster survey).',
        detectedStructures: 58,
        roadSignals: 'CS Coastal Road Flooded (Impassable)',
        damageSeverity: 'severe',
        confidence: 0.92,
        aiModel: 'yolo-v9-damage · r2026.08',
        notes: 'Isolated coastal community requiring boat intervention. Corresponds to priority #3.',
      },
    ]
  }, [activeEventId, activeScenario])

  // Filtered list by source
  const visibleImages = useMemo(() => {
    if (selectedSource === 'all') return demoImages
    return demoImages.filter((img) => img.sourceType === selectedSource)
  }, [demoImages, selectedSource])

  // Synchronize selection when scenario or source filter changes
  useEffect(() => {
    if (selectedImageId === 'uploaded') return
    const isValid = visibleImages.some((img) => img.id === selectedImageId)
    if (!isValid && visibleImages.length > 0) {
      setSelectedImageId(visibleImages[0].id)
    }
  }, [visibleImages, selectedImageId])

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
    return visibleImages.find((img) => img.id === selectedImageId) ?? visibleImages[0] ?? demoImages[0]
  }, [uploadedImage, selectedImageId, uploadedFileName, uploadedFileType, uploadedDimensions, activeScenario, visibleImages, demoImages])

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
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

        <PageFooter />
      </div>
    </div>
  )
}
