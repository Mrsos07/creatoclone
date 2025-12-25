
import React, { useRef, useEffect, useState } from 'react';
import { Layer } from '../types';
import { Play, Pause, X, RotateCw, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface CanvasProps {
  layers: Layer[];
  currentTime: number;
  isPlaying: boolean;
  isFullScreen: boolean;
  width: number;
  height: number;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  zoom: number;
  onLayerContextMenu: (e: React.MouseEvent, id: string) => void;
  onTogglePlay: () => void;
  onExitFullScreen: () => void;
  onZoomChange?: (newZoom: number) => void;
}

const VideoLayer: React.FC<{ 
  layer: Layer; 
  currentTime: number; 
  isPlaying: boolean; 
  style: React.CSSProperties;
}> = ({ layer, currentTime, isPlaying, style }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = layer.volume !== undefined ? layer.volume : 1;
    const relativeTime = currentTime - layer.start;
    const isActive = relativeTime >= 0 && relativeTime <= layer.duration;

    if (isActive) {
      if (Math.abs(video.currentTime - relativeTime) > 0.15) {
        video.currentTime = relativeTime;
      }
      if (isPlaying && video.paused) {
        video.play().catch(() => {});
      } else if (!isPlaying && !video.paused) {
        video.pause();
      }
    } else {
      if (!video.paused) video.pause();
    }
  }, [currentTime, isPlaying, layer.start, layer.duration, layer.volume]);

  return (
    <video
      ref={videoRef}
      src={layer.content}
      style={{ ...style, objectFit: 'cover', pointerEvents: 'none' }}
      playsInline
      muted={layer.volume === 0}
    />
  );
};

const Canvas: React.FC<CanvasProps> = ({ 
  layers, 
  currentTime, 
  isPlaying,
  isFullScreen,
  width, 
  height, 
  selectedLayerId, 
  onSelectLayer,
  onUpdateLayer,
  zoom,
  onLayerContextMenu,
  onTogglePlay,
  onExitFullScreen,
  onZoomChange
}) => {
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize' | 'rotate';
    handle?: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
    initialRotation: number;
  } | null>(null);

  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPlayIcon, setShowPlayIcon] = useState(false);

  useEffect(() => {
    setShowPlayIcon(true);
    const timer = setTimeout(() => setShowPlayIcon(false), 800);
    return () => clearTimeout(timer);
  }, [isPlaying]);

  const activeLayers = layers
    .filter(l => currentTime >= l.start && currentTime <= l.start + l.duration)
    .sort((a, b) => a.zIndex - b.zIndex);

  const handleMouseDown = (e: React.MouseEvent, layer: Layer, type: 'move' | 'resize' | 'rotate', handle?: string) => {
    if (isFullScreen) return;
    e.stopPropagation();
    onSelectLayer(layer.id);
    setDragState({
      type,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initialX: layer.x,
      initialY: layer.y,
      initialW: layer.width,
      initialH: layer.height,
      initialRotation: layer.rotation || 0
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragState || !selectedLayerId || isFullScreen) return;

    const dx = (e.clientX - dragState.startX) / zoom;
    const dy = (e.clientY - dragState.startY) / zoom;

    if (dragState.type === 'move') {
      onUpdateLayer(selectedLayerId, {
        x: Math.round(dragState.initialX + dx),
        y: Math.round(dragState.initialY + dy)
      });
    } else if (dragState.type === 'resize' && dragState.handle) {
      let updates: Partial<Layer> = {};
      if (dragState.handle.includes('e')) updates.width = Math.max(10, dragState.initialW + dx);
      if (dragState.handle.includes('s')) updates.height = Math.max(10, dragState.initialH + dy);
      if (dragState.handle.includes('w')) {
        const newW = Math.max(10, dragState.initialW - dx);
        updates.width = newW;
        updates.x = dragState.initialX + (dragState.initialW - newW);
      }
      if (dragState.handle.includes('n')) {
        const newH = Math.max(10, dragState.initialH - dy);
        updates.height = newH;
        updates.y = dragState.initialY + (dragState.initialH - newH);
      }
      onUpdateLayer(selectedLayerId, updates);
    } else if (dragState.type === 'rotate') {
      const layer = layers.find(l => l.id === selectedLayerId);
      if (layer) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const centerX = (layer.x + layer.width / 2) * zoom + rect.left;
          const centerY = (layer.y + layer.height / 2) * zoom + rect.top;
          const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI) + 90;
          onUpdateLayer(selectedLayerId, { rotation: Math.round(angle) });
        }
      }
    }
  };

  const handleMouseUp = () => setDragState(null);

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, selectedLayerId, zoom]);

  const renderLayer = (layer: Layer) => {
    const isSelected = selectedLayerId === layer.id && !isFullScreen;
    const isHovered = hoveredLayerId === layer.id && !isSelected && !isFullScreen;
    
    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${layer.x * zoom}px`,
      top: `${layer.y * zoom}px`,
      width: `${layer.width * zoom}px`,
      height: `${layer.height * zoom}px`,
      opacity: layer.opacity,
      transform: `rotate(${layer.rotation}deg)`,
      zIndex: layer.zIndex,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: isFullScreen ? 'default' : (dragState ? 'grabbing' : 'move'),
      boxSizing: 'border-box',
      userSelect: 'none',
      transition: dragState ? 'none' : 'transform 0.1s ease-out',
      outline: isHovered ? '3px solid rgba(59, 130, 246, 0.6)' : 'none',
      outlineOffset: '2px'
    };

    const commonProps = {
      onMouseDown: (e: React.MouseEvent) => handleMouseDown(e, layer, 'move'),
      onMouseEnter: () => setHoveredLayerId(layer.id),
      onMouseLeave: () => setHoveredLayerId(null),
      onContextMenu: (e: React.MouseEvent) => !isFullScreen && onLayerContextMenu(e, layer.id)
    };

    let content;
    switch (layer.type) {
      case 'text':
        content = (
          <div 
            style={{
              color: layer.color || '#fff', 
              fontSize: `${(layer.fontSize || 32) * zoom}px`, 
              fontWeight: layer.fontWeight || 'bold', 
              textAlign: 'center',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1.2,
              wordBreak: 'break-word',
              padding: '10px'
            }}
          >
            {layer.content}
          </div>
        );
        break;
      case 'shape':
        content = <div style={{ backgroundColor: layer.fill || '#3b82f6', borderRadius: '4px', width: '100%', height: '100%' }} />;
        break;
      case 'image':
        content = <img src={layer.content} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} draggable={false} />;
        break;
      case 'video':
        content = <VideoLayer layer={layer} currentTime={currentTime} isPlaying={isPlaying} style={{ width: '100%', height: '100%' }} />;
        break;
      default:
        content = null;
    }

    return (
      <div key={layer.id} style={style} {...commonProps}>
        {content}
        {isSelected && (
          <>
            <div className="absolute inset-0 border-[3px] border-blue-500 pointer-events-none shadow-[0_0_30px_rgba(59,130,246,0.5)]" />
            
            {/* مقابض التحجيم المحسنة للضغط */}
            {['nw', 'ne', 'sw', 'se'].map(h => (
              <div
                key={h}
                className={`absolute w-6 h-6 bg-white border-2 border-blue-600 rounded-lg z-[100] cursor-${h}-resize shadow-xl hover:scale-125 transition-transform flex items-center justify-center`}
                style={{
                  top: h.includes('n') ? -12 : 'auto',
                  bottom: h.includes('s') ? -12 : 'auto',
                  left: h.includes('w') ? -12 : 'auto',
                  right: h.includes('e') ? -12 : 'auto',
                }}
                onMouseDown={(e) => handleMouseDown(e, layer, 'resize', h)}
              >
                <div className="w-2 h-2 bg-blue-600 rounded-sm" />
              </div>
            ))}

            <div 
              className="absolute -top-16 left-1/2 -translate-x-1/2 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center cursor-alias shadow-2xl hover:bg-blue-500 transition-colors border-2 border-white/20"
              onMouseDown={(e) => handleMouseDown(e, layer, 'rotate')}
            >
              <RotateCw size={18} className="text-white" />
              <div className="absolute top-10 w-0.5 h-6 bg-blue-600" />
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div 
      className={`flex-1 flex items-center justify-center overflow-hidden relative transition-all duration-500 ease-in-out ${isFullScreen ? 'bg-black fixed inset-0 z-[100]' : 'bg-[#050505] p-2 md:p-8 lg:p-12'}`}
      onClick={(e) => {
        if (isFullScreen) onTogglePlay();
        else onSelectLayer(null);
      }}
      ref={containerRef}
    >
      {!isFullScreen && (
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      )}

      <div 
        style={{
          width: `${width * zoom}px`,
          height: `${height * zoom}px`,
          backgroundColor: '#000',
          position: 'relative',
          boxShadow: isFullScreen ? 'none' : '0 60px 150px -40px rgba(0, 0, 0, 1), 0 0 1px 1px rgba(255,255,255,0.05)',
          overflow: 'hidden',
          transition: dragState ? 'none' : 'width 0.5s cubic-bezier(0.2, 0, 0.2, 1), height 0.5s cubic-bezier(0.2, 0, 0.2, 1)'
        }}
      >
        {activeLayers.map(renderLayer)}
      </div>

      {!isFullScreen && (
        <div className="absolute bottom-8 right-8 flex items-center gap-2 p-1.5 bg-[#121214]/90 backdrop-blur-2xl border border-zinc-800 rounded-2xl shadow-2xl z-[150] animate-in slide-in-from-bottom-6">
          <button 
            onClick={(e) => { e.stopPropagation(); onZoomChange?.(Math.max(0.05, zoom - 0.05)); }}
            className="p-2.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all active:scale-90"
          >
            <ZoomOut size={18} />
          </button>
          <div className="px-4 min-w-[70px] text-center border-x border-zinc-800">
            <span className="text-xs font-black text-zinc-300 tabular-nums">{Math.round(zoom * 100)}%</span>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onZoomChange?.(Math.min(3, zoom + 0.05)); }}
            className="p-2.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all active:scale-90"
          >
            <ZoomIn size={18} />
          </button>
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          <button 
            onClick={(e) => { e.stopPropagation(); onZoomChange?.(0); }} 
            className="p-2.5 hover:bg-blue-600/10 text-blue-500 hover:text-blue-400 rounded-xl transition-all active:scale-90"
            title="Auto-Fit Fullsize"
          >
            <Maximize size={16} />
          </button>
        </div>
      )}

      {isFullScreen && (
        <button 
          onClick={(e) => { e.stopPropagation(); onExitFullScreen(); }}
          className="absolute top-12 right-12 p-5 bg-white/5 hover:bg-white/10 text-white rounded-full backdrop-blur-3xl transition-all z-[110] border border-white/10 active:scale-90 shadow-2xl group"
        >
          <X size={32} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}
    </div>
  );
};

export default Canvas;
