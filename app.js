/* ═══════════════════════════════════════════════════════════
   app.js — ListKaraoke Web App
   Fetch songs.json -> search/filter -> click de xem chi tiet
═══════════════════════════════════════════════════════════ */
'use strict';

const SONGS_URL = './songs.json';

let allSongs      = [];
let filteredSongs = [];
let currentSong   = null;

// DOM refs
const $list    = document.getElementById('song-list');
const $loading = document.getElementById('loading');
const $empty   = document.getElementById('empty-state');
const $search  = document.getElementById('search-input');
const $clear   = document.getElementById('btn-clear');
const $genre   = document.getElementById('filter-genre');
const $lang    = document.getElementById('filter-lang');
const $sort    = document.getElementById('sort-by');
const $badge   = document.getElementById('badge-count');
const $overlay = document.getElementById('modal-overlay');
const $btnTheme = document.getElementById('btn-theme');

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  loadTheme();
  await fetchSongs();
  bindEvents();
}

// ─── Fetch data ───────────────────────────────────────────────────────────────
async function fetchSongs() {
  try {
    const res = await fetch(SONGS_URL + '?v=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    allSongs = Array.isArray(data.songs) ? data.songs : [];
    buildFilters();
    applyFilter();
  } catch (e) {
    $loading.innerHTML =
      '<p style="font-size:15px;color:#ef4444">Khong tai duoc danh sach.<br><small>' +
      e.message + '</small></p>' +
      '<p style="margin-top:12px;font-size:13px;color:#94a3b8">Kiem tra: ban da sync len GitHub chua?</p>';
  }
}

// ─── Build filter dropdowns ───────────────────────────────────────────────────
function buildFilters() {
  const genres = [...new Set(allSongs.map(s => s.genre).filter(Boolean))].sort();
  const langs  = [...new Set(allSongs.map(s => s.language).filter(Boolean))].sort();
  genres.forEach(g => {
    const o = document.createElement('option');
    o.value = g; o.textContent = g;
    $genre.appendChild(o);
  });
  langs.forEach(l => {
    const o = document.createElement('option');
    o.value = l; o.textContent = l;
    $lang.appendChild(o);
  });
}

// ─── Filter + Sort + Render ───────────────────────────────────────────────────
function applyFilter() {
  const q    = $search.value.trim().toLowerCase();
  const gVal = $genre.value;
  const lVal = $lang.value;
  const sVal = $sort.value;

  filteredSongs = allSongs.filter(s => {
    if (gVal && s.genre    !== gVal) return false;
    if (lVal && s.language !== lVal) return false;
    if (q) {
      const hay = [s.title, s.artist, s.lyrics, s.note,
                   (s.tags || []).join(' ')].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  filteredSongs.sort((a, b) => {
    if (sVal === 'rating')     return (b.rating||0) - (a.rating||0);
    if (sVal === 'created_at') return (b.created_at||'').localeCompare(a.created_at||'');
    if (sVal === 'artist')     return (a.artist||'').localeCompare(b.artist||'');
    return (a.title||'').localeCompare(b.title||'');
  });

  renderList(filteredSongs, q);
  $badge.textContent = filteredSongs.length + ' / ' + allSongs.length + ' bai';
}

// ─── Render danh sach bai hat ─────────────────────────────────────────────────
function renderList(songs, query) {
  $loading.hidden = true;

  if (songs.length === 0) {
    $list.hidden  = true;
    $empty.hidden = false;
    return;
  }
  $empty.hidden = false;
  $empty.hidden = true;
  $list.hidden  = false;
  $list.innerHTML = '';

  songs.forEach((song, idx) => {
    const row = document.createElement('div');
    row.className = 'song-row';

    const tags = Array.isArray(song.tags) ? song.tags : [];
    const chips = [
      song.genre    ? '<span class="chip chip-genre">' + esc(song.genre) + '</span>' : '',
      song.language ? '<span class="chip chip-lang">'  + esc(song.language) + '</span>' : '',
    ].filter(Boolean).join('');

    const mediaIcons = [
      song.mp3_gdrive_id ? '<span class="media-icon mp3">MP3</span>' : '',
      song.mp4_gdrive_id ? '<span class="media-icon mp4">MP4</span>' : '',
      song.youtube_url   ? '<span class="media-icon yt">YT</span>'   : '',
    ].filter(Boolean).join('');

    const ratingStr = song.rating > 0
      ? '<span style="color:#f59e0b;font-size:13px">' + '★'.repeat(song.rating) + '</span>'
      : '';

    const titleHtml  = highlight(esc(song.title || '(Chua co ten)'), query);
    const artistHtml = highlight(esc(song.artist || 'Chua ro tac gia'), query);

    row.innerHTML =
      '<div class="song-num">' + (idx + 1) + '</div>' +
      '<div class="song-info">' +
        '<div class="song-title">' + titleHtml + '</div>' +
        '<div class="song-artist">🎤 ' + artistHtml + '</div>' +
        (chips ? '<div class="song-chips">' + chips + '</div>' : '') +
      '</div>' +
      '<div class="song-badges">' +
        (mediaIcons ? '<div class="media-icons">' + mediaIcons + '</div>' : '') +
        (ratingStr  ? '<div class="rating-str">' + ratingStr + '</div>' : '') +
      '</div>';

    row.addEventListener('click', () => openModal(song, query));
    $list.appendChild(row);
  });
}

// ─── Mo modal chi tiet bai hat ────────────────────────────────────────────────
function openModal(song, query) {
  currentSong = song;

  document.getElementById('modal-title').innerHTML =
    highlight(esc(song.title || ''), query);
  document.getElementById('modal-artist').textContent =
    '🎤 ' + (song.artist || 'Chua ro') + '   ' +
    (song.genre || '') + (song.language ? ' · ' + song.language : '');

  // Chips
  const ratingStr = song.rating > 0 ? '★'.repeat(song.rating) : '';
  const diffStr   = song.difficulty > 0 ? '!'.repeat(song.difficulty) : '';
  document.getElementById('modal-chips').innerHTML =
    (song.genre    ? '<span class="chip chip-genre">' + esc(song.genre) + '</span>' : '') +
    (song.language ? '<span class="chip chip-lang">' + esc(song.language) + '</span>' : '') +
    (ratingStr     ? '<span class="chip" style="background:rgba(245,158,11,.2);color:#f59e0b">★ ' + ratingStr + '</span>' : '') +
    (diffStr       ? '<span class="chip chip-diff">Do kho: ' + diffStr + '</span>' : '');

  // Tags
  const tags = Array.isArray(song.tags) ? song.tags : [];
  document.getElementById('modal-tags').innerHTML =
    tags.map(t => '<span class="tag-pill">#' + esc(t) + '</span>').join('');

  // ── Tab Lyrics ──
  const lyricsDiv = document.getElementById('modal-lyrics');
  if (song.lyrics && song.lyrics.trim()) {
    lyricsDiv.innerHTML =
      '<div class="lyrics-body">' + highlight(esc(song.lyrics), query) + '</div>';
  } else {
    lyricsDiv.innerHTML =
      '<div class="no-content">📭 Chua co loi bai hat nay<br>' +
      '<small style="color:#64748b">Them lyrics bang app desktop</small></div>';
  }

  // ── Tab Media ──
  const mediaDiv = document.getElementById('media-container');
  mediaDiv.innerHTML = '';

  if (song.mp3_gdrive_id) {
    mediaDiv.innerHTML +=
      '<div class="media-section">' +
        '<h3>🎵 Nhac MP3</h3>' +
        '<iframe src="https://drive.google.com/file/d/' + esc(song.mp3_gdrive_id) + '/preview"' +
          ' height="80" allow="autoplay" loading="lazy" title="MP3"></iframe>' +
      '</div>';
  }
  if (song.mp4_gdrive_id) {
    mediaDiv.innerHTML +=
      '<div class="media-section">' +
        '<h3>🎬 Video Karaoke (MP4)</h3>' +
        '<iframe src="https://drive.google.com/file/d/' + esc(song.mp4_gdrive_id) + '/preview"' +
          ' height="260" allow="autoplay" loading="lazy" title="MP4"></iframe>' +
      '</div>';
  }
  if (song.youtube_url) {
    mediaDiv.innerHTML +=
      '<div class="media-section">' +
        '<h3>▶ YouTube</h3>' +
        '<a class="media-link yt" href="' + esc(song.youtube_url) + '" target="_blank" rel="noopener">' +
          '▶ Mo tren YouTube' +
        '</a>' +
      '</div>';
  }
  if (!song.mp3_gdrive_id && !song.mp4_gdrive_id && !song.youtube_url) {
    mediaDiv.innerHTML =
      '<div class="no-content">📭 Chua co file media<br>' +
      '<small style="color:#64748b">Them MP3/MP4 bang app desktop roi sync</small></div>';
  }

  // ── Tab Info ──
  document.getElementById('info-container').innerHTML = [
    ['Ten bai hat', song.title],
    ['Tac gia / Ca si', song.artist],
    ['The loai', song.genre],
    ['Ngon ngu', song.language],
    ['Do kho', song.difficulty > 0 ? '!'.repeat(song.difficulty) : '-'],
    ['Danh gia', song.rating > 0 ? '★'.repeat(song.rating) : 'Chua danh gia'],
    ['Tags', (song.tags||[]).join(', ') || '-'],
    ['File MP3', song.mp3_gdrive_id ? 'Co tren Google Drive' : 'Chua co'],
    ['File MP4', song.mp4_gdrive_id ? 'Co tren Google Drive' : 'Chua co'],
    ['Ghi chu', song.note || '-'],
  ].map(([l, v]) =>
    '<div class="info-row">' +
      '<span class="info-label">' + l + '</span>' +
      '<span class="info-value">' + esc(String(v || '-')) + '</span>' +
    '</div>'
  ).join('');

  // Reset sang tab Lyrics
  switchTab('lyrics');
  $overlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $overlay.hidden = true;
  document.body.style.overflow = '';
  document.getElementById('media-container').innerHTML = '';
}

// ─── Switch tabs ──────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.hidden = (p.id !== 'tab-' + name);
  });
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem('karaoke-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  if ($btnTheme) $btnTheme.textContent = saved === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('karaoke-theme', next);
  if ($btnTheme) $btnTheme.textContent = next === 'dark' ? '☀️' : '🌙';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function highlight(html, q) {
  if (!q) return html;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return html.replace(new RegExp('(' + escaped + ')','gi'),'<mark>$1</mark>');
}

// ─── Events ───────────────────────────────────────────────────────────────────
function bindEvents() {
  $search.addEventListener('input', applyFilter);
  $clear.addEventListener('click', () => {
    $search.value = '';
    applyFilter();
    $search.focus();
  });
  $genre.addEventListener('change', applyFilter);
  $lang.addEventListener('change', applyFilter);
  $sort.addEventListener('change', applyFilter);

  if ($btnTheme) $btnTheme.addEventListener('click', toggleTheme);

  document.getElementById('modal-close').addEventListener('click', closeModal);
  $overlay.addEventListener('click', e => {
    if (e.target === $overlay) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (e.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault(); $search.focus();
    }
  });

  document.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
init();
