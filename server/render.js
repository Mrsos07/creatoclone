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
    const ff = cp.spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    ff.stdout.on('data', d => out += d.toString());
    ff.stderr.on('data', d => out += d.toString());
    ff.on('close', code => {
      if (code === 0) resolve(out); else reject(new Error('ffmpeg failed: ' + out));
    });
  });
}

// Very minimal renderer: choose first visual (image or video) and first audio, produce output mp4
export async function renderTemplate(payload, baseUrl) {
  const mods = payload.modifications || {};
  const templateInfo = payload.template_info || {};
  const totalDuration = Number(templateInfo.total_duration || payload.render_settings?.duration || 10);
  const canvasW = Number(templateInfo.canvas_size?.width || 1280);
  const canvasH = Number(templateInfo.canvas_size?.height || 720);

  const visuals = [];
  const audios = [];
  for (const k of Object.keys(mods)) {
    const it = mods[k];
    if (!it) continue;
    if ((it.type === 'image' || it.type === 'video') && it.content) visuals.push(it);
    if (it.type === 'audio' && it.content) audios.push(it);
  }

  if (visuals.length === 0 && audios.length === 0) throw new Error('No visual or audio assets provided');

  const outName = `render-${Date.now()}.mp4`;
  const outPath = path.join(uploadsDir, outName);

  // If there are only audio tracks, create a black video background and attach mixed audio
  if (visuals.length === 0 && audios.length > 0) {
    const audioFile = await downloadToFile(audios[0].content, `audio-${Date.now()}.mp3`);
    const args = ['-y', '-f', 'lavfi', '-i', `color=size=${canvasW}x${canvasH}:duration=${totalDuration}:rate=${payload.render_settings?.fps||25}:color=black`, '-i', audioFile, '-c:v', 'libx264', '-c:a', 'aac', '-shortest', outPath];
    await runFfmpeg(args);
    return `${baseUrl}/uploads/${outName}`;
  }

  // Download visual files
  const visualFiles = [];
  for (let i = 0; i < visuals.length; i++) {
    const it = visuals[i];
    const ext = (it.type === 'image' ? path.extname(it.content).split('?')[0] || '.jpg' : path.extname(it.content).split('?')[0] || '.mp4');
    const file = await downloadToFile(it.content, `${it.type}-${Date.now()}-${i}${ext}`);
    visualFiles.push({ file, item: it });
  }

  // Download audio files
  const audioFiles = [];
  for (let i = 0; i < audios.length; i++) {
    const a = audios[i];
    const file = await downloadToFile(a.content, `audio-${Date.now()}-${i}.mp3`);
    audioFiles.push({ file, item: a });
  }

  // Build ffmpeg args
  const args = ['-y'];
  // background black canvas
  args.push('-f', 'lavfi', '-i', `color=size=${canvasW}x${canvasH}:duration=${totalDuration}:rate=${payload.render_settings?.fps||25}:color=black`);

  // add visual inputs
  for (const vf of visualFiles) {
    if (vf.item.type === 'image') {
      args.push('-loop', '1', '-t', String(totalDuration), '-i', vf.file);
    } else {
      args.push('-i', vf.file);
    }
  }

  // add audio inputs
  for (const af of audioFiles) {
    args.push('-i', af.file);
  }

  // build filter_complex: overlay visuals on top of background with timing and transforms
  const filters = [];
  let lastLabel = '[0:v]';
  for (let i = 0; i < visualFiles.length; i++) {
    const inIndex = i + 1; // input index in ffmpeg args
    const labelIn = `[${inIndex}:v]`;
    const it = visualFiles[i].item;
    const w = Number(it.transform?.width || canvasW);
    const h = Number(it.transform?.height || canvasH);
    const x = Number(it.transform?.x || 0);
    const y = Number(it.transform?.y || 0);
    const start = Number(it.timing?.start_time || 0);
    const duration = Number(it.timing?.duration || totalDuration);
    const end = start + duration;
    const sLabel = `[s${i}]`;
    filters.push(`${labelIn} scale=${w}:${h},format=rgba, setpts=PTS+${start}/TB ${sLabel}`);
    const outLabel = `[vout${i}]`;
    // overlay with enable between start and end
    filters.push(`${lastLabel}${sLabel} overlay=x=${x}:y=${y}:enable='between(t,${start},${end})' ${outLabel}`);
    lastLabel = outLabel;
  }

  const finalVideoLabel = lastLabel;

  // audio mixing if present
  let audioMapLabel = null;
  if (audioFiles.length > 0) {
    const audioInputs = [];
    for (let j = 0; j < audioFiles.length; j++) {
      const idx = visualFiles.length + 1 + j; // input index for this audio
      audioInputs.push(`[${idx}:a]`);
    }
    const amixLabel = '[mixedaudio]';
    filters.push(`${audioInputs.join('')} amix=inputs=${audioFiles.length}:duration=longest:dropout_transition=0 ${amixLabel}`);
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
