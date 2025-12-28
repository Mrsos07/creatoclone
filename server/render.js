import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import cp from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

async function downloadToFile(url, filename) {
  // Support data: URLs (base64) directly — useful when client sends file as data URL
  if (typeof url === 'string' && url.startsWith('data:')) {
    const match = url.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) throw new Error('Invalid data URL');
    const base64 = match[2];
    const dest = path.join(uploadsDir, filename);
    const buffer = Buffer.from(base64, 'base64');
    await fs.promises.writeFile(dest, buffer);
    return dest;
  }

  // blob: URLs are browser-local and cannot be fetched from the server. Provide a clear error
  if (typeof url === 'string' && url.startsWith('blob:')) {
    throw new Error('Received blob: URL. The server cannot fetch browser-local blob URLs. Send a public URL, a data: (base64) URL, or upload the file to the server first.');
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const dest = path.join(uploadsDir, filename);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(dest, buffer);
  return dest;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    try {
      const ff = cp.spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      console.log('Running ffmpeg with args:', args.join(' '));
      let out = '';
      ff.stdout.on('data', d => out += d.toString());
      ff.stderr.on('data', d => out += d.toString());
      ff.on('close', code => {
        const logFile = path.join(uploadsDir, `ffmpeg-log-${Date.now()}.txt`);
        try { fs.writeFileSync(logFile, out); } catch (e) { console.error('Failed write ffmpeg log', e); }
        if (code === 0) resolve(out); else reject(new Error('ffmpeg failed: ' + out + ' (log: ' + logFile + ')'));
      });
    } catch (e) {
      reject(e);
    }
  });
}

function runFfprobe(args) {
  try {
    const out = cp.execFileSync('ffprobe', args, { encoding: 'utf8' });
    return out;
  } catch (e) {
    return '';
  }
}

function fileHasAudio(filePath) {
  try {
    const out = runFfprobe(['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', filePath]);
    return (out && out.trim().length > 0);
  } catch (e) { return false; }
}

// Very minimal renderer: choose first visual (image or video) and first audio, produce output mp4
export async function renderTemplate(payload, baseUrl) {
  const mods = payload.modifications || {};
  const templateInfo = payload.template_info || {};
  const totalDuration = Number(templateInfo.total_duration || payload.render_settings?.duration || 10);
  const canvasW = Number(templateInfo.canvas_size?.width || 1280);
  const canvasH = Number(templateInfo.canvas_size?.height || 720);
  // attempt to find a font file on common locations (used by drawtext)
  let fontfile = '';
  const maybeFonts = [
    'C:\\Windows\\Fonts\\arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/Library/Fonts/Arial.ttf'
  ];
  for (const f of maybeFonts) { if (fs.existsSync(f)) { fontfile = f; break; } }

  // Determine duration automatically from items if any timing provided
  let computedDuration = totalDuration || 0;
  const visuals = [];
  const audios = [];
  const texts = [];
  for (const k of Object.keys(mods)) {
    const it = mods[k];
    if (!it) continue;
    const start = Number(it.timing?.start_time || 0);
    const dur = Number(it.timing?.duration || 0);
    if (dur > 0) computedDuration = Math.max(computedDuration, start + dur);
    // classifying items
    if ((it.type === 'image' || it.type === 'video') && it.content) visuals.push(it);
    else if (it.type === 'audio' && it.content) audios.push(it);
    else if (it.type === 'text') texts.push(it);
  }
  const finalDuration = computedDuration || 10;

  if (visuals.length === 0 && audios.length === 0) throw new Error('No visual or audio assets provided');

  const outName = `render-${Date.now()}.mp4`;
  const outPath = path.join(uploadsDir, outName);

  // If there are only audio tracks, create a black video background and attach mixed audio
  if (visuals.length === 0 && audios.length > 0) {
    const audioFile = await downloadToFile(audios[0].content, `audio-${Date.now()}.mp3`);
    const args = ['-y', '-f', 'lavfi', '-i', `color=size=${canvasW}x${canvasH}:duration=${finalDuration}:rate=${payload.render_settings?.fps||25}:color=black`, '-i', audioFile, '-c:v', 'libx264', '-c:a', 'aac', '-shortest', outPath];
    await runFfmpeg(args);
    return `${baseUrl}/uploads/${outName}`;
  }

  // Download visual files
  const visualFiles = [];
  for (let i = 0; i < visuals.length; i++) {
    const it = visuals[i];
    const ext = (it.type === 'image' ? path.extname(it.content).split('?')[0] || '.jpg' : path.extname(it.content).split('?')[0] || '.mp4');
    const file = await downloadToFile(it.content, `${it.type}-${Date.now()}-${i}${ext}`);
    const hasAudio = (it.type === 'video') ? fileHasAudio(file) : false;
    visualFiles.push({ file, item: it, inputIndex: null, hasAudio });
  }

  // Download audio files
  const audioFiles = [];
  for (let i = 0; i < audios.length; i++) {
    const a = audios[i];
    const file = await downloadToFile(a.content, `audio-${Date.now()}-${i}.mp3`);
    audioFiles.push({ file, item: a, inputIndex: null });
  }

  // Build ffmpeg args
  const args = ['-y'];
  // background black canvas
  args.push('-f', 'lavfi', '-i', `color=size=${canvasW}x${canvasH}:duration=${finalDuration}:rate=${payload.render_settings?.fps||25}:color=black`);

  // add visual inputs and record input indices (background is index 0)
  let nextInputIndex = 1;
  for (const vf of visualFiles) {
    const itemDur = Number(vf.item.timing?.duration || finalDuration);
    if (vf.item.type === 'image') {
      args.push('-loop', '1', '-t', String(itemDur), '-i', vf.file);
    } else {
      // trim video input to its intended duration to avoid overflow
      args.push('-t', String(itemDur), '-i', vf.file);
    }
    vf.inputIndex = nextInputIndex;
    nextInputIndex++;
  }

  // add audio inputs
  for (const af of audioFiles) {
    args.push('-i', af.file);
    af.inputIndex = nextInputIndex;
    nextInputIndex++;
  }

  // build filter_complex: overlay visuals and texts in the specified order (template.order preferred)
  const order = payload.order || templateInfo.order || Object.keys(mods);
  const filters = [];
  let lastLabel = '[0:v]';
  let visualCounter = 0;
  let textCounter = 0;
  for (const key of order) {
    const it = mods[key];
    if (!it) continue;
    if (it.type === 'image' || it.type === 'video') {
      // find corresponding visualFiles entry
      const vf = visualFiles.find(v => (v.item.id && it.id && v.item.id === it.id) || (v.item.original_name && it.original_name && v.item.original_name === it.original_name) );
      if (!vf) continue;
      const inIndex = vf.inputIndex;
      const labelIn = `[${inIndex}:v]`;
      const w = Number(it.transform?.width || canvasW);
      const h = Number(it.transform?.height || canvasH);
      const x = Number(it.transform?.x || 0);
      const y = Number(it.transform?.y || 0);
      const start = Number(it.timing?.start_time || 0);
      const duration = Number(it.timing?.duration || finalDuration);
      const end = start + duration;
      const sLabel = `[s${visualCounter}]`;
      if (it.type === 'video') {
        // shift video stream to start time
        filters.push(`${labelIn} scale=${w}:${h},format=rgba, setpts=PTS+${start}/TB ${sLabel}`);
      } else {
        // image: keep timeline unchanged and rely on overlay enable
        filters.push(`${labelIn} scale=${w}:${h},format=rgba ${sLabel}`);
      }
      const outLabel = `[vout${visualCounter}]`;
      filters.push(`${lastLabel}${sLabel} overlay=x=${x}:y=${y}:enable='between(t,${start},${end})' ${outLabel}`);
      lastLabel = outLabel;
      visualCounter++;
    } else if (it.type === 'text') {
      const start = Number(it.timing?.start_time || 0);
      const duration = Number(it.timing?.duration || finalDuration);
      const end = start + duration;
      const x = Number(it.transform?.x || 0);
      const y = Number(it.transform?.y || 0);
      const fontSize = Number(it.style?.font_size || 48);
      const fontColor = (it.style?.text_color || 'white').replace('#', '');
      // Prefer script field for text. Use content only if it's plain text (not a URL or upload path).
      let rawText = '';
      if (it.script && String(it.script).trim().length > 0) rawText = String(it.script);
      else if (typeof it.content === 'string') {
        const c = it.content;
        const isUrl = c.startsWith('http://') || c.startsWith('https://') || c.startsWith('data:') || c.startsWith('/uploads') || c.includes('/uploads/');
        const isFont = c.match(/\.(ttf|otf|woff2?|eot)(\?|$)/i);
        if (!isUrl && !isFont) rawText = c;
      }
      let text = (rawText || '').toString();
      if (!text) {
        console.warn('Text layer has no textual content to render for key', key);
        continue; // skip drawtext for empty text
      }
      // write text to temp utf8 file and use drawtext=textfile to avoid quoting/encoding issues
      const textFileName = `text-${Date.now()}-${textCounter}.txt`;
      const textFilePath = path.join(uploadsDir, textFileName);
      try { fs.writeFileSync(textFilePath, text, { encoding: 'utf8' }); } catch (e) { console.warn('Failed to write text file for drawtext', e); }
      const outLabel = `[vtext${textCounter}]`;
      // determine font file: prefer per-layer font_file or style.font_file, else global fontfile
      let fontOpt = '';
      const layerFont = it.font_file || (it.style && it.style.font_file) || null;
      if (layerFont) {
        try {
          if (typeof layerFont === 'string' && layerFont.includes('/uploads/')) {
            const fn = layerFont.split('/uploads/').pop();
            const p = path.join(uploadsDir, fn);
            if (fs.existsSync(p)) {
              const ef = p.replace(/\\/g, '\\\\');
              const safe = ef.replace(/'/g, "\\'");
              fontOpt = `:fontfile='${safe}'`;
            }
          } else if (typeof layerFont === 'string' && fs.existsSync(layerFont)) {
            const ef = layerFont.replace(/\\/g, '\\\\');
            const safe = ef.replace(/'/g, "\\'");
            fontOpt = `:fontfile='${safe}'`;
          }
        } catch (e) { console.warn('font file check failed', e); }
      }
      if (!fontOpt && fontfile) {
        const ef = fontfile.replace(/\\/g, '\\\\');
        const safe = ef.replace(/'/g, "\\'");
        fontOpt = `:fontfile='${safe}'`;
      }
      // textfile path for drawtext must be escaped
      const tf = textFilePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:');
      filters.push(`${lastLabel} drawtext=textfile='${tf}':reload=1:fontcolor=#${fontColor}:fontsize=${fontSize}:x=${x}:y=${y}:enable='between(t,${start},${end})'${fontOpt} ${outLabel}`);
      lastLabel = outLabel;
      textCounter++;
    }
  }

  // (texts are already handled in the mods loop above)

  const finalVideoLabel = lastLabel;

  // audio mixing if present
  let audioMapLabel = null;
  // Prepare audio streams (from video inputs and separate audio files). Apply delay according to item start times.
  const audioStreamLabels = [];
  let audioCounter = 0;
  // from visual video inputs (only if they actually have audio)
  for (let i = 0; i < visualFiles.length; i++) {
    const vf = visualFiles[i];
    if (vf.item.type === 'video' && vf.hasAudio) {
      const idx = vf.inputIndex;
      const start = Number(vf.item.timing?.start_time || 0);
      const startMs = Math.round(start * 1000);
      const srcLabel = `[${idx}:a]`;
      const outLabel = `[aud${audioCounter}]`;
      filters.push(`${srcLabel} adelay=${startMs}|${startMs} ${outLabel}`);
      audioStreamLabels.push(outLabel);
      audioCounter++;
    }
  }
  // from separate audio files
  for (let j = 0; j < audioFiles.length; j++) {
    const af = audioFiles[j];
    const idx = af.inputIndex;
    const start = Number(af.item.timing?.start_time || 0);
    const startMs = Math.round(start * 1000);
    const srcLabel = `[${idx}:a]`;
    const outLabel = `[aud${audioCounter}]`;
    filters.push(`${srcLabel} adelay=${startMs}|${startMs} ${outLabel}`);
    audioStreamLabels.push(outLabel);
    audioCounter++;
  }
  if (audioStreamLabels.length > 0) {
    const amixLabel = '[mixedaudio]';
    filters.push(`${audioStreamLabels.join('')} amix=inputs=${audioStreamLabels.length}:duration=longest:dropout_transition=0 ${amixLabel}`);
    audioMapLabel = amixLabel;
  }

  const filterComplex = filters.join('; ');

  args.push('-filter_complex', filterComplex, '-map', finalVideoLabel);
  if (audioMapLabel) args.push('-map', audioMapLabel);
  args.push('-c:v', 'libx264', '-r', String(payload.render_settings?.fps || 25), '-pix_fmt', 'yuv420p');
  if (audioMapLabel) args.push('-c:a', 'aac', '-b:a', '192k');
  args.push('-shortest', outPath);

  await runFfmpeg(args);
  return `${baseUrl}/uploads/${outName}`;
}

export default { renderTemplate };
