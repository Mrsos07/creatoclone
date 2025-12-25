
import React from 'react';
import { X, Copy, Check, Code, Terminal, Box, Zap, Settings2, Database } from 'lucide-react';
import { Project } from '../types';

interface ExportModalProps {
  project: Project;
  onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ project, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  const apiPayload = {
    template_info: {
      template_id: project.id,
      name: project.name,
      canvas_size: { width: project.width, height: project.height },
      total_duration: project.duration,
      elevenlabs_api_key: project.elevenLabsApiKey || ""
    },
    modifications: project.layers.reduce((acc: any, layer) => {
      const key = layer.name.replace(/\s+/g, '_').toLowerCase();
      acc[key] = {
        id: layer.id,
        original_name: layer.name,
        type: layer.type,
        content: layer.content, 
        script: layer.script || (layer.type === 'text' ? layer.content : ''),
        voice_id: layer.voiceId || "",
        transform: {
          x: layer.x,
          y: layer.y,
          width: layer.width,
          height: layer.height,
          rotation: layer.rotation,
          scale: 1
        },
        style: {
          opacity: layer.opacity,
          z_index: layer.zIndex,
          ...(layer.type === 'text' && {
            font_size: layer.fontSize,
            font_weight: layer.fontWeight,
            text_color: layer.color,
            text_align: "center"
          }),
          ...(layer.type === 'shape' && { fill_color: layer.fill }),
          ...((layer.type === 'video' || layer.type === 'audio') && { volume: layer.volume })
        },
        timing: {
          start_time: layer.start,
          duration: layer.duration
        }
      };
      return acc;
    }, {}),
    render_settings: {
      format: "mp4",
      fps: 30,
      quality: "high",
      callback_url: "https://n8n.srv968786.hstgr.cloud/webhook/creatoclone"
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(apiPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Convert a blob: URL to data URL in browser
  // Upload a blob: URL file to server via multipart/form-data; returns public URL
  async function uploadBlob(blobUrl: string) {
    const resp = await fetch(blobUrl);
    const blob = await resp.blob();
    const form = new FormData();
    // try to derive filename from blobUrl or fallback
    const filename = 'file-' + Date.now();
    form.append('file', blob, filename);
    const upl = await fetch('/api/upload', { method: 'POST', body: form });
    if (!upl.ok) throw new Error('Upload failed');
    const j = await upl.json();
    return j.url;
  }

  const [exporting, setExporting] = React.useState(false);
  const [exportResult, setExportResult] = React.useState<string | null>(null);

  // Export via server /api/render. Converts any blob: content to data: URLs first.
  const handleExport = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const payload = JSON.parse(JSON.stringify(apiPayload));
      const mods = payload.modifications || {};
      for (const k of Object.keys(mods)) {
        const item = mods[k];
        if (item && typeof item.content === 'string' && item.content.startsWith('blob:')) {
          try {
            item.content = await blobToDataURL(item.content);
          } catch (err) {
            console.error('Failed convert blob to data URL', err);
          }
        }
      }

      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setExportResult(json.mp4_url || JSON.stringify(json));
      } else {
        setExportResult(`Error: ${json.error || JSON.stringify(json)}`);
      }
    } catch (err: any) {
      setExportResult('Export failed: ' + (err?.message || String(err)));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center ring-1 ring-blue-500/30">
              <Database size={24} className="text-blue-500" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Automation Bridge</h3>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Connect with n8n / Zapier / Make</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 transition-all hover:rotate-90"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-blue-600/5 border border-blue-500/20 rounded-2xl">
              <div className="flex items-center gap-2 mb-3 text-blue-400"><Zap size={18} /><h4 className="text-sm font-bold uppercase tracking-wide">How to use with n8n</h4></div>
              <ul className="text-[11px] text-zinc-400 space-y-2 list-disc list-inside leading-relaxed">
                <li>استخدم حقل <code className="text-blue-300">script</code> لتغيير النص المراد تحويله لصوت برمجياً.</li>
                <li>يتم تمرير <code className="text-blue-300">voice_id</code> و <code className="text-blue-300">elevenlabs_api_key</code> تلقائياً في الطلب.</li>
                <li>لتغيير الصور أو الفيديوهات، قم بتبديل قيمة <code className="text-blue-300">content</code> بالرابط الجديد.</li>
              </ul>
            </div>
            <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl">
              <div className="flex items-center gap-2 mb-3 text-zinc-400"><Settings2 size={18} /><h4 className="text-sm font-bold uppercase tracking-wide">Automation Context</h4></div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">بفضل تخزين الـ API Key في القالب، يمكن لـ n8n تنفيذ الرندر دون الحاجة لإعداد مفاتيح إضافية في كل مرة.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <Terminal size={16} className="text-blue-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Dynamic Template Payload</span>
               </div>
               <div className="flex items-center gap-3">
                <button onClick={handleCopy} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all text-xs font-bold uppercase shadow-xl shadow-blue-600/20 group">
                  {copied ? <Check size={14} /> : <Copy size={14} className="group-hover:scale-110 transition-transform" />}
                  {copied ? 'Payload Copied' : 'Copy Full Template API'}
                </button>
                <button onClick={handleExport} disabled={exporting} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-all text-xs font-bold uppercase shadow-xl shadow-green-600/20">
                  {exporting ? 'Exporting...' : 'Export Video'}
                </button>
               </div>
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-500/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <pre className="relative bg-zinc-900/80 p-6 rounded-2xl border border-zinc-800 text-blue-400 text-[11px] font-mono overflow-auto max-h-[400px] leading-relaxed scrollbar-thin scrollbar-thumb-zinc-800 shadow-inner">
                {JSON.stringify(apiPayload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
        <div className="p-6 bg-zinc-900/50 border-t border-zinc-800 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-tighter"><Box size={14} />Version 2.6 • ElevenLabs Integration Optimized</div>
            {exportResult && (
              <div className="text-xs text-blue-400">
                Result: {exportResult.startsWith('http') ? <a className="underline" href={exportResult} target="_blank" rel="noreferrer">Open video</a> : exportResult}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExport} disabled={exporting} className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95">
              {exporting ? 'Exporting...' : 'Export Video'}
            </button>
            <button onClick={onClose} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95">Close Bridge</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
