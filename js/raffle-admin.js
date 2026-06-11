// ============================================================
// PollSnap — Raffle Admin Dashboard
// ============================================================

let raffleAdminData = null;
let raffleTickets   = [];
let pickerRunning   = false;

// ─── Load admin view ──────────────────────────────────────────
async function loadRaffleAdminView(raffleId, adminToken) {
  setLoading(true);
  raffleAdminData = null; raffleTickets = [];
  document.getElementById('ra-ticket-tbody').innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-3)">Loading…</td></tr>';

  try {
    const raffleRef = db.collection('raffles').doc(raffleId);

    // Real-time raffle metadata
    window._unsubscribe = raffleRef.onSnapshot(async snap => {
      if (!snap.exists) { showView('notfound'); setLoading(false); return; }
      const data = snap.data();
      if (data.adminToken !== adminToken) { showView('notfound'); setLoading(false); return; }

      raffleAdminData = { ...data, id: raffleId };
      renderRaffleAdminHeader(data);
      setLoading(false);

      // Load tickets once (and on every raffle update)
      const ticketSnap = await raffleRef.collection('tickets').orderBy('issuedAt', 'asc').get();
      raffleTickets = ticketSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTicketTable(raffleTickets);
      renderRaffleStats(data, raffleTickets);
    }, err => { console.error(err); setLoading(false); showView('notfound'); });

  } catch (err) { console.error(err); setLoading(false); showView('notfound'); }
}
window.loadRaffleAdminView = loadRaffleAdminView;

// ─── Render header ─────────────────────────────────────────────
function renderRaffleAdminHeader(data) {
  document.getElementById('ra-title').textContent = data.title;
  document.getElementById('ra-desc').textContent  = data.desc || '';
  document.getElementById('ra-prize-val').textContent = data.prize;
  document.getElementById('ra-draw-val').textContent  = data.drawDate ? formatDate(data.drawDate) : '—';

  const isOpen   = data.isOpen !== false;
  const badge    = document.getElementById('ra-status-badge');
  const toggleBtn= document.getElementById('ra-toggle-btn');
  badge.className   = 'status-badge ' + (isOpen ? 'open' : 'closed');
  badge.textContent = isOpen ? '🟢 Open' : '🔴 Closed';
  toggleBtn.textContent = isOpen ? 'Close Raffle' : 'Reopen Raffle';

  const base = window.location.origin + window.location.pathname;
  document.getElementById('ra-admin-url').textContent  = `${base}#/ra/${raffleAdminData.id}/${data.adminToken}`;
  document.getElementById('ra-ticket-url').textContent = `${base}#/rt/${raffleAdminData.id}`;
}

// ─── Render stats ──────────────────────────────────────────────
function renderRaffleStats(data, tickets) {
  const issued    = tickets.length;
  const maxT      = data.maxTickets;
  const remaining = maxT ? Math.max(0, maxT - issued) : '∞';

  document.getElementById('ra-stat-issued').textContent    = issued;
  document.getElementById('ra-stat-remaining').textContent = remaining;
  document.getElementById('ra-stat-winners').textContent   = (data.winnerHistory || []).length;
}

// ─── Ticket table ──────────────────────────────────────────────
function renderTicketTable(tickets) {
  const tbody = document.getElementById('ra-ticket-tbody');
  if (!tickets.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="no-tickets-row">No tickets issued yet</td></tr>';
    return;
  }
  tbody.innerHTML = tickets.map(t => {
    const time = t.issuedAt ? new Date(t.issuedAt.seconds * 1000).toLocaleString() : '—';
    return `<tr>
      <td><span class="ticket-num-badge">#${t.number}</span></td>
      <td>${escapeHtml(t.holderName)}</td>
      <td>${escapeHtml(t.distributorName)}</td>
      <td class="ticket-time">${time}</td>
    </tr>`;
  }).join('');
}

// ─── Toggle open/closed ────────────────────────────────────────
async function toggleRaffleStatus() {
  if (!raffleAdminData) return;
  try {
    await db.collection('raffles').doc(raffleAdminData.id).update({ isOpen: !raffleAdminData.isOpen });
    showToast(raffleAdminData.isOpen ? 'Raffle closed 🔒' : 'Raffle reopened ✅', 'success');
  } catch (e) { showToast('Failed', 'error'); console.error(e); }
}
window.toggleRaffleStatus = toggleRaffleStatus;

// ─── Export CSV ────────────────────────────────────────────────
function exportRaffleCSV() {
  if (!raffleAdminData) return;
  const d = raffleAdminData;
  const rows = [
    ['Raffle Results Export'],
    ['Name', d.title],
    ['Prize', d.prize],
    d.drawDate ? ['Draw Date', formatDate(d.drawDate)] : null,
    ['Status', d.isOpen ? 'Open' : 'Closed'],
    ['Total Tickets Issued', raffleTickets.length],
    ['Exported At', new Date().toLocaleString()],
    [],
    ['Ticket #', 'Holder Name', 'Contact', 'Distributed By', 'Issued At']
  ].filter(Boolean);

  raffleTickets.forEach(t => {
    const time = t.issuedAt ? new Date(t.issuedAt.seconds * 1000).toLocaleString() : '';
    rows.push([t.number, t.holderName, t.holderContact || '', t.distributorName, time]);
  });

  if ((d.winnerHistory || []).length) {
    rows.push([], ['--- Winner History ---'], ['Ticket #', 'Holder', 'Picked At']);
    d.winnerHistory.forEach(w => rows.push([w.number, w.holderName, w.pickedAt || '']));
  }

  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `raffle-${raffleAdminData.id}.csv`;
  link.click();
  showToast('CSV downloaded! 📄', 'success');
}
window.exportRaffleCSV = exportRaffleCSV;

// ─── Winner Picker ─────────────────────────────────────────────
function runRafflePicker() {
  if (pickerRunning) return;
  if (!raffleTickets.length) { showToast('No tickets issued yet!', 'error'); return; }

  pickerRunning = true;
  const resultEl  = document.getElementById('ra-picker-result');
  const spinEl    = document.getElementById('ra-picker-spin');
  const btn       = document.getElementById('ra-picker-btn');
  const confetti  = document.getElementById('ra-confetti');

  resultEl.style.display = 'none';
  confetti.innerHTML     = '';
  btn.disabled           = true;
  btn.textContent        = '🎲 Drawing…';

  const winners = raffleTickets;
  let iterations = 0;
  const totalFrames = 40;
  let delay = 50;

  function spin() {
    const rand = winners[Math.floor(Math.random() * winners.length)];
    spinEl.textContent = '#' + rand.number;
    iterations++;

    if (iterations < totalFrames) {
      delay = 50 + (iterations / totalFrames) * 300;
      setTimeout(spin, delay);
    } else {
      // Final winner
      const winner = winners[Math.floor(Math.random() * winners.length)];
      spinEl.textContent = '#' + winner.number;

      resultEl.style.display = 'block';
      document.getElementById('ra-winner-number').textContent = '#' + winner.number;
      document.getElementById('ra-winner-name').textContent   = winner.holderName;

      fireConfetti(confetti);
      pickerRunning = false;
      btn.disabled  = false;
      btn.textContent = '🎲 Pick Again';

      // Save to winner history
      const histEntry = { number: winner.number, holderName: winner.holderName, pickedAt: new Date().toLocaleString() };
      db.collection('raffles').doc(raffleAdminData.id).update({
        winnerHistory: firebase.firestore.FieldValue.arrayUnion(histEntry)
      }).catch(console.error);
    }
  }
  spin();
}
window.runRafflePicker = runRafflePicker;

function fireConfetti(container) {
  const colors = ['#7c3aed','#ec4899','#fbbf24','#10b981','#3b82f6'];
  for (let i = 0; i < 60; i++) {
    const dot = document.createElement('div');
    dot.className = 'confetti-dot';
    dot.style.cssText = `
      left:${Math.random()*100}%;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-delay:${Math.random()*0.5}s;
      animation-duration:${0.8 + Math.random()*0.6}s;
      width:${6 + Math.random()*6}px;
      height:${6 + Math.random()*6}px;
    `;
    container.appendChild(dot);
    setTimeout(() => dot.remove(), 2000);
  }
}
