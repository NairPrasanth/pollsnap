// ============================================================
// PollSnap — Raffle Creation (with custom image upload)
// ============================================================

let selectedRaffleTemplate = 'classic';
let uploadedBgFile         = null;   // File object for custom bg
let uploadedBgLocalUrl     = null;   // ObjectURL for preview

// ─── Template Selection ───────────────────────────────────────
function selectRaffleTemplate(id) {
  selectedRaffleTemplate = id;
  document.querySelectorAll('.tpl-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('tpl-' + id);
  if (card) card.classList.add('selected');

  const uploadSection = document.getElementById('custom-upload-section');
  if (uploadSection) uploadSection.style.display = id === 'custom' ? 'block' : 'none';
}
window.selectRaffleTemplate = selectRaffleTemplate;

// ─── Custom BG Preview ────────────────────────────────────────
function handleBgUploadPreview(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    document.getElementById('upload-error').textContent = 'Image must be under 5MB.';
    input.value = '';
    return;
  }
  document.getElementById('upload-error').textContent = '';

  if (uploadedBgLocalUrl) URL.revokeObjectURL(uploadedBgLocalUrl);
  uploadedBgFile     = file;
  uploadedBgLocalUrl = URL.createObjectURL(file);

  const img  = document.getElementById('upload-preview-img');
  const wrap = document.getElementById('upload-preview-wrap');
  img.src = uploadedBgLocalUrl;
  document.getElementById('upload-drop-zone').style.display = 'none';
  wrap.style.display = 'flex';
}
window.handleBgUploadPreview = handleBgUploadPreview;

function clearBgUpload() {
  if (uploadedBgLocalUrl) URL.revokeObjectURL(uploadedBgLocalUrl);
  uploadedBgFile     = null;
  uploadedBgLocalUrl = null;
  document.getElementById('raffle-bg-upload').value = '';
  document.getElementById('upload-preview-img').src = '';
  document.getElementById('upload-preview-wrap').style.display = 'none';
  document.getElementById('upload-drop-zone').style.display    = 'flex';
}
window.clearBgUpload = clearBgUpload;

// ─── Compress + convert image to base64 (no Storage needed) ──
async function imageFileToBase64(file, maxPx, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Scale down if bigger than maxPx
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      const limit = maxPx || 900;
      if (w > limit || h > limit) {
        if (w > h) { h = Math.round(h * limit / w); w = limit; }
        else        { w = Math.round(w * limit / h); h = limit; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality || 0.65));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ─── Create Raffle ────────────────────────────────────────────
async function handleCreateRaffle(e) {
  e.preventDefault();
  hideError('raffle-create-error');

  if (!firebaseReady) {
    showError('raffle-create-error', '⚙️ Firebase is not configured.'); return;
  }

  const title      = document.getElementById('raffle-title').value.trim();
  const desc       = document.getElementById('raffle-desc').value.trim();
  const prize      = document.getElementById('raffle-prize').value.trim();
  const drawDate   = document.getElementById('raffle-draw-date').value;
  const maxRaw     = document.getElementById('raffle-max-tickets').value;
  const maxTickets = maxRaw ? parseInt(maxRaw, 10) : null;

  if (!title) { showError('raffle-create-error', 'Please enter a raffle name.'); return; }
  if (!prize) { showError('raffle-create-error', 'Please enter the prize description.'); return; }
  if (selectedRaffleTemplate === 'custom' && !uploadedBgFile) {
    showError('raffle-create-error', 'Please upload a background image for the Custom template.'); return;
  }
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

    // Compress + encode custom bg as base64 (stored in Firestore)
    let customBgUrl = null;
    if (selectedRaffleTemplate === 'custom' && uploadedBgFile) {
      btnLoad.textContent = 'Processing image…';
      try {
        customBgUrl = await imageFileToBase64(uploadedBgFile, 900, 0.65);
        // Firestore doc limit is 1MB; warn if still large
        if (customBgUrl.length > 900000) {
          customBgUrl = await imageFileToBase64(uploadedBgFile, 600, 0.5);
        }
      } catch (imgErr) {
        showError('raffle-create-error', 'Failed to process image: ' + imgErr.message);
        btn.disabled = false; btnText.style.display = 'inline'; btnLoad.style.display = 'none';
        return;
      }
      btnLoad.textContent = 'Creating…';
    }

    await db.collection('raffles').doc(raffleId).set({
      title, desc: desc || '', prize,
      drawDate:    drawDate || '',
      maxTickets,
      templateId:  selectedRaffleTemplate,
      customBgUrl: customBgUrl || null,
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
    btnLoad.textContent = 'Creating…';
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
  clearBgUpload();
  selectRaffleTemplate('classic');
  hideError('raffle-create-error');
}
window.resetRaffleForm = resetRaffleForm;
