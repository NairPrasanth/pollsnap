// ============================================================
// PollSnap — Raffle Ticket Issuance
// ============================================================

let currentRaffle  = null;
let currentTicket  = null;

// ─── Load ticket-issue page ───────────────────────────────────
async function loadRaffleTicketView(raffleId) {
  setLoading(true);
  currentRaffle = null; currentTicket = null;

  ['rt-issue-section','rt-ticket-section','rt-closed-msg','rt-full-msg']
    .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

  try {
    const snap = await db.collection('raffles').doc(raffleId).get();
    if (!snap.exists) { setLoading(false); showView('notfound'); return; }

    const data = snap.data();
    currentRaffle = { ...data, id: raffleId };

    document.getElementById('rt-title').textContent = data.title;
    document.getElementById('rt-desc').textContent  = data.desc || '';
    document.getElementById('rt-prize-val').textContent = data.prize;
    const drawEl = document.getElementById('rt-draw-val');
    if (drawEl) drawEl.textContent = data.drawDate ? formatDate(data.drawDate) : '—';

    if (!data.isOpen) {
      document.getElementById('rt-closed-msg').style.display = 'block';
      setLoading(false); return;
    }

    if (data.maxTickets) {
      const issued = (data.nextTicketNumber || 1) - 1;
      const remaining = data.maxTickets - issued;
      const remEl = document.getElementById('rt-remaining');
      if (remEl) remEl.textContent = remaining > 0 ? `${remaining} tickets remaining` : '';
      if (remaining <= 0) {
        document.getElementById('rt-full-msg').style.display = 'block';
        setLoading(false); return;
      }
    }

    document.getElementById('rt-issue-section').style.display = 'block';
    setLoading(false);

  } catch (err) {
    console.error(err); setLoading(false); showView('notfound');
  }
}
window.loadRaffleTicketView = loadRaffleTicketView;

// ─── Issue Ticket ──────────────────────────────────────────────
async function handleIssueTicket(e) {
  e.preventDefault();
  hideError('rt-error');

  const holderName     = document.getElementById('rt-holder-name').value.trim();
  const holderContact  = document.getElementById('rt-holder-contact').value.trim();
  const distributorName = document.getElementById('rt-distributor-name').value.trim();

  if (!holderName)      { showError('rt-error', 'Please enter the ticket holder name.'); return; }
  if (!holderContact)   { showError('rt-error', 'Please enter a contact number or email.'); return; }
  if (!distributorName) { showError('rt-error', 'Please enter the distributor name.'); return; }

  const btn = document.getElementById('rt-issue-btn');
  btn.disabled = true; btn.textContent = '⏳ Issuing…';

  try {
    const raffleId = currentRaffle.id;
    let ticketNumber, ticketId;

    await db.runTransaction(async (tx) => {
      const raffleRef  = db.collection('raffles').doc(raffleId);
      const raffleSnap = await tx.get(raffleRef);
      const nextNum    = raffleSnap.data().nextTicketNumber || 1;
      ticketNumber     = String(nextNum).padStart(4, '0');

      const ticketRef  = raffleRef.collection('tickets').doc();
      ticketId = ticketRef.id;

      tx.update(raffleRef, { nextTicketNumber: firebase.firestore.FieldValue.increment(1) });
      tx.set(ticketRef, {
        number: ticketNumber, holderName, holderContact, distributorName,
        issuedAt: firebase.firestore.Timestamp.now()
      });
    });

    currentTicket = {
      id: ticketId, number: ticketNumber,
      holderName, holderContact,
      raffleName: currentRaffle.title,
      prize:      currentRaffle.prize,
      templateId: currentRaffle.templateId || 'modern',
      drawDate:   currentRaffle.drawDate || ''
    };

    renderTicket(currentTicket);
    document.getElementById('rt-issue-section').style.display  = 'none';
    document.getElementById('rt-ticket-section').style.display = 'block';
    showToast('Ticket issued! 🎟️', 'success');

  } catch (err) {
    console.error('Issue ticket error:', err);
    showError('rt-error', 'Failed to issue ticket: ' + (err.message || err));
    btn.disabled = false; btn.textContent = '🎟️ Issue Ticket';
  }
}
window.handleIssueTicket = handleIssueTicket;

// ─── Render Ticket ─────────────────────────────────────────────
function renderTicket(d) {
  const canvas = document.getElementById('rt-ticket-canvas');
  canvas.className = 'ticket-render template-' + (d.templateId || 'modern');

  document.getElementById('tk-raffle-name').textContent = d.raffleName;
  document.getElementById('tk-number').textContent      = '#' + d.number;
  document.getElementById('tk-holder').textContent      = d.holderName;
  document.getElementById('tk-contact').textContent     = d.holderContact;
  document.getElementById('tk-prize').textContent       = d.prize;
  const drawEl = document.getElementById('tk-draw');
  if (drawEl) drawEl.textContent = d.drawDate ? '📅 ' + formatDate(d.drawDate) : '';
}

// ─── Download as Image ─────────────────────────────────────────
async function downloadTicket() {
  if (!currentTicket || typeof html2canvas === 'undefined') {
    showToast('Download not available', 'error'); return;
  }
  const btn = document.getElementById('rt-download-btn');
  const orig = btn.innerHTML;
  btn.innerHTML = '⏳ Generating…'; btn.disabled = true;

  try {
    const el = document.getElementById('rt-ticket-canvas');
    const canvas = await html2canvas(el, { scale: 3, logging: false, useCORS: true, backgroundColor: null });
    const link = document.createElement('a');
    link.download = `ticket-${currentTicket.number}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Ticket downloaded! 📥', 'success');
  } catch (err) {
    showToast('Download failed', 'error'); console.error(err);
  } finally {
    btn.innerHTML = orig; btn.disabled = false;
  }
}
window.downloadTicket = downloadTicket;

// ─── WhatsApp Share ────────────────────────────────────────────
function shareOnWhatsApp() {
  if (!currentTicket) return;
  const d = currentTicket;
  let text = `🎟️ *${d.raffleName}*\n\n`;
  text += `Ticket Number: *#${d.number}*\n`;
  text += `Name: ${d.holderName}\n`;
  text += `Prize: 🏆 ${d.prize}\n`;
  if (d.drawDate) text += `Draw Date: 📅 ${formatDate(d.drawDate)}\n`;
  text += `\nGood luck! 🍀`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
window.shareOnWhatsApp = shareOnWhatsApp;

// ─── Issue another ticket ──────────────────────────────────────
function issueAnotherTicket() {
  currentTicket = null;
  document.getElementById('rt-issue-section').style.display  = 'block';
  document.getElementById('rt-ticket-section').style.display = 'none';
  document.getElementById('rt-issue-form').reset();
  hideError('rt-error');
  const btn = document.getElementById('rt-issue-btn');
  if (btn) { btn.disabled = false; btn.textContent = '🎟️ Issue Ticket'; }
}
window.issueAnotherTicket = issueAnotherTicket;
