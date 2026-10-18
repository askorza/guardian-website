/* Guardian local-only memory proof of concept. No network requests or analytics. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const enc = new TextEncoder();
  const categories = { work: 'Work & projects', study: 'Study & learning', life: 'Daily life', preferences: 'Preferences' };
  let backend = null;
  let memories = [];
  let selectedFile = null;
  let toastTimer = 0;

  function flash(msg, error = false) {
    const toast = $('toast');
    toast.textContent = msg;
    toast.className = 'toast is-visible' + (error ? ' is-error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.className = 'toast', 3600);
  }

  const safeFrontmatter = (value) => String(value || '').replace(/[\r\n]+/g, ' ').replace(/[:"#\\]/g, '_').slice(0, 220);
  function encodeMemory(note) {
    return [
      '---',
      `id: ${safeFrontmatter(note.id)}`,
      `title: ${safeFrontmatter(note.title)}`,
      `category: ${safeFrontmatter(note.category)}`,
      `created_at: ${safeFrontmatter(note.createdAt)}`,
      ...(note.source ? [
        `source_name: ${safeFrontmatter(note.source.name)}`,
        `source_size_bytes: ${note.source.size}`,
        `source_sha256: ${safeFrontmatter(note.source.hash || 'not-computed')}`
      ] : []),
      '---', '',
      note.content, ''
    ].join('\n');
  }
  function decodeMemory(raw) {
    const marker = '\n---\n';
    if (!raw.startsWith('---\n') || !raw.includes(marker)) return null;
    const idx = raw.indexOf(marker);
    const front = raw.slice(4, idx).split('\n');
    const meta = {};
    for (const line of front) {
      const sep = line.indexOf(':');
      if (sep >= 0) meta[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
    }
    if (!meta.id || !categories[meta.category]) return null;
    return {
      id: meta.id, title: meta.title || 'Untitled', category: meta.category,
      createdAt: meta.created_at,
      content: raw.slice(idx + marker.length).trim(),
      source: meta.source_name ? { name: meta.source_name, size: Number(meta.source_size_bytes), hash: meta.source_sha256 } : null
    };
  }
  async function initBackend() {
    if (navigator.storage?.getDirectory) {
      try {
        const origin = await navigator.storage.getDirectory();
        const dir = await origin.getDirectoryHandle('guardian-memory-lab', { create: true });
        return {
          kind: 'OPFS .md files',
          async list() {
            const rows = [];
            for await (const [name, handle] of dir.entries()) {
              if (name.endsWith('.md') && handle.kind === 'file') {
                const raw = await (await handle.getFile()).text();
                const note = decodeMemory(raw);
                if (note) rows.push(note);
              }
            }
            return rows;
          },
          async save(note) { const f = await dir.getFileHandle(note.id + '.md', { create: true }); const w = await f.createWritable(); await w.write(encodeMemory(note)); await w.close(); },
          async remove(id) { await dir.removeEntry(id + '.md'); }
        };
      } catch (error) { console.warn('OPFS unavailable; trying IndexedDB', error); }
    }
    if (!('indexedDB' in window)) throw new Error('Local storage is unavailable in this browser.');
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('guardian-memory-lab', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('notes', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const query = (mode, action) => new Promise((resolve, reject) => {
      const tx = db.transaction('notes', mode);
      const store = tx.objectStore('notes');
      const req = action(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return {
      kind: 'IndexedDB · Markdown export',
      async list() { const items = await query('readonly', (s) => s.getAll()); return items.map((n) => decodeMemory(n.markdown)).filter(Boolean); },
      async save(note) { await query('readwrite', (s) => s.put({ id: note.id, markdown: encodeMemory(note) })); },
      async remove(id) { await query('readwrite', (s) => s.delete(id)); }
    };
  }
  function fmtDate(stamp) {
    const dt = new Date(stamp);
    return Number.isNaN(dt.valueOf()) ? '' : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function render() {
    const filter = $('filter-category').value;
    const subset = memories.filter((n) => filter === 'all' || n.category === filter);
    const list = $('memory-list');
    list.replaceChildren();
    $('memory-count').textContent = `${subset.length} ${subset.length === 1 ? 'memory' : 'memories'}`;
    $('storage-label').textContent = `${backend.kind} · ${Math.max(0, Math.ceil(memories.reduce((sum, n) => sum + enc.encode(encodeMemory(n)).length, 0) / 1024))} KB of Markdown`;
    if (!subset.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = memories.length ? 'No memories in this category.' : 'No saved memories yet. Add your first thought to begin.';
      list.append(empty);
      return;
    }
    subset.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const n of subset) {
      const item = document.createElement('article'); item.className = 'memory-item';
      const top = document.createElement('div'); top.className = 'memory-top';
      const cat = document.createElement('span'); cat.textContent = categories[n.category];
      const date = document.createElement('span'); date.textContent = fmtDate(n.createdAt);
      top.append(cat, date);
      const title = document.createElement('h3'); title.textContent = n.title;
      const excerpt = document.createElement('p'); excerpt.textContent = n.content.slice(0, 205) + (n.content.length > 205 ? '…' : '');
      if (!n.content) excerpt.textContent = `Original file reference: ${n.source?.name || 'none'}`;
      const meta = document.createElement('div'); meta.className = 'memory-meta';
      const size = document.createElement('span'); size.textContent = `${enc.encode(encodeMemory(n)).length} bytes · Markdown`;
      const actions = document.createElement('div');
      const exportButton = document.createElement('button'); exportButton.type = 'button'; exportButton.textContent = 'Export';
      exportButton.addEventListener('click', () => download(`${n.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 35) || 'memory'}.md`, encodeMemory(n)));
      const forget = document.createElement('button'); forget.type = 'button'; forget.textContent = 'Forget';
      forget.addEventListener('click', async () => { if (!confirm(`Permanently delete “${n.title}” from this local vault?`)) return; try { await backend.remove(n.id); await reload(); flash('Memory forgotten.'); } catch { flash('Deletion failed.', true); } });
      actions.append(exportButton, forget); meta.append(size, actions); item.append(top, title, excerpt, meta); list.append(item);
    }
  }
  function download(name, contents) {
    const blob = new Blob([contents], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  async function reload() { memories = await backend.list(); render(); }
  async function fingerprint(file) {
    if (file.size > 12 * 1024 * 1024 || !crypto.subtle) return 'not-computed';
    const bytes = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function startup() {
    try {
      backend = await initBackend();
      await reload();
      $('note-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const title = $('note-title').value.trim();
        const content = $('note-content').value.trim();
        if (!title || (!content && !selectedFile)) { flash('Write a memory or select a file reference.', true); return; }
        $('save-memory').disabled = true;
        try {
          const source = selectedFile ? { name: selectedFile.name, size: selectedFile.size, hash: await fingerprint(selectedFile) } : null;
          const note = { id: crypto.randomUUID(), title, content, category: $('note-category').value, createdAt: new Date().toISOString(), source };
          await backend.save(note);
          $('note-form').reset(); selectedFile = null; $('source-note').textContent = 'No file selected.';
          await reload(); flash('Saved as a local Markdown memory.');
        } catch (error) { console.error(error); flash('Could not save. Please check browser storage.', true); }
        finally { $('save-memory').disabled = false; }
      });
      $('reference-file').addEventListener('change', (event) => {
        selectedFile = event.target.files?.[0] || null;
        $('source-note').textContent = selectedFile ? `${selectedFile.name} · ${(selectedFile.size / 1024).toFixed(1)} KB · reference only` : 'No file selected.';
      });
      $('filter-category').addEventListener('change', render);
      $('export-all').addEventListener('click', () => {
        if (!memories.length) { flash('Nothing to export yet.', true); return; }
        const combined = [`# Guardian Memory Export\n\nCreated: ${new Date().toISOString()}\n\n`, ...memories.map(n => `## ${n.title}\n\n${encodeMemory(n)}\n`)].join('\n---\n\n');
        download('guardian-memories.md', combined); flash('Exported a portable Markdown backup.');
      });
      $('forget-category').addEventListener('click', async () => {
        const category = $('filter-category').value;
        if (category === 'all') { flash('Select a category first, or use Forget everything.', true); return; }
        const doomed = memories.filter(n => n.category === category);
        if (!doomed.length) { flash('Nothing to forget in this category.'); return; }
        if (!confirm(`Delete ${doomed.length} local memories in ${categories[category]}?`)) return;
        try { for (const n of doomed) await backend.remove(n.id); await reload(); flash('Selected category forgotten.'); } catch { flash('Deletion was not completed.', true); }
      });
      $('clear-all').addEventListener('click', async () => {
        if (!memories.length) { flash('The vault is already empty.'); return; }
        if (!confirm(`Permanently delete all ${memories.length} local memories? Export a backup first if you need one.`)) return;
        try { for (const n of memories) await backend.remove(n.id); await reload(); flash('All local memories deleted.'); } catch { flash('Deletion was not completed.', true); }
      });
    } catch (error) {
      console.error('Local memory init error:', error);
      $('memory-list').textContent = 'Local storage is unavailable in this browsing mode. Please try a standard browser window.';
      $('storage-label').textContent = 'Storage unavailable';
      $('save-memory').disabled = true;
      flash('Local storage is unavailable.', true);
    }
  }
  startup();
})();