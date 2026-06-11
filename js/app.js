// ============================================================
// PollSnap — App Core: Router, Utilities, Shared State
// ============================================================

// ─── State ───────────────────────────────────────────────────
window.currentPollId    = null;
window.currentAdminToken = null;
window._unsubscribe     = null;  // Firestore real-time listener teardown

// ─── Short ID Generator ──────────────────────────────────────
function generateId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) id += chars[array[i] % chars.length];
  return id;
}
window.generateId = generateId;

// ─── Router ──────────────────────────────────────────────────
function navigate(path) {
  window.location.hash = path;
}
window.navigate = navigate;

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + name);
  if (el) el.classList.add('active');

  const navBtn = document.getElementById('nav-new-poll-btn');
  if (navBtn) {
    navBtn.style.display = (name === 'participate') ? 'none' : 'block';
  }
}

function teardown() {
  if (window._unsubscribe) { window._unsubscribe(); window._unsubscribe = null; }
  window.currentPollId     = null;
  window.currentAdminToken = null;
}

async function handleRoute() {
  teardown();

  if (!firebaseReady) { showView('config'); return; }

  const hash  = window.location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  const page  = parts[0] || '';

  if (!page) {
    showView('home');
    resetCreateForm();
    switchHomeTab('poll');
    return;
  }

  if (page === 'raffle') {
    showView('home');
    resetCreateForm();
    switchHomeTab('raffle');
    return;
  }

  if (page === 'success') {
    const data = JSON.parse(sessionStorage.getItem('pollsnap_success') || 'null');
    if (!data) { showView('home'); return; }
    showSuccessView(data);
    return;
  }

  if (page === 'raffle-success') {
    const data = JSON.parse(sessionStorage.getItem('pollsnap_raffle_success') || 'null');
    if (!data) { showView('home'); return; }
    showRaffleSuccessView(data);
    return;
  }

  if (page === 'p' && parts[1]) {
    window.currentPollId = parts[1];
    showView('participate');
    loadParticipantView(parts[1]);
    return;
  }

  if (page === 'a' && parts[1] && parts[2]) {
    window.currentPollId     = parts[1];
    window.currentAdminToken = parts[2];
    showView('admin');
    loadAdminView(parts[1], parts[2]);
    return;
  }

  if (page === 'rt' && parts[1]) {
    showView('raffle-ticket');
    loadRaffleTicketView(parts[1]);
    return;
  }

  if (page === 'ra' && parts[1] && parts[2]) {
    showView('raffle-admin');
    loadRaffleAdminView(parts[1], parts[2]);
    return;
  }

  showView('notfound');
}

window.addEventListener('hashchange', handleRoute);
window.addEventListener('load', handleRoute);

// ─── Home Tab Switcher ────────────────────────────────────────
function switchHomeTab(tab) {
  ['poll','raffle'].forEach(t => {
    document.getElementById('ftab-' + t)?.classList.toggle('active', t === tab);
    document.getElementById('pane-' + t)?.classList.toggle('active', t === tab);
  });
  const navBtn = document.getElementById('nav-new-poll-btn');
  if (navBtn) navBtn.textContent = tab === 'raffle' ? '+ New Raffle' : '+ New Poll';
}
window.switchHomeTab = switchHomeTab;

// ─── Success View ─────────────────────────────────────────────
function showSuccessView(data) {
  const base = window.location.origin + window.location.pathname;
  const adminUrl       = `${base}#/a/${data.pollId}/${data.adminToken}`;
  const participantUrl = `${base}#/p/${data.pollId}`;

  document.getElementById('admin-url-display').textContent       = adminUrl;
  document.getElementById('participant-url-display').textContent = participantUrl;

  document.getElementById('go-admin-btn').onclick = () => {
    window.location.hash = `/a/${data.pollId}/${data.adminToken}`;
  };

  showView('success');
}
window.showSuccessView = showSuccessView;

// ─── Copy Link ────────────────────────────────────────────────
function copyLink(spanId, btnId) {
  const text = document.getElementById(spanId).textContent.trim();
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.classList.add('copied');
      btn.innerHTML = '✓';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 2000);
    }
    showToast('Link copied! ✓', 'success');
  }).catch(() => showToast('Could not copy — try manually', 'error'));
}
window.copyLink = copyLink;

// ─── Toast ───────────────────────────────────────────────────
let _toastTimeout;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast' + (type ? ' ' + type : '') + ' show';
  clearTimeout(_toastTimeout);
  _toastTimeout = setTimeout(() => { el.classList.remove('show'); }, 3000);
}
window.showToast = showToast;

// ─── Loading ─────────────────────────────────────────────────
function setLoading(on) {
  document.getElementById('loading-overlay').style.display = on ? 'flex' : 'none';
}
window.setLoading = setLoading;

// ─── Voter ID (per poll, anonymous) ──────────────────────────
function getVoterId(pollId) {
  const key = 'pollsnap_voter_' + pollId;
  let id = localStorage.getItem(key);
  if (!id) {
    id = generateId(16);
    localStorage.setItem(key, id);
  }
  return id;
}
window.getVoterId = getVoterId;

function hasVoted(pollId) {
  return !!localStorage.getItem('pollsnap_voted_' + pollId);
}
function markVoted(pollId, optionIndex) {
  localStorage.setItem('pollsnap_voted_' + pollId, String(optionIndex));
}
window.hasVoted  = hasVoted;
window.markVoted = markVoted;

// ─── Build Result Bars ────────────────────────────────────────
function buildResultBars(containerId, options, votes, highlightLeading = true) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const total = options.reduce((s, _, i) => s + (votes[i] || 0), 0);
  const maxVotes = Math.max(...options.map((_, i) => votes[i] || 0), 0);

  container.innerHTML = options.map((opt, i) => {
    const v   = votes[i] || 0;
    const pct = total > 0 ? Math.round((v / total) * 100) : 0;
    const isLeading = highlightLeading && v === maxVotes && v > 0;
    return `
      <div class="result-row">
        <div class="result-row-meta">
          <span class="result-option-label">${escapeHtml(opt)}</span>
          <span class="result-option-stats">${v} vote${v !== 1 ? 's' : ''} · ${pct}%</span>
        </div>
        <div class="result-bar-track">
          <div class="result-bar-fill ${isLeading ? 'leading' : ''}" style="width:${pct}%" data-pct="${pct}"></div>
        </div>
      </div>
    `;
  }).join('');

  // Animate bars in on next frame
  requestAnimationFrame(() => {
    container.querySelectorAll('.result-bar-fill').forEach(bar => {
      const target = bar.dataset.pct + '%';
      bar.style.width = '0%';
      requestAnimationFrame(() => { bar.style.width = target; });
    });
  });
}
window.buildResultBars = buildResultBars;

// ─── Reset Create Form ────────────────────────────────────────
function resetCreateForm() {
  const form = document.getElementById('create-form');
  if (form) form.reset();
  document.getElementById('title-count').textContent = '0/100';

  const container = document.getElementById('options-container');
  if (container) {
    container.innerHTML = `
      <div class="option-row" data-index="0">
        <span class="option-number">1</span>
        <input type="text" class="form-input option-input" placeholder="Option 1" maxlength="150" />
        <button type="button" class="btn-icon btn-delete-option" onclick="removeOption(this)" title="Remove" style="display:none">✕</button>
      </div>
      <div class="option-row" data-index="1">
        <span class="option-number">2</span>
        <input type="text" class="form-input option-input" placeholder="Option 2" maxlength="150" />
        <button type="button" class="btn-icon btn-delete-option" onclick="removeOption(this)" title="Remove" style="display:none">✕</button>
      </div>`;
  }
  hideError('create-error');
}

// ─── Helpers ─────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
window.escapeHtml = escapeHtml;

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  el.style.display = 'block';
}
function hideError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = '';
  el.classList.remove('visible');
  el.style.display = 'none';
}
window.showError = showError;
window.hideError = hideError;

// ─── Register Service Worker ──────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('✅ SW registered'))
      .catch(e => console.warn('SW error:', e));
  });
}
