
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import Timeline from './components/Timeline';
import PropertiesPanel from './components/PropertiesPanel';
import ContextMenu from './components/ContextMenu';
import ExportModal from './components/ExportModal';
import { Project, Layer, EditorState, LayerType } from './types';
import { DEFAULT_PROJECT_WIDTH, DEFAULT_PROJECT_HEIGHT, DEFAULT_PROJECT_DURATION } from './constants';
import { GeminiService } from './services/geminiService';

const App: React.FC = () => {
  const [project, setProject] = useState<Project>({
    id: 'p1',
    name: 'Automation Smart Template',
    width: DEFAULT_PROJECT_WIDTH,
    height: DEFAULT_PROJECT_HEIGHT,
    duration: DEFAULT_PROJECT_DURATION,
    elevenLabsApiKey: localStorage.getItem('elevenlabs_key') || '',
    layers: [
      {
        id: 'l1',
        type: 'text',
        name: 'Main Headline',
        x: 140,
        y: 800,
        width: 800,
        height: 200,
        opacity: 1,
        rotation: 0,
        content: 'AI REVOLUTION',
        start: 0,
        duration: 10,
        fontSize: 120,
        fontWeight: '900',
        color: '#ffffff',
        zIndex: 10,
        volume: 1
      }
    ],
  });

  const [editorState, setEditorState] = useState<EditorState>({
    currentTime: 0,
    isPlaying: false,
    selectedLayerId: null,
    zoom: 0.35,
  });

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, layerId: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current !== undefined) {
      const deltaTime = (time - lastTimeRef.current) / 1000;
      setEditorState(prev => {
        let nextTime = prev.currentTime + deltaTime;
        if (nextTime >= project.duration) {
          nextTime = 0;
          return { ...prev, currentTime: nextTime, isPlaying: false };
        }
        return { ...prev, currentTime: nextTime };
      });
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [project.duration]);

  useEffect(() => {
    if (editorState.isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = undefined;
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [editorState.isPlaying, animate]);

  useEffect(() => {
    project.layers.forEach(layer => {
      if (layer.type === 'audio') {
        let audio = audioRefs.current.get(layer.id);
        if (!audio || audio.src !== layer.content) {
          if (audio) audio.pause();
          audio = new Audio(layer.content);
          audio.preload = "auto";
          audioRefs.current.set(layer.id, audio);
        }
        audio.volume = layer.volume !== undefined ? layer.volume : 1;
        const relativeTime = editorState.currentTime - layer.start;
        const isActive = relativeTime >= 0 && relativeTime < layer.duration;
        if (isActive && editorState.isPlaying) {
          if (audio.paused) {
            audio.currentTime = relativeTime;
            audio.play().catch(e => console.warn("Audio blocked:", e));
          } else if (Math.abs(audio.currentTime - relativeTime) > 0.2) {
            audio.currentTime = relativeTime;
          }
        } else {
          if (!audio.paused) audio.pause();
          if (relativeTime < 0) audio.currentTime = 0;
        }
      }
    });
    const currentLayerIds = new Set(project.layers.map(l => l.id));
    for (const [id, audio] of audioRefs.current.entries()) {
      if (!currentLayerIds.has(id)) {
        audio.pause();
        audio.src = "";
        audioRefs.current.delete(id);
      }
    }
  }, [editorState.currentTime, editorState.isPlaying, project.layers]);

  const calculateAutoZoom = useCallback(() => {
    const sidebarWidth = sidebarCollapsed ? 64 : 320;
    const propertiesWidth = 320;
    const timelineHeight = 256;
    const headerHeight = 56;
    const padding = 60; 
    const availW = window.innerWidth - sidebarWidth - propertiesWidth - padding;
    const availH = window.innerHeight - headerHeight - timelineHeight - padding;
    
    const zoomW = availW / project.width;
    const zoomH = availH / project.height;
    return Math.min(zoomW, zoomH, 1.0); 
  }, [sidebarCollapsed, project.width, project.height]);

  useEffect(() => {
    if (!isFullScreen) {
      const handleResize = () => setEditorState(prev => ({ ...prev, zoom: calculateAutoZoom() }));
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [sidebarCollapsed, project.width, project.height, isFullScreen, calculateAutoZoom]);

  const handleZoomChange = (newZoom: number) => {
    if (newZoom === 0) {
      setEditorState(prev => ({ ...prev, zoom: calculateAutoZoom() }));
    } else {
      setEditorState(prev => ({ ...prev, zoom: newZoom }));
    }
  };

  const handleAddLayer = (type: LayerType, content?: string, script?: string, voiceId?: string) => {
    const newLayer: Layer = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      x: project.width / 2 - 250,
      y: project.height / 2 - 150,
      width: type === 'text' ? 800 : 500,
      height: type === 'text' ? 200 : 500,
      opacity: 1,
      rotation: 0,
      content: content || (type === 'image' ? 'https://picsum.photos/seed/creato/1080/1080' : ''),
      start: editorState.currentTime,
      duration: type === 'audio' ? 5 : 10,
      zIndex: project.layers.length > 0 ? Math.max(...project.layers.map(l => l.zIndex)) + 1 : 1,
      volume: 1,
      script: script || '',
      voiceId: voiceId,
      ...(type === 'text' ? { fontSize: 80, fontWeight: '900', color: '#ffffff' } : {}),
      ...(type === 'shape' ? { fill: '#3b82f6' } : {}),
    };
    if ((type === 'video' || type === 'audio') && content) {
      const tempMedia = type === 'video' ? document.createElement('video') : new Audio();
      tempMedia.src = content;
      tempMedia.onloadedmetadata = () => handleUpdateLayer(newLayer.id, { duration: tempMedia.duration });
    }
    setProject(prev => ({ ...prev, layers: [...prev.layers, newLayer] }));
    setEditorState(prev => ({ ...prev, selectedLayerId: newLayer.id }));
  };

  const handleUpdateLayer = (layerId: string, updates: Partial<Layer>) => {
    setProject(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === layerId ? { ...l, ...updates } : l)
    }));
  };

  const handleDeleteLayer = (layerId: string) => {
    setProject(prev => ({ ...prev, layers: prev.layers.filter(l => l.id !== layerId) }));
    setEditorState(prev => ({ ...prev, selectedLayerId: null }));
  };

  const handleDuplicateLayer = (layerId: string) => {
    const layer = project.layers.find(l => l.id === layerId);
    if (!layer) return;
    const newLayer: Layer = {
      ...layer,
      id: Math.random().toString(36).substr(2, 9),
      name: `${layer.name} (Copy)`,
      x: layer.x + 50, y: layer.y + 50,
      zIndex: Math.max(...project.layers.map(l => l.zIndex)) + 1,
    };
    setProject(prev => ({ ...prev, layers: [...prev.layers, newLayer] }));
    setEditorState(prev => ({ ...prev, selectedLayerId: newLayer.id }));
  };

  const handleGenerateAI = async (prompt: string) => {
    try {
      setIsGenerating(true);
      if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
      }
      const videoUrl = await GeminiService.generateVideo(prompt, '9:16');
      handleAddLayer('video', videoUrl);
    } catch (err: any) {
      alert("AI Generation Error: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedLayer = project.layers.find(l => l.id === editorState.selectedLayerId) || null;

  return (
    <div className="flex flex-col h-screen bg-[#050505] overflow-hidden text-zinc-100 font-sans selection:bg-blue-500/30">
      <Header 
        isPlaying={editorState.isPlaying}
        isFullScreen={isFullScreen}
        onTogglePlay={() => setEditorState(p => ({ ...p, isPlaying: !p.isPlaying }))}
        onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
        onRender={() => alert("Ready for Render with API Bridge")}
        onShowApiModal={() => setShowApiModal(true)}
        projectName={project.name}
        onOpenKeySelector={() => window.aistudio?.openSelectKey()}
      />
      
      <div className="flex-1 flex overflow-hidden relative">
        {!isFullScreen && (
          <Sidebar 
            layers={project.layers}
            projectApiKey={project.elevenLabsApiKey}
            onAddLayer={handleAddLayer}
            onUpdateLayer={handleUpdateLayer}
            onDeleteLayer={handleDeleteLayer}
            onSelectLayer={(id) => setEditorState(prev => ({ ...prev, selectedLayerId: id }))}
            selectedLayerId={editorState.selectedLayerId}
            onGenerateAI={handleGenerateAI}
            isGenerating={isGenerating}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            onUpdateProjectApiKey={(key) => setProject(p => ({ ...p, elevenLabsApiKey: key }))}
          />
        )}
        
        <main className={`flex-1 flex flex-col min-w-0 overflow-hidden relative transition-all duration-500 ease-in-out ${isFullScreen ? 'fixed inset-0 z-[100] bg-black' : 'bg-[#09090b]'}`}>
          <div className="flex-1 overflow-hidden relative flex flex-col">
            <Canvas 
              layers={project.layers}
              currentTime={editorState.currentTime}
              isPlaying={editorState.isPlaying}
              isFullScreen={isFullScreen}
              width={project.width}
              height={project.height}
              selectedLayerId={editorState.selectedLayerId}
              onSelectLayer={(id) => setEditorState(prev => ({ ...prev, selectedLayerId: id }))}
              onUpdateLayer={handleUpdateLayer}
              zoom={editorState.zoom}
              onLayerContextMenu={(e, id) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, layerId: id });
              }}
              onTogglePlay={() => setEditorState(p => ({ ...p, isPlaying: !p.isPlaying }))}
              onExitFullScreen={() => setIsFullScreen(false)}
              onZoomChange={handleZoomChange}
            />
          </div>
          
          {!isFullScreen && (
            <Timeline 
              layers={project.layers}
              currentTime={editorState.currentTime}
              duration={project.duration}
              onTimeChange={(time) => setEditorState(prev => ({ ...prev, currentTime: time }))}
              onLayerUpdate={handleUpdateLayer}
              selectedLayerId={editorState.selectedLayerId}
              onSelectLayer={(id) => setEditorState(prev => ({ ...prev, selectedLayerId: id }))}
              onLayerContextMenu={(e, id) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, layerId: id });
              }}
            />
          )}
        </main>
        
        {!isFullScreen && (
          <PropertiesPanel 
            layer={selectedLayer}
            project={project}
            onUpdateProject={(updates) => setProject(p => ({ ...p, ...updates }))}
            onUpdate={(updates) => editorState.selectedLayerId && handleUpdateLayer(editorState.selectedLayerId, updates)}
            onDelete={handleDeleteLayer}
          />
        )}
      </div>

      {contextMenu && !isFullScreen && (
        <ContextMenu 
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onDelete={() => handleDeleteLayer(contextMenu.layerId)}
          onDuplicate={() => handleDuplicateLayer(contextMenu.layerId)}
          onBringToFront={() => editorState.selectedLayerId && handleUpdateLayer(editorState.selectedLayerId, { zIndex: Math.max(...project.layers.map(l => l.zIndex)) + 1 })}
          onSendToBack={() => editorState.selectedLayerId && handleUpdateLayer(editorState.selectedLayerId, { zIndex: Math.min(...project.layers.map(l => l.zIndex)) - 1 })}
        />
      )}

      {showApiModal && (
        <ExportModal project={project} onClose={() => setShowApiModal(false)} />
      )}

      {isGenerating && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 px-8 py-5 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-[0_0_100px_rgba(59,130,246,0.3)] flex items-center gap-5 z-[200] animate-in slide-in-from-bottom-10">
           <div className="relative">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                 <Sparkles size={16} className="text-blue-500" />
              </div>
           </div>
           <div>
              <p className="text-sm font-black text-white uppercase tracking-widest">Generating AI Scene</p>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">Powered by Google Veo 3.1 & Gemini 3 Pro</p>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
