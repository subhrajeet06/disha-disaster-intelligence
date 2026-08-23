import React, { useState, useEffect, useRef } from 'react';
import { 
    Upload, 
    RotateCw, 
    AlertTriangle, 
    CheckCircle2,
    BarChart3,
    Image as ImageIcon,
    Map as MapIcon,
    AlertCircle,
    ServerCrash,
    ShieldAlert
} from 'lucide-react';
import { v11Api, type V11InferenceResponse } from '../../services/v11Api';

type AnalysisState = 'idle' | 'files_selected' | 'analyzing' | 'success' | 'error';
type ViewTab = 'overlay' | 'triage' | 'probability' | 'before_after';

export function V11AnalysisPage() {
    // Health status
    const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

    // State
    const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [activeTab, setActiveTab] = useState<ViewTab>('overlay');

    // Files and Previews
    const [preFile, setPreFile] = useState<File | null>(null);
    const [postFile, setPostFile] = useState<File | null>(null);
    const [prePreview, setPrePreview] = useState<string | null>(null);
    const [postPreview, setPostPreview] = useState<string | null>(null);

    // Results
    const [result, setResult] = useState<V11InferenceResponse | null>(null);

    // Before/After Slider state
    const [sliderPosition, setSliderPosition] = useState<number>(50);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [containerWidth, setContainerWidth] = useState<number>(600);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMove = (clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setSliderPosition(percentage);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        handleMove(e.clientX);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        handleMove(e.clientX);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        if (e.touches.length > 0) {
            handleMove(e.touches[0].clientX);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length > 0) {
            handleMove(e.touches[0].clientX);
        }
    };

    useEffect(() => {
        const handleWindowMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            handleMove(e.clientX);
        };
        const handleWindowMouseUp = () => {
            setIsDragging(false);
        };
        const handleWindowTouchEnd = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleWindowMouseMove);
            window.addEventListener('mouseup', handleWindowMouseUp);
            window.addEventListener('touchend', handleWindowTouchEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
            window.removeEventListener('touchend', handleWindowTouchEnd);
        };
    }, [isDragging]);

    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [result, activeTab]);

    // Refs
    const preInputRef = useRef<HTMLInputElement>(null);
    const postInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await v11Api.checkV11Health();
                setIsBackendHealthy(res.status === 'ok');
            } catch (e) {
                setIsBackendHealthy(false);
            }
        };
        checkHealth();
    }, []);

    const prePreviewRef = useRef<string | null>(null);
    const postPreviewRef = useRef<string | null>(null);

    useEffect(() => {
        prePreviewRef.current = prePreview;
    }, [prePreview]);

    useEffect(() => {
        postPreviewRef.current = postPreview;
    }, [postPreview]);

    useEffect(() => {
        return () => {
            if (prePreviewRef.current) URL.revokeObjectURL(prePreviewRef.current);
            if (postPreviewRef.current) URL.revokeObjectURL(postPreviewRef.current);
        };
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'pre' | 'post') => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        if (!file.type.startsWith('image/')) {
            setErrorMsg('Only image files are supported.');
            return;
        }
        
        setErrorMsg(''); // Clear previous errors
        const previewUrl = URL.createObjectURL(file);
        
        if (type === 'pre') {
            if (prePreview) URL.revokeObjectURL(prePreview);
            setPreFile(file);
            setPrePreview(previewUrl);
        } else {
            if (postPreview) URL.revokeObjectURL(postPreview);
            setPostFile(file);
            setPostPreview(previewUrl);
        }

        if ((type === 'pre' && postFile) || (type === 'post' && preFile)) {
            setAnalysisState('files_selected');
        }
    };

    const handleAnalyze = async () => {
        if (!preFile || !postFile) {
            setErrorMsg('Both pre-disaster and post-disaster images are required.');
            return;
        }

        setAnalysisState('analyzing');
        setErrorMsg('');
        setResult(null);

        try {
            const data = await v11Api.runV11Inference(preFile, postFile);
            setResult(data);
            setAnalysisState('success');
            setActiveTab('overlay');
        } catch (error: any) {
            setErrorMsg(error.message || 'An unknown error occurred during analysis.');
            setAnalysisState('error');
        }
    };

    const handleReset = () => {
        setPreFile(null);
        setPostFile(null);
        if (prePreview) URL.revokeObjectURL(prePreview);
        if (postPreview) URL.revokeObjectURL(postPreview);
        setPrePreview(null);
        setPostPreview(null);
        setResult(null);
        setErrorMsg('');
        setAnalysisState('idle');
        setActiveTab('overlay');
    };

    return (
        <div className="h-full overflow-y-auto scroll-thin bg-panel-soft p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-200 gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">V11 Inference Test</h1>
                        <p className="text-sm text-gray-500 mt-1">Isolated test workflow for the live FastAPI ML pipeline.</p>
                    </div>
                    <div>
                        {isBackendHealthy === true && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold">
                                <CheckCircle2 className="w-4 h-4" /> V11 AI Engine Ready
                            </span>
                        )}
                        {isBackendHealthy === false && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">
                                <ServerCrash className="w-4 h-4" /> V11 AI Engine Offline
                            </span>
                        )}
                        {isBackendHealthy === null && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-bold">
                                <RotateCw className="w-4 h-4 animate-spin" /> Checking Backend...
                            </span>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Image Selection & Analyze */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-primary" /> Inputs
                            </h2>
                            <div className="space-y-4">
                                {/* Pre-Disaster Upload */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Pre-Disaster Image</label>
                                    <div 
                                        onClick={() => analysisState !== 'analyzing' && preInputRef.current?.click()}
                                        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${prePreview ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400 bg-gray-50'} ${analysisState === 'analyzing' ? 'opacity-50 pointer-events-none' : ''}`}
                                    >
                                        <input type="file" className="hidden" ref={preInputRef} accept="image/*" onChange={(e) => handleFileChange(e, 'pre')} />
                                        {prePreview ? (
                                            <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                                                <img src={prePreview} alt="Pre-Disaster" className="w-full h-full object-contain" />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center py-6 text-gray-500">
                                                <Upload className="w-6 h-6 mb-2" />
                                                <span className="text-xs font-medium">Click to select image</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Post-Disaster Upload */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Post-Disaster Image</label>
                                    <div 
                                        onClick={() => analysisState !== 'analyzing' && postInputRef.current?.click()}
                                        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${postPreview ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400 bg-gray-50'} ${analysisState === 'analyzing' ? 'opacity-50 pointer-events-none' : ''}`}
                                    >
                                        <input type="file" className="hidden" ref={postInputRef} accept="image/*" onChange={(e) => handleFileChange(e, 'post')} />
                                        {postPreview ? (
                                            <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                                                <img src={postPreview} alt="Post-Disaster" className="w-full h-full object-contain" />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center py-6 text-gray-500">
                                                <Upload className="w-6 h-6 mb-2" />
                                                <span className="text-xs font-medium">Click to select image</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {errorMsg && (
                                    <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{errorMsg}</span>
                                    </div>
                                )}

                                <button
                                    onClick={handleAnalyze}
                                    disabled={!preFile || !postFile || analysisState === 'analyzing'}
                                    className="w-full py-3 px-4 bg-primary hover:bg-primary-deep text-white text-sm font-bold rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-2"
                                >
                                    {analysisState === 'analyzing' ? (
                                        <><RotateCw className="w-4 h-4 animate-spin" /> Analyzing...</>
                                    ) : (
                                        'Analyze Damage'
                                    )}
                                </button>
                                
                                {(analysisState === 'success' || analysisState === 'error') && (
                                    <button 
                                        onClick={handleReset}
                                        className="w-full py-2.5 px-4 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-bold rounded-xl transition-all"
                                    >
                                        New Analysis
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Visualization & Results */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-1 rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-[600px] flex flex-col">
                            {analysisState === 'idle' || analysisState === 'files_selected' ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12 text-center">
                                    <MapIcon className="w-16 h-16 mb-4 text-gray-200" />
                                    <h3 className="text-lg font-bold text-gray-700 mb-2">Workspace Ready</h3>
                                    <p className="text-sm max-w-sm">Use a matched image pair showing the same area before and after the disaster. Click Analyze Damage to run the AI pipeline.</p>
                                </div>
                            ) : analysisState === 'analyzing' ? (
                                <div className="flex-1 flex flex-col items-center justify-center bg-gray-900 text-white p-12 text-center rounded-xl relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                                    <RotateCw className="w-12 h-12 text-primary animate-spin mb-6 relative z-10" />
                                    <h3 className="text-xl font-bold tracking-wide relative z-10">Analyzing disaster imagery...</h3>
                                    <p className="text-gray-400 text-sm mt-2 relative z-10">Running V11 deep learning inference and morphological operations.</p>
                                </div>
                            ) : result ? (
                                <div className="flex-1 flex flex-col h-full">
                                    {/* Tabs */}
                                    <div className="flex border-b border-gray-100 p-2 gap-1 bg-gray-50">
                                        {[
                                            { id: 'overlay', label: 'Damage Overlay' },
                                            { id: 'triage', label: 'Triage Mask' },
                                            { id: 'probability', label: 'AI Damage Score Map' },
                                            { id: 'before_after', label: 'Before / After' }
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveTab(tab.id as ViewTab)}
                                                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === tab.id ? 'bg-white text-primary shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    {/* Viewer */}
                                    <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
                                        {activeTab === 'overlay' && (
                                            <img src={result.outputs.overlay} alt="Overlay" className="max-w-full max-h-full object-contain" />
                                        )}
                                        {activeTab === 'triage' && (
                                            <img src={result.outputs.triage_mask} alt="Triage Mask" className="max-w-full max-h-full object-contain" />
                                        )}
                                        {activeTab === 'probability' && (
                                            <img src={result.outputs.damage_probability} alt="Probability Map" className="max-w-full max-h-full object-contain" />
                                        )}
                                         {activeTab === 'before_after' && (
                                             <div 
                                                 ref={containerRef}
                                                 className="relative w-full h-full overflow-hidden select-none cursor-ew-resize"
                                                 onMouseDown={handleMouseDown}
                                                 onMouseMove={handleMouseMove}
                                                 onTouchStart={handleTouchStart}
                                                 onTouchMove={handleTouchMove}
                                                 onTouchEnd={() => setIsDragging(false)}
                                             >
                                                 {/* Post-Disaster Image (After) - covers full container */}
                                                 <img 
                                                     src={postPreview || ''} 
                                                     alt="After" 
                                                     className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" 
                                                 />

                                                 {/* Pre-Disaster Image (Before) - clipped by width */}
                                                 <div 
                                                     className="absolute top-0 left-0 h-full overflow-hidden pointer-events-none"
                                                     style={{ width: `${sliderPosition}%` }}
                                                 >
                                                     <img 
                                                         src={prePreview || ''} 
                                                         alt="Before" 
                                                         className="absolute top-0 left-0 h-full object-contain max-w-none" 
                                                         style={{ width: containerWidth }} 
                                                     />
                                                 </div>

                                                 {/* Slider line & handle */}
                                                 <div 
                                                     className="absolute top-0 bottom-0 w-0.5 bg-white cursor-ew-resize z-20 flex items-center justify-center pointer-events-none"
                                                     style={{ left: `${sliderPosition}%` }}
                                                 >
                                                     <div className="w-8 h-8 rounded-full bg-white border-2 border-primary shadow-lg flex items-center justify-center -ml-[15px] select-none text-primary font-bold text-base pointer-events-auto hover:scale-105 active:scale-95 transition-transform">
                                                         ↔
                                                     </div>
                                                 </div>

                                                 {/* Floating Labels */}
                                                 <span className="absolute top-4 left-4 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur z-10 pointer-events-none">
                                                     BEFORE
                                                 </span>
                                                 <span className="absolute top-4 right-4 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur z-10 pointer-events-none">
                                                     AFTER
                                                 </span>
                                             </div>
                                         )}

                                        {/* Legend for Overlay/Triage */}
                                        {(activeTab === 'overlay' || activeTab === 'triage') && (
                                            <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-3 text-white text-xs border border-gray-700 shadow-xl flex gap-4">
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-sm"></div>No Damage</div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-500 rounded-sm"></div>Damage</div>
                                                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div>Severe</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Human Verification Warning */}
                                    <div className="bg-yellow-50 border-t border-yellow-200 p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-yellow-800">
                                            <ShieldAlert className="w-5 h-5 shrink-0" />
                                            <div>
                                                <p className="text-xs font-bold">HUMAN VERIFICATION REQUIRED</p>
                                                <p className="text-[10px] opacity-80">AI results support assessment and should be verified by a responder.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button className="px-3 py-1.5 bg-white border border-yellow-300 text-yellow-800 text-[10px] font-bold rounded shadow-sm hover:bg-yellow-100">Reject</button>
                                            <button className="px-3 py-1.5 bg-yellow-600 text-white text-[10px] font-bold rounded shadow-sm hover:bg-yellow-700">Confirm Damage</button>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* Statistics Panel */}
                        {result && result.statistics && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Status</span>
                                    <span className={`text-sm font-extrabold ${result.decision.damage_detected ? 'text-red-600' : 'text-green-600'}`}>
                                        {result.decision.damage_detected ? 'Damage Detected' : 'No Damage Detected'}
                                    </span>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Severity</span>
                                    <span className={`text-sm font-extrabold capitalize ${result.decision.severity === 'severe' || result.decision.severity === 'critical' ? 'text-red-600' : result.decision.severity === 'none' ? 'text-green-600' : 'text-orange-600'}`}>
                                        {result.decision.severity === 'severe' ? 'Potential severe damage' : result.decision.severity}
                                    </span>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Damaged Area</span>
                                    <span className="text-sm font-extrabold text-gray-900">
                                        {result.statistics.damage_area_percent.toFixed(2)}%
                                    </span>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Severe Regions</span>
                                    <span className="text-sm font-extrabold text-gray-900">
                                        {result.statistics.severe_regions} clusters
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
