(() => {
  const EPD14_KEY = 'epd-heft-epd14-v1';
  const BASE_KEY = 'epd-heft-v1';
  const LANG_PREF_KEY = 'epd-heft-study-language-v1';
  const BACKUP_FORMAT = 'epd14-backup-v2';
  const PATCH_ATTR = 'data-epd14-audit-patched';

  const safeParse = (raw, fallback = null) => {
    try { return JSON.parse(raw); } catch { return fallback; }
  };

  const activeLanguage = () => localStorage.getItem(LANG_PREF_KEY) === 'en' ? 'en' : 'de';

  function currentCoreView() {
    return document.querySelector('.nav-item[data-view].active')?.dataset.view || 'schreiben';
  }

  function readPersistentTimer(view) {
    const root = safeParse(localStorage.getItem(EPD14_KEY) || '{}', {});
    return root?.timers?.[view] || null;
  }

  // Custom duration + Start should behave as one action. The original timer keeps
  // owning countdown state; this only applies a changed duration before Start.
  document.addEventListener('click', event => {
    const start = event.target.closest?.('#timerStart');
    if (!start) return;
    const card = start.closest('.timer-card');
    const input = card?.querySelector('#timerMinutes');
    const apply = card?.querySelector('#timerApply');
    if (!input || !apply) return;

    const typed = Math.max(1, Math.min(240, Math.round(Number(input.value) || 0)));
    if (!Number.isFinite(typed) || typed <= 0) return;
    const timer = readPersistentTimer(currentCoreView());
    const configured = Math.round(Number(timer?.durationMinutes) || 0);
    if (typed !== configured) apply.click();
  }, true);

  document.addEventListener('keydown', event => {
    const input = event.target.closest?.('#timerMinutes');
    if (!input || event.key !== 'Enter') return;
    event.preventDefault();
    input.closest('.timer-card')?.querySelector('#timerStart')?.click();
  }, true);

  function normalizeLearnModeNaming(root = document) {
    const selectors = [
      '#openLearnMode', '#startLearn', '#sectionTitle',
      '.learn-setup-card .eyebrow', '.study-summary .eyebrow'
    ];
    selectors.forEach(selector => {
      root.querySelectorAll?.(selector).forEach(element => {
        const next = element.textContent
          .replace(/ZAUBIANIE/g, 'LERNMODUS')
          .replace(/Zaubianie/gi, 'Lernmodus');
        if (next !== element.textContent) element.textContent = next;
      });
    });
  }

  function makeDeckTilesKeyboardAccessible(root = document) {
    root.querySelectorAll?.('[data-open-deck]').forEach(tile => {
      if (tile.getAttribute(PATCH_ATTR) === '1') return;
      tile.setAttribute(PATCH_ATTR, '1');
      tile.addEventListener('keydown', event => {
        if (event.target !== tile) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        tile.click();
      });
    });
  }

  function storageSnapshot() {
    const storage = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (key.startsWith('epd-heft-') || key.startsWith('epd14-')) {
        storage[key] = localStorage.getItem(key);
      }
    }
    return storage;
  }

  function exportCompleteBackup(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const payload = {
      format: BACKUP_FORMAT,
      version: 2,
      exportedAt: new Date().toISOString(),
      note: 'Local PDF/image binaries stored in IndexedDB are intentionally not embedded in this JSON backup.',
      storage: storageSnapshot(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `epd14-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function importCompleteBackup(event) {
    event.stopImmediatePropagation();
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.format === BACKUP_FORMAT && parsed.storage && typeof parsed.storage === 'object') {
        Object.entries(parsed.storage).forEach(([key, value]) => {
          if (!(key.startsWith('epd-heft-') || key.startsWith('epd14-'))) return;
          if (typeof value === 'string') localStorage.setItem(key, value);
        });
      } else if (parsed && typeof parsed === 'object' && parsed.entries && parsed.ui) {
        const raw = JSON.stringify(parsed);
        const lang = activeLanguage();
        localStorage.setItem(BASE_KEY, raw);
        localStorage.setItem(`epd-heft-v1-${lang}`, raw);
      } else {
        throw new Error('Nicht unterstütztes Backup-Format');
      }
      input.value = '';
      window.alert('Backup importiert. Die Seite wird neu geladen.');
      window.location.reload();
    } catch (error) {
      input.value = '';
      window.alert(`Import fehlgeschlagen: ${error?.message || 'Ungültige Datei'}`);
    }
  }

  function wireBackupControls() {
    const exportButton = document.getElementById('exportBtn');
    if (exportButton && exportButton.dataset.epd14BackupV2 !== '1') {
      exportButton.dataset.epd14BackupV2 = '1';
      exportButton.addEventListener('click', exportCompleteBackup, true);
      exportButton.title = 'Exportiert Deutsch, English, Wortschatz, Timer und Grammatik-Notizen';
    }

    const importInput = document.getElementById('importInput');
    if (importInput && importInput.dataset.epd14BackupV2 !== '1') {
      importInput.dataset.epd14BackupV2 = '1';
      importInput.addEventListener('change', importCompleteBackup, true);
    }
  }

  function auditPatch(root = document) {
    normalizeLearnModeNaming(root);
    makeDeckTilesKeyboardAccessible(root);
    wireBackupControls();
  }

  auditPatch();
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) auditPatch(node);
      }
    }
    normalizeLearnModeNaming(document);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
