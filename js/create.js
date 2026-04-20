// ============================================================
// PollSnap — Poll Creation Logic
// ============================================================

// ─── Character counter ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const titleInput = document.getElementById('poll-title');
  if (titleInput) {
    titleInput.addEventListener('input', () => {
      document.getElementById('title-count').textContent = `${titleInput.value.length}/100`;
    });
  }
});

// ─── Dynamic Options ──────────────────────────────────────────
const MAX_OPTIONS = 10;
const MIN_OPTIONS = 2;

function addOption() {
  const container = document.getElementById('options-container');
  const rows      = container.querySelectorAll('.option-row');
  if (rows.length >= MAX_OPTIONS) {
    showToast('Maximum 10 options allowed');
    return;
  }

  const idx = rows.length;
  const row = document.createElement('div');
  row.className      = 'option-row';
  row.dataset.index  = idx;
  row.innerHTML = `
    <span class="option-number">${idx + 1}</span>
    <input type="text" class="form-input option-input" placeholder="Option ${idx + 1}" maxlength="150" />
    <button type="button" class="btn-icon btn-delete-option" onclick="removeOption(this)" title="Remove option">✕</button>
  `;
  container.appendChild(row);

  // Show delete buttons when more than 2 rows exist
  updateDeleteButtons();
  row.querySelector('.option-input').focus();
  updateAddBtn();
}
window.addOption = addOption;

function removeOption(btn) {
  const container = document.getElementById('options-container');
  const rows      = container.querySelectorAll('.option-row');
  if (rows.length <= MIN_OPTIONS) {
    showToast('Minimum 2 options required');
    return;
  }
  btn.closest('.option-row').remove();
  renumberOptions();
  updateDeleteButtons();
  updateAddBtn();
}
window.removeOption = removeOption;

function renumberOptions() {
  const rows = document.querySelectorAll('#options-container .option-row');
  rows.forEach((row, i) => {
    row.dataset.index = i;
    row.querySelector('.option-number').textContent = i + 1;
    const input = row.querySelector('.option-input');
    if (input && !input.value) input.placeholder = `Option ${i + 1}`;
  });
}

function updateDeleteButtons() {
  const rows = document.querySelectorAll('#options-container .option-row');
  const show = rows.length > MIN_OPTIONS;
  rows.forEach(row => {
    const btn = row.querySelector('.btn-delete-option');
    if (btn) btn.style.display = show ? 'flex' : 'none';
  });
}

function updateAddBtn() {
  const btn  = document.getElementById('add-option-btn');
  const rows = document.querySelectorAll('#options-container .option-row');
  if (btn) btn.disabled = rows.length >= MAX_OPTIONS;
}

// ─── Form Submit ──────────────────────────────────────────────
async function handleCreatePoll(e) {
  e.preventDefault();
  hideError('create-error');

  if (!firebaseReady) {
    showError('create-error', '⚙️ Firebase is not configured. Open js/firebase-config.js to add your credentials.');
    return;
  }

  const title       = document.getElementById('poll-title').value.trim();
  const description = document.getElementById('poll-description').value.trim();
  const date        = document.getElementById('poll-date').value;
  const time        = document.getElementById('poll-time').value;
  const question    = document.getElementById('poll-question').value.trim();

  // Collect options
  const optionInputs = document.querySelectorAll('.option-input');
  const options = Array.from(optionInputs)
    .map(i => i.value.trim())
    .filter(v => v.length > 0);

  // Validate
  if (!title)           { showError('create-error', 'Please enter a poll title.'); return; }
  if (!question)        { showError('create-error', 'Please enter a poll question.'); return; }
  if (options.length < 2) { showError('create-error', 'Please provide at least 2 answer options.'); return; }

  // Duplicate check
  const unique = new Set(options.map(o => o.toLowerCase()));
  if (unique.size !== options.length) {
    showError('create-error', 'Duplicate options are not allowed.');
    return;
  }

  // UI: loading state
  const btn      = document.getElementById('create-btn');
  const btnText  = document.getElementById('create-btn-text');
  const btnLoad  = document.getElementById('create-btn-loader');
  btn.disabled   = true;
  btnText.style.display = 'none';
  btnLoad.style.display = 'inline';

  try {
    const pollId     = generateId(8);
    const adminToken = generateId(16);

    const votes = {};
    options.forEach((_, i) => { votes[i] = 0; });

    const pollData = {
      title,
      description: description || '',
      date:        date || '',
      time:        time || '',
      question,
      options,
      votes,
      voterIds:    [],
      isOpen:      true,
      adminToken,
      createdAt:   firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('polls').doc(pollId).set(pollData);

    // Store for success view
    sessionStorage.setItem('pollsnap_success', JSON.stringify({ pollId, adminToken, title }));
    navigate('/success');

  } catch (err) {
    console.error('Create poll error:', err);
    showError('create-error', 'Failed to create poll: ' + (err.message || err));
  } finally {
    btn.disabled = false;
    btnText.style.display = 'inline';
    btnLoad.style.display = 'none';
  }
}
window.handleCreatePoll = handleCreatePoll;

function goToAdmin() {
  const data = JSON.parse(sessionStorage.getItem('pollsnap_success') || 'null');
  if (data) navigate(`/a/${data.pollId}/${data.adminToken}`);
}
window.goToAdmin = goToAdmin;
