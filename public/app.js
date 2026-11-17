// InstantClip Mobile-First Client Logic
// Follows mobile UI/UX principles, haptics, and Peak-End feedback

(function () {
  'use strict';

  // --- State & URL params ---
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  const sharedTextParam = urlParams.get('shared');

  let currentRoom = roomParam || localStorage.getItem('instantclip_room') || 'sync';
  currentRoom = currentRoom.trim().toLowerCase();
  localStorage.setItem('instantclip_room', currentRoom);

  // Persistent Client UUID across reconnects and refreshes
  let myClientId = localStorage.getItem('instantclip_client_id');
  if (!myClientId) {
    myClientId = 'client_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    localStorage.setItem('instantclip_client_id', myClientId);
  }

  let autoCopy = localStorage.getItem('instantclip_autocopy') !== 'false';

  // Clean URL params cleanly
  if (roomParam || sharedTextParam) {
    const cleanUrl = window.location.pathname + (currentRoom !== 'sync' ? `?room=${encodeURIComponent(currentRoom)}` : '');
    window.history.replaceState({}, document.title, cleanUrl);
  }

  // --- Device Detection ---
  function getDeviceDetails() {
    const ua = navigator.userAgent;
    let type = 'desktop';
    let name = 'Desktop';

    if (/android/i.test(ua)) {
      type = 'mobile';
      name = 'Android Phone';
    } else if (/iPad|iPhone|iPod/.test(ua)) {
      type = 'mobile';
      name = 'iPhone';
    } else if (/windows/i.test(ua)) {
      name = 'Windows Laptop';
    } else if (/macintosh|mac os x/i.test(ua)) {
      name = 'MacBook';
    } else if (/linux/i.test(ua)) {
      name = 'Linux';
    }

    return { type, name };
  }

  const myDevice = getDeviceDetails();

  // --- DOM Elements ---
  const roomNameDisplay = document.getElementById('room-name-display');
  const roomHeaderPill = document.getElementById('room-header-pill');
  const statusDot = document.getElementById('status-dot');
  const deviceCountText = document.getElementById('device-count-text');
  const peerStatusTitle = document.getElementById('peer-status-title');
  const peerStatusDesc = document.getElementById('peer-status-desc');
  const autoCopyToggle = document.getElementById('auto-copy-toggle');
  const clearAllBtn = document.getElementById('clear-all-btn');
  const clipsList = document.getElementById('clips-list');
  const emptyState = document.getElementById('empty-state');
  const clipInput = document.getElementById('clip-input');
  const sendBtn = document.getElementById('send-btn');
  const pasteSendBtn = document.getElementById('paste-send-btn');
  const quickQrBtn = document.getElementById('quick-qr-btn');
  const openPairModalBtn = document.getElementById('open-pair-modal-btn');
  const pairModal = document.getElementById('pair-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const qrImage = document.getElementById('qr-image');
  const qrLoading = document.getElementById('qr-loading');
  const pairUrlInput = document.getElementById('pair-url-input');
  const copyUrlBtn = document.getElementById('copy-url-btn');
  const modalRoomInput = document.getElementById('modal-room-input');
  const changeRoomBtn = document.getElementById('change-room-btn');
  const toastContainer = document.getElementById('toast-container');

  // Initial UI state
  roomNameDisplay.textContent = currentRoom;
  modalRoomInput.value = currentRoom;
  autoCopyToggle.checked = autoCopy;

  // --- Haptic Feedback Utility ---
  function triggerHaptic(type = 'light') {
    if (!navigator.vibrate) return;
    try {
      if (type === 'light') navigator.vibrate(15);
      else if (type === 'success') navigator.vibrate([20, 40, 20]);
      else if (type === 'error') navigator.vibrate([50, 50]);
    } catch (_) {}
  }

  // --- Sound Alert (Web Audio Synthesized Chime) ---
  function playAudioChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.23);
    } catch (_) {}
  }

  // --- Toast System ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-pill ${type === 'success' ? 'toast-success' : ''}`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      setTimeout(() => toast.remove(), 250);
    }, 2200);
  }

  // --- Socket.IO Realtime Connection ---
  const socket = io();

  socket.on('connect', () => {
    statusDot.style.background = 'var(--accent-success)';
    statusDot.style.boxShadow = '0 0 8px var(--accent-success)';
    
    socket.emit('join-room', {
      room: currentRoom,
      deviceType: myDevice.type,
      deviceName: myDevice.name,
      clientId: myClientId
    });
  });

  socket.on('disconnect', () => {
    statusDot.style.background = 'var(--accent-danger)';
    statusDot.style.boxShadow = 'none';
    deviceCountText.textContent = 'Disconnected';
    peerStatusTitle.textContent = 'Connection Lost';
    peerStatusDesc.textContent = 'Reconnecting to network...';
  });

  socket.on('room-status', ({ deviceCount, devices }) => {
    deviceCountText.textContent = `${deviceCount} Online`;

    // Filter peers (other than me)
    const peers = devices.filter(d => d.id !== socket.id);
    if (peers.length > 0) {
      const peerNames = peers.map(p => p.name).join(', ');
      peerStatusTitle.textContent = `Connected with ${peerNames}`;
      peerStatusDesc.textContent = 'Instant clipboard bridge is active';
      statusDot.style.background = 'var(--accent-success)';
    } else {
      peerStatusTitle.textContent = 'Ready to Sync';
      peerStatusDesc.textContent = 'Pair your other device using the QR code';
    }
  });

  socket.on('init-history', (clips) => {
    renderAllClips(clips);
  });

  socket.on('new-clip', (clip) => {
    addClipToTop(clip);

    const isFromMe = clip.senderClientId ? (clip.senderClientId === myClientId) : (clip.senderSocketId === socket.id);

    if (!isFromMe) {
      playAudioChime();
      triggerHaptic('success');

      if (autoCopy && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(clip.content)
          .then(() => {
            showToast(`⚡ Auto-copied from ${clip.senderName}`, 'success');
          })
          .catch(() => {
            showToast(`📩 New clip from ${clip.senderName}`);
          });
      } else {
        showToast(`📩 New clip from ${clip.senderName}`);
      }
    } else {
      triggerHaptic('light');
      showToast('🚀 Transmitted to paired device!', 'success');
    }
  });

  socket.on('clip-deleted', ({ id }) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(12px) scale(0.96)';
      setTimeout(() => {
        el.remove();
        checkEmptyState();
      }, 200);
    }
  });

  socket.on('all-cleared', () => {
    clipsList.innerHTML = '';
    clipsList.appendChild(emptyState);
    emptyState.classList.remove('hidden');
    showToast('All clips cleared');
  });

  // --- Rendering Utilities ---
  function checkEmptyState() {
    const cards = clipsList.querySelectorAll('.clip-item-card');
    if (cards.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
    }
  }

  function isUrl(text) {
    try {
      const url = new URL(text.trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  function formatTime(timestamp) {
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000);
    if (diff < 30) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    const min = Math.floor(diff / 60);
    if (min < 60) return `${min}m ago`;
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function createClipElement(clip) {
    const card = document.createElement('div');
    const isFromMe = clip.senderClientId ? (clip.senderClientId === myClientId) : (clip.senderSocketId === socket.id);
    
    card.className = `clip-item-card ${isFromMe ? 'msg-outgoing' : 'msg-incoming'}`;
    card.id = clip.id;

    const isLink = isUrl(clip.content);
    const isMobile = clip.senderName.toLowerCase().includes('phone') || clip.senderName.toLowerCase().includes('iphone');

    const deviceIconSvg = isMobile
      ? `<svg class="device-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`
      : `<svg class="device-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;

    const senderDisplay = isFromMe ? 'You (this device)' : escapeHtml(clip.senderName);
    const statusTicks = isFromMe ? `<span class="wa-checks" title="Sent & Delivered">✓✓</span>` : '';

    card.innerHTML = `
      <div class="card-top-row">
        <div class="sender-pill">
          ${deviceIconSvg}
          <span>${senderDisplay}</span>
        </div>
        <div class="meta-right-group">
          <span class="card-timestamp">${formatTime(clip.timestamp)}</span>
          ${statusTicks}
        </div>
      </div>

      <div class="card-content-preview">${escapeHtml(clip.content)}</div>

      <div class="card-action-row">
        <div class="action-row-left">
          <button class="copy-cta-btn" data-id="${clip.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
            <span class="btn-copy-label">Copy</span>
          </button>

          ${isLink ? `
            <a href="${escapeHtml(clip.content.trim())}" target="_blank" rel="noopener noreferrer" class="open-url-cta">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              <span>Open Link</span>
            </a>
          ` : ''}
        </div>

        <button class="btn-card-del" data-id="${clip.id}" title="Delete clip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    // Copy Button Interaction (Peak-End Rule)
    const copyBtn = card.querySelector('.copy-cta-btn');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(clip.content);
        triggerHaptic('success');
        copyBtn.classList.add('copied');
        copyBtn.querySelector('svg').innerHTML = `
          <polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"></polyline>
        `;
        copyBtn.querySelector('.btn-copy-label').textContent = 'Copied!';
        showToast('Copied to clipboard!', 'success');

        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.querySelector('svg').innerHTML = `
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          `;
          copyBtn.querySelector('.btn-copy-label').textContent = 'Copy';
        }, 1800);
      } catch (_) {
        showToast('Failed to copy');
      }
    });

    // Delete Button
    card.querySelector('.btn-card-del').addEventListener('click', () => {
      socket.emit('delete-clip', { id: clip.id });
    });

    return card;
  }

  function addClipToTop(clip) {
    emptyState.classList.add('hidden');
    const card = createClipElement(clip);
    clipsList.insertBefore(card, clipsList.firstChild);
    checkEmptyState();
  }

  function renderAllClips(clips) {
    clipsList.innerHTML = '';
    clipsList.appendChild(emptyState);

    if (!clips || clips.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      clips.forEach(clip => {
        const card = createClipElement(clip);
        clipsList.appendChild(card);
      });
    }
  }

  // --- Send Text Actions ---
  function sendText(content) {
    if (!content || !content.trim()) return;
    socket.emit('send-clip', {
      content: content.trim(),
      deviceName: myDevice.name,
      senderClientId: myClientId
    });
    clipInput.value = '';
    triggerHaptic('light');
  }

  // Ctrl+Enter or Cmd+Enter to send
  clipInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendText(clipInput.value);
    }
  });

  sendBtn.addEventListener('click', () => {
    sendText(clipInput.value);
  });

  // "Paste & Send" (Thumb Zone 1-Tap Action)
  pasteSendBtn.addEventListener('click', async () => {
    triggerHaptic('light');
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          sendText(text);
          showToast('📋 Pasted & Sent instantly!', 'success');
        } else {
          showToast('Clipboard is empty');
        }
      } else {
        clipInput.focus();
        showToast('Paste inside text box');
      }
    } catch (_) {
      clipInput.focus();
      showToast('Tap inside box to paste');
    }
  });

  // Handle shared content from Android share sheet
  if (sharedTextParam) {
    setTimeout(() => {
      sendText(sharedTextParam);
    }, 400);
  }

  // Auto Copy Toggle
  autoCopyToggle.addEventListener('change', (e) => {
    autoCopy = e.target.checked;
    localStorage.setItem('instantclip_autocopy', autoCopy);
    triggerHaptic('light');
    showToast(autoCopy ? 'Auto-copy enabled' : 'Auto-copy disabled');
  });

  // Clear All
  clearAllBtn.addEventListener('click', () => {
    if (confirm('Clear clipboard history for all paired devices?')) {
      socket.emit('clear-all');
      triggerHaptic('light');
    }
  });

  // --- Pairing Modal Logic ---
  async function loadPairingQR() {
    qrLoading.classList.remove('hidden');
    qrImage.classList.add('hidden');

    try {
      const res = await fetch(`/api/info?room=${encodeURIComponent(currentRoom)}`);
      const data = await res.json();

      qrImage.src = data.qrDataUrl;
      qrImage.onload = () => {
        qrLoading.classList.add('hidden');
        qrImage.classList.remove('hidden');
      };

      pairUrlInput.value = data.url;
    } catch (_) {
      qrLoading.textContent = 'Could not generate QR code';
    }
  }

  function openPairModal() {
    loadPairingQR();
    pairModal.classList.remove('hidden');
    triggerHaptic('light');
  }

  function closePairModal() {
    pairModal.classList.add('hidden');
  }

  openPairModalBtn.addEventListener('click', openPairModal);
  quickQrBtn.addEventListener('click', openPairModal);
  roomHeaderPill.addEventListener('click', openPairModal);
  closeModalBtn.addEventListener('click', closePairModal);

  pairModal.addEventListener('click', (e) => {
    if (e.target === pairModal) closePairModal();
  });

  copyUrlBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pairUrlInput.value);
      copyUrlBtn.textContent = 'Copied!';
      triggerHaptic('success');
      setTimeout(() => (copyUrlBtn.textContent = 'Copy'), 1800);
      showToast('Pairing link copied!', 'success');
    } catch (_) {
      pairUrlInput.select();
      document.execCommand('copy');
      showToast('Link copied!');
    }
  });

  changeRoomBtn.addEventListener('click', () => {
    const newRoom = modalRoomInput.value.trim().toLowerCase();
    if (newRoom && newRoom !== currentRoom) {
      currentRoom = newRoom;
      localStorage.setItem('instantclip_room', currentRoom);
      roomNameDisplay.textContent = currentRoom;

      socket.emit('join-room', {
        room: currentRoom,
        deviceType: myDevice.type,
        deviceName: myDevice.name
      });

      loadPairingQR();
      showToast(`Joined room "${currentRoom}"`, 'success');
      triggerHaptic('success');
    }
  });

  // --- PWA Service Worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

})();
