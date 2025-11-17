// OmniConvert — Fresh UI Logic
(function () {
  const $ = id => document.getElementById(id);
  
  // Elements
  const navConvert = $('nav-convert');
  const navHistory = $('nav-history');
  const navExplore = $('nav-explore');
  const viewConvert = $('view-convert');
  const viewHistory = $('view-history');
  const viewExplore = $('view-explore');
  const form = $('convert-form');
  const fileInput = $('file-input');
  const dropzone = $('dropzone');
  const fileSelected = $('file-selected');
  const filePreview = $('file-preview');
  const fileIcon = $('file-icon');
  const fileName = $('file-name');
  const fileSize = $('file-size');
  const clearBtn = $('clear-file');
  const targetSelect = $('target-format');
  const targetNote = $('target-note');
  const progressRoot = $('convert-progress');
  const progressBar = $('progress-bar');
  const historyList = $('history-list');
  const refreshBtn = $('refresh-history');
  const conversionSearch = $('conversion-search');
  const clearSearch = $('clear-search');
  const conversionGrid = $('conversion-grid');
  const toastEl = $('toast');

  // State
  let currentFile = null;
  let currentPreviewUrl = null;
  let formatsCache = null;
  let expandedFormatsCache = null;

  async function fetchFormats(force = false) {
    if (!force && formatsCache) return formatsCache;
    try {
      const res = await fetch('/api/formats');
      const data = await res.json();
      formatsCache = data;
      return data;
    } catch (e) {
      return [];
    }
  }

  async function fetchExpandedFormats(force = false) {
    if (!force && expandedFormatsCache) return expandedFormatsCache;
    try {
      const res = await fetch('/api/formats/expanded');
      const data = await res.json();
      expandedFormatsCache = data;
      return data;
    } catch (e) {
      return [];
    }
  }

  // Navigation
  function switchView(view) {
    [viewConvert, viewHistory, viewExplore].forEach(v => v.classList.remove('active'));
    [navConvert, navHistory, navExplore].forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    view.classList.add('active');
    if (view === viewConvert) { navConvert.classList.add('active'); navConvert.setAttribute('aria-selected', 'true'); }
    if (view === viewHistory) { navHistory.classList.add('active'); navHistory.setAttribute('aria-selected', 'true'); refreshHistory(); }
    if (view === viewExplore) { navExplore.classList.add('active'); navExplore.setAttribute('aria-selected', 'true'); refreshConversionGrid(); }
  }

  navConvert.addEventListener('click', () => switchView(viewConvert));
  navHistory.addEventListener('click', () => switchView(viewHistory));
  navExplore.addEventListener('click', () => switchView(viewExplore));

  // Helpers
  async function fetchHistory() { try { const res = await fetch('/api/history'); return await res.json(); } catch { return []; } }
  
  function formatBytes(size) {
    if (!size) return '—';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size/1024).toFixed(1)} KB`;
    return `${(size/(1024*1024)).toFixed(2)} MB`;
  }

  function showFileInfo(file) {
    currentFile = file;
    if (!file) {
      dropzone.hidden = false;
      fileSelected.hidden = true;
      if (currentPreviewUrl) { URL.revokeObjectURL(currentPreviewUrl); currentPreviewUrl = null; }
      return;
    }
    dropzone.hidden = true;
    fileSelected.hidden = false;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    if (file.type && file.type.startsWith('image/')) {
      if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
      currentPreviewUrl = URL.createObjectURL(file);
      filePreview.src = currentPreviewUrl;
      filePreview.hidden = false;
      fileIcon.hidden = true;
    } else {
      filePreview.hidden = true;
      fileIcon.hidden = false;
    }
  }

  // keyboard support for Nav (left/right to change tabs)
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const active = document.querySelector('.nav-btn.active');
    if (!active) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const buttons = [navConvert, navHistory, navExplore];
      const idx = buttons.findIndex(b => b.classList.contains('active'));
      if (idx === -1) return;
      const next = e.key === 'ArrowRight' ? buttons[(idx + 1) % buttons.length] : buttons[(idx - 1 + buttons.length) % buttons.length];
      next.focus();
      next.click();
    }
  });

  async function renderTargets(ext) {
    targetSelect.innerHTML = '';
    targetSelect.disabled = !ext;
    if (!ext) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Pick a file to unlock targets';
      targetSelect.appendChild(opt);
      updateTargetNote();
      return;
    }

    const fmts = await fetchExpandedFormats();
    const entry = fmts.find(f => f.source === ext);
    if (!entry || !entry.targets.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No targets available';
      targetSelect.appendChild(opt);
      targetSelect.disabled = true;
      updateTargetNote();
      return;
    }

    targetSelect.disabled = false;
    entry.targets
      .slice()
      .sort((a, b) => (a.chain_len === b.chain_len ? a.ext.localeCompare(b.ext) : a.chain_len - b.chain_len))
      .forEach(t => {
        const o = document.createElement('option');
        o.value = t.ext;
        o.textContent = t.via_chain ? `${t.ext.toUpperCase()} • chain` : t.ext.toUpperCase();
        o.dataset.note = t.note || '';
        o.dataset.chain = t.via_chain ? 'true' : 'false';
        o.dataset.chainLen = (t.chain_len || 1).toString();
        o.dataset.path = (t.path || []).join('→');
        targetSelect.appendChild(o);
      });
    updateTargetNote();
  }

  function ensureTargetOption(meta) {
    if (!meta) return null;
    let option = Array.from(targetSelect.options).find(o => o.value === meta.ext);
    if (!option) {
      option = document.createElement('option');
      option.value = meta.ext;
      option.textContent = meta.via_chain ? `${meta.ext.toUpperCase()} • chain` : meta.ext.toUpperCase();
      option.dataset.note = meta.note || '';
      option.dataset.chain = meta.via_chain ? 'true' : 'false';
      option.dataset.chainLen = (meta.chain_len || 1).toString();
      option.dataset.path = (meta.path || []).join('→');
      targetSelect.appendChild(option);
      targetSelect.disabled = false;
    }
    return option;
  }

  function updateTargetNote() {
    if (!targetNote) return;
    const opt = targetSelect.selectedOptions[0];
    if (!opt || !opt.value) {
      targetNote.hidden = true;
      targetNote.textContent = '';
      return;
    }
    const parts = [];
    if (opt.dataset.note) parts.push(opt.dataset.note);
    if (opt.dataset.chain === 'true') {
      const steps = parseInt(opt.dataset.chainLen || '2', 10);
      parts.push(`Chain conversion (${steps} step${steps === 1 ? '' : 's'})`);
      if (opt.dataset.path) parts.push(opt.dataset.path.split('→').join(' → '));
    }
    if (!parts.length) {
      targetNote.hidden = true;
      targetNote.textContent = '';
      return;
    }
    targetNote.hidden = false;
    targetNote.textContent = parts.join(' • ');
  }
  targetSelect.addEventListener('change', updateTargetNote);

  function showToast(txt, type='info', ms=3500){ if(!toastEl) { console[type === 'error' ? 'error':'log'](txt); return; } toastEl.textContent = txt; toastEl.className = `toast ${type}`; toastEl.hidden = false; clearTimeout(toastEl._timeout); toastEl._timeout = setTimeout(()=>{ toastEl.hidden = true; toastEl.className = 'toast'; }, ms); }

  async function refreshHistory() {
    const data = await fetchHistory();
    historyList.innerHTML = '';
    
    if (!data.length) {
      const empty = document.createElement('li');
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--text-muted)';
      empty.style.padding = '2rem';
      empty.textContent = 'No conversion history yet';
      historyList.appendChild(empty);
      return;
    }
    
    data.forEach(job => {
      const li = document.createElement('li');
      li.className = 'history-item';
      const status = job.status || 'pending';
      
      const badge = document.createElement('div');
      badge.className = `job-badge job-status-${status}`;
      badge.textContent = status;
      
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `<div><strong>#${job.id}</strong> ${job.source_name} → ${job.target_format.toUpperCase()}</div>`;
      
      const actions = document.createElement('div');
      actions.className = 'history-actions';
      
      if (job.artifact_stored) {
        const d = document.createElement('button');
        d.className = 'small';
        d.textContent = 'Download';
        d.addEventListener('click', () => downloadArtifact(job.id));
        actions.appendChild(d);
      }
      
      if (job.original_stored) {
        const r = document.createElement('button');
        r.className = 'small';
        r.textContent = 'Re-run';
        r.addEventListener('click', async () => {
          r.disabled = true;
          showToast('Re-running...', 'info');
          try {
            const res = await fetch(`/api/jobs/${job.id}/reconvert`, { method: 'POST' });
            if (!res.ok) showToast('Re-run failed', 'error');
            else {
              showToast('Re-run queued', 'success');
              await refreshHistory();
            }
          } catch (e) {
            showToast(e.message, 'error');
          } finally {
            r.disabled = false;
          }
        });
        actions.appendChild(r);
      }
      
      const s = document.createElement('button');
      s.className = 'small';
      s.textContent = 'Share';
      s.addEventListener('click', async () => {
        s.disabled = true;
        try {
          const r = await fetch(`/api/jobs/${job.id}/share`, { method: 'POST' });
          if (!r.ok) return showToast('Share failed', 'error');
          const d = await r.json();
          try {
            await navigator.clipboard.writeText(d.share_url);
            showToast('Share URL copied', 'success');
          } catch {
            showToast(d.share_url, 'info');
          }
        } catch (e) {
          showToast(e.message, 'error');
        } finally {
          s.disabled = false;
        }
      });
      actions.appendChild(s);
      
      li.appendChild(badge);
      li.appendChild(meta);
      li.appendChild(actions);
      historyList.appendChild(li);
    });
  }

  // Conversion Grid
  function renderConversionGridData(formats, filter = '') {
    conversionGrid.innerHTML = '';
    const filterLower = (filter || '').trim().toLowerCase();
    formats.forEach(entry => {
      const src = entry.source;
      const srcLower = src.toLowerCase();
      const matchesFilter = !filterLower || srcLower.includes(filterLower) || entry.targets.some(t => t.ext.toLowerCase().includes(filterLower));
      if (!matchesFilter) return;
      
      const card = document.createElement('div');
      card.className = 'convert-card-mini';
      
      const head = document.createElement('div');
      head.className = 'convert-card-header';
      head.textContent = src.toUpperCase();
      
      const list = document.createElement('div');
      list.className = 'convert-target-list';
      
      entry.targets.forEach(t => {
        const b = document.createElement('button');
        b.className = 'small conversion-target-btn';
        if (t.direct) b.classList.add('direct');
        
        const label = document.createElement('span');
        label.textContent = t.ext.toUpperCase();
        b.appendChild(label);
        
        if (t.via_chain) {
          const badge = document.createElement('span');
          badge.className = 'chain-pill';
          badge.textContent = `${t.chain_len}`;
          b.appendChild(badge);
        }
        
        const pathText = (t.path || []).join(' → ') || `${src} → ${t.ext}`;
        b.setAttribute('aria-label', `Convert ${src} to ${t.ext}${t.via_chain ? ' via chain' : ''}`);
        b.title = t.via_chain ? `${pathText} (${t.chain_len} step${t.chain_len === 1 ? '' : 's'})` : pathText;
        
        b.addEventListener('click', () => {
          switchView(viewConvert);
          ensureTargetOption(t);
          targetSelect.value = t.ext;
          updateTargetNote();
          showToast(`Selected ${t.ext.toUpperCase()}`, 'info');
        });
        // keyboard activation (Enter / Space)
        b.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); b.click(); }
        });
        
        list.appendChild(b);
      });
      
      card.appendChild(head);
      card.appendChild(list);
      conversionGrid.appendChild(card);
    });
  }

  async function refreshConversionGrid() {
    let fmts = await fetchExpandedFormats();
    if (!fmts.length) {
      const fallback = await fetchFormats();
      fmts = fallback.map(entry => ({
        source: entry.source,
        targets: entry.targets.map(t => ({
          ext: t.ext,
          direct: true,
          via_chain: false,
          chain_len: 1,
          path: [entry.source, t.ext],
          note: t.note || '',
        })),
      }));
    }
    renderConversionGridData(fmts, conversionSearch ? conversionSearch.value : '');
  }

  if (conversionSearch) {
    conversionSearch.addEventListener('input', () => refreshConversionGrid());
  }
  if (clearSearch) {
    clearSearch.addEventListener('click', () => {
      if (conversionSearch) conversionSearch.value = '';
      refreshConversionGrid();
    });
  }


  async function downloadArtifact(id) {
    try {
      const r = await fetch(`/api/jobs/${id}/artifact`);
      if (!r.ok) throw new Error('Artifact not available');
      const blob = await r.blob();
      const cd = r.headers.get('Content-Disposition') || '';
      const name = (cd.split('filename=')[1] || `artifact-${id}`).replace(/"/g,'');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      showToast('Download started', 'success');
    } catch (e) {
      showToast(e.message || 'Download failed', 'error');
    }
  }

  function setProgress(p) {
    if (!progressRoot) return;
    progressRoot.hidden = false;
    progressBar.style.width = `${p}%`;
  }
  
  function resetProgress() {
    if (!progressRoot) return;
    progressBar.style.width = '0%';
    progressRoot.hidden = true;
  }

  function postWithProgress(fd) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/convert');
      xhr.responseType = 'blob';
      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) {
          const p = Math.floor((e.loaded / e.total) * 80);
          setProgress(p);
        }
      });
      xhr.addEventListener('load', () => {
        setProgress(100);
        resolve({ status: xhr.status, headers: xhr.getAllResponseHeaders(), blob: xhr.response });
      });
      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.send(fd);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const file = fileInput.files[0];
    if (!file) return showToast('Pick a file', 'error');
    if (!targetSelect.value) return showToast('Pick a target', 'error');
    
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('target_format', targetSelect.value);
    
    const btn = form.querySelector('.btn-convert');
    const btnText = btn.querySelector('span');
    if (btn) { btn.disabled = true; btnText.textContent = 'Converting...'; }
    
    try {
      const r = await postWithProgress(fd);
      resetProgress();
      
      if (r.status < 200 || r.status >= 300) {
        const txt = await new Response(r.blob).text().catch(() => null);
        throw new Error(txt || `Conversion failed (${r.status})`);
      }
      
      const blob = r.blob;
      const hdrs = r.headers;
      const obj = {};
      hdrs.split('\r\n').forEach(l => {
        const kv = l.split(': ');
        if (kv[0]) obj[kv[0]] = kv[1];
      });
      
      const cd = obj['Content-Disposition'] || 'attachment; filename=converted';
      const fname = (cd.split('filename=')[1] || 'converted').replace(/"/g,'');
      
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      
      showToast(`✓ Downloaded ${fname}`, 'success');
      fileInput.value = '';
      showFileInfo(null);
      targetSelect.value = '';
      updateTargetNote();
      await refreshHistory();
    } catch (e) {
      showToast(e.message || 'Conversion failed', 'error');
    } finally {
      if (btn) { btn.disabled = false; btnText.textContent = 'Convert Now'; }
      resetProgress();
    }
  }

  // File Input Handlers
  dropzone.addEventListener('click', () => fileInput.click());
  
  ['dragenter','dragover'].forEach(evt => dropzone.addEventListener(evt, e => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('dragover');
  }));
  
  ['dragleave','drop'].forEach(evt => dropzone.addEventListener(evt, e => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
  }));
  
  dropzone.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0];
    if (!f) return;
    const dt = new DataTransfer();
    dt.items.add(f);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change'));
  });

  fileInput.addEventListener('change', e => {
    const f = e.target.files[0];
    showFileInfo(f);
    renderTargets(f ? f.name.split('.').pop().toLowerCase() : null);
  });
  
  clearBtn.addEventListener('click', () => {
    fileInput.value = '';
    currentFile = null;
    showFileInfo(null);
    targetSelect.value = '';
    renderTargets(null);
    updateTargetNote();
  });

  form.addEventListener('submit', handleSubmit);
  refreshBtn.addEventListener('click', () => refreshHistory());

  // Init
  (async () => {
    await renderTargets(null);
    await refreshHistory();
    await refreshConversionGrid();
  })();
})();
