
import React, { useRef, useState, useEffect } from 'react';
import { Clock, ZoomIn, ZoomOut, Volume2, Video as VideoIcon, Type as TypeIcon, Box, GripHorizontal } from 'lucide-react';
import { Layer } from '../types';
import { PIXELS_PER_SECOND } from '../constants';

interface TimelineProps {
  layers: Layer[];
  currentTime: number;
  duration: number;
  onTimeChange: (time: number) => void;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onLayerContextMenu: (e: React.MouseEvent, id: string) => void;
}

const Timeline: React.FC<TimelineProps> = ({
  layers,
  currentTime,
  duration,
  onTimeChange,
  onLayerUpdate,
  selectedLayerId,
  onSelectLayer,
  onLayerContextMenu
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineWidth = Math.max(duration * PIXELS_PER_SECOND, 1000);
  
  const [dragInfo, setDragInfo] = useState<{
    layerId: string;
    type: 'move' | 'trim-start' | 'trim-end';
    startX: number;
    initialStart: number;
    initialDuration: number;
  } | null>(null);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (dragInfo || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const time = Math.max(0, Math.min(duration, x / PIXELS_PER_SECOND));
    onTimeChange(time);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const getLayerIcon = (type: string) => {
    switch (type) {
      case 'audio': return <Volume2 size={12} />;
      case 'video': return <VideoIcon size={12} />;
      case 'text': return <TypeIcon size={12} />;
      default: return <Box size={12} />;
    }
  };

  const startDragging = (e: React.MouseEvent, layer: Layer, type: 'move' | 'trim-start' | 'trim-end') => {
    e.stopPropagation();
    onSelectLayer(layer.id);
    setDragInfo({
      layerId: layer.id,
      type,
      startX: e.clientX,
      initialStart: layer.start,
      initialDuration: layer.duration
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragInfo) return;

      const dx = (e.clientX - dragInfo.startX) / PIXELS_PER_SECOND;
      
      if (dragInfo.type === 'move') {
        const newStart = Math.max(0, Math.min(duration - dragInfo.initialDuration, dragInfo.initialStart + dx));
        onLayerUpdate(dragInfo.layerId, { start: newStart });
      } 
      else if (dragInfo.type === 'trim-start') {
        const newStart = Math.max(0, Math.min(dragInfo.initialStart + dragInfo.initialDuration - 0.1, dragInfo.initialStart + dx));
        const newDuration = dragInfo.initialDuration - (newStart - dragInfo.initialStart);
        onLayerUpdate(dragInfo.layerId, { start: newStart, duration: newDuration });
      } 
      else if (dragInfo.type === 'trim-end') {
        const newDuration = Math.max(0.1, Math.min(duration - dragInfo.initialStart, dragInfo.initialDuration + dx));
        onLayerUpdate(dragInfo.layerId, { duration: newDuration });
      }
    };

    const handleMouseUp = () => {
      setDragInfo(null);
    };

    if (dragInfo) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragInfo, duration, onLayerUpdate]);

  const ticks = [];
  for (let i = 0; i <= duration; i++) ticks.push(i);

  return (
    <div className="h-64 border-t border-zinc-800 bg-zinc-950 flex flex-col select-none overflow-hidden">
      <div className="h-10 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock size={14} />
            <span className="text-[11px] font-mono tabular-nums">{formatTime(currentTime)}</span>
            <span className="text-[11px] text-zinc-600">/</span>
            <span className="text-[11px] text-zinc-600 font-mono">{formatTime(duration)}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">Drag edges to trim duration • Drag center to move</span>
           </div>
           <div className="flex items-center gap-2">
            <ZoomOut size={14} className="text-zinc-500" />
            <div className="w-24 h-1 bg-zinc-800 rounded-full relative">
              <div className="absolute top-0 left-0 w-1/2 h-full bg-blue-600 rounded-full" />
            </div>
            <ZoomIn size={14} className="text-zinc-500" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-48 border-r border-zinc-800 bg-zinc-900/30 overflow-y-auto shrink-0 scrollbar-none">
          {layers.map((layer) => (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              onContextMenu={(e) => onLayerContextMenu(e, layer.id)}
              className={`h-12 border-b border-zinc-800/50 px-3 flex items-center gap-3 cursor-pointer transition-colors ${
                selectedLayerId === layer.id ? 'bg-blue-600/10 text-blue-400' : 'hover:bg-zinc-800/50 text-zinc-400'
              }`}
            >
              <div className="opacity-30"><GripHorizontal size={10} /></div>
              {getLayerIcon(layer.type)}
              <span className="text-[10px] font-black uppercase tracking-wider truncate">{layer.name}</span>
            </div>
          ))}
        </div>

        <div 
          ref={containerRef}
          onClick={handleTimelineClick}
          className="flex-1 overflow-x-auto overflow-y-auto bg-[#070708] relative scroll-smooth custom-scrollbar"
        >
          <div className="h-6 border-b border-zinc-800/50 bg-zinc-900/20 sticky top-0 z-20" style={{ width: timelineWidth }}>
            {ticks.map((i) => (
              i % 5 === 0 && (
                <div key={i} className="absolute top-0 flex flex-col items-center" style={{ left: i * PIXELS_PER_SECOND }}>
                  <div className="h-2 w-px bg-zinc-700" />
                  <span className="text-[8px] text-zinc-600 mt-0.5">{i}s</span>
                </div>
              )
            ))}
          </div>

          <div className="absolute inset-0 pointer-events-none" style={{ 
            width: timelineWidth,
            backgroundImage: `linear-gradient(to right, #18181b 1px, transparent 1px)`,
            backgroundSize: `${PIXELS_PER_SECOND}px 100%`
          }} />

          <div className="relative min-h-full" style={{ width: timelineWidth }}>
            {layers.map((layer) => (
              <div 
                key={layer.id} 
                className="h-12 border-b border-zinc-900/30 relative"
                onContextMenu={(e) => onLayerContextMenu(e, layer.id)}
              >
                <div
                  onMouseDown={(e) => startDragging(e, layer, 'move')}
                  className={`absolute h-8 top-2 rounded-lg shadow-2xl flex items-center px-2 border transition-all cursor-grab active:cursor-grabbing overflow-visible group ${
                    selectedLayerId === layer.id 
                      ? 'bg-blue-600 border-blue-400 text-white z-10 scale-[1.01]' 
                      : layer.type === 'audio' 
                        ? 'bg-purple-600/40 border-purple-500/50 text-purple-200'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                  } ${dragInfo?.layerId === layer.id ? 'opacity-80' : ''}`}
                  style={{
                    left: layer.start * PIXELS_PER_SECOND,
                    width: layer.duration * PIXELS_PER_SECOND,
                  }}
                >
                  {/* Left Trim Handle */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/20 rounded-l-lg z-20"
                    onMouseDown={(e) => startDragging(e, layer, 'trim-start')}
                  >
                    <div className="absolute left-0.5 top-2 bottom-2 w-0.5 bg-white/40 rounded-full" />
                  </div>

                  <div className="flex items-center gap-2 min-w-0 px-1 pointer-events-none flex-1 overflow-hidden">
                    {getLayerIcon(layer.type)}
                    <span className="text-[10px] font-black uppercase truncate tracking-tight">
                      {layer.name}
                    </span>
                  </div>

                  {/* Right Trim Handle */}
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/20 rounded-r-lg z-20"
                    onMouseDown={(e) => startDragging(e, layer, 'trim-end')}
                  >
                    <div className="absolute right-0.5 top-2 bottom-2 w-0.5 bg-white/40 rounded-full" />
                  </div>
                </div>
              </div>
            ))}

            <div
              className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
              style={{ left: currentTime * PIXELS_PER_SECOND }}
            >
              <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 -mt-1.5 shadow-[0_0_10px_rgba(239,68,68,1)]" />
              <div className="absolute top-0 bottom-0 w-4 -ml-2 bg-red-500/10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
