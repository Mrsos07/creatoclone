import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { renderTemplate } from './render.js';
import multer from 'multer';
import crypto from 'crypto';
import cp from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static built files if present (production build)
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  console.log('Serving static files from', distDir);
} else {
  console.warn('Warning: dist/index.html not found — frontend build missing. Run `npm run build` in project root to generate static files.');
}

// Ensure uploads folder exists and serve it
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Ensure common Google Fonts are available in uploads/fonts
const fontsDir = path.join(uploadsDir, 'fonts');
if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });
async function ensureFont(name, url) {
  try {
    const filename = `${name}.ttf`;
    const dest = path.join(fontsDir, filename);
    if (fs.existsSync(dest)) return;
    const res = await fetch(url);
    if (!res.ok) { console.warn('Failed download font', name, res.status); return; }
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.promises.writeFile(dest, buf);
    console.log('Downloaded font', name);
  } catch (e) { console.warn('ensureFont error', name, e); }
}
// download Cairo and Noto Sans Arabic from Google Fonts repo if missing
// Download only Cairo and Tajawal (try jsDelivr fallback) and place into uploads/fonts
(async () => {
  await ensureFont('Cairo-Regular', 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cairo/Cairo-Regular.ttf');
  await ensureFont('Cairo-Bold', 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cairo/Cairo-Bold.ttf');
  await ensureFont('Tajawal-Regular', 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/tajawal/Tajawal-Regular.ttf');
})();

// Multer upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});
// Helper: fetch Google Fonts CSS and download referenced font files (woff2/woff)
async function ensureFontFromCss(family, cssUrl) {
  try {
    const res = await fetch(cssUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) { console.warn('Failed fetch CSS', cssUrl, res.status); return; }
    const css = await res.text();
    const urls = Array.from(css.matchAll(/url\((https:[^)]+)\)/g)).map(m => m[1]);
    for (const u of urls) {
      try {
        const fname = path.basename(new URL(u).pathname);
        const dest = path.join(fontsDir, `${family}-${fname}`);
        if (fs.existsSync(dest)) continue;
        const r = await fetch(u);
        if (!r.ok) { console.warn('Failed download font file', u, r.status); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        await fs.promises.writeFile(dest, buf);
        console.log('Downloaded font asset', dest);
      } catch (e) { console.warn('download font asset failed', e); }
    }
  } catch (e) { console.warn('ensureFontFromCss error', family, e); }
}

// Download Cairo and Tajawal from Google Fonts CSS (woff2 assets)
(async () => {
  await ensureFontFromCss('Cairo', 'https://fonts.googleapis.com/css2?family=Cairo:wght@200;400;700;900&display=swap');
  await ensureFontFromCss('Tajawal', 'https://fonts.googleapis.com/css2?family=Tajawal:wght@200;400;700;900&display=swap');
})();

const upload = multer({ storage });

// Upload endpoint: accepts multipart/form-data with field 'file' and returns public URL
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    // ensure file has an extension matching its mimetype so browsers render images/videos correctly
    const mimetype = req.file.mimetype || '';
    let ext = path.extname(req.file.filename) || '';
    if (!ext) {
      if (mimetype.includes('jpeg')) ext = '.jpg';
      else if (mimetype.includes('png')) ext = '.png';
      else if (mimetype.includes('webp')) ext = '.webp';
      else if (mimetype.includes('mp4')) ext = '.mp4';
      else if (mimetype.includes('mpeg') || mimetype.includes('mp3')) ext = '.mp3';
      else ext = '';
    }
    let filename = req.file.filename;
    if (ext && !filename.endsWith(ext)) {
      const newName = filename + ext;
      const oldPath = path.join(uploadsDir, filename);
      const newPath = path.join(uploadsDir, newName);
      try {
        await fs.promises.rename(oldPath, newPath);
        filename = newName;
      } catch (e) { console.warn('rename upload file failed', e); }
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/${filename}`;
    return res.json({ url });
  } catch (err) {
    console.error('Upload error', err);
    return res.status(500).json({ error: 'upload_failed' });
  }
});

// TTS test endpoint: generate speech with ElevenLabs and return public URL
app.post('/api/tts-test', async (req, res) => {
  try {
    const { voice_id, api_key, text } = req.body || {};
    if (!voice_id || !api_key || !text) return res.status(400).json({ error: 'missing_params' });
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': api_key },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
    });
    if (!ttsRes.ok) return res.status(502).json({ error: 'tts_failed', detail: await ttsRes.text() });
    const arrayBuffer = await ttsRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = `tts-${Date.now()}.mp3`;
    const outPath = path.join(uploadsDir, filename);
    await fs.promises.writeFile(outPath, buffer);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return res.json({ url: `${baseUrl}/uploads/${filename}` });
  } catch (e) {
    console.error('tts-test error', e);
    return res.status(500).json({ error: 'internal' });
  }
});

// Directories for templates and renders
const templatesDir = path.join(__dirname, '..', 'data', 'templates');
const rendersDir = path.join(__dirname, '..', 'data', 'renders');
if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir, { recursive: true });
if (!fs.existsSync(rendersDir)) fs.mkdirSync(rendersDir, { recursive: true });

function generateId(prefix = '') {
  return prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

async function saveTemplate(template) {
  // template may contain remote asset URLs or data: URLs — download and store copies in uploadsDir
  const id = template.template_id || generateId('tpl_');
  const portForUrl = process.env.PORT || 3001;
  const baseUrl = template.__request_base_url || (process.env.BASE_URL || `http://localhost:${portForUrl}`);
  const mods = template.modifications || {};
  // preserve order of modifications as an array so renderer can respect stacking/sequence
  const order = Object.keys(mods || {});
  template.order = order;
  // Reject browser-local blob: URLs — client must upload them first
  const offendingBlobs = [];
  for (const k of Object.keys(mods)) {
    const it = mods[k];
    if (!it) continue;
    const c = it.content;
    if (typeof c === 'string' && c.startsWith('blob:')) offendingBlobs.push(k);
  }
  if (offendingBlobs.length > 0) {
    const msg = 'Template contains browser-local blob: URLs for modifications: ' + offendingBlobs.join(', ');
    throw new Error(msg);
  }
  for (const k of Object.keys(mods)) {
    const it = mods[k];
    if (!it || !it.content) continue;
    // If text layer specifies font_family, attempt to map it to a local font file
    try {
      if (it.type === 'text' && it.style && it.style.font_family) {
        const fam = String(it.style.font_family).trim();
        // check uploads/fonts/<fam>.ttf first
        const fontsDir = path.join(uploadsDir, 'fonts');
        if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });
        const candidate = path.join(fontsDir, `${fam.replace(/\s+/g,'_')}.ttf`);
        if (fs.existsSync(candidate)) {
          it.font_file = `${baseUrl}/uploads/fonts/${path.basename(candidate)}`;
        } else {
          // try to find system font by common paths
          const systemPaths = ['C:\\Windows\\Fonts', '/usr/share/fonts/truetype', '/Library/Fonts'];
          for (const sp of systemPaths) {
            const tryPath = path.join(sp, `${fam}.ttf`);
            if (fs.existsSync(tryPath)) { it.font_file = tryPath; break; }
          }
        }
      }
    } catch (e) { console.warn('font mapping error', e); }
    try {
      const c = it.content;
      // data: URL
      if (typeof c === 'string' && c.startsWith('data:')) {
        const m = c.match(/^data:([^;]+);base64,(.*)$/);
        if (!m) continue;
        const mime = m[1];
        const b64 = m[2];
        const ext = (mime === 'image/jpeg' && '.jpg') || (mime === 'image/png' && '.png') || (mime === 'image/webp' && '.webp') || (mime.startsWith('audio/') && '.mp3') || (mime.startsWith('video/') && '.mp4') || '.bin';
        const filename = `${Date.now()}-${k}${ext}`;
        const dest = path.join(uploadsDir, filename);
        await fs.promises.writeFile(dest, Buffer.from(b64, 'base64'));
        it.content = `${baseUrl}/uploads/${filename}`;
        continue;
      }

      // http(s) URL -> download and save locally
      if (typeof c === 'string' && (c.startsWith('http://') || c.startsWith('https://'))) {
        // fetch and save
        try {
          const res = await fetch(c);
          if (!res.ok) { console.warn('Failed download asset', c, res.status); continue; }
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          // try to determine extension
          const urlExt = path.extname((new URL(c)).pathname) || '';
          let ext = urlExt;
          if (!ext) {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('jpeg')) ext = '.jpg'; else if (ct.includes('png')) ext = '.png'; else if (ct.includes('webp')) ext = '.webp'; else if (ct.includes('mp4')) ext = '.mp4'; else if (ct.includes('mpeg') || ct.includes('mp3')) ext = '.mp3'; else ext = '.bin';
          }
          const filename = `${Date.now()}-${k}${ext}`;
          const dest = path.join(uploadsDir, filename);
          await fs.promises.writeFile(dest, buffer);
          it.content = `${baseUrl}/uploads/${filename}`;
        } catch (err) {
          console.error('Error downloading asset for template', c, err);
        }
      }
    } catch (err) {
      console.error('saveTemplate asset handling error for', k, err);
    }
  }

  const file = path.join(templatesDir, `${id}.json`);
  await fs.promises.writeFile(file, JSON.stringify({ id, template }, null, 2));
  // also save a copy as the 'last saved' template for quick retrieval
  try {
    const lastFile = path.join(templatesDir, `last_template.json`);
    await fs.promises.writeFile(lastFile, JSON.stringify({ id, template }, null, 2));
  } catch (e) { console.warn('Failed to write last_template copy', e); }
  return id;
}

async function loadTemplate(id) {
  const file = path.join(templatesDir, `${id}.json`);
  if (!fs.existsSync(file)) throw new Error('template_not_found');
  const raw = await fs.promises.readFile(file, 'utf8');
  const obj = JSON.parse(raw);
  return obj.template;
}

async function saveRenderTask(task) {
  const file = path.join(rendersDir, `${task.id}.json`);
  await fs.promises.writeFile(file, JSON.stringify(task, null, 2));
}

async function loadRenderTask(id) {
  const file = path.join(rendersDir, `${id}.json`);
  if (!fs.existsSync(file)) throw new Error('render_not_found');
  return JSON.parse(await fs.promises.readFile(file, 'utf8'));
}

// Templates API
app.post('/api/templates', async (req, res) => {
  try {
    const tpl = req.body;
    const id = await saveTemplate(tpl);
    return res.json({ template_id: id });
  } catch (err) {
    console.error('Save template failed', err);
    return res.status(500).json({ error: 'save_failed' });
  }
});

app.get('/api/templates/:id', async (req, res) => {
  try {
    const tpl = await loadTemplate(req.params.id);
    return res.json(tpl);
  } catch (err) {
    return res.status(404).json({ error: 'not_found' });
  }
});

app.get('/api/templates', async (req, res) => {
  const list = (await fs.promises.readdir(templatesDir)).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
  return res.json({ templates: list });
});

// return last saved template quickly
app.get('/api/templates/last', async (req, res) => {
  try {
    const file = path.join(templatesDir, 'last_template.json');
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'not_found' });
    const raw = await fs.promises.readFile(file, 'utf8');
    return res.json(JSON.parse(raw));
  } catch (e) { return res.status(500).json({ error: 'read_failed' }); }
});

// Export assets for a template: copies referenced uploads into a folder and zips them
app.post('/api/templates/:id/export-assets', async (req, res) => {
  try {
    const id = req.params.id;
    const tpl = await loadTemplate(id);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const assetsDir = path.join(templatesDir, `${id}_assets`);
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
    const files = [];
    const mods = tpl.modifications || {};
    const group = req.query.group || req.body?.group_id;
    for (const k of Object.keys(mods)) {
      const it = mods[k];
      if (!it || !it.content) continue;
      if (group) {
        // template stores group id as group_id in modifications
        if (!it.group_id && !it.groupId && !it.group) continue;
        const gid = it.group_id || it.groupId || it.group;
        if (String(gid) !== String(group)) continue;
      }
      const c = it.content;
      if (typeof c === 'string' && (c.startsWith(baseUrl + '/uploads') || c.includes('/uploads/'))) {
        // extract filename
        const p = c.split('/uploads/').pop();
        if (!p) continue;
        const src = path.join(uploadsDir, p);
        if (fs.existsSync(src)) {
          const dest = path.join(assetsDir, path.basename(src));
          await fs.promises.copyFile(src, dest);
          files.push(dest);
        }
      }
    }
    if (files.length === 0) return res.status(400).json({ error: 'no_assets' });
    // create zip in uploads
    const zipName = `${id}-assets-${Date.now()}.zip`;
    const zipPath = path.join(uploadsDir, zipName);
    // try using PowerShell Compress-Archive on Windows else fallback to creating a simple folder response
    try {
      if (process.platform === 'win32') {
        const psArgs = ['-NoProfile', '-Command', `Compress-Archive -Path "${assetsDir}\\*" -DestinationPath "${zipPath}" -Force`];
        cp.spawnSync('powershell', psArgs, { stdio: 'inherit' });
      } else {
        // try zip command on unix
        cp.spawnSync('zip', ['-r', zipPath, '.'], { cwd: assetsDir });
      }
      const url = `${baseUrl}/uploads/${zipName}`;
      return res.json({ url, files: files.map(f => path.basename(f)) });
    } catch (e) {
      console.error('Zip failed', e);
      return res.json({ folder: assetsDir, files: files.map(f => path.basename(f)) });
    }
  } catch (err) {
    console.error('Export assets failed', err);
    return res.status(500).json({ error: 'export_failed' });
  }
});

// Render task queue endpoints
app.post('/api/templates/:id/render', async (req, res) => {
  try {
    const templateId = req.params.id;
    let tpl = null;
    try { tpl = await loadTemplate(templateId); } catch (e) { return res.status(404).json({ error: 'template_not_found' }); }
    // allow overriding modifications via body
    const payload = Object.assign({}, tpl, req.body || {});
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    // embed request base url so worker can build public URLs
    payload.__request_base_url = baseUrl;
    const taskId = generateId('r_');
    const task = { id: taskId, status: 'queued', created_at: Date.now(), template_id: templateId, payload };
    await saveRenderTask(task);
    // notify worker by creating file (worker polls dir)
    return res.json({ task_id: taskId, status: 'queued' });
  } catch (err) {
    console.error('Create render task failed', err);
    return res.status(500).json({ error: 'create_failed' });
  }
});

app.get('/api/renders/:id', async (req, res) => {
  try {
    const task = await loadRenderTask(req.params.id);
    return res.json(task);
  } catch (err) {
    return res.status(404).json({ error: 'not_found' });
  }
});

// Background worker: poll rendersDir for queued tasks
let workerRunning = false;
async function processNextTask() {
  const files = await fs.promises.readdir(rendersDir);
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const file = path.join(rendersDir, f);
    const task = JSON.parse(await fs.promises.readFile(file, 'utf8'));
    if (task.status !== 'queued') continue;
    // mark processing
    task.status = 'processing';
    task.started_at = Date.now();
    await saveRenderTask(task);
    try {
      // perform TTS generation as in /api/render
      const payload = task.payload;
      const elevenApiKey = process.env.ELEVENLABS_API_KEY || payload?.template_info?.elevenlabs_api_key;
      const requestBase = payload?.__request_base_url || process.env.BASE_URL || (`http://localhost:${process.env.PORT || 3001}`);
      const generatedAudio = [];
      const mods = payload.modifications || {};
      for (const k of Object.keys(mods)) {
        const item = mods[k];
        if (item && item.type === 'audio' && item.script && item.voice_id) {
          if (!elevenApiKey) {
            console.warn(`Skipping TTS for ${item.id || k}: no ElevenLabs key`);
            continue;
          }
          try {
            const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${item.voice_id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenApiKey },
              body: JSON.stringify({ text: item.script, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
            });
            if (!ttsRes.ok) { console.error('ElevenLabs TTS error', await ttsRes.text()); continue; }
            const arrayBuffer = await ttsRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const filename = `${item.id || k}.mp3`;
            const outPath = path.join(uploadsDir, filename);
            await fs.promises.writeFile(outPath, buffer);
            const publicUrl = `${requestBase}/uploads/${filename}`;
            item.content = publicUrl;
            generatedAudio.push({ id: item.id, url: publicUrl });
          } catch (err) { console.error('TTS error', err); }
        }
      }
      // validate no blob URLs
      const offending = [];
      for (const k of Object.keys(payload.modifications || {})) {
        const it = payload.modifications[k];
        if (!it) continue; const c = it.content; if (typeof c === 'string' && c.startsWith('blob:')) offending.push(k);
      }
      if (offending.length > 0) {
        task.status = 'error'; task.error = 'Payload contains browser-local blob: URLs: ' + offending.join(', ');
        await saveRenderTask(task);
        continue;
      }
      const mp4 = await renderTemplate(payload, requestBase);
      task.status = 'done'; task.mp4_url = mp4; task.generatedAudio = generatedAudio; task.completed_at = Date.now();
      await saveRenderTask(task);
      // callback
      const callbackUrl = payload?.render_settings?.callback_url;
      if (callbackUrl) {
        try { await fetch(callbackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'done', mp4_url: mp4, generatedAudio }) }); } catch (e) { console.error('Callback failed', e); }
      }
    } catch (err) {
      console.error('Render task failed', err);
      task.status = 'error'; task.error = err.message || String(err); task.completed_at = Date.now();
      await saveRenderTask(task);
    }
    // process one at a time
    return true;
  }
  return false;
}

async function workerLoop() {
  if (workerRunning) return; workerRunning = true;
  try {
    while (true) {
      const did = await processNextTask();
      if (!did) await new Promise(r => setTimeout(r, 2000));
    }
  } catch (err) { console.error('Worker loop error', err); }
}

// start worker
workerLoop().catch(e => console.error(e));

// Health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// /api/render: save template and enqueue render task (preferred API for clients)
app.post('/api/render', async (req, res) => {
  try {
    const payload = req.body;
    console.log('/api/render received payload — saving template and enqueueing render');

    // basic check for blob: URLs — remind client to upload
    const offending = [];
    for (const k of Object.keys((payload.modifications || {}))) {
      const it = payload.modifications[k];
      if (!it) continue;
      const c = it.content;
      if (typeof c === 'string' && c.startsWith('blob:')) offending.push(k);
    }
    if (offending.length > 0) {
      const msg = 'Payload contains browser-local blob: URLs for modifications: ' + offending.join(', ');
      console.error(msg);
      return res.status(400).json({ error: msg, suggestion: 'Upload files to /api/upload or convert blobs to data: URLs in the client before calling /api/render.' });
    }

    // Save template
    const template = payload;
    const templateId = await saveTemplate({ template_id: payload.template_info?.template_id || undefined, ...template });

    // create render task
    const taskId = generateId('r_');
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    // embed base URL so worker can build public URLs
    template.__request_base_url = baseUrl;
    const task = { id: taskId, status: 'queued', created_at: Date.now(), template_id: templateId, payload: template };
    await saveRenderTask(task);

    return res.status(202).json({ status: 'queued', task_id: taskId, template_id: templateId });
  } catch (err) {
    console.error('Error in /api/render:', err);
    return res.status(500).json({ error: 'internal_server_error' });
  }
});

// Fallback to index.html for SPA routing if built; otherwise return a simple message for API-only mode
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('*', (req, res) => {
    res.status(200).send('API server running. Frontend not built — run `npm run build` to generate UI.');
  });
}

  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`Server listening on port ${port}`));
