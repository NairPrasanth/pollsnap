// ============================================================
// PollSnap — Participant Voting View
// ============================================================

let participantPollData = null;
let selectedOptionIndex = null;

async function loadParticipantView(pollId) {
  setLoading(true);
  selectedOptionIndex = null;

  // Reset all sub-cards
  document.getElementById('vote-card').style.display    = 'none';
  document.getElementById('voted-card').style.display   = 'none';
  document.getElementById('closed-card').style.display  = 'none';
  const nameInput = document.getElementById('voter-name');
  if (nameInput) nameInput.value = '';
  hideError('vote-error');

  document.getElementById('part-poll-title').textContent       = 'Loading…';
  document.getElementById('part-poll-description').textContent = '';
  document.getElementById('part-poll-meta').innerHTML          = '';

  try {
    const ref = db.collection('polls').doc(pollId);

    // Real-time listener so results update live after voting
    window._unsubscribe = ref.onSnapshot(snap => {
      if (!snap.exists) {
        setLoading(false);
        showView('notfound');
        return;
      }

      const data = snap.data();
      participantPollData = { ...data, id: pollId };
      renderParticipantView(data, pollId);
      setLoading(false);
    }, err => {
      console.error('Participant snapshot error:', err);
      setLoading(false);
      showView('notfound');
    });

  } catch (err) {
    console.error('loadParticipantView error:', err);
    setLoading(false);
    showView('notfound');
  }
}
window.loadParticipantView = loadParticipantView;

function renderParticipantView(data, pollId) {
  // Header
  document.getElementById('part-poll-title').textContent       = data.title;
  document.getElementById('part-poll-description').textContent = data.description || '';

  const meta = [];
  if (data.date) meta.push(`<span class="poll-meta-item">📅 ${formatDate(data.date)}</span>`);
  if (data.time) meta.push(`<span class="poll-meta-item">🕐 ${formatTime(data.time)}</span>`);
  document.getElementById('part-poll-meta').innerHTML = meta.join('');

  const isOpen   = data.isOpen !== false;
  const voted    = hasVoted(pollId);
  const votes    = data.votes || {};
  const total    = Object.values(votes).reduce((a, b) => a + b, 0);

  if (!isOpen) {
    // Poll is closed — show results
    document.getElementById('vote-card').style.display   = 'none';
    document.getElementById('voted-card').style.display  = 'none';
    document.getElementById('closed-card').style.display = 'block';

    document.getElementById('closed-question').textContent    = data.question;
    document.getElementById('closed-total-votes').textContent = `${total} vote${total !== 1 ? 's' : ''} total`;
    buildResultBars('closed-results-bars', data.options, votes, true);
    return;
  }

  if (voted) {
    // Already voted — show live results
    document.getElementById('vote-card').style.display   = 'none';
    document.getElementById('closed-card').style.display = 'none';
    document.getElementById('voted-card').style.display  = 'block';

    // Personalise the thank-you message with stored name
    const storedName = localStorage.getItem('pollsnap_name_' + pollId);
    const h2 = document.querySelector('#voted-card h2');
    if (h2) h2.textContent = storedName ? `Thanks, ${storedName}!` : 'Thanks for voting!';

    document.getElementById('voted-question').textContent   = data.question;
    document.getElementById('part-total-votes').textContent = `${total} vote${total !== 1 ? 's' : ''} total`;
    buildResultBars('part-results-bars', data.options, votes, true);
    return;
  }

  // Show voting form
  document.getElementById('voted-card').style.display  = 'none';
  document.getElementById('closed-card').style.display = 'none';
  document.getElementById('vote-card').style.display   = 'block';

  document.getElementById('part-question').textContent = data.question;

  const container = document.getElementById('vote-options');
  container.innerHTML = data.options.map((opt, i) => `
    <div class="vote-option" id="vote-opt-${i}" onclick="selectOption(${i})" role="radio" aria-checked="false" tabindex="0">
      <div class="vote-radio">
        <div class="vote-radio-dot"></div>
      </div>
      <span class="vote-option-text">${escapeHtml(opt)}</span>
    </div>
  `).join('');
}

// ─── Select Option ────────────────────────────────────────────
function selectOption(index) {
  selectedOptionIndex = index;

  document.querySelectorAll('.vote-option').forEach((el, i) => {
    el.classList.toggle('selected', i === index);
    el.setAttribute('aria-checked', i === index ? 'true' : 'false');
  });

  hideError('vote-error');
}
window.selectOption = selectOption;

// ─── Submit Vote ──────────────────────────────────────────────
async function submitVote() {
  if (!participantPollData) return;

  // Validate name
  const nameInput = document.getElementById('voter-name');
  const voterName = nameInput ? nameInput.value.trim() : '';
  if (!voterName) {
    showError('vote-error', 'Please enter your name before submitting.');
    if (nameInput) nameInput.focus();
    return;
  }

  // Validate option selection
  if (selectedOptionIndex === null) {
    showError('vote-error', 'Please select an option before submitting.');
    return;
  }

  const pollId  = participantPollData.id;
  const voterId = getVoterId(pollId);

  // Double-check if already voted (in Firestore)
  if (participantPollData.voterIds && participantPollData.voterIds.includes(voterId)) {
    markVoted(pollId, selectedOptionIndex);
    localStorage.setItem('pollsnap_name_' + pollId, voterName);
    renderParticipantView(participantPollData, pollId);
    return;
  }

  const btn  = document.getElementById('vote-btn');
  btn.disabled    = true;
  btn.textContent = '⏳ Submitting…';
  hideError('vote-error');

  try {
    const voteKey = `votes.${selectedOptionIndex}`;

    // Build voter detail object
    const voterDetail = {
      id:          voterId,
      name:        voterName,
      optionIndex: selectedOptionIndex,
      option:      participantPollData.options[selectedOptionIndex] || '',
      votedAt:     firebase.firestore.Timestamp.now()
    };

    await db.collection('polls').doc(pollId).update({
      [voteKey]:      firebase.firestore.FieldValue.increment(1),
      voterIds:       firebase.firestore.FieldValue.arrayUnion(voterId),
      voterDetails:   firebase.firestore.FieldValue.arrayUnion(voterDetail),
      expiresAt:      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    markVoted(pollId, selectedOptionIndex);
    localStorage.setItem('pollsnap_name_' + pollId, voterName);
    showToast('Vote submitted! ✅', 'success');

    // Immediately update local data & switch to voted view — don't wait for snapshot
    participantPollData.votes = participantPollData.votes || {};
    participantPollData.votes[selectedOptionIndex] = (participantPollData.votes[selectedOptionIndex] || 0) + 1;
    renderParticipantView(participantPollData, pollId);

  } catch (err) {
    console.error('Vote submit error:', err);
    showError('vote-error', 'Failed to submit vote: ' + (err.message || err));
    btn.disabled    = false;
    btn.textContent = '🗳️ Submit Vote';
  }
}
window.submitVote = submitVote;
