(() => {
  const BASE_STATE_KEY = 'epd-heft-v1';
  const LANG_PREF_KEY = 'epd-heft-study-language-v1';
  const LANG_INIT_KEY = 'epd-heft-study-language-initialized-v1';
  const LANG_STATE_KEYS = {
    de: 'epd-heft-v1-de',
    en: 'epd-heft-v1-en',
  };
  const EPD14_KEY = 'epd-heft-epd14-v1';
  const DECK_LANG_KEY = 'epd14-deck-languages-v1';
  const STYLE_ID = 'epd14-language-style';

  const blankNotebookState = () => ({
    version: 1,
    entries: { schreiben: [], lesen: [], hoeren: [] },
    errors: [],
    ui: { view: 'schreiben', currentId: null },
  });

  function safeParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function activeLanguage() {
    return localStorage.getItem(LANG_PREF_KEY) === 'en' ? 'en' : 'de';
  }

  function initializeLanguageStorage() {
    if (localStorage.getItem(LANG_INIT_KEY) === '1') return;
    const current = localStorage.getItem(BASE_STATE_KEY) || JSON.stringify(blankNotebookState());
    localStorage.setItem(LANG_STATE_KEYS.de, current);
    if (!localStorage.getItem(LANG_STATE_KEYS.en)) {
      localStorage.setItem(LANG_STATE_KEYS.en, JSON.stringify(blankNotebookState()));
    }
    localStorage.setItem(LANG_PREF_KEY, 'de');
    localStorage.setItem(LANG_INIT_KEY, '1');
  }

  initializeLanguageStorage();

  function snapshotCurrentLanguage() {
    const lang = activeLanguage();
    const raw = localStorage.getItem(BASE_STATE_KEY);
    if (raw) localStorage.setItem(LANG_STATE_KEYS[lang], raw);
  }

  function switchLanguage(nextLang) {
    if (!LANG_STATE_KEYS[nextLang] || nextLang === activeLanguage()) return;
    snapshotCurrentLanguage();
    const target = localStorage.getItem(LANG_STATE_KEYS[nextLang]) || JSON.stringify(blankNotebookState());
    localStorage.setItem(BASE_STATE_KEY, target);
    localStorage.setItem(LANG_PREF_KEY, nextLang);
    window.location.reload();
  }

  window.addEventListener('beforeunload', snapshotCurrentLanguage);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') snapshotCurrentLanguage();
  });

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .study-language-switch {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
        margin: 8px 20px 16px;
        padding: 4px;
        border: 1px solid #dfe5f0;
        border-radius: 12px;
        background: #f4f6fb;
      }
      .study-language-switch button {
        border: 0;
        border-radius: 9px;
        padding: 8px 7px;
        background: transparent;
        color: #68748a;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
      }
      .study-language-switch button.active {
        background: #fff;
        color: #2849df;
        box-shadow: 0 2px 8px rgba(20,35,75,.09);
      }
      .study-language-note {
        grid-column: 1 / -1;
        margin: 0 3px 2px;
        color: #8a95a6;
        font-size: 9px;
        line-height: 1.25;
        text-align: center;
      }
      .deck-language-field {
        margin-top: 14px;
        padding: 14px;
        border: 1px solid #e1e6f0;
        border-radius: 12px;
        background: #fafbfe;
      }
      .deck-language-field label {
        display: block;
        margin-bottom: 7px;
        color: #677389;
        font-size: 10px;
        font-weight: 850;
        letter-spacing: .12em;
      }
      .deck-language-field select {
        width: 100%;
        border: 1px solid #d9e0ec;
        border-radius: 10px;
        background: #fff;
        color: #182238;
        padding: 10px 12px;
        font: inherit;
      }
      .deck-language-field small {
        display: block;
        margin-top: 7px;
        color: #7e899c;
        font-size: 11px;
        line-height: 1.45;
      }
      .deck-lang-badge {
        display: inline-flex;
        align-items: center;
        width: max-content;
        margin-top: 8px;
        padding: 4px 7px;
        border: 1px solid #dfe5f0;
        border-radius: 999px;
        background: #f6f8fc;
        color: #637087;
        font-size: 10px;
        font-weight: 800;
      }
      @media (max-width: 760px) {
        .study-language-switch { margin: 8px 12px 14px; }
      }
    `;
    document.head.appendChild(style);
  }

  function readDeckLanguages() {
    const parsed = safeParse(localStorage.getItem(DECK_LANG_KEY) || '{}', {});
    return parsed && typeof parsed === 'object' ? parsed : {};
  }

  function writeDeckLanguages(value) {
    localStorage.setItem(DECK_LANG_KEY, JSON.stringify(value));
  }

  function deckLanguage(deckId) {
    if (!deckId) return 'de';
    return readDeckLanguages()[deckId] === 'en' ? 'en' : 'de';
  }

  function readDeckData() {
    const parsed = safeParse(localStorage.getItem(EPD14_KEY) || '{}', {});
    return Array.isArray(parsed.decks) ? parsed.decks : [];
  }

  function addLanguageSwitch() {
    if (document.querySelector('.study-language-switch')) return;
    const brand = document.querySelector('.brand');
    if (!brand) return;

    const wrap = document.createElement('div');
    wrap.className = 'study-language-switch';
    wrap.innerHTML = `
      <button type="button" data-study-language="de">Deutsch</button>
      <button type="button" data-study-language="en">English</button>
      <div class="study-language-note">Schreiben · Lesen · Hören getrennt gespeichert</div>`;
    brand.insertAdjacentElement('afterend', wrap);

    wrap.querySelectorAll('[data-study-language]').forEach(button => {
      button.classList.toggle('active', button.dataset.studyLanguage === activeLanguage());
      button.addEventListener('click', () => switchLanguage(button.dataset.studyLanguage));
    });
  }

  const englishCoreLabels = {
    schreiben: { title: 'Writing', eyebrow: 'EPD · WRITING', nav: 'Writing' },
    lesen: { title: 'Reading', eyebrow: 'EPD · READING', nav: 'Reading' },
    hoeren: { title: 'Listening', eyebrow: 'EPD · LISTENING', nav: 'Listening' },
    fehler: { title: 'Error Journal', eyebrow: 'EPD · ERROR JOURNAL', nav: 'Error Journal' },
  };

  function setNavLabel(button, label) {
    if (!button) return;
    const icon = button.querySelector('span')?.outerHTML || '';
    if (button.dataset.epd14EnglishLabel === label && button.textContent.trim().endsWith(label)) return;
    button.innerHTML = `${icon}${label}`;
    button.dataset.epd14EnglishLabel = label;
  }

  function patchCoreLanguageUI() {
    const lang = activeLanguage();
    document.documentElement.lang = lang === 'en' ? 'en' : 'de';

    const brandSub = document.querySelector('.brand span');
    if (brandSub) brandSub.textContent = lang === 'en' ? 'English · VWU' : 'Deutsch · VWU';

    if (lang !== 'en') return;

    Object.entries(englishCoreLabels).forEach(([view, labels]) => {
      setNavLabel(document.querySelector(`.nav-item[data-view="${view}"]`), labels.nav);
    });

    const activeCore = document.querySelector('.nav-item[data-view].active');
    const view = activeCore?.dataset.view;
    if (!view || !englishCoreLabels[view]) return;

    const labels = englishCoreLabels[view];
    const title = document.getElementById('sectionTitle');
    const eyebrow = document.getElementById('sectionEyebrow');
    if (title) title.textContent = labels.title;
    if (eyebrow) eyebrow.textContent = labels.eyebrow;

    const history = document.getElementById('historyBtn');
    const newEntry = document.getElementById('newEntryBtn');
    if (history && history.style.display !== 'none') history.textContent = 'History';
    if (newEntry && newEntry.style.display !== 'none') newEntry.textContent = '+ New page';

    const titleInput = document.getElementById('entryTitle');
    if (titleInput) titleInput.placeholder = 'Task title';
    const mainText = document.getElementById('mainText');
    if (mainText) {
      mainText.lang = 'en';
      mainText.placeholder = 'Write your text here…';
    }
    const notes = document.getElementById('notesText');
    if (notes) {
      notes.lang = 'en';
      notes.placeholder = 'Notes, keywords, new words…';
    }
    document.querySelectorAll('.answer-input').forEach((input, index) => {
      input.lang = 'en';
      input.placeholder = `Answer ${index + 1}`;
    });
  }

  let activeDeckId = null;
  let editingDeckId = null;
  let draftDeckLanguage = null;

  function patchDeckTiles() {
    const map = readDeckLanguages();
    document.querySelectorAll('[data-open-deck]').forEach(tile => {
      const id = tile.dataset.openDeck;
      if (!id || tile.querySelector('.deck-lang-badge')) return;
      const badge = document.createElement('span');
      badge.className = 'deck-lang-badge';
      badge.textContent = map[id] === 'en' ? 'English' : 'Deutsch';
      const preview = tile.querySelector('.deck-preview');
      if (preview) preview.insertAdjacentElement('beforebegin', badge);
      else tile.appendChild(badge);
    });
  }

  function patchTermEditor(lang) {
    const foreign = lang === 'en' ? 'English' : 'Deutsch';
    const foreignCaps = lang === 'en' ? 'ENGLISH' : 'DEUTSCH';
    document.querySelectorAll('.term-input[data-side="de"]').forEach(input => {
      input.placeholder = foreign;
      const label = input.parentElement?.querySelector('span');
      if (label) label.textContent = foreignCaps;
    });

    const bulk = document.getElementById('bulkImportCard');
    if (bulk) {
      const heading = bulk.querySelector('h3');
      const description = bulk.querySelector('p');
      const textarea = bulk.querySelector('textarea');
      if (heading) heading.textContent = `${foreign} und Russisch mit Tabulator trennen`;
      if (description) {
        description.innerHTML = lang === 'en'
          ? 'Eine Karte pro Zeile: <b>study abroad</b> ⇥ <b>обучение за границей</b>'
          : 'Eine Karte pro Zeile: <b>das Auslandssemester</b> ⇥ <b>семестр за рубежом</b>';
      }
      if (textarea) {
        textarea.placeholder = lang === 'en'
          ? 'study abroad\tобучение за границей\napplication\tзаявление'
          : 'das Auslandssemester\tсеместр за рубежом\ndas Erasmus-Programm\tпрограмма Эразмус';
      }
    }
  }

  function patchDeckEditor() {
    const card = document.querySelector('.deck-editor-card');
    if (!card) return;

    let field = card.querySelector('.deck-language-field');
    if (!field) {
      const defaultLang = editingDeckId ? deckLanguage(editingDeckId) : activeLanguage();
      draftDeckLanguage = defaultLang === 'en' ? 'en' : 'de';
      field = document.createElement('div');
      field.className = 'deck-language-field';
      field.innerHTML = `
        <label for="deckLanguageChoice">SPRACHE DER KARTEN</label>
        <select id="deckLanguageChoice">
          <option value="de">Deutsch ↔ Русский</option>
          <option value="en">English ↔ Русский</option>
        </select>
        <small>Wähle Deutsch oder English. Im Lernmodus kannst du anschließend in beide Richtungen üben: Fremdsprache → Русский oder Русский → Fremdsprache.</small>`;
      const description = card.querySelector('#deckDescription');
      (description || card.lastElementChild)?.insertAdjacentElement('afterend', field);
      const select = field.querySelector('select');
      select.value = draftDeckLanguage;
      select.addEventListener('change', () => {
        draftDeckLanguage = select.value === 'en' ? 'en' : 'de';
        patchTermEditor(draftDeckLanguage);
      });
    } else {
      draftDeckLanguage = field.querySelector('select')?.value === 'en' ? 'en' : (draftDeckLanguage || 'de');
    }

    patchTermEditor(draftDeckLanguage || 'de');
  }

  function saveDeckLanguageAfterEditor(beforeIds, preferredLang, knownId, title) {
    window.setTimeout(() => {
      const decks = readDeckData();
      let id = knownId && decks.some(deck => deck.id === knownId) ? knownId : null;
      if (!id) {
        const created = decks
          .filter(deck => !beforeIds.has(deck.id))
          .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
        id = created?.id || null;
      }
      if (!id && title) {
        id = decks
          .filter(deck => String(deck.title || '').trim() === title)
          .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0]?.id || null;
      }
      if (!id) return;
      const map = readDeckLanguages();
      map[id] = preferredLang === 'en' ? 'en' : 'de';
      writeDeckLanguages(map);
      activeDeckId = id;
      editingDeckId = id;
      patchDeckTiles();
    }, 80);
  }

  function fixLearnModeName(root = document) {
    const selectors = ['#openLearnMode', '#startLearn', '#sectionTitle', '.learn-setup-card .eyebrow'];
    selectors.forEach(selector => {
      const element = root.querySelector?.(selector) || document.querySelector(selector);
      if (!element) return;
      element.textContent = element.textContent
        .replace(/Zaubianie/gi, 'Lernmodus')
        .replace(/ZAUBIANIE/g, 'LERNMODUS');
    });
  }

  function patchStudyModeLanguage() {
    fixLearnModeName();
    if (!activeDeckId) return;
    const lang = deckLanguage(activeDeckId);
    const foreign = lang === 'en' ? 'Englisch' : 'Deutsch';
    const foreignCaps = lang === 'en' ? 'ENGLISH' : 'DEUTSCH';

    const flashFront = document.querySelector('.flash-front .flash-side-label');
    if (flashFront) flashFront.textContent = foreignCaps;

    const modeButton = document.getElementById('openLearnMode');
    if (modeButton) modeButton.textContent = 'Lernmodus · Заучивание';

    const learnEyebrow = document.querySelector('.learn-setup-card .eyebrow');
    if (learnEyebrow) learnEyebrow.textContent = 'LERNMODUS · ЗАУЧИВАНИЕ';
    const start = document.getElementById('startLearn');
    if (start) start.textContent = 'Lernmodus starten';

    const deRu = document.querySelector('[data-direction="de-ru"]');
    const ruDe = document.querySelector('[data-direction="ru-de"]');
    if (deRu) {
      const labels = deRu.querySelectorAll('b');
      if (labels[0]) labels[0].textContent = foreign;
    }
    if (ruDe) {
      const labels = ruDe.querySelectorAll('b');
      if (labels[1]) labels[1].textContent = foreign;
    }

    const questionLabel = document.querySelector('.learn-question-label');
    if (questionLabel && /DEUTSCH/i.test(questionLabel.textContent)) questionLabel.textContent = foreignCaps;
    const questionHint = document.querySelector('.learn-question-card > p');
    if (questionHint && lang === 'en') questionHint.textContent = questionHint.textContent.replace(/Deutsch/g, 'Englisch');

    const sectionTitle = document.getElementById('sectionTitle');
    if (sectionTitle) sectionTitle.textContent = sectionTitle.textContent.replace(/Zaubianie/gi, 'Lernmodus');
  }

  function patchAll() {
    addLanguageSwitch();
    patchCoreLanguageUI();
    patchDeckTiles();
    patchDeckEditor();
    patchStudyModeLanguage();
  }

  function wireDeckTracking() {
    document.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const open = target.closest('[data-open-deck]');
      if (open?.dataset.openDeck) {
        activeDeckId = open.dataset.openDeck;
        editingDeckId = null;
      }

      const edit = target.closest('[data-edit-deck]');
      if (edit?.dataset.editDeck) {
        editingDeckId = edit.dataset.editDeck;
        activeDeckId = editingDeckId;
      }

      if (target.closest('#newDeckBtn')) {
        editingDeckId = null;
        activeDeckId = null;
        draftDeckLanguage = activeLanguage();
      }

      if (target.closest('#editCurrentDeck')) {
        editingDeckId = activeDeckId;
      }

      if (target.closest('#saveDeck')) {
        const beforeIds = new Set(readDeckData().map(deck => deck.id));
        const title = document.getElementById('deckTitle')?.value.trim() || '';
        const selected = document.getElementById('deckLanguageChoice')?.value === 'en' ? 'en' : 'de';
        saveDeckLanguageAfterEditor(beforeIds, selected, editingDeckId, title);
      }
    }, true);
  }

  injectStyles();
  wireDeckTracking();

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(patchAll);
  });

  window.addEventListener('DOMContentLoaded', () => {
    patchAll();
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
