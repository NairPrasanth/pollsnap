// ============================================================
// PollSnap — Raffle Creation
// ============================================================

let selectedRaffleTemplate = 'modern';

function selectRaffleTemplate(id) {
  selectedRaffleTemplate = id;
  document.querySelectorAll('.tpl-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('tpl-' + id);
  if (card) card.classList.add('selected');
}
window.selectRaffleTemplate = selectRaffleTemplate;

async function handleCreateRaffle(e) {
  e.preventDefault();
  hideError('raffle-create-error');

  if (!firebaseReady) {
    showError('raffle-create-error', '⚙️ Firebase is not configured.');
    return;
  }

  const title      = document.getElementById('raffle-title').value.trim();
  const desc       = document.getElementById('raffle-desc').value.trim();
  const prize      = document.getElementById('raffle-prize').value.trim();
  const drawDate   = document.getElementById('raffle-draw-date').value;
  const maxRaw     = document.getElementById('raffle-max-tickets').value;
  const maxTickets = maxRaw ? parseInt(maxRaw, 10) : null;

  if (!title) { showError('raffle-create-error', 'Please enter a raffle name.'); return; }
  if (!prize) { showError('raffle-create-error', 'Please enter the prize description.'); return; }
  if (maxTickets !== null && (isNaN(maxTickets) || maxTickets < 1)) {
    showError('raffle-create-error', 'Max tickets must be a positive number.'); return;
  }

  const btn     = document.getElementById('raffle-create-btn');
  const btnText = document.getElementById('raffle-create-btn-text');
  const btnLoad = document.getElementById('raffle-create-btn-loader');
  btn.disabled = true; btnText.style.display = 'none'; btnLoad.style.display = 'inline';

  try {
    const raffleId   = generateId(8);
    const adminToken = generateId(16);

    await db.collection('raffles').doc(raffleId).set({
      title, desc: desc || '', prize,
      drawDate:    drawDate || '',
      maxTickets:  maxTickets,
      templateId:  selectedRaffleTemplate,
      isOpen:      true,
      adminToken,
      nextTicketNumber: 1,
      winnerHistory:    [],
      createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
      expiresAt:   new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    });

    sessionStorage.setItem('pollsnap_raffle_success',
      JSON.stringify({ raffleId, adminToken, title }));
    navigate('/raffle-success');

  } catch (err) {
    console.error('Create raffle error:', err);
    showError('raffle-create-error', 'Failed to create raffle: ' + (err.message || err));
  } finally {
    btn.disabled = false; btnText.style.display = 'inline'; btnLoad.style.display = 'none';
  }
}
window.handleCreateRaffle = handleCreateRaffle;

function showRaffleSuccessView(data) {
  const base     = window.location.origin + window.location.pathname;
  const adminUrl  = `${base}#/ra/${data.raffleId}/${data.adminToken}`;
  const ticketUrl = `${base}#/rt/${data.raffleId}`;

  document.getElementById('rs-admin-url').textContent  = adminUrl;
  document.getElementById('rs-ticket-url').textContent = ticketUrl;
  document.getElementById('rs-raffle-name').textContent = data.title;

  document.getElementById('rs-go-admin-btn').onclick = () => {
    window.location.hash = `/ra/${data.raffleId}/${data.adminToken}`;
  };
  showView('raffle-success');
}
window.showRaffleSuccessView = showRaffleSuccessView;

function resetRaffleForm() {
  const form = document.getElementById('raffle-create-form');
  if (form) form.reset();
  selectRaffleTemplate('modern');
  hideError('raffle-create-error');
}
window.resetRaffleForm = resetRaffleForm;
