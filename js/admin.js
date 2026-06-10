// ============================================================
// PollSnap — Admin Dashboard
// ============================================================

let adminPollData = null;

async function loadAdminView(pollId, adminToken) {
  setLoading(true);

  document.getElementById('admin-poll-title').textContent    = 'Loading…';
  document.getElementById('admin-poll-description').textContent = '';
  document.getElementById('admin-poll-meta').innerHTML        = '';
  document.getElementById('admin-results-bars').innerHTML     = '';
  document.getElementById('participants-list').innerHTML      = '<p class="no-voters">Loading…</p>';

  try {
    const ref = db.collection('polls').doc(pollId);

    window._unsubscribe = ref.onSnapshot(snap => {
      if (!snap.exists) {
        showView('notfound');
        setLoading(false);
        return;
      }

      const data = snap.data();

      if (data.adminToken !== adminToken) {
        showView('notfound');
        setLoading(false);
        return;
      }

      adminPollData = { ...data, id: pollId };
      renderAdminDashboard(data, pollId, adminToken);
      setLoading(false);
    }, err => {
      console.error('Admin snapshot error:', err);
      setLoading(false);
      showView('notfound');
    });

  } catch (err) {
    console.error('loadAdminView error:', err);
    setLoading(false);
    showView('notfound');
  }
}
window.loadAdminView = loadAdminView;

function renderAdminDashboard(data, pollId, adminToken) {
  // Header
  document.getElementById('admin-poll-title').textContent       = data.title;
  document.getElementById('admin-poll-description').textContent = data.description || '';

  const meta = [];
  if (data.date) meta.push(`<span class="poll-meta-item">📅 ${formatDate(data.date)}</span>`);
  if (data.time) meta.push(`<span class="poll-meta-item">🕐 ${formatTime(data.time)}</span>`);
  document.getElementById('admin-poll-meta').innerHTML = meta.join('');

  // Status
  const isOpen    = data.isOpen !== false;
  const hideResults = data.hideResults === true;
  const badge     = document.getElementById('poll-status-badge');
  const toggleBtn = document.getElementById('toggle-poll-btn');
  const hideBtn   = document.getElementById('toggle-hide-btn');
  badge.className   = 'status-badge ' + (isOpen ? 'open' : 'closed');
  badge.textContent = isOpen ? '🟢 Open' : '🔴 Closed';
  toggleBtn.textContent = isOpen ? 'Close Poll' : 'Reopen Poll';
  if (hideBtn) {
    hideBtn.textContent = hideResults ? '👁️ Show Results' : '🔒 Hide Results';
    hideBtn.classList.toggle('active-hide', hideResults);
  }

  // Stats
  const votes  = data.votes || {};
  const total  = Object.values(votes).reduce((a, b) => a + b, 0);
  const voters = data.voterDetails || [];

  document.getElementById('total-votes-stat').textContent   = total;
  document.getElementById('unique-voters-stat').textContent = voters.length || (data.voterIds || []).length;

  // Leading option
  let leadingIdx = -1, leadingMax = -1;
  data.options.forEach((_, i) => {
    if ((votes[i] || 0) > leadingMax) { leadingMax = votes[i] || 0; leadingIdx = i; }
  });
  const leadingEl = document.getElementById('leading-option-stat');
  if (leadingIdx >= 0 && leadingMax > 0) {
    const label = data.options[leadingIdx];
    leadingEl.textContent = label.length > 10 ? label.slice(0, 10) + '…' : label;
    leadingEl.title = label;
  } else {
    leadingEl.textContent = '—';
  }

  // Question & result bars
  document.getElementById('admin-question').textContent = data.question;
  buildResultBars('admin-results-bars', data.options, votes, true);

  // Participants list
  renderParticipantsList(voters, data.options);

  // Share links
  const base = window.location.origin + window.location.pathname;
  document.getElementById('admin-share-url').textContent       = `${base}#/a/${pollId}/${adminToken}`;
  document.getElementById('participant-share-url').textContent = `${base}#/p/${pollId}`;
}

// ─── Participants List (grouped by option) ────────────────────
function renderParticipantsList(voters, options) {
  const container = document.getElementById('participants-list');
  if (!voters || voters.length === 0) {
    container.innerHTML = '<p class="no-voters">No votes yet — share the participant link!</p>';
    return;
  }

  // Group voters by optionIndex
  const groups = {}; // { optionIndex: [voterDetail, ...] }
  options.forEach((_, i) => { groups[i] = []; });
  voters.forEach(v => {
    const idx = v.optionIndex !== undefined ? v.optionIndex : -1;
    if (groups[idx] === undefined) groups[idx] = [];
    groups[idx].push(v);
  });

  // Sort voters within each group by votedAt ascending
  Object.keys(groups).forEach(k => {
    groups[k].sort((a, b) => (a.votedAt ? a.votedAt.seconds : 0) - (b.votedAt ? b.votedAt.seconds : 0));
  });

  let html = '';
  options.forEach((opt, i) => {
    const group = groups[i] || [];
    const count = group.length;
    html += `
      <div class="participant-group">
        <div class="participant-group-header">
          <span class="participant-group-label">${escapeHtml(opt)}</span>
          <span class="participant-group-count">${count} vote${count !== 1 ? 's' : ''}</span>
        </div>`;

    if (count === 0) {
      html += `<p class="no-voters-group">No votes yet</p>`;
    } else {
      group.forEach(v => {
        const timeStr = v.votedAt
          ? new Date(v.votedAt.seconds * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
          : '';
        html += `
          <div class="participant-row">
            <div class="participant-avatar">${escapeHtml(v.name.trim()[0].toUpperCase())}</div>
            <div class="participant-info">
              <span class="participant-name">${escapeHtml(v.name)}</span>
            </div>
            ${timeStr ? `<span class="participant-time">${timeStr}</span>` : ''}
          </div>`;
      });
    }

    html += `</div>`;
  });

  container.innerHTML = html;
}

// ─── Toggle Poll Open/Closed ──────────────────────────────────
async function togglePollStatus() {
  if (!adminPollData) return;
  const newStatus = !adminPollData.isOpen;
  try {
    await db.collection('polls').doc(adminPollData.id).update({ isOpen: newStatus });
    showToast(newStatus ? 'Poll reopened ✅' : 'Poll closed 🔒', 'success');
  } catch (e) {
    showToast('Failed to update status', 'error');
    console.error(e);
  }
}
window.togglePollStatus = togglePollStatus;

// ─── Toggle Hide Results ──────────────────────────────────────
async function toggleHideResults() {
  if (!adminPollData) return;
  const newHide = !adminPollData.hideResults;
  try {
    await db.collection('polls').doc(adminPollData.id).update({ hideResults: newHide });
    showToast(newHide ? 'Results hidden from participants 🔒' : 'Results now visible to participants 👁️', 'success');
  } catch (e) {
    showToast('Failed to update setting', 'error');
    console.error(e);
  }
}
window.toggleHideResults = toggleHideResults;

// ─── Export: CSV (includes participant names) ─────────────────
function exportCSV() {
  if (!adminPollData) return;
  const d      = adminPollData;
  const votes  = d.votes || {};
  const voters = d.voterDetails || [];
  const total  = Object.values(votes).reduce((a, b) => a + b, 0);

  const rows = [
    ['PollSnap Results Export'],
    ['Title',    d.title],
    ['Question', d.question],
    d.date ? ['Date', formatDate(d.date)] : null,
    d.time ? ['Time', formatTime(d.time)] : null,
    ['Total Votes', total],
    ['Status', d.isOpen ? 'Open' : 'Closed'],
    ['Exported At', new Date().toLocaleString()],
    [],
    ['--- Vote Totals ---'],
    ['Option', 'Votes', 'Percentage']
  ].filter(Boolean);

  d.options.forEach((opt, i) => {
    const v   = votes[i] || 0;
    const pct = total > 0 ? ((v / total) * 100).toFixed(1) + '%' : '0.0%';
    rows.push([opt, v, pct]);
  });

  if (voters.length > 0) {
    rows.push([]);
    rows.push(['--- Participant Details ---']);
    rows.push(['Name', 'Vote', 'Time']);
    const sorted = [...voters].sort((a, b) => {
      const ta = a.votedAt ? (a.votedAt.seconds || 0) : 0;
      const tb = b.votedAt ? (b.votedAt.seconds || 0) : 0;
      return ta - tb;
    });
    sorted.forEach(v => {
      const optLabel = d.options[v.optionIndex] || v.option || '—';
      const timeStr  = v.votedAt
        ? new Date(v.votedAt.seconds * 1000).toLocaleString()
        : '';
      rows.push([v.name, optLabel, timeStr]);
    });
  }

  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href     = URL.createObjectURL(blob);
  link.download = `pollsnap-${adminPollData.id}-results.csv`;
  link.click();
  showToast('CSV downloaded! 📄', 'success');
}
window.exportCSV = exportCSV;

// ─── Export: Clipboard (includes names) ──────────────────────
async function exportClipboard() {
  if (!adminPollData) return;
  const d      = adminPollData;
  const votes  = d.votes || {};
  const voters = d.voterDetails || [];
  const total  = Object.values(votes).reduce((a, b) => a + b, 0);

  let text = `📊 ${d.title}\n`;
  if (d.description) text += `${d.description}\n`;
  text += `\n❓ ${d.question}\n\n`;

  d.options.forEach((opt, i) => {
    const v   = votes[i] || 0;
    const pct = total > 0 ? Math.round((v / total) * 100) : 0;
    const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
    text += `${opt}\n${bar} ${v} votes (${pct}%)\n\n`;
  });

  text += `Total: ${total} vote${total !== 1 ? 's' : ''}\n`;

  if (voters.length > 0) {
    text += `\n👥 Participants (${voters.length}):\n`;
    const sorted = [...voters].sort((a, b) => {
      return (a.votedAt ? a.votedAt.seconds : 0) - (b.votedAt ? b.votedAt.seconds : 0);
    });
    sorted.forEach(v => {
      const optLabel = d.options[v.optionIndex] || v.option || '—';
      text += `  • ${v.name} → ${optLabel}\n`;
    });
  }

  text += `\nExported via PollSnap`;

  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard! 📋', 'success');
  } catch {
    showToast('Clipboard not available', 'error');
  }
}
window.exportClipboard = exportClipboard;

// ─── Export: PNG ─────────────────────────────────────────────
async function exportPNG() {
  if (!adminPollData || typeof html2canvas === 'undefined') {
    showToast('Image export not available', 'error');
    return;
  }

  const btn  = document.getElementById('export-png-btn');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="export-icon">⏳</span><span>Generating…</span>';
  btn.disabled  = true;

  try {
    const el = document.getElementById('results-export-area');
    const canvas = await html2canvas(el, {
      backgroundColor: '#0f0f2a',
      scale: 2,
      logging: false,
      useCORS: true
    });

    const link  = document.createElement('a');
    link.download = `pollsnap-${adminPollData.id}-results.png`;
    link.href     = canvas.toDataURL('image/png');
    link.click();
    showToast('Image saved! 🖼️', 'success');
  } catch (e) {
    showToast('Image export failed', 'error');
    console.error(e);
  } finally {
    btn.innerHTML = orig;
    btn.disabled  = false;
  }
}
window.exportPNG = exportPNG;

// ─── Helpers ─────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '';
  try {
    const [y, m, day] = d.split('-');
    return new Date(y, m - 1, day).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
  } catch { return d; }
}

function formatTime(t) {
  if (!t) return '';
  try {
    const [h, m] = t.split(':');
    const date = new Date(); date.setHours(+h, +m);
    return date.toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' });
  } catch { return t; }
}
window.formatDate = formatDate;
window.formatTime = formatTime;
