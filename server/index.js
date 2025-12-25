import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { renderTemplate } from './render.js';
import multer from 'multer';

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
