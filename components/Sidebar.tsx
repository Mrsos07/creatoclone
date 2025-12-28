
import React, { useState, useRef } from 'react';
import { 
  Type, Square, Image as ImageIcon, Video, Layers, Plus, 
  Wand2, Loader2, Sparkles, Mic, Volume2, Upload, 
  ChevronLeft, ChevronRight, Hash, AlertCircle, 
  Eye, EyeOff, Trash2, GripVertical, Fingerprint, FolderOpen, Save, FileVideo, Clock
} from 'lucide-react';
import { Download } from 'lucide-react';
import { LayerType, Layer, Project } from '../types';
import { ElevenLabsService } from '../services/elevenLabsService';

interface SidebarProps {
  layers: Layer[];
  projectApiKey?: string;
  savedProjects: Project[];
  currentProjectId: string;
  onAddLayer: (type: LayerType, content?: string, script?: string, voiceId?: string) => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onDeleteLayer: (id: string) => void;
  onSelectLayer: (id: string | null) => void;
  selectedLayerId: string | null;
  onGenerateAI: (prompt: string) => Promise<void>;
  isGenerating: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onUpdateProjectApiKey: (key: string) => void;
  onSaveProject: (p?: Project) => void;
  onLoadProject: (p: Project) => void;
  onDeleteProject: (id: string) => void;
  onExportAssets?: (id: string) => void;
  onExportAssetsDownload?: (id: string) => void;
}

export const ARABIC_VOICES = [
  { id: 'SAz9YHcvj6GT2YYSR8uH', name: 'Adam (أدام - عميق)', gender: 'Male' },
  { id: 'ThT5KcBe7VKqLNo94wvJ', name: 'Mona (منى - رزين)', gender: 'Female' },
  { id: 'EXAVITQu4vr4ARTe8YtL', name: 'Bella (بيلا - ناعم)', gender: 'Female' },
  { id: 'VR6AewLTBeLyMUrqH8r2', name: 'Omar (عمر - جهوري)', gender: 'Male' },
];

const Sidebar: React.FC<SidebarProps> = ({ 
  layers, 
  projectApiKey,
  savedProjects,
  currentProjectId,
  onAddLayer, 
  onUpdateLayer, 
  onDeleteLayer, 
  onSelectLayer, 
  selectedLayerId,
  onGenerateAI, 
  isGenerating, 
  collapsed, 
  onToggleCollapse,
  onUpdateProjectApiKey,
  onSaveProject,
  onLoadProject,
  onDeleteProject
}) => {
  const [activeTab, setActiveTab] = useState<'assets' | 'layers' | 'ai' | 'voice' | 'templates'>('assets');
  const [aiPrompt, setAiPrompt] = useState('');
  const [ttsText, setTtsText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(ARABIC_VOICES[0].id);
  const [customVoiceId, setCustomVoiceId] = useState(ARABIC_VOICES[0].id);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const menuItems = [
    { id: 'assets', icon: Plus, label: 'Add' },
    { id: 'layers', icon: Layers, label: 'Layers' },
    { id: 'templates', icon: FolderOpen, label: 'Templates' },
    { id: 'voice', icon: Mic, label: 'Voice' },
    { id: 'ai', icon: Wand2, label: 'AI Video' },
  ];

  const handleVoiceSelectChange = (id: string) => {
    setSelectedVoice(id);
    if (id !== 'custom') {
      setCustomVoiceId(id);
    }
  };

  const handleGenerateVoice = async () => {
    setErrorMessage(null);
    if (!projectApiKey) { setErrorMessage("الرجاء إدخال مفتاح ElevenLabs API أولاً."); return; }
    if (!ttsText.trim()) { setErrorMessage("الرجاء إدخال النص المراد تحويله."); return; }
    if (!customVoiceId.trim()) { setErrorMessage("الرجاء إدخال Voice ID صحيح."); return; }
    
    try {
      setIsGeneratingVoice(true);
      const audioUrl = await ElevenLabsService.generateSpeech(ttsText, customVoiceId, projectApiKey);
      onAddLayer('audio', audioUrl, ttsText, customVoiceId);
      setTtsText('');
    } catch (error: any) {
      setErrorMessage(error.message || "حدث خطأ أثناء توليد الصوت.");
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const getLayerIcon = (type: LayerType) => {
    switch (type) {
      case 'audio': return <Volume2 size={14} className="text-purple-400" />;
      case 'video': return <Video size={14} className="text-blue-400" />;
      case 'image': return <ImageIcon size={14} className="text-green-400" />;
      case 'text': return <Type size={14} className="text-yellow-400" />;
      default: return <Square size={14} className="text-zinc-400" />;
    }
  };

  const formatResolution = (w: number, h: number) => {
    if (w === 1080 && h === 1920) return "9:16 Vertical";
    if (w === 1920 && h === 1080) return "16:9 Landscape";
    return `${w}x${h}`;
  };

  return (
    <aside className={`border-r border-zinc-800 bg-[#0c0c0e] flex transition-all duration-300 ease-in-out relative z-40 ${collapsed ? 'w-16' : 'w-80'}`}>
      <div className="w-16 border-r border-zinc-800 flex flex-col h-full bg-[#09090b]">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id as any); if (collapsed) onToggleCollapse(); }}
            className={`w-16 h-16 flex flex-col items-center justify-center gap-1 transition-all group relative ${activeTab === item.id ? 'text-blue-500 bg-blue-500/5' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {activeTab === item.id && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-500 rounded-r-full" />}
            <item.icon size={20} className={activeTab === item.id ? 'scale-110' : ''} />
            <span className="text-[8px] font-bold uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
        <button onClick={onToggleCollapse} className="mt-auto h-16 w-16 flex items-center justify-center text-zinc-500 hover:text-white border-t border-zinc-800 transition-colors">
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-hidden flex flex-col animate-in fade-in slide-in-from-left-2 duration-300">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/20 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
              {menuItems.find(i => i.id === activeTab)?.label}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {activeTab === 'assets' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <AssetButton icon={Type} label="Headline" onClick={() => onAddLayer('text', 'AI REVOLUTION')} />
                  <AssetButton icon={Square} label="Rectangle" onClick={() => onAddLayer('shape')} />
                  <AssetButton icon={ImageIcon} label="Image" onClick={() => fileInputRef.current?.click()} />
                  <AssetButton icon={Video} label="Video" onClick={() => fileInputRef.current?.click()} />
                </div>
                <div className="pt-4 border-t border-zinc-800/50">
                   <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 border-2 border-dashed border-zinc-800 hover:border-blue-500/50 rounded-2xl flex flex-col items-center gap-2 text-zinc-500 hover:text-blue-400 transition-all bg-zinc-900/30 group">
                      <Upload size={24} className="group-hover:-translate-y-1 transition-transform" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Import Asset</span>
                   </button>
                </div>
              </div>
            )}

            {activeTab === 'templates' && (
               <div className="space-y-4">
                  <button 
                    onClick={() => onSaveProject()}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 group"
                  >
                    <Save size={16} className="group-hover:scale-110 transition-transform" />
                    Save Current Template
                  </button>

                  <div className="pt-4 border-t border-zinc-800/50 space-y-2">
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-3">Saved Projects</p>
                    {savedProjects.length === 0 ? (
                      <div className="py-12 flex flex-col items-center text-zinc-600">
                         <FolderOpen size={32} className="opacity-20 mb-2" />
                         <p className="text-[10px] font-bold uppercase tracking-tighter">No templates saved</p>
                      </div>
                    ) : (
                      savedProjects.map((p) => (
                        <div 
                          key={p.id}
                          className={`group p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                            currentProjectId === p.id 
                            ? 'bg-blue-600/10 border-blue-500/50' 
                            : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700'
                          }`}
                          onClick={() => onLoadProject(p)}
                        >
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center border border-zinc-800 shrink-0">
                                <FileVideo size={18} className={currentProjectId === p.id ? 'text-blue-400' : 'text-zinc-500'} />
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className={`text-[11px] font-black uppercase truncate tracking-tight ${currentProjectId === p.id ? 'text-blue-400' : 'text-zinc-200'}`}>{p.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                   <span className="text-[9px] text-zinc-600 font-bold">{formatResolution(p.width, p.height)}</span>
                                   <span className="w-1 h-1 bg-zinc-800 rounded-full" />
                                   <div className="flex items-center gap-1 text-[9px] text-zinc-600 font-bold">
                                      <Clock size={10} />
                                      {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'Old'}
                                   </div>
                                </div>
                             </div>
                             <button 
                               onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id); }}
                               className="p-2 text-zinc-700 hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                             >
                                <Trash2 size={14} />
                             </button>
                             <button
                               onClick={(e) => { 
                                 e.stopPropagation(); 
                                 const gid = prompt('Enter component/group id to export (leave empty for full template):');
                                 onExportAssets && onExportAssets(p.id, gid && gid.trim().length>0 ? gid.trim() : undefined); 
                               }}
                               className="p-2 text-zinc-700 hover:text-green-400 hover:bg-green-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all ml-2"
                             >
                               <FileVideo size={14} />
                             </button>
                             <button
                               onClick={(e) => { e.stopPropagation(); if (typeof onExportAssetsDownload === 'function') onExportAssetsDownload(p.id); else onExportAssets && onExportAssets(p.id); }}
                               title="Download assets"
                               className="p-2 text-zinc-700 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all ml-2"
                             >
                               <Download size={14} />
                             </button>
                          </div>
                          {currentProjectId === p.id && (
                             <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
               </div>
            )}

            {activeTab === 'layers' && (
              <div className="space-y-2">
                {layers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                    <Layers size={32} className="mb-2 opacity-20" />
                    <p className="text-[10px] font-bold uppercase">No layers yet</p>
                  </div>
                ) : (
                  [...layers].reverse().map((layer) => (
                    <div
                      key={layer.id}
                      onClick={() => onSelectLayer(layer.id)}
                      className={`group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedLayerId === layer.id 
                        ? 'bg-blue-600/10 border-blue-500/50' 
                        : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="text-zinc-600 group-hover:text-zinc-400"><GripVertical size={14} /></div>
                      <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center border border-zinc-800">
                        {getLayerIcon(layer.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-bold truncate ${selectedLayerId === layer.id ? 'text-blue-400' : 'text-zinc-300'}`}>
                          {layer.name}
                        </p>
                        <p className="text-[9px] text-zinc-600 uppercase font-medium">{layer.type}</p>
                      </div>
                      <div className="flex items-center gap-1">
                         <button 
                           onClick={(e) => { e.stopPropagation(); onUpdateLayer(layer.id, { opacity: layer.opacity === 0 ? 1 : 0 }); }}
                           className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white"
                         >
                           {layer.opacity === 0 ? <EyeOff size={14} /> : <Eye size={14} />}
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                           className="p-1.5 hover:bg-red-500/10 rounded-lg text-zinc-600 hover:text-red-500"
                         >
                           <Trash2 size={14} />
                         </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'voice' && (
              <div className="space-y-4">
                <div className="p-4 bg-purple-600/5 border border-purple-500/20 rounded-2xl">
                  <p className="text-[11px] text-purple-300/80 leading-relaxed font-medium">حوّل نصوصك إلى فويس أوفر احترافي باستخدام ElevenLabs.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">ElevenLabs API Key</label>
                    <input 
                      type="password" 
                      value={projectApiKey} 
                      onChange={(e) => onUpdateProjectApiKey(e.target.value)} 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-purple-500/50 focus:outline-none transition-all" 
                      placeholder="sk_..." 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Select Voice Preset</label>
                    <select value={selectedVoice} onChange={(e) => handleVoiceSelectChange(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-purple-500/50 focus:outline-none cursor-pointer">
                      {ARABIC_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      <option value="custom">Custom Voice ID...</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                       <Fingerprint size={12} className="text-zinc-500" />
                       <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Voice ID</label>
                    </div>
                    <input 
                      type="text" 
                      value={customVoiceId} 
                      onChange={(e) => setCustomVoiceId(e.target.value)} 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-purple-500/50 focus:outline-none transition-all font-mono" 
                      placeholder="e.g. SAz9YHcvj6GT2YYSR8uH" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Script</label>
                    <textarea value={ttsText} onChange={(e) => setTtsText(e.target.value)} className="w-full h-40 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-white focus:border-purple-500/50 focus:outline-none resize-none leading-relaxed" dir="auto" placeholder="اكتب النص هنا..." />
                  </div>
                  {errorMessage && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-[10px] font-bold">
                       <AlertCircle size={14} /> {errorMessage}
                    </div>
                  )}
                  <button onClick={handleGenerateVoice} disabled={isGeneratingVoice || !ttsText.trim()} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-purple-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                    {isGeneratingVoice ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
                    {isGeneratingVoice ? 'Generating...' : 'Generate Voiceover'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-5">
                <div className="p-4 bg-blue-600/5 border border-blue-500/20 rounded-2xl">
                   <p className="text-[11px] text-blue-300/80 leading-relaxed font-medium">قم بوصف المشهد الذي تتخيله، وسيقوم محرك Google Veo بتوليده لك.</p>
                </div>
                <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="A cinematic drone shot of Riyadh city at night..." className="w-full h-48 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs text-white focus:border-blue-500/50 focus:outline-none transition-all resize-none shadow-inner" />
                <button onClick={() => aiPrompt.trim() && onGenerateAI(aiPrompt)} disabled={isGenerating || !aiPrompt.trim()} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {isGenerating ? 'Generating Video...' : 'Create AI Scene'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <input type="file" ref={fileInputRef} onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          const url = URL.createObjectURL(file);
          const type = file.type.startsWith('video/') ? 'video' : (file.type.startsWith('audio/') ? 'audio' : 'image');
          onAddLayer(type as LayerType, url);
        }
      }} className="hidden" accept="image/*,video/*,audio/*" />
    </aside>
  );
};

const AssetButton = ({ icon: Icon, label, onClick }: any) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center p-5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-all group">
    <Icon size={24} className="text-zinc-500 group-hover:text-blue-500 transition-all mb-2" />
    <span className="text-[9px] font-black uppercase text-zinc-500 group-hover:text-zinc-200 tracking-widest">{label}</span>
  </button>
);

export default Sidebar;
