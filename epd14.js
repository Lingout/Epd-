(() => {
  const ENHANCEMENTS_KEY = 'epd-heft-epd14-v1';
  const DB_NAME = 'epd14-local-files';
  const DB_VERSION = 1;
  const FILE_STORE = 'files';
  const DEFAULT_GRAMMAR_ID = 'grammatik-aktiv-b2-c1';
  const TIMER_DEFAULTS = { schreiben: 80, lesen: 30, hoeren: 15 };
  const TIMER_PRESETS = {
    schreiben: [20, 40, 80],
    lesen: [10, 25, 30],
    hoeren: [5, 10, 15],
  };

  let timerUiInterval = null;
  let activeKeyHandler = null;
  let activeObjectUrl = null;
  let flashState = null;
  let learnState = null;
  let editorDraft = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function normalizeAnswer(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('de-DE');
  }

  function formatUpdated(timestamp) {
    if (!timestamp) return '';
    try {
      return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
    } catch {
      return '';
    }
  }

  function loadData() {
    let parsed = {};
    try {
      parsed = JSON.parse(localStorage.getItem(ENHANCEMENTS_KEY) || '{}');
    } catch {
      parsed = {};
    }
    return {
      version: 3,
      words: Array.isArray(parsed.words) ? parsed.words : [],
      decks: Array.isArray(parsed.decks) ? parsed.decks : [],
      timers: parsed.timers && typeof parsed.timers === 'object' ? parsed.timers : {},
      customView: parsed.customView || null,
      grammar: parsed.grammar && typeof parsed.grammar === 'object'
        ? { files: [], selectedFileId: null, ...parsed.grammar }
        : { files: [], selectedFileId: null },
      migratedWordsAt: parsed.migratedWordsAt || null,
    };
  }

  const data = loadData();

  function saveData() {
    localStorage.setItem(ENHANCEMENTS_KEY, JSON.stringify(data));
    const saveState = $('#saveState');
    if (saveState) {
      saveState.textContent = 'Gespeichert';
      saveState.style.color = '';
    }
  }

  function migrateLegacyWords() {
    if (data.migratedWordsAt) return;
    if (!data.decks.length && data.words.length) {
      const cards = data.words
        .map(item => ({
          id: item.id || uid(),
          de: String(item.word || '').trim(),
          ru: String(item.translation || '').trim(),
          createdAt: item.createdAt || Date.now(),
          updatedAt: item.updatedAt || Date.now(),
        }))
        .filter(card => card.de || card.ru);
      if (cards.length) {
        data.decks.push({
          id: uid(),
          title: 'Meine Wörter',
          description: '',
          cards,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
    data.migratedWordsAt = Date.now();
    saveData();
  }

  function ensureDefaultGrammarFile() {
    if (!Array.isArray(data.grammar.files)) data.grammar.files = [];
    if (!data.grammar.files.some(file => file.id === DEFAULT_GRAMMAR_ID)) {
      data.grammar.files.unshift({
        id: DEFAULT_GRAMMAR_ID,
        title: 'Grammatik aktiv B2–C1',
        fileName: 'Grammatik aktiv B2-C1.pdf',
        mime: 'application/pdf',
        pages: 311,
        notebook: '',
        splitRatio: 56,
        viewMode: 'split',
        zoom: 'page-width',
        page: 1,
        seeded: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      saveData();
    }
  }

  migrateLegacyWords();
  ensureDefaultGrammarFile();
  injectAdvancedStyles();

  function setKeyHandler(handler) {
    if (activeKeyHandler) document.removeEventListener('keydown', activeKeyHandler);
    activeKeyHandler = handler || null;
    if (activeKeyHandler) document.addEventListener('keydown', activeKeyHandler);
  }

  function cleanupCustomRuntime() {
    clearInterval(timerUiInterval);
    setKeyHandler(null);
    flashState = null;
    learnState = null;
    editorDraft = null;
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = null;
    }
  }

  function currentStudyView() {
    return $('.nav-item[data-view].active')?.dataset.view || 'schreiben';
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
    if (data.customView) return;
    const card = $('.timer-card');
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

    const display = $('#timerDisplay', card);
    const minutesInput = $('#timerMinutes', card);

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

    $('#timerApply', card).addEventListener('click', () => {
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

    $('#timerStart', card).addEventListener('click', () => {
      if (timer.running) return;
      const remaining = getRemaining(timer);
      timer.remainingSeconds = remaining <= 0 ? timer.durationMinutes * 60 : remaining;
      timer.remainingAtStart = timer.remainingSeconds;
      timer.startedAt = Date.now();
      timer.running = true;
      saveData();
      refreshDisplay();
    });

    $('#timerPause', card).addEventListener('click', () => {
      if (!timer.running) return;
      persistPausedState(timer);
      refreshDisplay();
    });

    $('#timerReset', card).addEventListener('click', () => {
      timer.running = false;
      timer.startedAt = null;
      timer.remainingSeconds = timer.durationMinutes * 60;
      timer.remainingAtStart = timer.remainingSeconds;
      saveData();
      refreshDisplay();
    });

    $$('[data-epd14-min]', card).forEach(button => {
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

  function activateCustomNav(button, eyebrow, title) {
    $$('.nav-item').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    $('#sectionEyebrow').textContent = eyebrow;
    $('#sectionTitle').textContent = title;
    $('#newEntryBtn').style.display = 'none';
    $('#historyBtn').style.display = 'none';
    $('#saveState').textContent = 'Lokal gespeichert';
    clearInterval(timerUiInterval);
  }

  function renderWortschatzHome() {
    cleanupCustomRuntime();
    data.customView = 'wortschatz';
    saveData();
    activateCustomNav(wordsButton, 'EPD · WORTSCHATZ', 'Wortschatz');

    const workspace = $('#workspace');
    workspace.innerHTML = `
      <div class="study-home">
        <section class="study-hero">
          <div>
            <span class="eyebrow">DEINE WORTLISTEN</span>
            <h2>Wortschatz wie mit Karteikarten lernen</h2>
            <p>Erstelle Listen, lerne mit Karten oder trainiere in 7er-Blöcken mit Auswahl- und Schreibaufgaben.</p>
          </div>
          <button class="primary" id="newDeckBtn" type="button">+ Neue Wortliste</button>
        </section>
        <section class="deck-grid" id="deckGrid">
          ${data.decks.length ? data.decks.map(deck => renderDeckTile(deck)).join('') : `
            <div class="study-empty">
              <div class="study-empty-icon">🗂️</div>
              <h3>Noch keine Wortlisten</h3>
              <p>Erstelle deine erste Liste oder übernimm Wörter per Tab-Import.</p>
            </div>`}
        </section>
      </div>`;

    $('#newDeckBtn').addEventListener('click', () => renderDeckEditor());
    $$('[data-open-deck]', workspace).forEach(button => button.addEventListener('click', () => renderFlashcards(button.dataset.openDeck)));
    $$('[data-edit-deck]', workspace).forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      renderDeckEditor(button.dataset.editDeck);
    }));
    $$('[data-delete-deck]', workspace).forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      const deck = getDeck(button.dataset.deleteDeck);
      if (!deck) return;
      if (!window.confirm(`„${deck.title}“ löschen?`)) return;
      data.decks = data.decks.filter(item => item.id !== deck.id);
      saveData();
      renderWortschatzHome();
    }));
  }

  function renderDeckTile(deck) {
    const preview = deck.cards.slice(0, 3).map(card => `<span>${escapeHtml(card.de || '—')}</span>`).join('');
    return `
      <article class="deck-tile" data-open-deck="${deck.id}" tabindex="0" role="button">
        <div class="deck-tile-top">
          <div class="deck-icon">▤</div>
          <div class="deck-tile-actions">
            <button class="icon-text" data-edit-deck="${deck.id}" type="button">Bearbeiten</button>
            <button class="icon-text danger-text" data-delete-deck="${deck.id}" type="button">Löschen</button>
          </div>
        </div>
        <h3>${escapeHtml(deck.title || 'Ohne Titel')}</h3>
        <p>${deck.cards.length} ${deck.cards.length === 1 ? 'Karte' : 'Karten'}</p>
        <div class="deck-preview">${preview || '<span>Noch leer</span>'}</div>
        <footer>${formatUpdated(deck.updatedAt)}</footer>
      </article>`;
  }

  function getDeck(deckId) {
    return data.decks.find(deck => deck.id === deckId) || null;
  }

  function renderDeckEditor(deckId = null) {
    cleanupCustomRuntime();
    data.customView = 'wortschatz';
    saveData();
    activateCustomNav(wordsButton, 'EPD · WORTSCHATZ', deckId ? 'Wortliste bearbeiten' : 'Neue Wortliste');

    const source = deckId ? getDeck(deckId) : null;
    editorDraft = {
      id: source?.id || uid(),
      title: source?.title || '',
      description: source?.description || '',
      cards: source ? source.cards.map(card => ({ ...card })) : [
        { id: uid(), de: '', ru: '' },
        { id: uid(), de: '', ru: '' },
        { id: uid(), de: '', ru: '' },
      ],
      createdAt: source?.createdAt || Date.now(),
      updatedAt: Date.now(),
      isNew: !source,
    };

    const workspace = $('#workspace');
    workspace.innerHTML = `
      <div class="deck-editor-shell">
        <div class="editor-toolbar">
          <button class="secondary" id="deckBack" type="button">← Wortschatz</button>
          <div class="editor-toolbar-actions">
            <button class="secondary" id="showBulkImport" type="button">Importieren</button>
            <button class="primary" id="saveDeck" type="button">Speichern</button>
          </div>
        </div>

        <section class="deck-editor-card">
          <label class="editor-label" for="deckTitle">TITEL</label>
          <input class="deck-title-input" id="deckTitle" value="${escapeHtml(editorDraft.title)}" placeholder="z. B. Studium & Auslandsstudium" />
          <textarea class="deck-description-input" id="deckDescription" rows="2" placeholder="Beschreibung (optional)">${escapeHtml(editorDraft.description)}</textarea>
        </section>

        <section class="bulk-import-card" id="bulkImportCard" hidden>
          <div>
            <span class="eyebrow">SCHNELLIMPORT</span>
            <h3>Deutsch und Russisch mit Tabulator trennen</h3>
            <p>Eine Karte pro Zeile: <b>das Auslandssemester</b> ⇥ <b>семестр за рубежом</b></p>
          </div>
          <textarea id="bulkImportText" rows="7" placeholder="das Auslandssemester\tсеместр за рубежом\ndas Erasmus-Programm\tпрограмма Эразмус"></textarea>
          <div class="bulk-import-actions">
            <span id="bulkImportStatus"></span>
            <button class="primary" id="applyBulkImport" type="button">Wörter übernehmen</button>
          </div>
        </section>

        <section class="term-editor-list" id="termEditorList"></section>
        <button class="secondary add-term-row" id="addTermRow" type="button">+ Karte hinzufügen</button>
      </div>`;

    renderTermRows();

    $('#deckTitle').addEventListener('input', event => { editorDraft.title = event.target.value; });
    $('#deckDescription').addEventListener('input', event => { editorDraft.description = event.target.value; });
    $('#deckBack').addEventListener('click', renderWortschatzHome);
    $('#showBulkImport').addEventListener('click', () => { $('#bulkImportCard').hidden = !$('#bulkImportCard').hidden; });
    $('#addTermRow').addEventListener('click', () => {
      editorDraft.cards.push({ id: uid(), de: '', ru: '' });
      renderTermRows();
      $$('.term-row .term-input').at(-2)?.focus();
    });
    $('#applyBulkImport').addEventListener('click', applyBulkImport);
    $('#saveDeck').addEventListener('click', saveDeckDraft);
  }

  function renderTermRows() {
    const list = $('#termEditorList');
    if (!list || !editorDraft) return;
    list.innerHTML = editorDraft.cards.map((card, index) => `
      <article class="term-row" data-row-id="${card.id}">
        <div class="term-row-number">${index + 1}</div>
        <div class="term-fields">
          <div>
            <input class="term-input" data-side="de" value="${escapeHtml(card.de)}" placeholder="Deutsch" autocomplete="off" />
            <span>DEUTSCH</span>
          </div>
          <div>
            <input class="term-input" data-side="ru" value="${escapeHtml(card.ru)}" placeholder="Русский" autocomplete="off" />
            <span>РУССКИЙ</span>
          </div>
        </div>
        <button class="term-delete" type="button" aria-label="Karte löschen">×</button>
      </article>`).join('');

    $$('.term-row', list).forEach(row => {
      const card = editorDraft.cards.find(item => item.id === row.dataset.rowId);
      $$('.term-input', row).forEach(input => input.addEventListener('input', () => { card[input.dataset.side] = input.value; }));
      $('.term-delete', row).addEventListener('click', () => {
        editorDraft.cards = editorDraft.cards.filter(item => item.id !== card.id);
        if (!editorDraft.cards.length) editorDraft.cards.push({ id: uid(), de: '', ru: '' });
        renderTermRows();
      });
    });
  }

  function applyBulkImport() {
    const text = $('#bulkImportText').value;
    const rows = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const parsed = [];
    let skipped = 0;
    rows.forEach(line => {
      const parts = line.split('\t');
      if (parts.length < 2) {
        skipped += 1;
        return;
      }
      const de = parts.shift().trim();
      const ru = parts.join('\t').trim();
      if (!de || !ru) {
        skipped += 1;
        return;
      }
      parsed.push({ id: uid(), de, ru });
    });
    editorDraft.cards = editorDraft.cards.filter(card => card.de.trim() || card.ru.trim());
    editorDraft.cards.push(...parsed);
    if (!editorDraft.cards.length) editorDraft.cards.push({ id: uid(), de: '', ru: '' });
    renderTermRows();
    $('#bulkImportStatus').textContent = `${parsed.length} übernommen${skipped ? ` · ${skipped} übersprungen` : ''}`;
    if (parsed.length) $('#bulkImportText').value = '';
  }

  function saveDeckDraft() {
    const title = editorDraft.title.trim();
    if (!title) {
      $('#deckTitle').focus();
      $('#deckTitle').classList.add('input-error');
      return;
    }
    const complete = editorDraft.cards
      .map(card => ({ ...card, de: card.de.trim(), ru: card.ru.trim() }))
      .filter(card => card.de && card.ru);
    if (!complete.length) {
      window.alert('Füge mindestens eine vollständige Karte mit Deutsch und Russisch hinzu.');
      return;
    }
    const deck = {
      id: editorDraft.id,
      title,
      description: editorDraft.description.trim(),
      cards: complete,
      createdAt: editorDraft.createdAt,
      updatedAt: Date.now(),
    };
    const index = data.decks.findIndex(item => item.id === deck.id);
    if (index >= 0) data.decks[index] = deck;
    else data.decks.unshift(deck);
    saveData();
    renderFlashcards(deck.id);
  }

  function renderFlashcards(deckId, subsetIds = null) {
    cleanupCustomRuntime();
    data.customView = 'wortschatz';
    saveData();
    const deck = getDeck(deckId);
    if (!deck || !deck.cards.length) return renderWortschatzHome();
    activateCustomNav(wordsButton, 'EPD · WORTSCHATZ', deck.title);

    const cards = subsetIds?.length ? subsetIds.map(id => deck.cards.find(card => card.id === id)).filter(Boolean) : [...deck.cards];
    flashState = { deckId, cards, index: 0, flipped: false, known: [], unknown: [], locked: false };

    const workspace = $('#workspace');
    workspace.innerHTML = `
      <div class="flash-shell" id="flashShell">
        <div class="study-mode-top">
          <button class="secondary" id="flashBack" type="button">← Wortlisten</button>
          <div class="study-mode-tabs">
            <button class="mode-tab active" type="button">Karten</button>
            <button class="mode-tab" id="openLearnMode" type="button">Zaubianie · Заучивание</button>
          </div>
          <div class="study-mode-actions">
            <button class="secondary" id="editCurrentDeck" type="button">Bearbeiten</button>
            <button class="secondary" id="flashFullscreen" type="button">⛶ Vollbild</button>
          </div>
        </div>
        <div class="flash-progress-row">
          <span id="flashProgress">1 / ${cards.length}</span>
          <div class="flash-progress-track"><i id="flashProgressBar"></i></div>
          <span id="flashScore">0 ✓ · 0 ×</span>
        </div>
        <div class="flash-stage">
          <button class="swipe-action swipe-left" id="unknownBtn" type="button" title="A / ←">← <span>Noch nicht</span></button>
          <div class="flash-card-scene" id="flashCardScene" tabindex="0" aria-label="Karte umdrehen">
            <div class="flash-card" id="flashCard">
              <div class="flash-face flash-front"><span class="flash-side-label">DEUTSCH</span><strong id="flashFront"></strong><small>W / ↑ / Leertaste zum Umdrehen</small></div>
              <div class="flash-face flash-back"><span class="flash-side-label">РУССКИЙ</span><strong id="flashBackText"></strong><small>S / ↓ zurück</small></div>
            </div>
          </div>
          <button class="swipe-action swipe-right" id="knownBtn" type="button" title="D / →"><span>Kenne ich</span> →</button>
        </div>
        <div class="flash-hints"><b>A / ←</b> nicht gewusst · <b>W / ↑ / Space</b> drehen · <b>S / ↓</b> zurück · <b>D / →</b> gewusst</div>
      </div>`;

    $('#flashBack').addEventListener('click', renderWortschatzHome);
    $('#editCurrentDeck').addEventListener('click', () => renderDeckEditor(deckId));
    $('#openLearnMode').addEventListener('click', () => renderLearnSetup(deckId));
    $('#flashFullscreen').addEventListener('click', () => $('#flashShell').requestFullscreen?.());
    $('#flashCardScene').addEventListener('click', toggleFlashCard);
    $('#unknownBtn').addEventListener('click', () => rateFlashCard(false));
    $('#knownBtn').addEventListener('click', () => rateFlashCard(true));

    setKeyHandler(event => {
      if (!flashState) return;
      const tag = event.target?.tagName?.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 's', 'S', 'a', 'A', 'd', 'D'].includes(event.key)) event.preventDefault();
      if (event.key === ' ' || event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') setFlashSide(true);
      else if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') setFlashSide(false);
      else if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') rateFlashCard(false);
      else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') rateFlashCard(true);
    });

    updateFlashCard();
  }

  function setFlashSide(back) {
    if (!flashState) return;
    flashState.flipped = back;
    $('#flashCard')?.classList.toggle('is-flipped', back);
  }

  function toggleFlashCard() {
    setFlashSide(!flashState.flipped);
  }

  function updateFlashCard() {
    if (!flashState) return;
    const card = flashState.cards[flashState.index];
    if (!card) return renderFlashSummary();
    $('#flashFront').textContent = card.de;
    $('#flashBackText').textContent = card.ru;
    $('#flashProgress').textContent = `${flashState.index + 1} / ${flashState.cards.length}`;
    $('#flashScore').textContent = `${flashState.known.length} ✓ · ${flashState.unknown.length} ×`;
    $('#flashProgressBar').style.width = `${(flashState.index / flashState.cards.length) * 100}%`;
    setFlashSide(false);
  }

  function rateFlashCard(known) {
    if (!flashState || flashState.locked || !flashState.cards[flashState.index]) return;
    flashState.locked = true;
    const scene = $('#flashCardScene');
    const card = flashState.cards[flashState.index];
    (known ? flashState.known : flashState.unknown).push(card.id);
    scene.classList.remove('card-exit-left', 'card-exit-right');
    scene.classList.add(known ? 'card-exit-right' : 'card-exit-left');
    setTimeout(() => {
      flashState.index += 1;
      flashState.locked = false;
      scene.classList.remove('card-exit-left', 'card-exit-right');
      if (flashState.index >= flashState.cards.length) renderFlashSummary();
      else updateFlashCard();
    }, 180);
  }

  function renderFlashSummary() {
    const state = flashState;
    if (!state) return;
    setKeyHandler(null);
    const deck = getDeck(state.deckId);
    $('#workspace').innerHTML = `
      <div class="study-summary">
        <div class="summary-ring"><strong>${state.known.length}</strong><span>von ${state.cards.length}</span></div>
        <span class="eyebrow">RUNDE ABGESCHLOSSEN</span>
        <h2>${state.unknown.length ? 'Noch einmal festigen' : 'Alles gewusst 🎉'}</h2>
        <p>${state.known.length} gewusst · ${state.unknown.length} noch nicht gewusst</p>
        <div class="summary-actions">
          <button class="secondary" id="summaryBack" type="button">Zurück zu Wortlisten</button>
          <button class="secondary" id="repeatAll" type="button">Alle Karten wiederholen</button>
          <button class="primary" id="repeatUnknown" type="button" ${state.unknown.length ? '' : 'disabled'}>Nur unbekannte wiederholen</button>
        </div>
      </div>`;
    $('#summaryBack').addEventListener('click', renderWortschatzHome);
    $('#repeatAll').addEventListener('click', () => renderFlashcards(deck.id));
    $('#repeatUnknown').addEventListener('click', () => renderFlashcards(deck.id, state.unknown));
  }

  function renderLearnSetup(deckId) {
    cleanupCustomRuntime();
    data.customView = 'wortschatz';
    saveData();
    const deck = getDeck(deckId);
    if (!deck) return renderWortschatzHome();
    activateCustomNav(wordsButton, 'EPD · WORTSCHATZ', `${deck.title} · Zaubianie`);

    $('#workspace').innerHTML = `
      <div class="learn-setup-card">
        <button class="secondary" id="learnSetupBack" type="button">← Karten</button>
        <span class="eyebrow">ZAUBIANIE · ЗАУЧИВАНИЕ</span>
        <h2>Lernen in 7er-Blöcken</h2>
        <p>Zuerst Auswahlfragen, danach dieselben Wörter schriftlich. Falsche Schreibantworten kommen erneut, bis sie sitzen.</p>
        <div class="direction-picker">
          <button class="direction-option active" data-direction="de-ru" type="button"><b>Deutsch</b><span>→</span><b>Русский</b></button>
          <button class="direction-option" data-direction="ru-de" type="button"><b>Русский</b><span>→</span><b>Deutsch</b></button>
        </div>
        <button class="primary learn-start" id="startLearn" type="button">Zaubianie starten</button>
      </div>`;

    let direction = 'de-ru';
    $$('.direction-option').forEach(button => button.addEventListener('click', () => {
      direction = button.dataset.direction;
      $$('.direction-option').forEach(item => item.classList.toggle('active', item === button));
    }));
    $('#learnSetupBack').addEventListener('click', () => renderFlashcards(deckId));
    $('#startLearn').addEventListener('click', () => startLearn(deckId, direction));
  }

  function startLearn(deckId, direction) {
    const deck = getDeck(deckId);
    if (!deck || !deck.cards.length) return renderWortschatzHome();
    learnState = {
      deckId,
      direction,
      allCards: shuffle(deck.cards),
      blockStart: 0,
      block: [],
      phase: 'mc',
      mcIndex: 0,
      typingQueue: [],
      completed: 0,
      mcMistakes: 0,
      typingMistakes: 0,
    };
    beginLearnBlock();
  }

  function beginLearnBlock() {
    const state = learnState;
    state.block = state.allCards.slice(state.blockStart, state.blockStart + 7);
    if (!state.block.length) return renderLearnSummary();
    state.phase = 'mc';
    state.mcIndex = 0;
    state.typingQueue = [];
    renderLearnQuestion();
  }

  function learnSides(card) {
    return learnState.direction === 'de-ru'
      ? { prompt: card.de, answer: card.ru, promptLabel: 'DEUTSCH', answerLabel: 'РУССКИЙ' }
      : { prompt: card.ru, answer: card.de, promptLabel: 'РУССКИЙ', answerLabel: 'DEUTSCH' };
  }

  function renderLearnQuestion() {
    const state = learnState;
    const deck = getDeck(state.deckId);
    const workspace = $('#workspace');
    const total = state.allCards.length;
    const blockNumber = Math.floor(state.blockStart / 7) + 1;
    const blockTotal = Math.ceil(total / 7);

    if (state.phase === 'mc') {
      const card = state.block[state.mcIndex];
      if (!card) {
        state.phase = 'typing';
        state.typingQueue = state.block.map(item => item.id);
        return renderLearnQuestion();
      }
      const sides = learnSides(card);
      const targetSide = state.direction === 'de-ru' ? 'ru' : 'de';
      const distractors = shuffle(deck.cards.filter(item => item.id !== card.id))
        .map(item => item[targetSide])
        .filter((value, index, array) => value && array.indexOf(value) === index)
        .slice(0, 3);
      const options = shuffle([sides.answer, ...distractors]);

      workspace.innerHTML = `
        <div class="learn-shell">
          ${learnProgressHeader(blockNumber, blockTotal, state.completed, total, 'Auswahl')}
          <section class="learn-question-card">
            <span class="learn-question-label">${sides.promptLabel}</span>
            <h2>${escapeHtml(sides.prompt)}</h2>
            <p>Wähle die passende Übersetzung.</p>
            <div class="learn-options">
              ${options.map((option, index) => `<button class="learn-option" data-option="${escapeHtml(option)}" type="button"><span>${index + 1}</span>${escapeHtml(option)}</button>`).join('')}
            </div>
            <div class="learn-feedback" id="learnFeedback"></div>
          </section>
        </div>`;
      wireLearnHeader();
      $$('.learn-option').forEach(button => button.addEventListener('click', () => {
        if ($('.learn-options').classList.contains('answered')) return;
        $('.learn-options').classList.add('answered');
        const chosen = button.dataset.option;
        const correct = normalizeAnswer(chosen) === normalizeAnswer(sides.answer);
        if (!correct) state.mcMistakes += 1;
        $$('.learn-option').forEach(item => {
          if (normalizeAnswer(item.dataset.option) === normalizeAnswer(sides.answer)) item.classList.add('correct');
        });
        button.classList.add(correct ? 'correct' : 'wrong');
        $('#learnFeedback').textContent = correct ? 'Richtig ✓' : `Richtig: ${sides.answer}`;
        setTimeout(() => {
          state.mcIndex += 1;
          renderLearnQuestion();
        }, correct ? 450 : 850);
      }));
      return;
    }

    const cardId = state.typingQueue[0];
    const card = deck.cards.find(item => item.id === cardId);
    if (!card) {
      state.typingQueue.shift();
      return renderLearnQuestion();
    }
    const sides = learnSides(card);
    workspace.innerHTML = `
      <div class="learn-shell">
        ${learnProgressHeader(blockNumber, blockTotal, state.completed, total, 'Schreiben')}
        <section class="learn-question-card typing-question">
          <span class="learn-question-label">${sides.promptLabel}</span>
          <h2>${escapeHtml(sides.prompt)}</h2>
          <p>Schreibe die Übersetzung auf ${sides.answerLabel === 'DEUTSCH' ? 'Deutsch' : 'Russisch'}.</p>
          <form id="typingForm" class="typing-form">
            <input id="typingAnswer" autocomplete="off" spellcheck="false" placeholder="Antwort eingeben …" />
            <button class="primary" type="submit">Prüfen</button>
          </form>
          <div class="learn-feedback" id="learnFeedback"></div>
        </section>
      </div>`;
    wireLearnHeader();
    $('#typingAnswer').focus();
    $('#typingForm').addEventListener('submit', event => {
      event.preventDefault();
      const input = $('#typingAnswer');
      if (!input.value.trim()) return;
      const correct = normalizeAnswer(input.value) === normalizeAnswer(sides.answer);
      if (correct) {
        $('#learnFeedback').textContent = 'Richtig ✓';
        $('#learnFeedback').className = 'learn-feedback success';
        state.typingQueue.shift();
        state.completed += 1;
      } else {
        $('#learnFeedback').textContent = `Noch einmal. Richtig: ${sides.answer}`;
        $('#learnFeedback').className = 'learn-feedback error';
        state.typingMistakes += 1;
        state.typingQueue.shift();
        state.typingQueue.push(card.id);
      }
      input.disabled = true;
      setTimeout(() => {
        if (!state.typingQueue.length) {
          state.blockStart += state.block.length;
          beginLearnBlock();
        } else {
          renderLearnQuestion();
        }
      }, correct ? 450 : 900);
    });
  }

  function learnProgressHeader(blockNumber, blockTotal, completed, total, phase) {
    return `
      <div class="learn-topbar">
        <button class="secondary" id="quitLearn" type="button">× Beenden</button>
        <div><b>Block ${blockNumber}/${blockTotal}</b><span>${phase} · ${completed}/${total} abgeschlossen</span></div>
        <div class="learn-progress-mini"><i style="width:${total ? (completed / total) * 100 : 0}%"></i></div>
      </div>`;
  }

  function wireLearnHeader() {
    $('#quitLearn')?.addEventListener('click', () => renderFlashcards(learnState.deckId));
  }

  function renderLearnSummary() {
    const state = learnState;
    const deck = getDeck(state.deckId);
    $('#workspace').innerHTML = `
      <div class="study-summary">
        <div class="summary-ring"><strong>${state.allCards.length}</strong><span>gelernt</span></div>
        <span class="eyebrow">ZAUBIANIE FERTIG</span>
        <h2>${escapeHtml(deck.title)}</h2>
        <p>${state.mcMistakes} Auswahlfehler · ${state.typingMistakes} Schreibfehler</p>
        <div class="summary-actions">
          <button class="secondary" id="learnToCards" type="button">Zu den Karten</button>
          <button class="primary" id="learnAgain" type="button">Noch einmal lernen</button>
        </div>
      </div>`;
    $('#learnToCards').addEventListener('click', () => renderFlashcards(deck.id));
    $('#learnAgain').addEventListener('click', () => renderLearnSetup(deck.id));
  }

  function openFileDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(FILE_STORE)) request.result.createObjectStore(FILE_STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function putLocalFile(id, file) {
    const db = await openFileDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readwrite');
      tx.objectStore(FILE_STORE).put({ id, blob: file, name: file.name, type: file.type, size: file.size, updatedAt: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function getLocalFile(id) {
    const db = await openFileDb();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readonly');
      const request = tx.objectStore(FILE_STORE).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  }

  async function deleteLocalFile(id) {
    const db = await openFileDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readwrite');
      tx.objectStore(FILE_STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  function grammarMeta(fileId) {
    return data.grammar.files.find(file => file.id === fileId) || null;
  }

  async function renderGrammarHome() {
    cleanupCustomRuntime();
    data.customView = 'grammar';
    data.grammar.selectedFileId = null;
    saveData();
    activateCustomNav(grammarButton, 'EPD · GRAMMATIK', 'Grammatik');

    const workspace = $('#workspace');
    workspace.innerHTML = `
      <div class="grammar-home">
        <section class="study-hero grammar-hero">
          <div>
            <span class="eyebrow">DATEIEN + EIGENE NOTIZEN</span>
            <h2>Grammatik-Arbeitsplatz</h2>
            <p>Öffne Dateien direkt im Heft, zoome sie oder arbeite im Split-Screen mit einer eigenen Notizseite pro Datei.</p>
          </div>
          <label class="primary grammar-upload-label">+ Datei hinzufügen<input id="grammarAddInput" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" hidden /></label>
        </section>
        <section class="grammar-file-grid" id="grammarFileGrid">
          ${data.grammar.files.map(file => renderGrammarTile(file)).join('')}
        </section>
        <div class="local-only-note"><b>Privat & lokal:</b> Dateien werden nicht hochgeladen. Sie bleiben in diesem Browser (IndexedDB).</div>
      </div>`;

    $('#grammarAddInput').addEventListener('change', event => addGrammarFile(event.target.files?.[0]));
    await refreshGrammarAvailability();
    wireGrammarTiles();
  }

  function renderGrammarTile(file) {
    return `
      <article class="grammar-file-tile" data-grammar-tile="${file.id}">
        <div class="grammar-file-cover ${file.seeded ? 'grammar-cover-green' : ''}">
          <span>${file.mime?.startsWith('image/') ? 'IMG' : 'PDF'}</span>
          ${file.seeded ? '<b>B2–C1</b><strong>Grammatik<br>aktiv</strong>' : `<strong>${escapeHtml(file.title.slice(0, 24))}</strong>`}
        </div>
        <div class="grammar-file-info">
          <span class="file-local-status" data-file-status="${file.id}">Prüfe lokalen Speicher …</span>
          <h3>${escapeHtml(file.title)}</h3>
          <p>${file.pages ? `${file.pages} Seiten · ` : ''}${file.notebook?.trim() ? 'Notizen vorhanden' : 'Eigene Notizseite'}</p>
          <div class="grammar-tile-actions">
            <button class="primary compact" data-open-grammar="${file.id}" type="button">Öffnen</button>
            <label class="secondary compact local-file-label" data-attach-label="${file.id}"><span data-attach-text="${file.id}">Datei auswählen</span><input type="file" data-attach-grammar="${file.id}" accept="application/pdf,image/png,image/jpeg,image/webp" hidden /></label>
            ${file.seeded ? '' : `<button class="ghost compact danger-text" data-delete-grammar="${file.id}" type="button">Löschen</button>`}
          </div>
        </div>
      </article>`;
  }

  async function refreshGrammarAvailability() {
    const results = await Promise.all(data.grammar.files.map(async file => ({ id: file.id, record: await getLocalFile(file.id).catch(() => null) })));
    results.forEach(({ id, record }) => {
      const status = $(`[data-file-status="${id}"]`);
      const open = $(`[data-open-grammar="${id}"]`);
      const attach = $(`[data-attach-label="${id}"]`);
      const attachText = $(`[data-attach-text="${id}"]`);
      if (!status) return;
      if (record) {
        status.textContent = `Lokal gespeichert · ${Math.round(record.size / 1024 / 1024)} MB`;
        status.classList.add('available');
        if (open) open.disabled = false;
        if (attachText) attachText.textContent = 'Datei ersetzen';
      } else {
        status.textContent = 'Einmal lokal auswählen';
        if (open) {
          open.disabled = true;
          open.title = 'Wähle die Datei einmal aus. Danach bleibt sie lokal gespeichert.';
        }
      }
    });
  }

  function wireGrammarTiles() {
    $$('[data-open-grammar]').forEach(button => button.addEventListener('click', () => renderGrammarFile(button.dataset.openGrammar)));
    $$('[data-attach-grammar]').forEach(input => input.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      await attachGrammarFile(input.dataset.attachGrammar, file);
    }));
    $$('[data-delete-grammar]').forEach(button => button.addEventListener('click', async () => {
      const fileId = button.dataset.deleteGrammar;
      const meta = grammarMeta(fileId);
      if (!meta || !window.confirm(`„${meta.title}“ samt lokaler Datei löschen?`)) return;
      await deleteLocalFile(fileId).catch(() => null);
      data.grammar.files = data.grammar.files.filter(file => file.id !== fileId);
      saveData();
      renderGrammarHome();
    }));
  }

  async function addGrammarFile(file) {
    if (!file) return;
    const id = uid();
    const title = file.name.replace(/\.[^.]+$/, '');
    const meta = {
      id,
      title,
      fileName: file.name,
      mime: file.type || 'application/octet-stream',
      pages: null,
      notebook: '',
      splitRatio: 56,
      viewMode: 'split',
      zoom: 'page-width',
      page: 1,
      seeded: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await putLocalFile(id, file);
    data.grammar.files.push(meta);
    saveData();
    renderGrammarFile(id);
  }

  async function attachGrammarFile(fileId, file) {
    const meta = grammarMeta(fileId);
    if (!meta || !file) return;
    await putLocalFile(fileId, file);
    meta.fileName = file.name;
    meta.mime = file.type || meta.mime;
    meta.updatedAt = Date.now();
    saveData();
    renderGrammarFile(fileId);
  }

  async function renderGrammarFile(fileId, requestedMode = null) {
    cleanupCustomRuntime();
    data.customView = 'grammar';
    data.grammar.selectedFileId = fileId;
    const meta = grammarMeta(fileId);
    if (!meta) return renderGrammarHome();
    const record = await getLocalFile(fileId).catch(() => null);
    if (!record) return renderGrammarHome();
    if (requestedMode) meta.viewMode = requestedMode;
    saveData();
    activateCustomNav(grammarButton, 'EPD · GRAMMATIK', meta.title);

    activeObjectUrl = URL.createObjectURL(record.blob);
    const mode = meta.viewMode || 'split';
    const workspace = $('#workspace');
    workspace.innerHTML = `
      <div class="grammar-reader-shell" data-mode="${mode}">
        <div class="grammar-reader-top">
          <button class="secondary" id="grammarBack" type="button">← Dateien</button>
          <div class="grammar-mode-tabs">
            <button class="mode-tab ${mode === 'notes' ? 'active' : ''}" data-grammar-mode="notes" type="button">Tетрадь · Notizen</button>
            <button class="mode-tab ${mode === 'pdf' ? 'active' : ''}" data-grammar-mode="pdf" type="button">Datei</button>
            <button class="mode-tab ${mode === 'split' ? 'active' : ''}" data-grammar-mode="split" type="button">Split View</button>
          </div>
          <span class="grammar-file-name">${escapeHtml(meta.fileName || meta.title)}</span>
        </div>
        <div class="grammar-reader-grid ${mode}" id="grammarReaderGrid" style="--split:${Math.max(25, Math.min(75, meta.splitRatio || 56))}%">
          <section class="grammar-pdf-pane" id="grammarPdfPane">
            ${renderDocumentViewer(meta, record)}
          </section>
          <div class="split-resizer" id="splitResizer" title="Ziehen, um die Breite zu ändern"></div>
          <section class="grammar-notes-pane">
            <div class="grammar-notes-head"><span class="tool-label">NOTIZEN ZU DIESER DATEI</span><span id="grammarNoteState">Gespeichert</span></div>
            <div class="lined-wrap grammar-notebook-wrap"><textarea id="grammarNotebook" class="lined-textarea grammar-notebook" spellcheck="true" lang="de" placeholder="Regeln, Beispiele, eigene Erklärungen …"></textarea></div>
          </section>
        </div>
      </div>`;

    $('#grammarNotebook').value = meta.notebook || '';
    let noteSaveTimer = null;
    $('#grammarNotebook').addEventListener('input', event => {
      meta.notebook = event.target.value;
      meta.updatedAt = Date.now();
      $('#grammarNoteState').textContent = 'Speichert …';
      clearTimeout(noteSaveTimer);
      noteSaveTimer = setTimeout(() => {
        saveData();
        $('#grammarNoteState').textContent = 'Gespeichert';
      }, 250);
    });

    $('#grammarBack').addEventListener('click', renderGrammarHome);
    $$('[data-grammar-mode]').forEach(button => button.addEventListener('click', () => {
      meta.viewMode = button.dataset.grammarMode;
      saveData();
      renderGrammarFile(fileId, meta.viewMode);
    }));
    wireDocumentViewer(meta, record);
    wireSplitResizer(meta);
  }

  function renderDocumentViewer(meta, record) {
    if (record.type?.startsWith('image/')) {
      return `
        <div class="doc-toolbar">
          <span class="doc-toolbar-title">Bild</span>
          <div class="doc-controls">
            <button class="secondary compact" data-image-zoom="-" type="button">−</button>
            <span id="imageZoomLabel">100%</span>
            <button class="secondary compact" data-image-zoom="+" type="button">+</button>
            <button class="secondary compact" id="docFullscreen" type="button">⛶</button>
          </div>
        </div>
        <div class="image-viewer"><img id="grammarImage" src="${activeObjectUrl}" alt="${escapeHtml(meta.title)}" /></div>`;
    }
    const page = Math.max(1, Number(meta.page) || 1);
    const zoom = meta.zoom || 'page-width';
    return `
      <div class="doc-toolbar">
        <div class="doc-page-controls">
          <button class="secondary compact" id="prevPdfPage" type="button">←</button>
          <label>Seite <input id="pdfPageInput" type="number" min="1" ${meta.pages ? `max="${meta.pages}"` : ''} value="${page}" />${meta.pages ? ` / ${meta.pages}` : ''}</label>
          <button class="secondary compact" id="nextPdfPage" type="button">→</button>
        </div>
        <div class="doc-controls">
          <button class="secondary compact" id="pdfZoomOut" type="button">−</button>
          <span id="pdfZoomLabel">${typeof zoom === 'number' ? `${zoom}%` : zoom === 'page-fit' ? 'Seite' : 'Breite'}</span>
          <button class="secondary compact" id="pdfZoomIn" type="button">+</button>
          <button class="secondary compact" id="pdfFitWidth" type="button">Breite</button>
          <button class="secondary compact" id="pdfFitPage" type="button">Seite</button>
          <button class="secondary compact" id="docFullscreen" type="button">⛶</button>
        </div>
      </div>
      <iframe class="pdf-frame" id="grammarPdfFrame" title="${escapeHtml(meta.title)}"></iframe>`;
  }

  function wireDocumentViewer(meta, record) {
    $('#docFullscreen')?.addEventListener('click', () => $('#grammarPdfPane').requestFullscreen?.());
    if (record.type?.startsWith('image/')) {
      let zoom = typeof meta.zoom === 'number' ? meta.zoom : 100;
      const image = $('#grammarImage');
      function updateImageZoom() {
        image.style.width = `${zoom}%`;
        $('#imageZoomLabel').textContent = `${zoom}%`;
        meta.zoom = zoom;
        saveData();
      }
      $$('[data-image-zoom]').forEach(button => button.addEventListener('click', () => {
        zoom = Math.max(25, Math.min(300, zoom + (button.dataset.imageZoom === '+' ? 10 : -10)));
        updateImageZoom();
      }));
      updateImageZoom();
      return;
    }

    const frame = $('#grammarPdfFrame');
    function updatePdfFrame() {
      const page = Math.max(1, Math.min(meta.pages || 99999, Number(meta.page) || 1));
      meta.page = page;
      const zoom = meta.zoom || 'page-width';
      const zoomFragment = typeof zoom === 'number' ? zoom : zoom;
      frame.src = `${activeObjectUrl}#page=${page}&zoom=${zoomFragment}&toolbar=1&navpanes=0`;
      const input = $('#pdfPageInput');
      if (input) input.value = String(page);
      const label = $('#pdfZoomLabel');
      if (label) label.textContent = typeof zoom === 'number' ? `${zoom}%` : zoom === 'page-fit' ? 'Seite' : 'Breite';
      saveData();
    }
    $('#prevPdfPage')?.addEventListener('click', () => { meta.page = Math.max(1, (Number(meta.page) || 1) - 1); updatePdfFrame(); });
    $('#nextPdfPage')?.addEventListener('click', () => { meta.page = Math.min(meta.pages || 99999, (Number(meta.page) || 1) + 1); updatePdfFrame(); });
    $('#pdfPageInput')?.addEventListener('change', event => { meta.page = Number(event.target.value) || 1; updatePdfFrame(); });
    $('#pdfZoomOut')?.addEventListener('click', () => { meta.zoom = Math.max(40, (typeof meta.zoom === 'number' ? meta.zoom : 100) - 10); updatePdfFrame(); });
    $('#pdfZoomIn')?.addEventListener('click', () => { meta.zoom = Math.min(250, (typeof meta.zoom === 'number' ? meta.zoom : 100) + 10); updatePdfFrame(); });
    $('#pdfFitWidth')?.addEventListener('click', () => { meta.zoom = 'page-width'; updatePdfFrame(); });
    $('#pdfFitPage')?.addEventListener('click', () => { meta.zoom = 'page-fit'; updatePdfFrame(); });
    updatePdfFrame();
  }

  function wireSplitResizer(meta) {
    const resizer = $('#splitResizer');
    const grid = $('#grammarReaderGrid');
    if (!resizer || !grid) return;
    let dragging = false;
    const onMove = event => {
      if (!dragging) return;
      const rect = grid.getBoundingClientRect();
      const x = Math.max(25, Math.min(75, ((event.clientX - rect.left) / rect.width) * 100));
      meta.splitRatio = Math.round(x);
      grid.style.setProperty('--split', `${meta.splitRatio}%`);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('resizing-split');
      saveData();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    resizer.addEventListener('pointerdown', event => {
      dragging = true;
      event.preventDefault();
      document.body.classList.add('resizing-split');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  function injectAdvancedStyles() {
    if ($('#epd14AdvancedStyles')) return;
    const style = document.createElement('style');
    style.id = 'epd14AdvancedStyles';
    style.textContent = `
      .study-home,.deck-editor-shell,.flash-shell,.learn-shell,.grammar-home,.grammar-reader-shell{display:grid;gap:22px}
      .study-hero{display:flex;align-items:center;justify-content:space-between;gap:24px;background:linear-gradient(135deg,#fff,#f5f7ff);border:1px solid var(--line);border-radius:22px;padding:28px;box-shadow:var(--shadow)}
      .study-hero h2{font-size:28px;margin:8px 0}.study-hero p{margin:0;color:var(--muted);max-width:760px;line-height:1.55}.grammar-hero{background:linear-gradient(135deg,#fff,#f7fff8)}
      .deck-grid,.grammar-file-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}.deck-tile{background:#fff;border:1px solid var(--line);border-radius:18px;padding:19px;box-shadow:var(--shadow);cursor:pointer;transition:.16s ease;min-height:210px}.deck-tile:hover{transform:translateY(-2px);border-color:#b9c5ff}.deck-tile-top{display:flex;justify-content:space-between;gap:12px}.deck-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#eef2ff;color:var(--blue);font-size:21px}.deck-tile-actions{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.icon-text{border:0;background:transparent;color:#68748a;padding:5px 7px;font-size:11px}.danger-text{color:#a85656!important}.deck-tile h3{font-size:19px;margin:18px 0 4px}.deck-tile>p{margin:0;color:var(--muted);font-size:13px}.deck-preview{display:flex;gap:6px;flex-wrap:wrap;margin-top:16px}.deck-preview span{background:#f6f8fc;border:1px solid var(--line-soft);border-radius:8px;padding:5px 7px;font-size:11px;color:#58647a}.deck-tile footer{font-size:10px;color:#9aa4b5;margin-top:16px}.study-empty{grid-column:1/-1;text-align:center;background:#fff;border:1px dashed #cdd5e5;border-radius:18px;padding:56px 24px;color:var(--muted)}.study-empty h3{color:var(--ink)}.study-empty-icon{font-size:42px}
      .editor-toolbar,.study-mode-top,.grammar-reader-top{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}.editor-toolbar-actions,.study-mode-actions{display:flex;gap:8px;flex-wrap:wrap}.deck-editor-card,.bulk-import-card,.term-row{background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow)}.deck-editor-card{padding:22px}.editor-label{font-size:10px;font-weight:850;color:var(--muted);letter-spacing:.13em}.deck-title-input,.deck-description-input{width:100%;border:0;background:#f5f7fb;border-radius:12px;outline:0;color:var(--ink)}.deck-title-input{font-size:22px;font-weight:800;padding:15px;margin-top:8px}.deck-description-input{padding:12px 15px;margin-top:10px;resize:vertical}.input-error{box-shadow:0 0 0 2px #df5d5d!important}.bulk-import-card{padding:20px;display:grid;gap:14px}.bulk-import-card[hidden]{display:none}.bulk-import-card h3{margin:5px 0}.bulk-import-card p{margin:0;color:var(--muted);font-size:13px}.bulk-import-card textarea{width:100%;border:1px solid var(--line);border-radius:12px;padding:13px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;outline:0}.bulk-import-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;color:var(--green);font-size:12px}.term-editor-list{display:grid;gap:12px}.term-row{display:grid;grid-template-columns:44px minmax(0,1fr) 38px;align-items:center;overflow:hidden}.term-row-number{display:grid;place-items:center;color:#8490a5;font-weight:800}.term-fields{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:18px 8px}.term-fields>div{display:grid}.term-input{border:0;border-bottom:2px solid #d8deeb;padding:10px 4px;outline:0;font-size:16px}.term-input:focus{border-bottom-color:var(--blue)}.term-fields span{font-size:9px;color:#8d98ab;font-weight:800;letter-spacing:.12em;margin-top:6px}.term-delete{border:0;background:transparent;color:#8792a4;font-size:22px;padding:8px}.add-term-row{justify-self:start}
      .study-mode-tabs,.grammar-mode-tabs{display:flex;background:#eef1f7;border-radius:12px;padding:4px;gap:2px}.mode-tab{border:0;background:transparent;color:#647087;padding:8px 12px}.mode-tab.active{background:#fff;color:var(--blue-dark);box-shadow:0 2px 8px rgba(20,35,75,.08)}.flash-progress-row{display:grid;grid-template-columns:auto minmax(120px,1fr) auto;align-items:center;gap:14px;color:#667187;font-size:12px}.flash-progress-track{height:7px;background:#e6eaf2;border-radius:99px;overflow:hidden}.flash-progress-track i{display:block;height:100%;background:var(--blue);border-radius:99px;transition:.2s}.flash-stage{display:grid;grid-template-columns:140px minmax(0,1fr) 140px;gap:18px;align-items:center}.flash-card-scene{perspective:1400px;min-height:470px;transition:.18s ease;outline:0}.flash-card{position:relative;width:100%;height:470px;transform-style:preserve-3d;transition:transform .36s cubic-bezier(.2,.75,.25,1);cursor:pointer}.flash-card.is-flipped{transform:rotateX(180deg)}.flash-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:22px;background:#fff;border:1px solid var(--line);box-shadow:0 24px 65px rgba(19,37,83,.12);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:42px;text-align:center}.flash-back{transform:rotateX(180deg);background:#fbfcff}.flash-face strong{font-size:clamp(30px,4vw,48px);font-weight:560;line-height:1.18}.flash-side-label{position:absolute;top:22px;left:24px;color:#8b96a9;font-size:10px;font-weight:850;letter-spacing:.13em}.flash-face small{position:absolute;bottom:22px;color:#9aa4b4}.swipe-action{min-height:110px;border-radius:18px;background:#fff;border:1px solid var(--line);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#6d788c}.swipe-action span{font-size:11px}.swipe-left:hover{border-color:#e6a9a9;color:#b94c4c}.swipe-right:hover{border-color:#8fd3b3;color:#17774f}.card-exit-left{transform:translateX(-35px) rotate(-2deg);opacity:0}.card-exit-right{transform:translateX(35px) rotate(2deg);opacity:0}.flash-hints{text-align:center;color:#8a95a6;font-size:12px}.flash-hints b{color:#56627a}.flash-shell:fullscreen{background:var(--bg);padding:28px;overflow:auto}.flash-shell:fullscreen .flash-card-scene,.flash-shell:fullscreen .flash-card{height:min(68vh,650px)}
      .study-summary,.learn-setup-card{max-width:760px;margin:5vh auto;background:#fff;border:1px solid var(--line);border-radius:24px;box-shadow:var(--shadow);padding:42px;text-align:center}.summary-ring{width:130px;height:130px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 22px;background:#eef2ff;color:var(--blue-dark)}.summary-ring strong{font-size:42px}.summary-ring span{font-size:12px}.study-summary h2,.learn-setup-card h2{font-size:30px;margin:10px 0}.study-summary p,.learn-setup-card p{color:var(--muted);line-height:1.55}.summary-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:26px}.direction-picker{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:26px 0}.direction-option{display:flex;align-items:center;justify-content:center;gap:12px;border:1px solid var(--line);background:#fff;padding:18px}.direction-option.active{border-color:var(--blue);background:#f4f6ff;color:var(--blue-dark)}.learn-start{min-width:220px}
      .learn-topbar{display:grid;grid-template-columns:auto minmax(0,1fr) 220px;align-items:center;gap:18px}.learn-topbar>div:nth-child(2){display:grid}.learn-topbar span{color:var(--muted);font-size:11px;margin-top:3px}.learn-progress-mini{height:7px;background:#e5e9f2;border-radius:99px;overflow:hidden}.learn-progress-mini i{display:block;height:100%;background:var(--blue)}.learn-question-card{max-width:950px;margin:3vh auto;background:#fff;border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow);padding:38px}.learn-question-label{font-size:11px;font-weight:850;letter-spacing:.12em;color:#6f7b91}.learn-question-card h2{font-size:34px;margin:42px 0 72px}.learn-question-card>p{color:var(--muted)}.learn-options{display:grid;grid-template-columns:1fr 1fr;gap:14px}.learn-option{display:flex;align-items:center;gap:14px;text-align:left;background:#fff;border:1px solid #dce2ee;padding:18px;font-size:16px}.learn-option>span{width:28px;height:28px;border-radius:50%;background:#eef1f7;display:grid;place-items:center;font-size:12px}.learn-option.correct{border-color:#61b78e;background:#eefaf4}.learn-option.wrong{border-color:#df8c8c;background:#fff2f2}.learn-feedback{min-height:24px;margin-top:18px;font-weight:750;color:#4e5b72}.learn-feedback.success{color:#17774f}.learn-feedback.error{color:#b94c4c}.typing-form{display:grid;grid-template-columns:1fr auto;gap:10px}.typing-form input{border:2px solid #dce2ee;border-radius:12px;padding:14px 16px;font-size:18px;outline:0}.typing-form input:focus{border-color:var(--blue)}
      .grammar-upload-label{display:inline-flex;align-items:center;justify-content:center;cursor:pointer;border-radius:10px;padding:10px 14px;font-weight:700}.grammar-file-tile{display:grid;grid-template-columns:118px 1fr;gap:18px;background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:var(--shadow);min-height:185px}.grammar-file-cover{border-radius:13px;background:linear-gradient(150deg,#304b91,#17264d);color:#fff;padding:14px;display:flex;flex-direction:column;min-height:150px}.grammar-cover-green{background:linear-gradient(155deg,#8dda16 0 58%,#078c70 58% 72%,#7b1578 72%)}.grammar-file-cover span{font-size:9px;letter-spacing:.13em;font-weight:800}.grammar-file-cover b{margin-top:auto;font-size:20px}.grammar-file-cover strong{font-size:17px;line-height:1.05;margin-top:6px}.grammar-file-info{min-width:0}.file-local-status{font-size:10px;color:#a37143;font-weight:750}.file-local-status.available{color:#17774f}.grammar-file-info h3{font-size:18px;margin:9px 0 5px}.grammar-file-info>p{font-size:12px;color:var(--muted);margin:0}.grammar-tile-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:17px}.local-file-label{display:inline-flex!important;align-items:center;justify-content:center;cursor:pointer}.local-only-note{background:#f7f9fd;border:1px solid var(--line);border-radius:13px;padding:13px;color:#667187;font-size:12px}
      .grammar-reader-top{background:#fff;border:1px solid var(--line);border-radius:16px;padding:10px 12px;position:sticky;top:126px;z-index:13;box-shadow:0 8px 24px rgba(20,35,75,.06)}.grammar-file-name{font-size:11px;color:var(--muted);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.grammar-reader-grid{display:grid;grid-template-columns:var(--split) 8px calc(100% - var(--split) - 8px);min-height:calc(100vh - 235px);border:1px solid var(--line);border-radius:18px;overflow:hidden;background:#fff}.grammar-reader-grid.notes{grid-template-columns:0 0 1fr}.grammar-reader-grid.pdf{grid-template-columns:1fr 0 0}.grammar-reader-grid.notes .grammar-pdf-pane,.grammar-reader-grid.notes .split-resizer,.grammar-reader-grid.pdf .grammar-notes-pane,.grammar-reader-grid.pdf .split-resizer{overflow:hidden;visibility:hidden}.grammar-pdf-pane,.grammar-notes-pane{min-width:0;background:#eef1f6}.grammar-notes-pane{background:#fff;display:grid;grid-template-rows:auto 1fr}.split-resizer{background:#dfe5f0;cursor:col-resize;position:relative}.split-resizer:hover{background:#b9c6df}.resizing-split{cursor:col-resize!important;user-select:none}.doc-toolbar{min-height:54px;padding:9px 10px;background:#fff;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.doc-page-controls,.doc-controls{display:flex;align-items:center;gap:6px}.doc-page-controls label{font-size:11px;color:var(--muted)}.doc-page-controls input{width:58px;border:1px solid var(--line);border-radius:8px;padding:6px 7px}.doc-controls>span{min-width:48px;text-align:center;font-size:11px;color:#667187}.pdf-frame{display:block;width:100%;height:calc(100vh - 300px);min-height:620px;border:0;background:#525659}.grammar-notes-head{height:54px;padding:9px 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.grammar-notes-head #grammarNoteState{font-size:10px;color:var(--green)}.grammar-notebook-wrap{height:100%}.grammar-notebook{min-height:calc(100vh - 300px);height:100%;resize:none}.image-viewer{height:calc(100vh - 300px);min-height:620px;overflow:auto;display:grid;place-items:start center;padding:22px}.image-viewer img{max-width:none;height:auto;box-shadow:0 8px 35px rgba(0,0,0,.15)}.grammar-pdf-pane:fullscreen{background:#eef1f6;padding:0}.grammar-pdf-pane:fullscreen .pdf-frame,.grammar-pdf-pane:fullscreen .image-viewer{height:calc(100vh - 54px);min-height:0}
      @media(max-width:1050px){.flash-stage{grid-template-columns:88px minmax(0,1fr) 88px}.swipe-action{min-height:90px;padding:8px}.learn-topbar{grid-template-columns:auto 1fr}.learn-progress-mini{grid-column:1/-1}.grammar-reader-grid{grid-template-columns:1fr!important;display:block}.grammar-reader-grid.split .grammar-pdf-pane,.grammar-reader-grid.split .grammar-notes-pane{min-height:620px}.split-resizer{display:none}.grammar-reader-top{top:100px}}
      @media(max-width:760px){.workspace{padding-left:14px!important;padding-right:14px!important}.study-hero{align-items:flex-start;flex-direction:column;padding:20px}.study-hero h2{font-size:24px}.deck-grid,.grammar-file-grid{grid-template-columns:1fr}.term-row{grid-template-columns:34px minmax(0,1fr) 34px}.term-fields{grid-template-columns:1fr;gap:10px;padding:14px 4px}.study-mode-top,.grammar-reader-top{align-items:stretch}.study-mode-tabs,.grammar-mode-tabs{overflow:auto}.flash-stage{grid-template-columns:1fr;gap:9px}.swipe-action{min-height:48px;flex-direction:row}.flash-card-scene,.flash-card{min-height:380px;height:380px}.flash-face{padding:28px}.flash-face strong{font-size:31px}.swipe-left{order:2}.flash-card-scene{order:1}.swipe-right{order:3}.flash-progress-row{grid-template-columns:auto 1fr}.flash-progress-row>span:last-child{grid-column:1/-1;text-align:right}.direction-picker,.learn-options{grid-template-columns:1fr}.learn-question-card{padding:22px}.learn-question-card h2{font-size:27px;margin:30px 0 44px}.typing-form{grid-template-columns:1fr}.grammar-file-tile{grid-template-columns:92px 1fr}.grammar-file-cover{min-height:130px;padding:10px}.grammar-reader-top{position:static}.grammar-reader-grid.split .grammar-pdf-pane,.grammar-reader-grid.split .grammar-notes-pane{min-height:520px}.pdf-frame,.image-viewer{min-height:500px;height:65vh}.grammar-notebook{min-height:520px}.doc-toolbar{align-items:flex-start}.doc-controls{flex-wrap:wrap}.study-summary,.learn-setup-card{padding:26px 18px}.summary-actions{display:grid}.summary-actions button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  const nav = $('#nav');
  const wordsButton = document.createElement('button');
  wordsButton.className = 'nav-item';
  wordsButton.type = 'button';
  wordsButton.dataset.epd14View = 'wortschatz';
  wordsButton.innerHTML = '<span>🗂️</span>Wortschatz';
  nav.appendChild(wordsButton);

  const grammarButton = document.createElement('button');
  grammarButton.className = 'nav-item';
  grammarButton.type = 'button';
  grammarButton.dataset.epd14View = 'grammar';
  grammarButton.innerHTML = '<span>📚</span>Grammatik';
  nav.appendChild(grammarButton);

  wordsButton.addEventListener('click', renderWortschatzHome);
  grammarButton.addEventListener('click', renderGrammarHome);

  $$('.nav-item[data-view]').forEach(button => {
    button.addEventListener('click', () => {
      cleanupCustomRuntime();
      data.customView = null;
      saveData();
      $('#newEntryBtn').style.display = '';
      $('#historyBtn').style.display = '';
      requestAnimationFrame(installPersistentTimer);
    });
  });

  const observer = new MutationObserver(() => {
    if (!data.customView) installPersistentTimer();
  });
  observer.observe($('#workspace'), { childList: true, subtree: true });

  window.addEventListener('beforeunload', () => {
    if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  });

  if (data.customView === 'wortschatz' || data.customView === 'woerter') {
    renderWortschatzHome();
  } else if (data.customView === 'grammar') {
    if (data.grammar.selectedFileId) renderGrammarFile(data.grammar.selectedFileId).catch(renderGrammarHome);
    else renderGrammarHome();
  } else {
    data.customView = null;
    saveData();
    installPersistentTimer();
  }
})();
