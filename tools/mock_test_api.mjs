import fetch from 'node-fetch';
import fs from 'fs';
const base = 'http://localhost:3001';
(async ()=>{
  try{
    const payload = {
      template_info: { name: 'MOCK_TEST', canvas_size: { width: 1280, height: 720 }, total_duration: 12 },
      modifications: {
        'bg_video': { id: 'mv1', type: 'video', content: `${base}/uploads/video-1766918608290-0.bin`, transform:{x:0,y:0,width:1280,height:720}, style:{z_index:1}, timing:{start_time:0,duration:5} },
        'main_image': { id: 'mi1', type: 'image', content: `${base}/uploads/1766918605128-new_image.bin`, transform:{x:200,y:150,width:400,height:300}, style:{z_index:2}, timing:{start_time:5,duration:6} },
        'headline': { id: 't1', type: 'text', content: 'هذا نص في content', script: 'هذا نص في script ويجب أن يظهر', transform:{x:300,y:50,width:700,height:100}, style:{z_index:3,font_size:48,font_family:'Cairo',text_color:'#ffffff'}, timing:{start_time:5,duration:6} },
        'voice': { id: 'a1', type: 'audio', content: `${base}/uploads/1766923905443-new_audio.bin`, script: 'هذا السكربت للفويس اوفر', voice_id: 'fkqevZRU7Xj52dY1CTkq', transform:{}, style:{z_index:4}, timing:{start_time:5,duration:6} }
      },
      render_settings: { format: 'mp4', fps: 25 }
    };
    console.log('Saving template...');
    const res = await fetch(base + '/api/templates', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    const j = await res.json(); console.log('save resp', j);
    const tpl = j.template_id;
    console.log('Request render...');
    const cre = await fetch(base + `/api/templates/${tpl}/render`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({})});
    const cj = await cre.json(); console.log('render create', cj);
    const task = cj.task_id;
    for (let i=0;i<120;i++){
      const r = await fetch(base + `/api/renders/${task}`);
      const s = await r.json();
      console.log(i, s.status, s.mp4_url || s.error || '');
      if (s.status==='done') { console.log('Done', s.mp4_url); break; }
      if (s.status==='error') { console.error('ERR', s.error); break; }
      await new Promise(rp=>setTimeout(rp,2000));
    }
  }catch(e){ console.error(e); process.exit(1); }
})();
