(() => {
  const ENHANCEMENTS_KEY = 'epd-heft-epd14-v1';
  const TIMER_DEFAULTS = { schreiben: 80, lesen: 30, hoeren: 15 };
  const TIMER_PRESETS = {
    schreiben: [20, 40, 80],
    lesen: [10, 25, 30],
    hoeren: [5, 10, 15],
  };

  let timerUiInterval = null;
  let editingWordId = null;

  function loadData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(ENHANCEMENTS_KEY) || '{}');
      return {
        words: Array.isArray(parsed.words) ? parsed.words : [],
        timers: parsed.timers && typeof parsed.timers === 'object' ? parsed.timers : {},
        customView: parsed.customView || null,
      };
    } catch {
      return { words: [], timers: {}, customView: null };
    }
  }

  const data = loadData();

  function saveData() {
    localStorage.setItem(ENHANCEMENTS_KEY, JSON.stringify(data));
    const saveState = document.getElementById('saveState');
    if (saveState) {
      saveState.textContent = 'Gespeichert';
      saveState.style.color = '';
    }
  }

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function currentStudyView() {
    return document.querySelector('.nav-item[data-view].active')?.dataset.view || 'schreiben';
  }

  function ensureTimer(view) {
    const fallback = TIMER_DEFAULTS[view] || 30;
    if (!data.timers[view]) {
      data.timers[view] = {
        durationMinutes: fallback,
        remainingSeconds: fallback * 60,
        running: false,
        startedAt: null,
        remainingAtStart: fallback * 60,
      };
      saveData();
    }
    const timer = data.timers[view];
    if (!Number.isFinite(timer.durationMinutes) || timer.durationMinutes <= 0) timer.durationMinutes = fallback;
    if (!Number.isFinite(timer.remainingSeconds) || timer.remainingSeconds < 0) timer.remainingSeconds = timer.durationMinutes * 60;
    return timer;
  }

  function getRemaining(timer) {
    if (!timer.running || !timer.startedAt) return Math.max(0, Math.round(timer.remainingSeconds));
    const base = Number.isFinite(timer.remainingAtStart) ? timer.remainingAtStart : timer.remainingSeconds;
    const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
    return Math.max(0, base - elapsed);
  }

  function persistPausedState(timer) {
    timer.remainingSeconds = getRemaining(timer);
    timer.running = false;
    timer.startedAt = null;
    timer.remainingAtStart = timer.remainingSeconds;
    saveData();
  }

  function installPersistentTimer() {
    if (data.customView === 'woerter') return;
    const card = document.querySelector('.timer-card');
    if (!card || card.dataset.epd14Timer === '1') return;

    const view = currentStudyView();
    if (!TIMER_DEFAULTS[view]) return;

    clearInterval(timerUiInterval);
    card.dataset.epd14Timer = '1';
    const timer = ensureTimer(view);
    const presets = TIMER_PRESETS[view];

    card.innerHTML = `
      <span class="tool-label">PRÜFUNGSZEIT</span>
      <div class="timer" id="timerDisplay">00:00</div>
      <div class="timer-edit-row">
        <label for="timerMinutes">Minuten</label>
        <div class="timer-edit-controls">
          <input id="timerMinutes" class="timer-minutes-input" type="number" min="1" max="240" step="1" inputmode="numeric" value="${Math.round(timer.durationMinutes)}" />
          <button class="secondary compact" id="timerApply" type="button">Übernehmen</button>
        </div>
      </div>
      <div class="timer-actions">
        <button class="primary compact" id="timerStart" type="button">Start</button>
        <button class="secondary compact" id="timerPause" type="button">Pause</button>
        <button class="ghost compact" id="timerReset" type="button">Reset</button>
      </div>
      <div class="preset-row" id="presetRow">
        ${presets.map(minutes => `<button class="preset-chip" data-epd14-min="${minutes}" type="button">${minutes} min</button>`).join('')}
      </div>`;

    const display = card.querySelector('#timerDisplay');
    const minutesInput = card.querySelector('#timerMinutes');

    function refreshDisplay() {
      const remaining = getRemaining(timer);
      const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
      const seconds = (remaining % 60).toString().padStart(2, '0');
      display.textContent = `${minutes}:${seconds}`;
      display.style.color = remaining > 0 && remaining <= 300 ? '#d94040' : '';

      if (remaining <= 0 && timer.running) {
        timer.running = false;
        timer.remainingSeconds = 0;
        timer.remainingAtStart = 0;
        timer.startedAt = null;
        saveData();
      }
    }

    card.querySelector('#timerApply').addEventListener('click', () => {
      const minutes = Math.max(1, Math.min(240, Math.round(Number(minutesInput.value) || timer.durationMinutes)));
      timer.durationMinutes = minutes;
      timer.remainingSeconds = minutes * 60;
      timer.remainingAtStart = timer.remainingSeconds;
      timer.running = false;
      timer.startedAt = null;
      minutesInput.value = String(minutes);
      saveData();
      refreshDisplay();
    });

    card.querySelector('#timerStart').addEventListener('click', () => {
      if (timer.running) return;
      const remaining = getRemaining(timer);
      if (remaining <= 0) {
        timer.remainingSeconds = timer.durationMinutes * 60;
      } else {
        timer.remainingSeconds = remaining;
      }
      timer.remainingAtStart = timer.remainingSeconds;
      timer.startedAt = Date.now();
      timer.running = true;
      saveData();
      refreshDisplay();
    });

    card.querySelector('#timerPause').addEventListener('click', () => {
      if (!timer.running) return;
      persistPausedState(timer);
      refreshDisplay();
    });

    card.querySelector('#timerReset').addEventListener('click', () => {
      timer.running = false;
      timer.startedAt = null;
      timer.remainingSeconds = timer.durationMinutes * 60;
      timer.remainingAtStart = timer.remainingSeconds;
      saveData();
      refreshDisplay();
    });

    card.querySelectorAll('[data-epd14-min]').forEach(button => {
      button.addEventListener('click', () => {
        const minutes = Number(button.dataset.epd14Min);
        timer.durationMinutes = minutes;
        timer.remainingSeconds = minutes * 60;
        timer.remainingAtStart = timer.remainingSeconds;
        timer.running = false;
        timer.startedAt = null;
        minutesInput.value = String(minutes);
        saveData();
        refreshDisplay();
      });
    });

    refreshDisplay();
    timerUiInterval = setInterval(refreshDisplay, 250);
  }

  function renderWords(filter = '') {
    data.customView = 'woerter';
    saveData();
    clearInterval(timerUiInterval);

    document.querySelectorAll('.nav-item').forEach(button => button.classList.remove('active'));
    wordsButton.classList.add('active');

    const eyebrow = document.getElementById('sectionEyebrow');
    const title = document.getElementById('sectionTitle');
    const newEntry = document.getElementById('newEntryBtn');
    const history = document.getElementById('historyBtn');
    if (eyebrow) eyebrow.textContent = 'EPD · WORTSCHATZ';
    if (title) title.textContent = 'Neue Wörter';
    if (newEntry) newEntry.style.display = 'none';
    if (history) history.style.display = 'none';

    const workspace = document.getElementById('workspace');
    const query = filter.trim().toLowerCase();
    const visibleWords = data.words.filter(item => {
      if (!query) return true;
      return [item.word, item.translation, item.note].some(value => String(value || '').toLowerCase().includes(query));
    });

    workspace.innerHTML = `
      <div class="words-layout">
        <section class="words-form-card">
          <span class="eyebrow">NEUES WORT</span>
          <h2>${editingWordId ? 'Wort bearbeiten' : 'Wort speichern'}</h2>
          <div class="word-form-grid">
            <div class="field">
              <label for="wordGerman">Deutsch</label>
              <input id="wordGerman" type="text" placeholder="z. B. Voraussetzung" autocomplete="off" />
            </div>
            <div class="field">
              <label for="wordTranslation">Перевод</label>
              <input id="wordTranslation" type="text" placeholder="z. B. предпосылка" autocomplete="off" />
            </div>
            <div class="field word-note-field">
              <label for="wordNote">Beispiel / Notiz</label>
              <textarea id="wordNote" rows="3" placeholder="Ein Beispielsatz, Synonym, Artikel oder Hinweis …"></textarea>
            </div>
          </div>
          <div class="word-form-actions">
            ${editingWordId ? '<button class="secondary" id="cancelWordEdit" type="button">Abbrechen</button>' : ''}
            <button class="primary" id="saveWord" type="button">${editingWordId ? 'Änderungen speichern' : '+ Wort hinzufügen'}</button>
          </div>
        </section>

        <section class="words-list-card">
          <div class="words-list-head">
            <div>
              <span class="tool-label">MEIN WORTSCHATZ</span>
              <h2>${data.words.length} ${data.words.length === 1 ? 'Wort' : 'Wörter'}</h2>
            </div>
            <input id="wordSearch" class="word-search" type="search" placeholder="Suchen …" value="${escapeHtml(filter)}" />
          </div>
          <div id="wordsList" class="words-list">
            ${visibleWords.length ? visibleWords.map(item => `
              <article class="word-card">
                <div class="word-main">
                  <strong>${escapeHtml(item.word)}</strong>
                  <span>${escapeHtml(item.translation)}</span>
                  ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}
                </div>
                <div class="word-actions">
                  <button class="secondary compact" type="button" data-word-edit="${item.id}">Bearbeiten</button>
                  <button class="ghost compact word-delete" type="button" data-word-delete="${item.id}">Löschen</button>
                </div>
              </article>`).join('') : '<div class="empty">Noch keine Wörter gespeichert.</div>'}
          </div>
        </section>
      </div>`;

    const editing = editingWordId ? data.words.find(item => item.id === editingWordId) : null;
    if (editing) {
      document.getElementById('wordGerman').value = editing.word || '';
      document.getElementById('wordTranslation').value = editing.translation || '';
      document.getElementById('wordNote').value = editing.note || '';
    }

    document.getElementById('saveWord').addEventListener('click', () => {
      const word = document.getElementById('wordGerman').value.trim();
      const translation = document.getElementById('wordTranslation').value.trim();
      const note = document.getElementById('wordNote').value.trim();
      if (!word && !translation) return;

      if (editingWordId) {
        const existing = data.words.find(item => item.id === editingWordId);
        if (existing) {
          existing.word = word;
          existing.translation = translation;
          existing.note = note;
          existing.updatedAt = Date.now();
        }
        editingWordId = null;
      } else {
        data.words.unshift({ id: uid(), word, translation, note, createdAt: Date.now(), updatedAt: Date.now() });
      }
      saveData();
      renderWords(document.getElementById('wordSearch')?.value || '');
    });

    document.getElementById('wordSearch').addEventListener('input', event => renderWords(event.target.value));

    workspace.querySelectorAll('[data-word-edit]').forEach(button => {
      button.addEventListener('click', () => {
        editingWordId = button.dataset.wordEdit;
        renderWords(filter);
        document.getElementById('wordGerman')?.focus();
      });
    });

    workspace.querySelectorAll('[data-word-delete]').forEach(button => {
      button.addEventListener('click', () => {
        data.words = data.words.filter(item => item.id !== button.dataset.wordDelete);
        if (editingWordId === button.dataset.wordDelete) editingWordId = null;
        saveData();
        renderWords(filter);
      });
    });

    document.getElementById('cancelWordEdit')?.addEventListener('click', () => {
      editingWordId = null;
      renderWords(filter);
    });
  }

  const nav = document.getElementById('nav');
  const wordsButton = document.createElement('button');
  wordsButton.className = 'nav-item';
  wordsButton.type = 'button';
  wordsButton.dataset.epd14View = 'woerter';
  wordsButton.innerHTML = '<span>🗂️</span>Neue Wörter';
  nav.appendChild(wordsButton);
  wordsButton.addEventListener('click', () => {
    editingWordId = null;
    renderWords();
  });

  document.querySelectorAll('.nav-item[data-view]').forEach(button => {
    button.addEventListener('click', () => {
      data.customView = null;
      editingWordId = null;
      saveData();
      requestAnimationFrame(installPersistentTimer);
    });
  });

  const observer = new MutationObserver(() => {
    if (data.customView !== 'woerter') installPersistentTimer();
  });
  observer.observe(document.getElementById('workspace'), { childList: true, subtree: true });

  if (data.customView === 'woerter') {
    renderWords();
  } else {
    installPersistentTimer();
  }
})();
