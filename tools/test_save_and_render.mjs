import fs from 'fs';
import path from 'path';

const baseUrl = 'http://localhost:3001';

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const txt = await res.text();
  try { return JSON.parse(txt); } catch(e) { return txt; }
}

async function getJson(url) {
  const res = await fetch(url);
  return res.json();
}

async function main() {
  // pick existing uploads to reference
  const uploads = fs.readdirSync(path.join(process.cwd(),'uploads'));
  console.log('found uploads', uploads.length);
  const sampleVideo = uploads.find(f=>f.startsWith('video-')) || uploads.find(f=>f.endsWith('.bin'));
  const sampleImage = uploads.find(f=>f.includes('image') && f.endsWith('.bin')) || uploads.find(f=>f.endsWith('.bin'));
  const sampleAudio = uploads.find(f=>f.endsWith('.mp3')) || null;
  console.log({ sampleVideo, sampleImage, sampleAudio });
  if (!sampleVideo || !sampleImage) {
    console.error('not enough sample assets in uploads/ to run test'); process.exit(1);
  }

  const payload = {
    template_info: {
      name: 'TEST_TEMPLATE_AUTO',
      canvas_size: { width: 1280, height: 720 },
      total_duration: 0
    },
    modifications: {
      'intro_video': {
        id: 'test_vid_1', type: 'video', content: `${baseUrl}/uploads/${sampleVideo}`, transform: { x:0,y:0,width:1280,height:720 }, style:{ z_index:1 }, timing:{ start_time:0, duration:5 }
      },
      'overlay_image': {
        id: 'test_img_1', type: 'image', content: `${baseUrl}/uploads/${sampleImage}`, transform: { x:200,y:150,width:400,height:300 }, style:{ z_index:3 }, timing:{ start_time:5, duration:6 }
      },
      'headline': {
        id: 'text1', type: 'text', content: 'اختبار حفظ التيمبلت وعرض النص', transform:{ x:300,y:50,width:700,height:100 }, style:{ z_index:4, font_size:48, text_color:'#ffffff' }, timing:{ start_time:5, duration:6 }
      },
      'voiceover': {
        id: 'audio1', type: 'audio', content: sampleAudio ? `${baseUrl}/uploads/${sampleAudio}` : '', script: 'هذا نص صوتي تجريبي', transform:{}, style:{ z_index:5 }, timing:{ start_time:5, duration:6 }
      }
    },
    render_settings: { format: 'mp4', fps: 25 }
  };

  console.log('saving template...');
  const save = await postJson(`${baseUrl}/api/templates`, payload);
  console.log('save result', save);
  const tplId = save.template_id;
  if (!tplId) { console.error('Failed to save template'); process.exit(2); }

  console.log('requesting render...');
  const create = await postJson(`${baseUrl}/api/templates/${tplId}/render`, {});
  console.log('create render result', create);
  if (!create.task_id) { console.error('Failed to create render task'); process.exit(3); }
  const taskId = create.task_id;

  console.log('polling task', taskId);
  for (let i=0;i<120;i++) {
    const status = await getJson(`${baseUrl}/api/renders/${taskId}`);
    console.log(i, status.status, status.mp4_url || status.error || '');
    if (status.status === 'done') { console.log('Done:', status.mp4_url); break; }
    if (status.status === 'error') { console.error('Render error:', status.error); break; }
    await new Promise(r=>setTimeout(r,2000));
  }
}

main().catch(e=>{ console.error(e); process.exit(99); });
