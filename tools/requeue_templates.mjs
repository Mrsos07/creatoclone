import fs from 'fs';
import path from 'path';

const tplDir = path.join(process.cwd(),'data','templates');
const files = fs.readdirSync(tplDir).filter(f=>f.endsWith('.json'));
for (const file of files) {
  const id = file.replace(/\.json$/,'');
  const raw = fs.readFileSync(path.join(tplDir,file),'utf8');
  if (raw.includes('blob:')) { console.log('SKIP (blob):', id); continue; }
  try {
    const res = await fetch(`http://localhost:3001/api/templates/${id}/render`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) });
    const j = await res.json();
    console.log('ENQUEUED', id, j);
  } catch (e) {
    console.error('ERR', id, e.message || e);
  }
}
