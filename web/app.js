/* ═══════════════════════════════════════════════════════════
   app.js — ListKaraoke Web App (GitHub Pages)
   Fetch songs.json → search → lyrics/media modal
═══════════════════════════════════════════════════════════ */

'use strict';

// ─── Config ───────────────────────────────────────────────────────────────────
// songs.json được fetch từ cùng thư mục (GitHub Pages root)
const SONGS_URL = './songs.json';

// ─── State ────────────────────────────────────────────────────────────────────
let allSongs = [];
let filteredSongs = [];
let currentSong = null;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $grid       = document.getElementById('song-grid');
const $loading    = document.getElementById('loading');
const $empty      = document.getElementById('empty-state');
const $search     = document.getElementById('search-input');
const $clear      = document.getElementById('btn-clear');
const $genre      = document.getElementById('filter-genre');
const $lang       = document.getElementById('filter-lang');
const $sort       = document.getElementById('sort-by');
const $badge      = document.getElementById('badge-count');
const $overlay    = document.getElementById('modal-overlay');
const $modalClose = document.getElementById('modal-close');
const $btnTheme   = document.getElementById('btn-theme');
const $toast      = document.getElementById('toast');

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  loadTheme();
  await fetchSongs();
  bindEvents();
}

// ─── Fetch data ───────────────────────────────────────────────────────────────
async function fetchSongs() {
  try {
    const res = await fetch(SONGS_URL + '?t=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allSongs = Array.isArray(data.songs) ? data.songs : [];
    buildFilters();
    applyFilter();
  } catch (e) {
    $loading.innerHTML = `<span style="font-size:40px">⚠️</span><p style="margin-top:12px">Không tải được danh sách bài hát.<br><small>${e.message}</small></p>`;
  }
}

// ─── Build filter dropdowns ───────────────────────────────────────────────────
function buildFilters() {
  const genres = [...new Set(allSongs.map(s => s.genre).filter(Boolean))].sort();
  const langs  = [...new Set(allSongs.map(s => s.language).filter(Boolean))].sort();

  genres.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g; opt.textContent = `🎼 ${g}`;
    $genre.appendChild(opt);
  });
  langs.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l; opt.textContent = `🌐 ${l}`;
    $lang.appendChild(opt);
  });
}

// ─── Filter + Sort + Render ───────────────────────────────────────────────────
function applyFilter() {
  const q     = $search.value.trim().toLowerCase();
  const genre = $genre.value;
  const lang  = $lang.value;
  const sort  = $sort.value;

  filteredSongs = allSongs.filter(s => {
    if (genre && s.genre !== genre) return false;
    if (lang  && s.language !== lang) return false;
    if (q) {
      const hay = [
        s.title, s.artist, s.lyrics,
        s.note, (s.tags || []).join(' ')
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  filteredSongs.sort((a, b) => {
    if (sort === 'rating')     return (b.rating||0) - (a.rating||0);
    if (sort === 'created_at') return (b.created_at||'').localeCompare(a.created_at||'');
    if (sort === 'artist')     return (a.artist||'').localeCompare(b.artist||'');
    return (a.title||'').localeCompare(b.title||'');
  });

  renderGrid(filteredSongs, q);
  $badge.textContent = `${filteredSongs.length} / ${allSongs.length} bài`;
}

// ─── Render grid ──────────────────────────────────────────────────────────────
function renderGrid(songs, query = '') {
  $loading.hidden = true;

  if (songs.length === 0) {
    $grid.hidden = true;
    $empty.hidden = false;
    return;
  }
  $empty.hidden = true;
  $grid.hidden = false;
  $grid.innerHTML = '';

  songs.forEach(song => {
    const card = document.createElement('article');
    card.className = 'song-card';
    card.setAttribute('data-id', song.id);

    const ratingStars = '⭐'.repeat(Math.max(0, Math.min(5, song.rating || 0)));
    const diffStr     = '💪'.repeat(Math.max(0, Math.min(5, song.difficulty || 0)));
    const tags        = Array.isArray(song.tags) ? song.tags : [];

    const mediaDots = [
      song.mp3_gdrive_id ? '<span class="media-dot dot-mp3" title="MP3">♫</span>' : '',
      song.mp4_gdrive_id ? '<span class="media-dot dot-mp4" title="MP4">▶</span>' : '',
      song.youtube_url   ? '<span class="media-dot dot-yt"  title="YouTube">▷</span>' : '',
    ].join('');

    const tagPills = tags.slice(0, 4)
      .map(t => `<span class="tag-pill">#${esc(t)}</span>`).join('');

    card.innerHTML = `
      <div class="card-title">${highlight(esc(song.title || ''), query)}</div>
      <div class="card-artist">🎤 ${highlight(esc(song.artist || 'Chưa rõ'), query)}</div>
      <div class="card-meta">
        ${song.genre    ? `<span class="chip chip-genre">${esc(song.genre)}</span>` : ''}
        ${song.language ? `<span class="chip chip-lang">${esc(song.language)}</span>` : ''}
        ${diffStr       ? `<span class="chip chip-diff">${diffStr}</span>` : ''}
      </div>
      <div class="card-footer">
        <span class="card-rating">${ratingStars || '<span style="color:var(--muted)">Chưa đánh giá</span>'}</span>
        <div class="card-media-icons">${mediaDots}</div>
      </div>
      ${tagPills ? `<div class="card-tags">${tagPills}</div>` : ''}
    `;

    card.addEventListener('click', () => openModal(song, query));
    $grid.appendChild(card);
  });
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(song, query = '') {
  currentSong = song;

  document.getElementById('modal-title').textContent  = song.title || '';
  document.getElementById('modal-artist').textContent = `🎤 ${song.artist || 'Chưa rõ'} · ${song.genre || ''} · ${song.language || ''}`;

  // Meta row
  const ratingStars = '⭐'.repeat(song.rating || 0) || 'Chưa đánh giá';
  const diffStr = '💪'.repeat(song.difficulty || 0) || '—';
  document.getElementById('modal-meta').innerHTML = `
    <span class="chip chip-genre">${esc(song.genre||'')}</span>
    <span class="chip chip-lang">${esc(song.language||'')}</span>
    <span class="chip chip-diff">Độ khó: ${diffStr}</span>
    <span class="chip" style="background:rgba(245,158,11,.15);color:var(--warn)">${ratingStars}</span>
  `;

  // Tags
  const tags = Array.isArray(song.tags) ? song.tags : [];
  document.getElementById('modal-tags').innerHTML = tags.map(t =>
    `<span class="tag-pill">#${esc(t)}</span>`).join('');

  // Lyrics tab
  const lyricsDiv = document.getElementById('modal-lyrics');
  if (song.lyrics && song.lyrics.trim()) {
    lyricsDiv.innerHTML = `<div class="lyrics-content">${highlight(esc(song.lyrics), query)}</div>`;
  } else {
    lyricsDiv.innerHTML = '<p class="no-lyrics">📭 Chưa có lyrics cho bài này</p>';
  }

  // Media tab
  const mediaDiv = document.getElementById('media-container');
  mediaDiv.innerHTML = '';

  if (song.mp3_gdrive_id) {
    const sec = document.createElement('div');
    sec.className = 'media-section';
    sec.innerHTML = `
      <h3>🎵 Nhạc MP3</h3>
      <iframe src="https://drive.google.com/file/d/${esc(song.mp3_gdrive_id)}/preview"
              height="80" allow="autoplay" loading="lazy"
              title="MP3 Player"></iframe>
    `;
    mediaDiv.appendChild(sec);
  }

  if (song.mp4_gdrive_id) {
    const sec = document.createElement('div');
    sec.className = 'media-section';
    sec.innerHTML = `
      <h3>🎬 Video Karaoke (MP4)</h3>
      <iframe src="https://drive.google.com/file/d/${esc(song.mp4_gdrive_id)}/preview"
              height="300" allow="autoplay" loading="lazy"
              title="Karaoke Video"></iframe>
    `;
    mediaDiv.appendChild(sec);
  }

  if (song.youtube_url) {
    const sec = document.createElement('div');
    sec.className = 'media-section';
    sec.innerHTML = `
      <h3>▶️ YouTube</h3>
      <a class="media-btn media-btn-yt" href="${esc(song.youtube_url)}" target="_blank" rel="noopener">
        <span>▶️</span> Mở trên YouTube
      </a>
    `;
    mediaDiv.appendChild(sec);
  }

  if (!song.mp3_gdrive_id && !song.mp4_gdrive_id && !song.youtube_url) {
    mediaDiv.innerHTML = '<p class="no-lyrics">📭 Chưa có file media cho bài này</p>';
  }

  // Info tab
  const infoDiv = document.getElementById('info-container');
  infoDiv.innerHTML = [
    ['🎵 Tên bài', song.title],
    ['🎤 Tác giả', song.artist],
    ['🎼 Thể loại', song.genre],
    ['🌐 Ngôn ngữ', song.language],
    ['💪 Độ khó', '💪'.repeat(song.difficulty||0) || '—'],
    ['⭐ Đánh giá', '⭐'.repeat(song.rating||0) || '—'],
    ['🏷️ Tags', (song.tags||[]).join(', ') || '—'],
    ['🎵 File MP3', song.mp3_gdrive_id ? '✅ Có trên Google Drive' : '❌ Chưa có'],
    ['🎬 File MP4', song.mp4_gdrive_id ? '✅ Có trên Google Drive' : '❌ Chưa có'],
    ['📅 Thêm vào', (song.created_at||'').replace('T',' ')],
    ['💬 Ghi chú', song.note || '—'],
  ].map(([l, v]) => `
    <div class="info-row">
      <span class="info-label">${l}</span>
      <span class="info-value">${esc(String(v||'—'))}</span>
    </div>
  `).join('');

  // Reset tab
  switchTab('lyrics');

  $overlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $overlay.hidden = true;
  document.body.style.overflow = '';
  // Dừng media đang phát
  document.getElementById('media-container').innerHTML = '';
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.hidden = (p.id !== `tab-${name}`);
  });
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem('karaoke-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  $btnTheme.textContent = saved === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('karaoke-theme', next);
  $btnTheme.textContent = next === 'dark' ? '☀️' : '🌙';
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, ms = 2500) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout($toast._t);
  $toast._t = setTimeout(() => { $toast.hidden = true; }, ms);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function highlight(html, query) {
  if (!query) return html;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

// ─── Events ───────────────────────────────────────────────────────────────────
function bindEvents() {
  $search.addEventListener('input', applyFilter);
  $clear.addEventListener('click', () => { $search.value = ''; applyFilter(); $search.focus(); });
  $genre.addEventListener('change', applyFilter);
  $lang.addEventListener('change', applyFilter);
  $sort.addEventListener('change', applyFilter);
  $btnTheme.addEventListener('click', toggleTheme);
  $modalClose.addEventListener('click', closeModal);
  $overlay.addEventListener('click', e => { if (e.target === $overlay) closeModal(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (e.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault(); $search.focus();
    }
  });

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Pull-to-refresh hint
  let startY = 0;
  document.addEventListener('touchstart', e => { startY = e.touches[0].clientY; });
  document.addEventListener('touchend', e => {
    if (e.changedTouches[0].clientY - startY > 100 && window.scrollY === 0) {
      showToast('🔄 Đang tải lại...');
      fetchSongs();
    }
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
init();
