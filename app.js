(() => {
  const STORAGE_KEY = 'epd-heft-v1';
  const state = loadState();
  let currentView = state.ui?.view || 'schreiben';
  let currentId = state.ui?.currentId || null;
  let saveTimer = null;
  let timerInterval = null;
  let timerSeconds = 0;
  let timerRunning = false;
  let deleteTargetId = null;

  const config = {
    schreiben: {
      title: 'Schreiben', eyebrow: 'EPD · SCHREIBEN', timer: 80,
      tips: [
        'Mindestens 300 Wörter im echten EPD.',
        'Einleitung → Hauptteil → Fazit klar trennen.',
        'Nicht russisch denken und Wort für Wort übersetzen: zuerst den deutschen Satzbau planen.',
      ],
      structures: [
        'Einerseits …, andererseits …',
        'Zwar …, aber …',
        'Ein wesentlicher Vorteil besteht darin, dass …',
        'Dadurch, dass … / Indem …',
        'Nicht außer Acht gelassen werden darf, dass …',
        'Zusammenfassend lässt sich feststellen, dass …',
      ],
    },
    lesen: {
      title: 'Lesen', eyebrow: 'EPD · LESEN', timer: 30,
      tips: [
        'Zuerst die Fragen lesen, dann den Text.',
        'Nach Sinn und Synonymen suchen — nicht nur nach identischen Wörtern.',
        'Kurze, präzise Antworten schreiben.',
      ],
    },
    hoeren: {
      title: 'Hören', eyebrow: 'EPD · HÖREN', timer: 15,
      tips: [
        'Beim ersten Hören: Thema, Personen, Zahlen, Ursache, Folge, Meinung.',
        'Nicht jedes Wort mitschreiben.',
        'Beim zweiten Hören gezielt Lücken schließen.',
      ],
    },
    fehler: { title: 'Fehlerjournal', eyebrow: 'EPD · FEHLERJOURNAL' },
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function defaultState() {
    return {
      version: 1,
      entries: { schreiben: [], lesen: [], hoeren: [] },
      errors: [],
      ui: { view: 'schreiben', currentId: null },
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed, entries: { ...defaultState().entries, ...(parsed.entries || {}) } };
    } catch {
      return defaultState();
    }
  }

  function persist(immediate = false) {
    $('#saveState').textContent = 'Сохранение…';
    $('#saveState').style.color = '#8a6b1d';
    clearTimeout(saveTimer);
    const commit = () => {
      state.ui = { view: currentView, currentId };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      $('#saveState').textContent = 'Gespeichert';
      $('#saveState').style.color = '';
    };
    if (immediate) commit(); else saveTimer = setTimeout(commit, 350);
  }

  function createEntry(type) {
    const entry = {
      id: uid(),
      title: '',
      date: today(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      text: '',
      notes: '',
      answers: Array.from({ length: type === 'hoeren' ? 10 : 10 }, () => ''),
    };
    state.entries[type].unshift(entry);
    currentId = entry.id;
    persist(true);
    return entry;
  }

  function currentEntry(type) {
    if (!['schreiben', 'lesen', 'hoeren'].includes(type)) return null;
    let entry = state.entries[type].find(e => e.id === currentId);
    if (!entry) entry = state.entries[type][0] || createEntry(type);
    currentId = entry.id;
    return entry;
  }

  function updateHeader() {
    const c = config[currentView];
    $('#sectionEyebrow').textContent = c.eyebrow;
    $('#sectionTitle').textContent = c.title;
    $('#newEntryBtn').style.display = currentView === 'fehler' ? 'none' : '';
    $('#historyBtn').style.display = currentView === 'fehler' ? 'none' : '';
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
  }

  function render() {
    stopTimer();
    updateHeader();
    if (currentView === 'fehler') renderErrors();
    else renderEditor(currentView);
    persist(true);
  }

  function renderEditor(type) {
    const entry = currentEntry(type);
    const tpl = $('#editorTemplate').content.cloneNode(true);
    const workspace = $('#workspace');
    workspace.innerHTML = '';
    workspace.appendChild(tpl);

    $('#entryTitle').value = entry.title;
    $('#entryDate').value = entry.date || today();

    if (type === 'schreiben') renderWritingArea(entry);
    else renderAnswerArea(entry, type);

    renderTools(type, entry);
    wireCommonEntry(entry, type);
    resetTimer(config[type].timer);
  }

  function renderWritingArea(entry) {
    $('#editorArea').innerHTML = `
      <div class="lined-wrap">
        <textarea id="mainText" class="lined-textarea" spellcheck="true" lang="de" placeholder="Schreibe hier deinen Text…"></textarea>
      </div>`;
    const ta = $('#mainText');
    ta.value = entry.text || '';
    ta.addEventListener('input', () => {
      entry.text = ta.value;
      entry.updatedAt = Date.now();
      updateWritingStats(entry.text);
      persist();
    });
  }

  function renderAnswerArea(entry, type) {
    const label = type === 'lesen' ? 'Antworten zum Lesetext' : 'Antworten zum Hörtext';
    $('#editorArea').innerHTML = `
      <div class="answer-sheet">
        <div class="answer-head"><strong>${label}</strong><span class="eyebrow">KURZ & PRÄZISE</span></div>
        <div id="answerList" class="answer-list"></div>
        <button class="ghost compact add-answer" id="addAnswer">+ Antwort hinzufügen</button>
        <div class="notes-block">
          <div class="lined-wrap">
            <textarea id="notesText" class="lined-textarea" spellcheck="true" lang="de" placeholder="Notizen, Schlüsselwörter, neue Wörter…"></textarea>
          </div>
        </div>
      </div>`;
    renderAnswers(entry);
    $('#notesText').value = entry.notes || '';
    $('#notesText').addEventListener('input', e => {
      entry.notes = e.target.value;
      entry.updatedAt = Date.now();
      persist();
    });
    $('#addAnswer').addEventListener('click', () => {
      entry.answers.push('');
      renderAnswers(entry);
      persist();
    });
  }

  function renderAnswers(entry) {
    const list = $('#answerList');
    list.innerHTML = '';
    entry.answers.forEach((answer, idx) => {
      const row = document.createElement('div');
      row.className = 'answer-row';
      row.innerHTML = `<div class="answer-num">${idx + 1}</div><input class="answer-input" data-index="${idx}" placeholder="Antwort ${idx + 1}" />`;
      const input = $('input', row);
      input.value = answer;
      input.addEventListener('input', e => {
        entry.answers[idx] = e.target.value;
        entry.updatedAt = Date.now();
        updateAnswerStats(entry);
        persist();
      });
      list.appendChild(row);
    });
    updateAnswerStats(entry);
  }

  function renderTools(type, entry) {
    const preset = $('#presetRow');
    const presets = type === 'schreiben' ? [20, 40, 80] : type === 'lesen' ? [10, 25, 30] : [5, 10, 15];
    preset.innerHTML = presets.map(m => `<button class="preset-chip" data-min="${m}">${m} min</button>`).join('');
    $$('.preset-chip', preset).forEach(b => b.addEventListener('click', () => resetTimer(Number(b.dataset.min))));

    $('#timerStart').addEventListener('click', startTimer);
    $('#timerPause').addEventListener('click', stopTimer);
    $('#timerReset').addEventListener('click', () => resetTimer(config[type].timer));

    if (type === 'schreiben') {
      $('#statsCard').innerHTML = `
        <span class="tool-label">TEXT</span>
        <div class="stat-grid">
          <div class="stat"><b id="wordCount">0</b><span>Wörter</span></div>
          <div class="stat"><b id="charCount">0</b><span>Zeichen</span></div>
        </div>`;
      updateWritingStats(entry.text || '');
      $('#tipsCard').innerHTML = `
        <span class="tool-label">C1-BAUSTEINE</span>
        <div class="tip-structure">${config.schreiben.structures.map(s => `<div class="tip-pill">${s}</div>`).join('')}</div>
        <ul>${config.schreiben.tips.map(t => `<li>${t}</li>`).join('')}</ul>`;
    } else {
      $('#statsCard').innerHTML = `
        <span class="tool-label">FORTSCHRITT</span>
        <div class="stat-grid">
          <div class="stat"><b id="answeredCount">0</b><span>beantwortet</span></div>
          <div class="stat"><b id="answerTotal">${entry.answers.length}</b><span>Fragen</span></div>
        </div>`;
      updateAnswerStats(entry);
      $('#tipsCard').innerHTML = `<span class="tool-label">STRATEGIE</span><ul>${config[type].tips.map(t => `<li>${t}</li>`).join('')}</ul>`;
    }
  }

  function updateWritingStats(text) {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    if ($('#wordCount')) $('#wordCount').textContent = words;
    if ($('#charCount')) $('#charCount').textContent = text.length;
  }

  function updateAnswerStats(entry) {
    if (!$('#answeredCount')) return;
    $('#answeredCount').textContent = entry.answers.filter(a => a.trim()).length;
    $('#answerTotal').textContent = entry.answers.length;
  }

  function wireCommonEntry(entry, type) {
    $('#entryTitle').addEventListener('input', e => {
      entry.title = e.target.value;
      entry.updatedAt = Date.now();
      persist();
    });
    $('#entryDate').addEventListener('change', e => {
      entry.date = e.target.value;
      entry.updatedAt = Date.now();
      persist();
    });
  }

  function renderErrors() {
    const workspace = $('#workspace');
    workspace.innerHTML = `
      <div class="fehler-wrap">
        <section class="fehler-form">
          <span class="eyebrow">NEUER FEHLER</span>
          <h2>Aus einem Fehler eine Regel machen</h2>
          <div class="field"><label>Meine Version</label><textarea id="errWrong" rows="3" placeholder="z. B. Obwohl ich arbeite, aber ich habe Zeit."></textarea></div>
          <div class="field"><label>Korrektur</label><textarea id="errRight" rows="3" placeholder="Obwohl ich arbeite, habe ich genug Zeit."></textarea></div>
          <div class="field"><label>Regel / Warum?</label><textarea id="errRule" rows="3" placeholder="Nach obwohl steht ein Nebensatz; aber ist für dieselbe Verbindung nicht nötig."></textarea></div>
          <div class="field"><label>Mein neues Beispiel</label><textarea id="errExample" rows="3" placeholder="Obwohl das Studium viel Zeit kostet, arbeiten viele Studierende nebenbei."></textarea></div>
          <div class="fehler-actions"><button class="primary" id="saveError">Fehler speichern</button></div>
        </section>
        <aside class="fehler-list-card">
          <span class="tool-label">MEINE MUSTER</span>
          <h2>Fehlerjournal</h2>
          <div class="fehler-list" id="fehlerList"></div>
        </aside>
      </div>`;
    $('#saveError').addEventListener('click', saveError);
    renderErrorList();
  }

  function saveError() {
    const wrong = $('#errWrong').value.trim();
    const right = $('#errRight').value.trim();
    if (!wrong && !right) return;
    state.errors.unshift({
      id: uid(), wrong, right,
      rule: $('#errRule').value.trim(),
      example: $('#errExample').value.trim(),
      createdAt: Date.now(),
    });
    ['#errWrong','#errRight','#errRule','#errExample'].forEach(id => $(id).value = '');
    persist(true);
    renderErrorList();
  }

  function renderErrorList() {
    const list = $('#fehlerList');
    if (!state.errors.length) {
      list.innerHTML = '<div class="empty">Noch keine Fehler gespeichert.</div>';
      return;
    }
    list.innerHTML = state.errors.map(e => `
      <article class="error-card">
        ${e.wrong ? `<div class="wrong">${escapeHtml(e.wrong)}</div>` : ''}
        ${e.right ? `<div class="right">${escapeHtml(e.right)}</div>` : ''}
        ${e.rule ? `<div class="rule">${escapeHtml(e.rule)}</div>` : ''}
        ${e.example ? `<div class="example">${escapeHtml(e.example)}</div>` : ''}
        <footer><span>${formatDateTime(e.createdAt)}</span><button data-error-delete="${e.id}">löschen</button></footer>
      </article>`).join('');
    $$('[data-error-delete]', list).forEach(b => b.addEventListener('click', () => {
      state.errors = state.errors.filter(e => e.id !== b.dataset.errorDelete);
      persist(true); renderErrorList();
    }));
  }

  function showHistory() {
    const list = $('#historyList');
    const entries = state.entries[currentView] || [];
    if (!entries.length) list.innerHTML = '<div class="empty">Noch keine Seiten.</div>';
    else list.innerHTML = entries.map(e => `
      <div class="history-item">
        <button class="history-main" data-open="${e.id}">
          <strong>${escapeHtml(e.title || 'Ohne Titel')}</strong>
          <span>${e.date || ''} · geändert ${formatDateTime(e.updatedAt)}</span>
        </button>
        <button class="history-delete" data-delete="${e.id}" aria-label="Löschen">Löschen</button>
      </div>`).join('');

    $$('[data-open]', list).forEach(b => b.addEventListener('click', () => {
      currentId = b.dataset.open;
      $('#historyDialog').close();
      render();
    }));
    $$('[data-delete]', list).forEach(b => b.addEventListener('click', () => {
      deleteTargetId = b.dataset.delete;
      $('#confirmDialog').showModal();
    }));
    $('#historyDialog').showModal();
  }

  function deleteCurrentTarget() {
    if (!deleteTargetId) return;
    state.entries[currentView] = state.entries[currentView].filter(e => e.id !== deleteTargetId);
    if (currentId === deleteTargetId) currentId = null;
    deleteTargetId = null;
    persist(true);
    $('#confirmDialog').close();
    if ($('#historyDialog').open) showHistoryRefresh();
    render();
  }

  function showHistoryRefresh() {
    $('#historyDialog').close();
    showHistory();
  }

  function resetTimer(minutes) {
    stopTimer();
    timerSeconds = Math.round(minutes * 60);
    updateTimerDisplay();
  }

  function startTimer() {
    if (timerRunning || timerSeconds <= 0) return;
    timerRunning = true;
    timerInterval = setInterval(() => {
      timerSeconds -= 1;
      updateTimerDisplay();
      if (timerSeconds <= 0) {
        stopTimer();
        document.title = 'Zeit vorbei · EPD Heft';
        setTimeout(() => document.title = 'EPD Heft', 4000);
      }
    }, 1000);
  }

  function stopTimer() {
    timerRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  function updateTimerDisplay() {
    const el = $('#timerDisplay');
    if (!el) return;
    const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
    const s = (timerSeconds % 60).toString().padStart(2, '0');
    el.textContent = `${m}:${s}`;
    el.style.color = timerSeconds > 0 && timerSeconds <= 300 ? '#d94040' : '';
  }

  function exportData() {
    persist(true);
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `epd-heft-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object') throw new Error('Ungültige Datei');
        state.entries = { ...defaultState().entries, ...(parsed.entries || {}) };
        state.errors = Array.isArray(parsed.errors) ? parsed.errors : [];
        currentId = null;
        persist(true);
        render();
        alert('Backup importiert.');
      } catch {
        alert('Diese Datei konnte nicht importiert werden.');
      }
    };
    reader.readAsText(file);
  }

  function escapeHtml(str = '') {
    return str.replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function formatDateTime(ts) {
    if (!ts) return '';
    return new Intl.DateTimeFormat('de-AT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(ts));
  }

  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => {
    currentView = btn.dataset.view;
    currentId = null;
    render();
  }));
  $('#newEntryBtn').addEventListener('click', () => { createEntry(currentView); render(); });
  $('#historyBtn').addEventListener('click', showHistory);
  $('#closeHistory').addEventListener('click', () => $('#historyDialog').close());
  $('#cancelDelete').addEventListener('click', () => { deleteTargetId = null; $('#confirmDialog').close(); });
  $('#confirmDelete').addEventListener('click', deleteCurrentTarget);
  $('#exportBtn').addEventListener('click', exportData);
  $('#importInput').addEventListener('change', e => { if (e.target.files?.[0]) importData(e.target.files[0]); e.target.value = ''; });

  render();
})();
