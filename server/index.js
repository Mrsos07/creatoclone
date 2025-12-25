import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { renderTemplate } from './render.js';
import multer from 'multer';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static built files
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Ensure uploads folder exists and serve it
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Multer upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({ storage });

// Upload endpoint: accepts multipart/form-data with field 'file' and returns public URL
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/${req.file.filename}`;
    return res.json({ url });
  } catch (err) {
    console.error('Upload error', err);
    return res.status(500).json({ error: 'upload_failed' });
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
  const id = template.template_id || generateId('tpl_');
  const file = path.join(templatesDir, `${id}.json`);
  await fs.promises.writeFile(file, JSON.stringify({ id, template }, null, 2));
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
            const baseUrl = `${process.env.BASE_URL || 'http://localhost:' + (process.env.PORT || 3000)}`;
            const publicUrl = `${baseUrl}/uploads/${filename}`;
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
      const baseUrl = `${process.env.BASE_URL || 'http://localhost:' + (process.env.PORT || 3000)}`;
      const mp4 = await renderTemplate(payload, baseUrl);
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

// /api/render handler: generate ElevenLabs TTS server-side when audio scripts present
app.post('/api/render', async (req, res) => {
  try {
    const payload = req.body;
    console.log('/api/render received payload');

    // Prefer environment variable for ElevenLabs API key; fall back to template value if provided
    const elevenApiKey = process.env.ELEVENLABS_API_KEY || payload?.template_info?.elevenlabs_api_key;
    if (!elevenApiKey) console.warn('ElevenLabs API key not found in environment or payload.template_info');

    // For each audio modification with a `script` and `voice_id`, generate TTS via ElevenLabs
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
            headers: {
              'Content-Type': 'application/json',
              'xi-api-key': elevenApiKey,
            },
            body: JSON.stringify({
              text: item.script,
              model_id: 'eleven_multilingual_v2',
              voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            })
          });

          if (!ttsRes.ok) {
            const txt = await ttsRes.text().catch(() => '');
            console.error('ElevenLabs TTS error', ttsRes.status, txt);
            continue;
          }

          const arrayBuffer = await ttsRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const filename = `${item.id || k}.mp3`;
          const outPath = path.join(uploadsDir, filename);
          await fs.promises.writeFile(outPath, buffer);

          // Expose public URL for the generated audio
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          const publicUrl = `${baseUrl}/uploads/${filename}`;

          // Replace content in payload so renderer can fetch it
          item.content = publicUrl;
          generatedAudio.push({ id: item.id, url: publicUrl });
        } catch (err) {
          console.error('Error generating TTS for', item.id || k, err);
        }
      }
    }

    // After generating audio URLs (if any), call renderer to produce final mp4
    try {
      // Validate no browser-local blob: URLs remain in payload (server cannot fetch them)
      const offending = [];
      for (const k of Object.keys(payload.modifications || {})) {
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

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const mp4Url = await renderTemplate(payload, baseUrl);
      // respond with done and mp4 url
      const result = { status: 'done', mp4_url: mp4Url, generatedAudio };

      // If callback_url provided, POST the result to it (non-blocking)
      const callbackUrl = payload?.render_settings?.callback_url;
      if (callbackUrl) {
        (async () => {
          try {
            await fetch(callbackUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(result),
            });
            console.log('Callback posted to', callbackUrl);
          } catch (cbErr) {
            console.error('Callback POST failed:', cbErr);
          }
        })();
      }

      return res.status(200).json(result);
    } catch (err) {
      console.error('Render error:', err);
      const fallback = { status: 'accepted', generatedAudio, error: err.message };
      const callbackUrl = payload?.render_settings?.callback_url;
      if (callbackUrl) {
        (async () => {
          try {
            await fetch(callbackUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'error', error: err.message }),
            });
            console.log('Error callback posted to', callbackUrl);
          } catch (cbErr) {
            console.error('Error callback POST failed:', cbErr);
          }
        })();
      }
      return res.status(202).json(fallback);
    }
  } catch (err) {
    console.error('Error in /api/render:', err);
    return res.status(500).json({ error: 'internal_server_error' });
  }
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}`));
