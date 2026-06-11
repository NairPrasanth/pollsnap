// ============================================================
// PollSnap — Raffle Ticket Issuance
// ============================================================

let currentRaffle = null;
let currentTicket = null;

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

    document.getElementById('rt-title').textContent     = data.title;
    document.getElementById('rt-desc').textContent      = data.desc || '';
    document.getElementById('rt-prize-val').textContent = data.prize;
    const drawEl = document.getElementById('rt-draw-val');
    if (drawEl) drawEl.textContent = data.drawDate ? formatDate(data.drawDate) : '—';

    if (!data.isOpen) {
      document.getElementById('rt-closed-msg').style.display = 'block';
      setLoading(false); return;
    }

    if (data.maxTickets) {
      const issued    = (data.nextTicketNumber || 1) - 1;
      const remaining = data.maxTickets - issued;
      const remEl     = document.getElementById('rt-remaining');
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

  const holderName      = document.getElementById('rt-holder-name').value.trim();
  const holderContact   = document.getElementById('rt-holder-contact').value.trim();
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

      const ticketRef = raffleRef.collection('tickets').doc();
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
      templateId: currentRaffle.templateId || 'classic',
      customBgUrl: currentRaffle.customBgUrl || null,
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
  canvas.className = 'ticket-render template-' + (d.templateId || 'classic');

  // Apply custom background image if set
  if (d.templateId === 'custom' && d.customBgUrl) {
    canvas.style.backgroundImage    = `url(${d.customBgUrl})`;
    canvas.style.backgroundSize     = 'cover';
    canvas.style.backgroundPosition = 'center';
  } else {
    canvas.style.backgroundImage = '';
  }

  document.getElementById('tk-raffle-name').textContent = d.raffleName;
  document.getElementById('tk-number').textContent      = d.number;
  document.getElementById('tk-holder').textContent      = d.holderName;
  document.getElementById('tk-contact').textContent     = d.holderContact;
  document.getElementById('tk-prize').textContent       = d.prize;
  const drawEl = document.getElementById('tk-draw');
  if (drawEl) drawEl.textContent = d.drawDate ? formatDate(d.drawDate) : '';
}

// ─── Generate ticket canvas blob ──────────────────────────────
async function generateTicketBlob(scale) {
  const el = document.getElementById('rt-ticket-canvas');
  const canvas = await html2canvas(el, {
    scale: scale || 3, logging: false, useCORS: true, allowTaint: true, backgroundColor: null
  });
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
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
    const blob = await generateTicketBlob(3);
    const link = document.createElement('a');
    link.download = `ticket-${currentTicket.number}.png`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    showToast('Ticket downloaded! 📥', 'success');
  } catch (err) {
    showToast('Download failed', 'error'); console.error(err);
  } finally {
    btn.innerHTML = orig; btn.disabled = false;
  }
}
window.downloadTicket = downloadTicket;

// ─── WhatsApp Share (image via Web Share API) ─────────────────
async function shareOnWhatsApp() {
  if (!currentTicket) return;

  const btn = document.getElementById('rt-whatsapp-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Preparing…'; }

  const text = `🎟️ *${currentTicket.raffleName}*\n\nTicket No: *#${currentTicket.number}*\nName: ${currentTicket.holderName}\nPrize: 🏆 ${currentTicket.prize}${currentTicket.drawDate ? '\nDraw: 📅 ' + formatDate(currentTicket.drawDate) : ''}\n\nGood luck! 🍀`;

  try {
    const blob = await generateTicketBlob(2);
    const file = new File([blob], `ticket-${currentTicket.number}.png`, { type: 'image/png' });

    // Web Share API with file (works on mobile Chrome/Safari)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: `Raffle Ticket #${currentTicket.number}`, text, files: [file] });
      showToast('Shared! 🎉', 'success');
    } else if (navigator.share) {
      // Share without file (desktop or unsupported)
      await navigator.share({ title: `Raffle Ticket #${currentTicket.number}`, text });
      showToast('Shared! 🎉', 'success');
    } else {
      // Fallback: download image + open WhatsApp web
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `ticket-${currentTicket.number}.png`;
      link.click();
      setTimeout(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        URL.revokeObjectURL(link.href);
      }, 800);
      showToast('Image downloaded — paste it in WhatsApp', 'success');
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      // Fallback to text-only WhatsApp
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
    console.error('Share error:', err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💬 Share on WhatsApp'; }
  }
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
