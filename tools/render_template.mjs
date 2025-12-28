import fetch from 'node-fetch';
const tpl = process.argv[2] || 'tpl_50c806511e6b';
(async ()=>{
  try{
    const res = await fetch(`http://localhost:3001/api/templates/${tpl}/render`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) });
    const j = await res.json();
    console.log('create render:', j);
    const taskId = j.task_id;
    if(!taskId){ console.error('no task id'); process.exit(1); }
    for(let i=0;i<200;i++){
      const r = await fetch(`http://localhost:3001/api/renders/${taskId}`);
      const s = await r.json();
      console.log(i, s.status, s.mp4_url || s.error || '');
      if(s.status === 'done'){ console.log('DONE', s.mp4_url); process.exit(0); }
      if(s.status === 'error'){ console.error('ERROR', s.error); process.exit(2); }
      await new Promise(r => setTimeout(r, 2000));
    }
    console.error('timeout waiting'); process.exit(3);
  }catch(e){ console.error(e); process.exit(99); }
})();
