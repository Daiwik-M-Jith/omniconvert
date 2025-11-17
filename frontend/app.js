// Deprecated: Use app.clean.js
console.warn('Deprecated: Use app.clean.js. This file is intentionally minimal to avoid duplicate behavior.');
// Keep this file minimal to avoid duplicate state & to maintain compatibility with old deployments.
  const $ = id => document.getElementById(id);
  const form = $('convert-form');
  const fileInput = $('file-input');
  const dropzone = $('dropzone');
  const clearBtn = $('clear-file');
  const targetSelect = $('target-format');
  const fileInfo = $('file-info');
  const filePreview = $('file-preview');
  const fileName = $('file-name');
  const fileSize = $('file-size');
  const historyList = $('history-list');
  const progressRoot = $('convert-progress');
  const progressBar = $('progress-bar');
  const toastEl = $('toast');
  const refreshBtn = $('refresh-history');
  const targetNote = $('target-note');

  let currentPreviewUrl = null;

  async function fetchFormats() {
    try {
      const res = await fetch('/api/formats');
      return await res.json();
    } catch (e) {
      return [];
    }
  }

  async function fetchHistory() {
    try {
      const res = await fetch('/api/history');
      return await res.json();
    } catch (e) { return []; }
  }

  function formatBytes(size) {
    if (!size) return '—';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  function showFileInfo(file) {
    if (!file) { fileInfo.hidden = true; return; }
    fileInfo.hidden = false;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    if (file.type && file.type.startsWith('image/')) {
      if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
      currentPreviewUrl = URL.createObjectURL(file);
      filePreview.src = currentPreviewUrl; filePreview.hidden = false;
    } else { filePreview.hidden = true; }
  }

  async function renderTargets(ext) {
    const fmts = await fetchFormats();
    targetSelect.innerHTML = '';
    if (!ext) {
      const all = Array.from(new Set(fmts.flatMap(f => f.targets.map(t => t.ext))));
      all.forEach(e => {
        const o = document.createElement('option'); o.value = e; o.textContent = e.toUpperCase(); targetSelect.appendChild(o);
      });
      if (!all.length) { const opt = document.createElement('option'); opt.textContent = 'No formats available'; opt.value = ''; targetSelect.appendChild(opt); }
      return;
    }
    const entry = fmts.find(f => f.source === ext);
    if (!entry || !entry.targets.length) { targetSelect.innerHTML = '<option value="">No targets</option>'; return; }
    entry.targets.forEach(t => {
      const o = document.createElement('option'); o.value = t.ext; o.textContent = t.ext.toUpperCase(); if (t.note) o.dataset.note = t.note; targetSelect.appendChild(o);
    });
    updateTargetNote();
  }

  function updateTargetNote() { const opt = targetSelect.selectedOptions[0]; if (!opt || !opt.dataset.note) { targetNote.hidden = true; } else { targetNote.hidden = false; targetNote.textContent = opt.dataset.note; } }
  targetSelect.addEventListener('change', updateTargetNote);

  async function refreshHistory() {
    const jobs = await fetchHistory();
    historyList.innerHTML = '';
    jobs.forEach(job => {
      const li = document.createElement('li'); li.className = 'history-item';
      const status = job.status || 'pending';
      const badge = document.createElement('div'); badge.className = `job-badge job-status-${status}`; badge.textContent = status;
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.innerHTML = `<div><strong>#${job.id}</strong> ${job.source_name} → ${job.target_format.toUpperCase()}</div><div class="meta">${job.duration_ms ?? '-'} ms • ${new Date(job.created_at).toLocaleString()}</div>`;
      li.appendChild(badge); li.appendChild(meta);
      const actions = document.createElement('div'); actions.className = 'history-actions';
      if (job.artifact_stored) { const d = document.createElement('button'); d.className = 'small'; d.textContent = 'Download'; d.addEventListener('click', ()=>downloadArtifact(job.id)); actions.appendChild(d); }
      if (job.original_stored) { const r = document.createElement('button'); r.className = 'small'; r.textContent = 'Re-run'; r.addEventListener('click', async ()=>{ r.disabled = true; showToast('Re-running...'); try { const res = await fetch(`/api/jobs/${job.id}/reconvert`, { method: 'POST' }); if (!res.ok) showToast('Re-run failed', 'error'); else { showToast('Re-run queued', 'success'); await refreshHistory(); } } catch (e) { showToast(e.message,'error'); } finally { r.disabled = false; } }); actions.appendChild(r); }
      const s = document.createElement('button'); s.className = 'small'; s.textContent = 'Share'; s.addEventListener('click', async ()=>{ s.disabled = true; try { const res = await fetch(`/api/jobs/${job.id}/share`, { method: 'POST' }); if (!res.ok) return showToast('Share failed', 'error'); const d = await res.json(); try { await navigator.clipboard.writeText(d.share_url); showToast('Share URL copied', 'success'); } catch { showToast(d.share_url, 'info'); } } catch(e) { showToast(e.message,'error'); } finally { s.disabled = false; } }); actions.appendChild(s);
      li.appendChild(actions);
      historyList.appendChild(li);
    });
  }

  async function downloadArtifact(id) {
    try {
      const res = await fetch(`/api/jobs/${id}/artifact`);
      if (!res.ok) throw new Error('Artifact not available');
      const blob = await res.blob(); const cd = res.headers.get('Content-Disposition')||''; const fname = cd.split('filename=')[1] ? cd.split('filename=')[1].replace(/"/g,'') : `artifact-${id}`;
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
    } catch (e) { showToast((e && e.message) || 'Download failed', 'error'); }
  }

  function showToast(txt, type='info', ms = 3500) { if (!toastEl) { console.log(txt); return; } toastEl.textContent = txt; toastEl.className = `toast ${type}`; toastEl.hidden = false; window.clearTimeout(toastEl._timeout); toastEl._timeout = window.setTimeout(()=>{ toastEl.hidden = true; toastEl.className = 'toast'; }, ms); }

  function setProgress(pct) { if (!progressRoot) return; progressRoot.hidden = false; progressBar.style.width = `${pct}%`; }
  function resetProgress() { if (!progressRoot) return; progressBar.style.width = '0%'; progressRoot.hidden = true; }

  function postWithProgress(formData) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/convert'); xhr.responseType = 'blob';
      xhr.upload.addEventListener('progress', (e) => { if (e.lengthComputable) { const p = Math.floor((e.loaded/e.total) * 80); setProgress(p); } });
      xhr.addEventListener('load', () => { setProgress(100); resolve({ status: xhr.status, headers: xhr.getAllResponseHeaders(), blob: xhr.response }); });
      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.send(formData);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault(); if (!form.reportValidity()) return; const file = fileInput.files[0]; if (!file) return showToast('Pick a file','error'); if (!targetSelect.value) return showToast('Pick a target','error');
    const fd = new FormData(); fd.append('file', file, file.name); fd.append('target_format', targetSelect.value);
    const btn = form.querySelector('.primary'); if (btn) { btn.disabled = true; btn.textContent = 'Converting...'; }
    try {
      const res = await postWithProgress(fd);
      resetProgress(); if (res.status < 200 || res.status >= 300) { const txt = await new Response(res.blob).text().catch(()=>null); throw new Error(txt || `Conversion failed (${res.status})`); }
      const blob = res.blob; const headers = res.headers || ''; const hd = {}; headers.split('\r\n').forEach(l => { const [k,v] = l.split(': '); if (k && v) hd[k] = v; }); const cd = hd['Content-Disposition'] || 'attachment; filename=converted'; const fname = (cd.split('filename=')[1] || 'converted').replace(/"/g,''); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 5000); showToast(`Downloaded ${fname}`,'success'); fileInput.value = ''; showFileInfo(null); await refreshHistory();
    } catch (err) { showToast(err.message || 'Conversion failed','error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Convert'; } resetProgress(); }
  }

  // Drag & drop support
  ['dragenter','dragover'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
  dropzone.addEventListener('drop', (e) => { const file = e.dataTransfer.files[0]; if (!file) return; const dt = new DataTransfer(); dt.items.add(file); fileInput.files = dt.files; fileInput.dispatchEvent(new Event('change')); });

  fileInput.addEventListener('change', (e) => { const f = e.target.files[0]; showFileInfo(f); renderTargets(f ? f.name.split('.').pop().toLowerCase() : null); });
  clearBtn.addEventListener('click', () => { fileInput.value = ''; showFileInfo(null); renderTargets(); });
  form.addEventListener('submit', handleSubmit);
  if (refreshBtn) refreshBtn.addEventListener('click', refreshHistory);

  // init
  (async ()=>{ await renderTargets(); await refreshHistory(); })();
// End of deprecated file

// Deprecated app.js - consolidated UI has been moved to app.clean.js
console.warn('Deprecated: Use app.clean.js. This file is intentionally minimal to avoid duplicate behavior.');
// This file is left intentionally minimal for compatibility reasons.
(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('convert-form');
  const fileInput = $('file-input');
  const targetSelect = $('target-format');
  const historyList = $('history-list');
  const messageEl = $('message');
  const convertBtn = $('convert-btn');
  const spinner = $('spinner');

  async function fetchFormats() {
    try { const r = await fetch('/api/formats'); return await r.json(); } catch { return []; }
  }

  async function fetchHistory() {
    try { const r = await fetch('/api/history'); return await r.json(); } catch { return []; }
  }

  function setMessage(txt) { messageEl.textContent = txt ?? ''; }

  async function renderTargets() {
    targetSelect.innerHTML = '';
    const file = fileInput.files[0];
    if (!file) { const op = document.createElement('option'); op.value = ''; op.textContent = 'Pick a file first'; targetSelect.appendChild(op); return; }
    const ext = file.name.split('.').pop()?.toLowerCase();
    const formats = await fetchFormats();
    const entry = formats.find(f => f.source === ext);
    if (!entry || !entry.targets.length) { targetSelect.innerHTML = '<option value="">No targets</option>'; return; }
    entry.targets.forEach(t => { const o = document.createElement('option'); o.value = t.ext; o.textContent = t.ext.toUpperCase(); targetSelect.appendChild(o); });
  }

  async function refreshHistory() {
    const data = await fetchHistory();
    historyList.innerHTML = '';
    data.forEach(job => {
      const li = document.createElement('li'); li.className = 'history-item';
      const left = document.createElement('div'); left.textContent = `#${job.id} ${job.source_name} → ${job.target_format.toUpperCase()}`;
      const actions = document.createElement('div'); actions.style.display = 'flex'; actions.style.gap = '0.5rem';
      if (job.artifact_stored) {
        const btn = document.createElement('button'); btn.className = 'small'; btn.textContent = 'Download';
        btn.addEventListener('click', async () => { try { const r = await fetch(`/api/jobs/${job.id}/artifact`); if (!r.ok) { setMessage('Failed to fetch artifact'); return; } const blob = await r.blob(); const cd = r.headers.get('Content-Disposition') || ''; const fname = cd.split('filename=')[1] || `artifact-${job.id}`; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname.replace(/"/g, ''); document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 3000);} catch(e) { setMessage(e.message) } });
        actions.appendChild(btn);
      }
      if (job.original_stored) {
        const runBtn = document.createElement('button'); runBtn.className = 'small'; runBtn.textContent = 'Re-run';
        runBtn.addEventListener('click', async () => {
          runBtn.disabled = true; setMessage('Re-running conversion...');
          try { const r = await fetch(`/api/jobs/${job.id}/reconvert`, { method: 'POST' }); if(!r.ok) setMessage('Re-run failed'); else { setMessage('Re-run success'); await refreshHistory(); } } catch (e) { setMessage(e.message) } finally { runBtn.disabled = false; }
        });
        actions.appendChild(runBtn);
      }
      const shareBtn = document.createElement('button'); shareBtn.className = 'small'; shareBtn.textContent = 'Share';
      shareBtn.addEventListener('click', async () => {
        shareBtn.disabled = true; setMessage('Creating share link...');
        try { const r = await fetch(`/api/jobs/${job.id}/share`, { method: 'POST' }); if(!r.ok) { setMessage('Share failed'); return; } const d = await r.json(); try { await navigator.clipboard.writeText(d.share_url); setMessage('Share URL copied to clipboard'); } catch(e) { setMessage(d.share_url); } } catch (e) { setMessage(e.message) } finally { shareBtn.disabled = false; }
      });
      actions.appendChild(shareBtn);
      li.appendChild(left); li.appendChild(actions); historyList.appendChild(li);
    });
  }

  async function handleConvert(e) {
    e.preventDefault();
    if (!fileInput.files[0]) { setMessage('Pick a file'); return; }
    if (!targetSelect.value) { setMessage('Pick a target format'); return; }
    convertBtn.disabled = true; spinner.hidden = false; setMessage('Converting...');
    const fd = new FormData(); fd.append('file', fileInput.files[0]); fd.append('target_format', targetSelect.value);
    try {
      const res = await fetch('/api/convert', { method: 'POST', body: fd });
      if (!res.ok) { try { const j = await res.json(); setMessage(j.detail || 'Conversion failed'); } catch { setMessage('Conversion failed') } return; }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const fname = cd.split('filename=')[1] || 'converted';
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname.replace(/"/g, ''); document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
      setMessage('Conversion complete'); fileInput.value = '';
      await refreshHistory();
    } catch (ex) {
      setMessage(ex.message || 'Conversion failed');
    } finally { convertBtn.disabled = false; spinner.hidden = true; }
  }

  fileInput.addEventListener('change', renderTargets);
  form.addEventListener('submit', handleConvert);
  window.addEventListener('load', async () => { await renderTargets(); await refreshHistory(); });
})();
// Minimal frontend script (single-scope to avoid global duplicates)
(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('convert-form');
  const fileInput = $('file-input');
  const targetSelect = $('target-format');
  const historyList = $('history-list');
  const msg = $('message');

  const fmt = async () => { try { const res = await fetch('/api/formats'); return await res.json(); } catch { return []; } };
  const history = async () => { try { const res = await fetch('/api/history'); return await res.json(); } catch { return []; } };

  const renderTargets = async () => {
    targetSelect.innerHTML = '';
    const file = fileInput.files[0];
    if (!file) { const opt = document.createElement('option'); opt.value=''; opt.textContent='Pick a file first'; targetSelect.appendChild(opt); return; }
    const ext = file.name.split('.').pop()?.toLowerCase(); const fmts = await fmt();
    const entry = fmts.find(e => e.source === ext);
    if (!entry) { targetSelect.innerHTML = '<option value="">No targets</option>'; return; }
    entry.targets.forEach(t => { const o = document.createElement('option'); o.value = t.ext; o.textContent = t.ext.toUpperCase(); targetSelect.appendChild(o); });
  };

  const refreshHistory = async () => {
    const data = await history(); historyList.innerHTML = '';
    data.forEach(j => {
      const li = document.createElement('li'); li.className = 'history-item';
      const text = document.createElement('div'); text.textContent = `#${j.id} ${j.source_name} → ${j.target_format.toUpperCase()}`;
      const actions = document.createElement('div');
      if (j.artifact_stored) { const b = document.createElement('button'); b.className='small'; b.textContent='Download'; b.onclick = () => downloadArtifact(j.id); actions.appendChild(b); }
      li.appendChild(text); li.appendChild(actions); historyList.appendChild(li);
    });
  };

  const downloadArtifact = async (id) => {
    try { const res = await fetch(`/api/jobs/${id}/artifact`); if (!res.ok) throw new Error('Artifact not found'); const blob = await res.blob(); const cd = res.headers.get('Content-Disposition')||''; const filename = cd.split('filename=')[1] || `artifact-${id}`; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename.replace(/"/g,''); document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),3000); } catch (e) { msg.textContent = e.message; }
  };

  form.addEventListener('submit', async (e)=>{
    e.preventDefault(); if (!fileInput.files[0]) { msg.textContent = 'Pick a file'; return; } if (!targetSelect.value) { msg.textContent = 'Pick a target'; return; }
    const fd = new FormData(); fd.append('file', fileInput.files[0]); fd.append('target_format', targetSelect.value); msg.textContent = 'Converting...';
    try { const res = await fetch('/api/convert', { method: 'POST', body: fd }); if (!res.ok) { const j = await res.json().catch(()=>({ detail: 'Conversion failed' })); throw new Error(j.detail||'Conversion failed'); } const blob = await res.blob(); const cd = res.headers.get('Content-Disposition')||''; const filename = cd.split('filename=')[1] || 'converted'; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename.replace(/"/g,''); document.body.appendChild(a); a.click(); a.remove(); msg.textContent = 'Done'; fileInput.value=''; await refreshHistory(); } catch (err) { msg.textContent = err.message || 'Conversion failed'; }
  });

  fileInput.addEventListener('change', renderTargets);
  window.addEventListener('load', async () => { await renderTargets(); await refreshHistory(); });
})();
// Legacy app.js is not used. Minimal UI loads /static/app.min.js.
// Minimal frontend for OmniConvert
const form = document.getElementById('convert-form');
const fileInput = document.getElementById('file-input');
const targetSelect = document.getElementById('target-format');
const historyList = document.getElementById('history-list');
const messageEl = document.getElementById('message');

async function fetchFormats() {
  try {
    const res = await fetch('/api/formats');
    return await res.json();
  } catch (err) {
    return [];
  }
}

async function renderTargets() {
  const file = fileInput.files[0];
  const formats = await fetchFormats();
  targetSelect.innerHTML = '';
  if (!file) {
    const o = document.createElement('option'); o.value = ''; o.textContent = 'Pick a file first'; targetSelect.appendChild(o); return;
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  const entry = formats.find(f=>f.source===ext);
  if (!entry || !entry.targets.length) {
    targetSelect.innerHTML = '<option value="">No targets</option>'; return;
  }
  entry.targets.forEach(t=>{
    const o = document.createElement('option'); o.value = t.ext; o.textContent = t.ext.toUpperCase(); targetSelect.appendChild(o);
  });
}

async function fetchHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    historyList.innerHTML = '';
    data.forEach(job=>{
      const li = document.createElement('li'); li.className = 'history-item';
      li.innerHTML = `<div><strong>#${job.id}</strong> ${job.source_name} → ${job.target_format.toUpperCase()}</div>`;
      const right = document.createElement('div');
      if (job.artifact_stored) {
        const btn = document.createElement('button'); btn.className = 'small'; btn.textContent = 'Download';
        btn.onclick = ()=> downloadArtifact(job.id);
        right.appendChild(btn);
      }
      li.appendChild(right);
      historyList.appendChild(li);
    });
  } catch(err){ console.warn(err); }
}

async function downloadArtifact(jobId){
  try{
    const res = await fetch(`/api/jobs/${jobId}/artifact`);
    if(!res.ok) throw new Error('Artifact not available');
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition')||'';
    const fname = cd.split('filename=')[1] || `artifact-${jobId}`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname.replace(/\"/g,''); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  }catch(err){ message(`${err.message}`); }
}

function message(msg){ messageEl.textContent = msg; }

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!fileInput.files[0]){ message('Pick a file'); return; }
  if(!targetSelect.value){ message('Pick a target format'); return; }
  const fd = new FormData(); fd.append('file', fileInput.files[0]); fd.append('target_format', targetSelect.value);
  message('Converting...');
  try{
    const res = await fetch('/api/convert', { method: 'POST', body: fd });
    if(!res.ok){ const err = await res.json().catch(()=>({detail:'Conversion failed'})); throw new Error(err.detail||'Conversion failed'); }
    // download file
    const blob = await res.blob(); const cd = res.headers.get('Content-Disposition')||''; const fname = cd.split('filename=')[1] || 'converted';
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname.replace(/\"/g,''); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
    message('Done.');
    fileInput.value = '';
    await fetchHistory();
  }catch(err){ message(err.message || 'Conversion failed'); }
});

fileInput.addEventListener('change', () => { renderTargets(); });
window.addEventListener('load', async ()=>{ await renderTargets(); await fetchHistory(); });
const form = document.getElementById('convert-form');
const fileInput = document.getElementById('file-input');
const targetSelect = document.getElementById('target-format');
const historyList = document.getElementById('history-list');
const messageEl = document.getElementById('message');

async function fetchFormats() {
  try {
    const res = await fetch('/api/formats');
    const data = await res.json();
    return data;
  } catch (err) {
    return [];
  }
}

async function renderTargets() {
  const file = fileInput.files[0];
  const formats = await fetchFormats();
  targetSelect.innerHTML = '';
  if (!file) {
    const o = document.createElement('option'); o.value = ''; o.textContent = 'Pick a file first'; targetSelect.appendChild(o); return;
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  const entry = formats.find(f=>f.source===ext);
  if (!entry || !entry.targets.length) {
    targetSelect.innerHTML = '<option value="">No targets</option>'; return;
  }
  entry.targets.forEach(t=>{
    const o = document.createElement('option'); o.value = t.ext; o.textContent = t.ext.toUpperCase(); targetSelect.appendChild(o);
  });
}

async function fetchHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    historyList.innerHTML = '';
    data.forEach(job=>{
      const li = document.createElement('li'); li.className = 'history-item';
      li.innerHTML = `<div><strong>#${job.id}</strong> ${job.source_name} → ${job.target_format.toUpperCase()}</div>`;
      const right = document.createElement('div');
      if (job.artifact_stored) {
        const btn = document.createElement('button'); btn.className = 'small'; btn.textContent = 'Download';
        btn.onclick = ()=> downloadArtifact(job.id);
        right.appendChild(btn);
      }
      li.appendChild(right);
      historyList.appendChild(li);
    });
  } catch(err){}
}

async function downloadArtifact(jobId){
  try{
    const res = await fetch(`/api/jobs/${jobId}/artifact`);
    if(!res.ok) throw new Error('Artifact not available');
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition')||'';
    const fname = cd.split('filename=')[1] || `artifact-${jobId}`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname.replace(/\"/g,''); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  }catch(err){ message(`${err.message}`); }
}

function message(msg){ messageEl.textContent = msg; }

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!fileInput.files[0]){ message('Pick a file'); return; }
  if(!targetSelect.value){ message('Pick a target format'); return; }
  const fd = new FormData(); fd.append('file', fileInput.files[0]); fd.append('target_format', targetSelect.value);
  message('Converting...');
  try{
    const res = await fetch('/api/convert', { method: 'POST', body: fd });
    if(!res.ok){ const err = await res.json().catch(()=>({detail:'Conversion failed'})); throw new Error(err.detail||'Conversion failed'); }
    // download file
    const blob = await res.blob(); const cd = res.headers.get('Content-Disposition')||''; const fname = cd.split('filename=')[1] || 'converted';
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname.replace(/\"/g,''); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
    message('Done.');
    fileInput.value = '';
    await fetchHistory();
  }catch(err){ message(err.message || 'Conversion failed'); }
});

fileInput.addEventListener('change', () => { renderTargets(); });
window.addEventListener('load', async ()=>{ await renderTargets(); await fetchHistory(); });
const form = document.getElementById("convert-form");
const targetSelect = document.getElementById("target-format");
const fileInput = document.getElementById("file-input");
const dropzone = document.getElementById("dropzone");
const fileInfo = document.getElementById("file-info");
const filePreview = document.getElementById("file-preview");
const fileName = document.getElementById("file-name");
const fileSize = document.getElementById("file-size");
const clearBtn = document.getElementById("clear-file");
const progressRoot = document.getElementById("convert-progress");
const progressBar = document.getElementById("progress-bar");
const historyList = document.getElementById("history-list");
const targetNote = document.getElementById('target-note');
const toast = document.getElementById('toast');
const refreshHistoryBtn = document.getElementById("refresh-history");

let formatMap = new Map();
let currentPreviewUrl = null;

async function fetchFormats() {
    const response = await fetch("/api/formats");
    const data = await response.json();
    formatMap = new Map();
    data.forEach((entry) => {
        // entry.targets are objects with ext and optional note
        formatMap.set(entry.source, entry.targets);
    });
    renderTargets();
}

function renderTargets(sourceExt) {
    const options = sourceExt ? (formatMap.get(sourceExt) ?? []) : (Array.from(new Set(Array.from(formatMap.values()).flat().map(t => t.ext))).map(e => ({ ext: e, note: null })));
    targetSelect.innerHTML = "";
    if (!options.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = sourceExt ? `No targets for .${sourceExt} yet` : "Pick a file to see targets";
        targetSelect.appendChild(option);
        targetSelect.disabled = true;
        return;
    }
    options.forEach((target) => {
        const option = document.createElement("option");
        option.value = target.ext ?? target;
        option.textContent = (target.ext ?? target).toUpperCase();
        if(target.note){ option.dataset.note = target.note; }
        targetSelect.appendChild(option);
    });
    targetSelect.disabled = false;
    updateTargetNote();
}

function updateTargetNote(){
    const opt = targetSelect.selectedOptions[0];
    if(!opt || !targetNote) { if(targetNote) targetNote.hidden = true; return; }
    const note = opt.dataset.note;
    if(note){ targetNote.hidden = false; targetNote.textContent = note; } else { targetNote.hidden = true; }
}

targetSelect.addEventListener('change', updateTargetNote);

function formatBytes(size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function showFileInfo(file) {
    fileInfo.hidden = false;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    if (file.type && file.type.startsWith("image/")) {
        if(currentPreviewUrl){ URL.revokeObjectURL(currentPreviewUrl); }
        const url = URL.createObjectURL(file);
        currentPreviewUrl = url;
        filePreview.src = url;
        filePreview.hidden = false;
    } else {
        filePreview.hidden = true;
    }
    if(clearBtn) clearBtn.disabled = false;
}

fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) {
        renderTargets();
        return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    renderTargets(ext);
    showFileInfo(file);
    updateTargetNote();
});

['dragenter', 'dragover'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    })
);
['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
    })
);
dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) {
        // transfer to file input for the form
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        const ext = file.name.split('.').pop()?.toLowerCase();
        renderTargets(ext);
        showFileInfo(file);
        try{ fileInput.dispatchEvent(new Event('change', { bubbles: true })); } catch(_){ /* best-effort */ }
    }
});
clearBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileInfo.hidden = true;
    renderTargets();
    if(currentPreviewUrl){ URL.revokeObjectURL(currentPreviewUrl); currentPreviewUrl = null; }
    if(targetNote) targetNote.hidden = true;
    if(clearBtn) clearBtn.disabled = true;
});
dropzone.addEventListener('click', ()=> fileInput.click());

async function fetchHistory() {
    const response = await fetch('/api/history');
    const jobs = await response.json();
    historyList.innerHTML = '';
    jobs.forEach((job) => {
        const li = document.createElement('li');
        li.className = 'history-item';
        const statusClass = job.status === 'success' ? 'job-status-success' : job.status === 'failed' ? 'job-status-failed' : 'job-status-pending';
        li.innerHTML = `
            <div class="job-badge ${statusClass}">${job.status}</div>
            <div class="meta">
                <div><strong>#${job.id}</strong> ${job.source_name} → ${job.target_format.toUpperCase()}</div>
                <div class="meta">${job.duration_ms ?? '-'} ms • ${new Date(job.created_at).toLocaleString()}</div>
            </div>
        `;
        if (job.error) {
            const err = document.createElement('div');
            err.className = 'meta';
            err.textContent = job.error;
            li.appendChild(err);
        }
        if (job.artifact_stored) {
            const st = document.createElement('div');
            st.className = 'meta';
            const when = job.stored_at ? new Date(job.stored_at).toLocaleString() : 'saved';
            st.textContent = `Artifact: saved at ${when}`;
            li.appendChild(st);
        }
        // small utility: copy target format to the selector to re-run easily
        const copyBtn = document.createElement('button');
        copyBtn.className = 'small secondary';
        copyBtn.textContent = 'Use target';
        copyBtn.title = 'Use this result target format for a new conversion';
        copyBtn.addEventListener('click', ()=>{ targetSelect.value = job.target_format; updateTargetNote(); showToast(`Selected target ${job.target_format}`,'info',1500); });
        li.appendChild(copyBtn);
        if(job.artifact_stored){
            const btn = document.createElement('button');
            btn.className = 'small';
            btn.textContent = 'Download';
            btn.addEventListener('click', ()=>{ downloadArtifact(job.id) });
            li.appendChild(btn);
        }
        historyList.appendChild(li);
    });
}

async function downloadArtifact(jobId){
    try{
        const response = await fetch(`/api/jobs/${jobId}/artifact`);
        if(!response.ok) throw new Error('Failed to fetch artifact');
        const blob = await response.blob();
        const cd = response.headers.get('Content-Disposition') || '';
        const fileName = cd.split('filename=')[1] ? cd.split('filename=')[1].replace(/\"/g,'') : `artifact-${jobId}`;
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = fileName; document.body.appendChild(link); link.click(); link.remove();
        setTimeout(()=>URL.revokeObjectURL(link.href), 5000);
    }catch(err){ showToast(err.message || 'Download failed', 'error'); }
}

function setProgress(percent){ progressRoot.hidden = false; progressBar.style.width = `${percent}%`; }
function resetProgress(){ progressBar.style.width = '0%'; progressRoot.hidden = true; }

function showToast(msg, type = 'info', ms = 3500){
    if(!toast){ alert(msg); return; }
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    toast.hidden = false;
    window.clearTimeout(toast._timeout);
    toast._timeout = window.setTimeout(()=>{ toast.hidden = true; toast.className = 'toast'; }, ms);
}

function postWithProgress(formData){
    return new Promise((resolve, reject) =>{
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/convert');
        xhr.responseType = 'blob';
        xhr.upload.addEventListener('progress', (e)=>{
            if(e.lengthComputable){ const p = Math.floor((e.loaded/e.total) * 80); setProgress(p); }
        });
        xhr.addEventListener('load', ()=>{ setProgress(100); resolve({status: xhr.status, headers: xhr.getAllResponseHeaders(), blob: xhr.response }); });
        xhr.addEventListener('error', ()=>{ reject(new Error('Network error')); });
        xhr.send(formData);
    });
}

async function handleSubmit(event){
    event.preventDefault();
    // Let browser validate required fields first so built-in messages show
    if(!form.reportValidity()) return;
    const file = fileInput.files[0];
    if(!file){ showToast('Please pick a file', 'error'); fileInput.focus(); return; }
    if(!targetSelect.value){ showToast('Select a target format', 'error'); return; }
    const fd = new FormData(); fd.append('file', file, file.name); fd.append('target_format', targetSelect.value);
    const button = form.querySelector('.primary');
    button.disabled = true; button.textContent = 'Converting...';
    try{
        const resp = await postWithProgress(fd);
        resetProgress();
        if(resp.status < 200 || resp.status >= 300){
            const errText = await new Response(resp.blob).text().catch(()=> 'Conversion failed');
            throw new Error(errText || `Status ${resp.status}`);
        }
        const blob = resp.blob;
        // parse headers into map-like
        const headersStr = resp.headers || '';
        const headersObj = {};
        headersStr.split('\r\n').forEach(line=>{ const [k,v] = line.split(': '); if(k && v) headersObj[k] = v; });
        const contentDisposition = headersObj['Content-Disposition'] || 'attachment; filename=converted';
        const fileNameOut = (contentDisposition.split('filename=')[1] || 'converted').replace(/\"/g, '');
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = fileNameOut; document.body.appendChild(link); link.click(); link.remove();
        setTimeout(()=>URL.revokeObjectURL(link.href), 5000);
        // success toast
        try{ showToast(`Downloaded ${fileNameOut}`, 'success'); } catch(_){}
        await fetchHistory();
    } catch(err){
        // Show the converter's message (already surfaced by API)
        showToast(err.message || 'Conversion failed', 'error');
    }
    finally { button.disabled = false; button.textContent = 'Convert'; resetProgress(); }
}

form.addEventListener("submit", handleSubmit);
refreshHistoryBtn.addEventListener("click", fetchHistory);

fetchFormats();
fetchHistory();
renderTargets();
// If the underlying browser required flag prevents the change event from firing when files are set
// programmatically, ensure the initial state is correct by re-rendering targets (defensive).
fileInput.addEventListener('change', () => { renderTargets(fileInput.files[0]?.name.split('.').pop()?.toLowerCase()); updateTargetNote(); });
