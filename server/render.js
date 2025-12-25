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
  let visualUrl = null;
  let visualType = null; // 'image' or 'video'
  let audioUrl = null;

  for (const k of Object.keys(mods)) {
    const it = mods[k];
    if (!visualUrl && (it.type === 'image' || it.type === 'video') && it.content) {
      visualUrl = it.content;
      visualType = it.type;
    }
    if (!audioUrl && it.type === 'audio' && it.content) {
      audioUrl = it.content;
    }
    if (visualUrl && audioUrl) break;
  }

  if (!visualUrl && !audioUrl) throw new Error('No visual or audio assets provided');

  const outName = `render-${Date.now()}.mp4`;
  const outPath = path.join(uploadsDir, outName);

  if (visualUrl && visualType === 'image' && audioUrl) {
    const imgFile = await downloadToFile(visualUrl, `img-${Date.now()}${path.extname(visualUrl).split('?')[0] || '.jpg'}`);
    const audioFile = await downloadToFile(audioUrl, `audio-${Date.now()}.mp3`);
    // get audio duration via ffprobe
    // create video from single image with audio
    const args = [
      '-y', '-loop', '1', '-i', imgFile, '-i', audioFile,
      '-c:v', 'libx264', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-pix_fmt', 'yuv420p', outPath
    ];
    await runFfmpeg(args);
    return `${baseUrl}/uploads/${outName}`;
  }

  if (visualUrl && visualType === 'video' && audioUrl) {
    const videoFile = await downloadToFile(visualUrl, `video-${Date.now()}${path.extname(visualUrl).split('?')[0] || '.mp4'}`);
    const audioFile = await downloadToFile(audioUrl, `audio-${Date.now()}.mp3`);
    // replace audio stream
    const args = ['-y', '-i', videoFile, '-i', audioFile, '-c:v', 'copy', '-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0', '-shortest', outPath];
    await runFfmpeg(args);
    return `${baseUrl}/uploads/${outName}`;
  }

  // If only visual (video) and no audio, just copy/trim
  if (visualUrl && visualType === 'video' && !audioUrl) {
    const videoFile = await downloadToFile(visualUrl, `video-${Date.now()}${path.extname(visualUrl).split('?')[0] || '.mp4'}`);
    const args = ['-y', '-i', videoFile, '-c', 'copy', outPath];
    await runFfmpeg(args);
    return `${baseUrl}/uploads/${outName}`;
  }

  // If only audio and no visual, create a blank video with black frame
  if (!visualUrl && audioUrl) {
    const audioFile = await downloadToFile(audioUrl, `audio-${Date.now()}.mp3`);
    const args = ['-y', '-f', 'lavfi', '-i', 'color=size=1280x720:duration=10:rate=25:color=black', '-i', audioFile, '-c:v', 'libx264', '-c:a', 'aac', '-shortest', outPath];
    await runFfmpeg(args);
    return `${baseUrl}/uploads/${outName}`;
  }

  throw new Error('Unsupported combination for rendering');
}

export default { renderTemplate };
