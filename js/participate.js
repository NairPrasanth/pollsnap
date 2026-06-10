// ============================================================
// PollSnap — Participant Voting View
// ============================================================

let participantPollData = null;
let selectedOptionIndex = null;

async function loadParticipantView(pollId) {
  setLoading(true);
  selectedOptionIndex = null;

  // Reset all sub-cards
  document.getElementById('vote-card').style.display      = 'none';
  document.getElementById('voted-card').style.display     = 'none';
  document.getElementById('thankyou-card').style.display  = 'none';
  document.getElementById('closed-card').style.display    = 'none';
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

  const isOpen      = data.isOpen !== false;
  const hideResults = data.hideResults === true;
  const voted       = hasVoted(pollId);
  const votes       = data.votes || {};
  const total       = Object.values(votes).reduce((a, b) => a + b, 0);

  // Hide all cards first
  document.getElementById('vote-card').style.display     = 'none';
  document.getElementById('voted-card').style.display    = 'none';
  document.getElementById('thankyou-card').style.display = 'none';
  document.getElementById('closed-card').style.display   = 'none';

  // ── Poll is CLOSED ──────────────────────────────────────────
  if (!isOpen) {
    document.getElementById('closed-card').style.display = 'block';
    document.getElementById('closed-question').textContent    = data.question;
    document.getElementById('closed-total-votes').textContent = `${total} vote${total !== 1 ? 's' : ''} total`;
    buildResultBars('closed-results-bars', data.options, votes, true);
    return;
  }

  // ── Participant already voted ────────────────────────────────
  if (voted) {
    const storedName       = localStorage.getItem('pollsnap_name_' + pollId);
    const storedOptIndex   = parseInt(localStorage.getItem('pollsnap_voted_' + pollId) ?? '-1', 10);
    const storedOptLabel   = data.options[storedOptIndex] || '—';

    if (hideResults) {
      // Show thank-you card — no results visible
      document.getElementById('thankyou-card').style.display = 'block';

      const choiceEl = document.getElementById('thankyou-choice');
      if (choiceEl) {
        choiceEl.innerHTML = storedOptIndex >= 0
          ? `Your choice: <strong>${escapeHtml(storedOptLabel)}</strong>`
          : '';
      }

      const title = document.querySelector('#thankyou-card .thankyou-title');
      if (title) title.textContent = storedName ? `Thank you, ${storedName}!` : 'Thank you for voting!';

    } else {
      // Show live results
      document.getElementById('voted-card').style.display  = 'block';

      const h2 = document.querySelector('#voted-card h2');
      if (h2) h2.textContent = storedName ? `Thanks, ${storedName}!` : 'Thanks for voting!';

      document.getElementById('voted-question').textContent   = data.question;
      document.getElementById('part-total-votes').textContent = `${total} vote${total !== 1 ? 's' : ''} total`;
      buildResultBars('part-results-bars', data.options, votes, true);
    }
    return;
  }

  // ── Show voting form ─────────────────────────────────────────
  document.getElementById('vote-card').style.display = 'block';
  document.getElementById('part-question').textContent = data.question;

  // Pre-fill name if known
  const storedName = localStorage.getItem('pollsnap_name_' + pollId);
  const nameInput  = document.getElementById('voter-name');
  if (nameInput && storedName) nameInput.value = storedName;

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

// ─── Change Vote ──────────────────────────────────────────────
function changeVote() {
  if (!participantPollData) return;
  const pollId = participantPollData.id;

  // Clear the local voted flag so they can re-vote
  localStorage.removeItem('pollsnap_voted_' + pollId);
  selectedOptionIndex = null;

  // Show the vote form again
  renderParticipantView(participantPollData, pollId);
}
window.changeVote = changeVote;

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

  // Check if changing vote — get previous option
  const prevOptIndex = parseInt(localStorage.getItem('pollsnap_voted_' + pollId) ?? '-1', 10);
  const isChanging   = hasVoted(pollId) || prevOptIndex >= 0;

  const btn  = document.getElementById('vote-btn');
  btn.disabled    = true;
  btn.textContent = '⏳ Submitting…';
  hideError('vote-error');

  try {
    const voterDetail = {
      id:          voterId,
      name:        voterName,
      optionIndex: selectedOptionIndex,
      option:      participantPollData.options[selectedOptionIndex] || '',
      votedAt:     firebase.firestore.Timestamp.now()
    };

    const update = {
      [`votes.${selectedOptionIndex}`]: firebase.firestore.FieldValue.increment(1),
      voterIds:     firebase.firestore.FieldValue.arrayUnion(voterId),
      voterDetails: firebase.firestore.FieldValue.arrayUnion(voterDetail),
      expiresAt:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };

    // If changing vote, decrement the old option and remove old voterDetail
    if (isChanging && prevOptIndex >= 0 && prevOptIndex !== selectedOptionIndex) {
      update[`votes.${prevOptIndex}`] = firebase.firestore.FieldValue.increment(-1);

      // Remove old voterDetail entry (by voter id) then re-add updated one
      const oldDetail = (participantPollData.voterDetails || []).find(v => v.id === voterId);
      if (oldDetail) {
        update.voterDetails = firebase.firestore.FieldValue.arrayRemove(oldDetail);
      }
    }

    // If voterDetails needs both remove+add, Firestore doesn't allow that in one update
    // So split into two writes when changing vote
    if (isChanging && prevOptIndex >= 0 && prevOptIndex !== selectedOptionIndex) {
      const oldDetail = (participantPollData.voterDetails || []).find(v => v.id === voterId);
      await db.collection('polls').doc(pollId).update({
        [`votes.${prevOptIndex}`]: firebase.firestore.FieldValue.increment(-1),
        ...(oldDetail ? { voterDetails: firebase.firestore.FieldValue.arrayRemove(oldDetail) } : {})
      });
      await db.collection('polls').doc(pollId).update({
        [`votes.${selectedOptionIndex}`]: firebase.firestore.FieldValue.increment(1),
        voterDetails: firebase.firestore.FieldValue.arrayUnion(voterDetail),
        expiresAt:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    } else if (!isChanging) {
      await db.collection('polls').doc(pollId).update(update);
    }
    // If same option re-selected, just update name/timestamp
    if (isChanging && prevOptIndex === selectedOptionIndex) {
      const oldDetail = (participantPollData.voterDetails || []).find(v => v.id === voterId);
      if (oldDetail) {
        await db.collection('polls').doc(pollId).update({
          voterDetails: firebase.firestore.FieldValue.arrayRemove(oldDetail)
        });
      }
      await db.collection('polls').doc(pollId).update({
        voterDetails: firebase.firestore.FieldValue.arrayUnion(voterDetail),
        expiresAt:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    markVoted(pollId, selectedOptionIndex);
    localStorage.setItem('pollsnap_name_' + pollId, voterName);
    showToast('Vote submitted! ✅', 'success');

    // Immediately update local data & switch to the appropriate card
    participantPollData.votes = participantPollData.votes || {};
    if (isChanging && prevOptIndex >= 0 && prevOptIndex !== selectedOptionIndex) {
      participantPollData.votes[prevOptIndex] = Math.max(0, (participantPollData.votes[prevOptIndex] || 1) - 1);
    }
    if (!isChanging) {
      participantPollData.votes[selectedOptionIndex] = (participantPollData.votes[selectedOptionIndex] || 0) + 1;
    }

    // Update voterDetails locally for immediate re-render
    if (!participantPollData.voterDetails) participantPollData.voterDetails = [];
    participantPollData.voterDetails = participantPollData.voterDetails.filter(v => v.id !== voterId);
    participantPollData.voterDetails.push({ ...voterDetail, votedAt: { seconds: Date.now() / 1000 } });

    renderParticipantView(participantPollData, pollId);

  } catch (err) {
    console.error('Vote submit error:', err);
    showError('vote-error', 'Failed to submit vote: ' + (err.message || err));
    btn.disabled    = false;
    btn.textContent = '🗳️ Submit Vote';
  }
}
window.submitVote = submitVote;
