// Minimal Express server (ES module) to accept template payloads and allow CRUD
// operations so n8n can create/modify templates.
import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const STORE_DIR = path.join(__dirname, 'templates');
if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR);

function safeFileName(id) {
  return id.replace(/[^a-zA-Z0-9-_\.]/g, '_');
}

// Basic profanity / dangerous-content check (customize as needed)
const blacklist = [ 'kill', 'bomb', 'terror', 'porn', 'rape' ];
function hasBlacklistedText(obj) {
  const s = JSON.stringify(obj).toLowerCase();
  return blacklist.some(w => s.includes(w));
}

// Create or upsert template
app.post('/api/templates', (req, res) => {
  const body = req.body;
  if (!body || !body.template_info || !body.template_info.template_id) {
    return res.status(400).json({ error: 'Invalid payload: missing template_info.template_id' });
  }

  if (hasBlacklistedText(body)) {
    return res.status(422).json({ error: 'Payload contains blocked content' });
  }

  // Warn if API keys are included in payload — recommend server-side storage
  if (body.template_info && body.template_info.elevenlabs_api_key) {
    console.warn('Received payload with elevenlabs_api_key. Recommend removing keys from client payloads and storing them server-side.');
    // optional: remove the key before saving
    // delete body.template_info.elevenlabs_api_key;
  }

  const id = safeFileName(body.template_info.template_id);
  const file = path.join(STORE_DIR, `${id}.json`);
  fs.writeFileSync(file, JSON.stringify(body, null, 2), 'utf8');
  return res.json({ ok: true, id });
});

// Get template
app.get('/api/templates/:id', (req, res) => {
  const id = safeFileName(req.params.id);
  const file = path.join(STORE_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return res.json(data);
});

// Patch modifications: merge `modifications` object
app.patch('/api/templates/:id', (req, res) => {
  const id = safeFileName(req.params.id);
  const file = path.join(STORE_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
  const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
  const patch = req.body;

  // Basic validation
  if (!patch || typeof patch !== 'object') return res.status(400).json({ error: 'Invalid patch body' });
  if (hasBlacklistedText(patch)) return res.status(422).json({ error: 'Patch contains blocked content' });

  // Merge modifications (replace or add keys under modifications)
  existing.modifications = existing.modifications || {};
  if (patch.modifications && typeof patch.modifications === 'object') {
    for (const k of Object.keys(patch.modifications)) {
      existing.modifications[k] = patch.modifications[k];
    }
  }

  // Allow updating render_settings or template_info partially
  if (patch.render_settings) existing.render_settings = { ...existing.render_settings, ...patch.render_settings };
  if (patch.template_info) existing.template_info = { ...existing.template_info, ...patch.template_info };

  fs.writeFileSync(file, JSON.stringify(existing, null, 2), 'utf8');
  return res.json({ ok: true, id });
});

// Simple health
app.get('/api/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Template API listening on http://localhost:${port}`));
