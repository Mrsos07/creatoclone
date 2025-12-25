
import React from 'react';
import { Play, Pause, Download, Sparkles, Key, Code, Maximize2 } from 'lucide-react';

interface HeaderProps {
  isPlaying: boolean;
  isFullScreen: boolean;
  onTogglePlay: () => void;
  onToggleFullScreen: () => void;
  onRender: () => void;
  onShowApiModal: () => void;
  projectName: string;
  onOpenKeySelector: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  isPlaying, 
  isFullScreen,
  onTogglePlay, 
  onToggleFullScreen,
  onRender, 
  onShowApiModal,
  projectName, 
  onOpenKeySelector 
}) => {
  if (isFullScreen) return null;

  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between px-4 z-50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight hidden md:block">CreatoClone <span className="text-blue-500">AI</span></span>
        </div>
        <div className="h-6 w-px bg-zinc-800 mx-2" />
        <span className="text-sm font-medium text-zinc-400 truncate max-w-[150px]">{projectName}</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onTogglePlay}
          className="p-3 hover:bg-zinc-800 rounded-full transition-all text-zinc-100 hover:scale-110 active:scale-95"
        >
          {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button 
          onClick={onToggleFullScreen}
          className="p-2 hover:bg-zinc-800 rounded-md transition-all text-zinc-400 hover:text-white"
          title="Full Screen (F)"
        >
          <Maximize2 size={18} />
        </button>
        
        <div className="h-6 w-px bg-zinc-800 mx-1" />

        <button 
          onClick={onShowApiModal}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-all"
        >
          <Code size={14} className="text-blue-500" />
          <span className="hidden sm:inline">Export API</span>
        </button>

        <button 
          onClick={onOpenKeySelector}
          className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all border border-transparent hover:border-zinc-700"
          title="AI Settings"
        >
          <Key size={18} />
        </button>
        
        <button 
          onClick={onRender}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-500/20 transition-all active:scale-95"
        >
          <Download size={14} />
          Render
        </button>
      </div>
    </header>
  );
};

export default Header;
