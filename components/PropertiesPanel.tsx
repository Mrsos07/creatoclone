
import React from 'react';
import { Layer, Project } from '../types';
import { Settings, Trash2, Layout, Volume2, ScrollText, Maximize2, Monitor, Smartphone, Instagram, Key, Mic, Fingerprint } from 'lucide-react';
import { ARABIC_VOICES } from './Sidebar';

interface PropertiesPanelProps {
  layer: Layer | null;
  project: Project;
  onUpdateProject: (updates: Partial<Project>) => void;
  onUpdate: (updates: Partial<Layer>) => void;
  onDelete: (id: string) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ layer, project, onUpdateProject, onUpdate, onDelete }) => {
  const PRESETS = [
    { name: 'Full HD Vertical', w: 1080, h: 1920, icon: Smartphone, label: '9:16 - TikTok/Reels' },
    { name: '4K Ultra HD', w: 3840, h: 2160, icon: Monitor, label: '16:9 - Cinematic' },
    { name: 'Full HD Landscape', w: 1920, h: 1080, icon: Monitor, label: '16:9 - YouTube' },
    { name: 'Social Square', w: 1080, h: 1080, icon: Instagram, label: '1:1 - Post' },
    { name: '2K QHD', w: 2560, h: 1440, icon: Monitor, label: 'High Quality' },
  ];

  const handleVoicePresetChange = (id: string) => {
    if (id !== 'custom') {
      onUpdate({ voiceId: id });
    }
  };

  const renderProjectSettings = () => (
    <div className="p-5 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-2">
        <Layout size={16} className="text-blue-500" />
        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Project Canvas</h3>
      </div>
      
      <section className="space-y-3">
        <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] block">Fullsize Presets</label>
        <div className="space-y-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => onUpdateProject({ width: p.w, height: p.h })}
              className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center gap-4 group ${
                project.width === p.w && project.height === p.h 
                ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20' 
                : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30'
              }`}
            >
              <div className={`p-2 rounded-xl border transition-colors ${
                project.width === p.w && project.height === p.h ? 'bg-blue-600 border-blue-400' : 'bg-zinc-800 border-zinc-700'
              }`}>
                <p.icon size={16} className={project.width === p.w ? 'text-white' : 'text-zinc-500'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-black truncate uppercase ${project.width === p.w ? 'text-blue-400' : 'text-zinc-200'}`}>{p.name}</p>
                <p className="text-[9px] text-zinc-600 font-bold mt-0.5">{p.label}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/50 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Width</label>
            <input 
              type="number" 
              value={project.width} 
              onChange={(e) => onUpdateProject({ width: parseInt(e.target.value) || 0 })} 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:border-blue-500/50 focus:outline-none" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Height</label>
            <input 
              type="number" 
              value={project.height} 
              onChange={(e) => onUpdateProject({ height: parseInt(e.target.value) || 0 })} 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:border-blue-500/50 focus:outline-none" 
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Scene Length (sec)</label>
          <div className="relative">
            <input 
              type="number" 
              value={project.duration} 
              onChange={(e) => onUpdateProject({ duration: Math.max(1, parseInt(e.target.value) || 1) })} 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:border-blue-500/50 focus:outline-none pr-10" 
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-black">S</span>
          </div>
        </div>
      </section>

      <section className="p-4 bg-purple-600/5 rounded-2xl border border-purple-500/20 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Key size={14} className="text-purple-400" />
          <h4 className="text-[9px] font-black uppercase tracking-widest text-purple-300">Automation Settings</h4>
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">ElevenLabs API Key</label>
          <input 
            type="password" 
            value={project.elevenLabsApiKey || ''} 
            onChange={(e) => {
              onUpdateProject({ elevenLabsApiKey: e.target.value });
              localStorage.setItem('elevenlabs_key', e.target.value);
            }} 
            placeholder="sk_..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:border-purple-500/50 focus:outline-none" 
          />
          <p className="text-[8px] text-zinc-600 font-bold leading-tight uppercase tracking-tighter italic">This key is saved in the template for n8n automation</p>
        </div>
      </section>
    </div>
  );

  if (!layer) {
    return (
      <aside className="w-80 border-l border-zinc-800 bg-[#0c0c0e] flex flex-col overflow-y-auto custom-scrollbar z-40 shadow-[-10px_0_30px_rgba(0,0,0,0.3)]">
        {renderProjectSettings()}
        <div className="mt-auto p-10 flex flex-col items-center justify-center text-center opacity-30 select-none">
          <Settings size={32} className="text-zinc-600 mb-4 animate-spin-slow" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Selection Required</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 border-l border-zinc-800 bg-[#0c0c0e] flex flex-col overflow-y-auto custom-scrollbar z-40 shadow-[-10px_0_30px_rgba(0,0,0,0.3)]">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-[#0c0c0e]/95 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
            <Settings size={16} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-200">Properties</h3>
        </div>
        <button onClick={() => onDelete(layer.id)} className="p-2 hover:bg-red-500/10 text-zinc-600 hover:text-red-500 rounded-xl transition-all"><Trash2 size={16} /></button>
      </div>

      <div className="p-5 space-y-8 pb-20">
        <section className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Layer Title</label>
            <input type="text" value={layer.name} onChange={(e) => onUpdate({ name: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-blue-500/50 focus:outline-none shadow-inner" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <PropertyField label="Position X" value={layer.x} onChange={(val) => onUpdate({ x: parseInt(val) })} />
            <PropertyField label="Position Y" value={layer.y} onChange={(val) => onUpdate({ y: parseInt(val) })} />
            <PropertyField label="Width" value={layer.width} onChange={(val) => onUpdate({ width: parseInt(val) })} />
            <PropertyField label="Height" value={layer.height} onChange={(val) => onUpdate({ height: parseInt(val) })} />
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
               <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Opacity</label>
               <span className="text-[9px] font-mono text-zinc-400">{Math.round(layer.opacity * 100)}%</span>
            </div>
            <input type="range" min="0" max="1" step="0.01" value={layer.opacity} onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })} className="w-full accent-blue-600 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer" />
          </div>
        </section>

        {layer.type === 'text' && (
          <section className="space-y-4 pt-6 border-t border-zinc-800">
            <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Text Content</label>
            <textarea value={layer.content} onChange={(e) => onUpdate({ content: e.target.value })} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white h-24 focus:border-blue-500/50 focus:outline-none resize-none" dir="auto" />
            <div className="grid grid-cols-2 gap-4">
               <PropertyField label="Font Size" value={layer.fontSize || 32} onChange={(val) => onUpdate({ fontSize: parseInt(val) })} />
               <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Color</label>
                  <div className="flex items-center gap-2 p-2 bg-zinc-900 border border-zinc-800 rounded-xl">
                    <input type="color" value={layer.color || '#ffffff'} onChange={(e) => onUpdate({ color: e.target.value })} className="w-6 h-6 rounded-lg bg-transparent border-none cursor-pointer" />
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">{layer.color || '#ffffff'}</span>
                  </div>
               </div>
            </div>
          </section>
        )}

        {(layer.type === 'video' || layer.type === 'audio') && (
           <section className="space-y-5 pt-6 border-t border-zinc-800">
             <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 size={14} className="text-zinc-500" />
                    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Volume</label>
                  </div>
                  <span className="text-[9px] font-mono text-zinc-400">{Math.round((layer.volume || 0) * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.01" value={layer.volume || 0} onChange={(e) => onUpdate({ volume: parseFloat(e.target.value) })} className="w-full accent-blue-500 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer" />
             </div>
             
             {layer.type === 'audio' && (
               <div className="space-y-4 pt-2">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Mic size={14} className="text-purple-500" />
                      <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-purple-400">Voice Selection</label>
                    </div>
                    <select 
                      value={ARABIC_VOICES.some(v => v.id === layer.voiceId) ? layer.voiceId : 'custom'} 
                      onChange={(e) => handleVoicePresetChange(e.target.value)} 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-purple-500/50 focus:outline-none cursor-pointer"
                    >
                      {ARABIC_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      <option value="custom">Manual Voice ID</option>
                    </select>
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                         <Fingerprint size={12} className="text-zinc-600" />
                         <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Voice ID</label>
                      </div>
                      <input 
                        type="text" 
                        value={layer.voiceId || ''} 
                        onChange={(e) => onUpdate({ voiceId: e.target.value })} 
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:border-purple-500/50 focus:outline-none font-mono" 
                        placeholder="Paste Voice ID here..."
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ScrollText size={14} className="text-purple-500" />
                      <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-purple-400">Audio Script</label>
                    </div>
                    <textarea 
                      value={layer.script || ''}
                      onChange={(e) => onUpdate({ script: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-300 h-32 focus:border-purple-500/50 focus:outline-none resize-none leading-relaxed"
                      dir="auto"
                      placeholder="The script used for this voiceover..."
                    />
                    <p className="text-[8px] text-zinc-600 font-bold leading-tight bg-zinc-900 p-2 rounded-lg border border-zinc-800 uppercase tracking-tighter italic">Editable for n8n API automation</p>
                  </div>
               </div>
             )}
           </section>
        )}

        <section className="space-y-4 pt-6 border-t border-zinc-800">
           <div className="flex items-center gap-2 mb-2">
             <Maximize2 size={14} className="text-zinc-500" />
             <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Timeline Alignment</label>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <PropertyField label="Starts at" value={layer.start} suffix="s" onChange={(val) => onUpdate({ start: parseFloat(val) })} />
              <PropertyField label="Duration" value={layer.duration} suffix="s" onChange={(val) => onUpdate({ duration: parseFloat(val) })} />
           </div>
        </section>
      </div>
    </aside>
  );
};

const PropertyField = ({ label, value, onChange, suffix = '' }: any) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{label}</label>
    <div className="relative">
      <input 
        type="number" 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:border-blue-500/50 focus:outline-none shadow-inner" 
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-bold uppercase">{suffix}</span>}
    </div>
  </div>
);

export default PropertiesPanel;
