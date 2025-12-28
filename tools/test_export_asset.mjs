import fetch from 'node-fetch';
const id = process.argv[2] || 'tpl_50c806511e6b';
const group = process.argv[3];
const url = group ? `http://localhost:3001/api/templates/${id}/export-assets?group=${encodeURIComponent(group)}` : `http://localhost:3001/api/templates/${id}/export-assets`;
(async ()=>{
  try {
    const res = await fetch(url, { method: 'POST' });
    const text = await res.text();
    console.log('status', res.status);
    try{ console.log(JSON.parse(text)); } catch(e) { console.log(text); }
  } catch (e) { console.error('error', e); }
})();
