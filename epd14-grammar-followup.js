(() => {
  const STYLE_ID = 'epd14-grammar-followup-style';
  const NOTEBOOK_PAGES_KEY = 'epd14-grammar-notebook-pages-v1';

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .grammar-reader-top.epd14-fixed-grammar-toolbar {
        position: fixed !important;
        z-index: 45 !important;
        margin: 0 !important;
      }
      .grammar-reader-grid.epd14-fixed-toolbar-offset {
        margin-top: var(--epd14-grammar-toolbar-offset, 76px) !important;
      }
      .grammar-pdf-pane .doc-toolbar.epd14-pdf-custom-toolbar {
        display: none !important;
      }
      .grammar-pdf-pane .pdf-frame {
        height: calc(100vh - 246px) !important;
      }
      .grammar-notebook-pager {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 14px;
        border-bottom: 1px solid #e3e9f4;
        background: rgba(255, 255, 255, 0.96);
      }
      .grammar-notebook-page-nav,
      .grammar-notebook-page-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .grammar-notebook-page-label {
        min-width: 76px;
        text-align: center;
        font-weight: 700;
        color: #52617a;
        font-size: 13px;
      }
      .grammar-notebook-pager button {
        min-height: 34px;
      }
      @media (max-width: 760px) {
        .grammar-reader-top.epd14-fixed-grammar-toolbar {
          position: fixed !important;
        }
        .grammar-pdf-pane .pdf-frame {
          height: 70vh !important;
          min-height: 500px !important;
        }
        .grammar-notebook-pager {
          align-items: stretch;
          flex-direction: column;
        }
        .grammar-notebook-page-nav,
        .grammar-notebook-page-actions {
          justify-content: space-between;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function markAndHidePdfToolbar() {
    const pdfFrame = document.getElementById('grammarPdfFrame');
    if (!pdfFrame) return;
    const pane = document.getElementById('grammarPdfPane');
    const customToolbar = pane?.querySelector(':scope > .doc-toolbar');
    if (customToolbar) customToolbar.classList.add('epd14-pdf-custom-toolbar');
  }

  function selectedGrammarFileId() {
    try {
      const root = JSON.parse(localStorage.getItem('epd-heft-epd14-v1') || '{}');
      return root?.grammar?.selectedFileId || null;
    } catch {
      return null;
    }
  }

  function loadNotebookPages() {
    try {
      const parsed = JSON.parse(localStorage.getItem(NOTEBOOK_PAGES_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveNotebookPages(store) {
    localStorage.setItem(NOTEBOOK_PAGES_KEY, JSON.stringify(store));
  }

  function newPage(text = '') {
    return {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  function ensureNotebookPager() {
    const textarea = document.getElementById('grammarNotebook');
    const pane = textarea?.closest('.grammar-notes-pane');
    const head = pane?.querySelector('.grammar-notes-head');
    const fileId = selectedGrammarFileId();

    if (!textarea || !pane || !head || !fileId || textarea.dataset.epd14PagerReady === '1') return;
    textarea.dataset.epd14PagerReady = '1';

    const store = loadNotebookPages();
    const existing = store[fileId];
    const state = existing && Array.isArray(existing.pages) && existing.pages.length
      ? existing
      : { pages: [newPage(textarea.value || '')], activeIndex: 0 };

    state.activeIndex = Math.max(0, Math.min(Number(state.activeIndex) || 0, state.pages.length - 1));
    store[fileId] = state;
    saveNotebookPages(store);

    const pager = document.createElement('div');
    pager.className = 'grammar-notebook-pager';
    pager.innerHTML = `
      <div class="grammar-notebook-page-nav">
        <button class="secondary compact" type="button" data-grammar-page-prev aria-label="Vorherige Seite">←</button>
        <span class="grammar-notebook-page-label" data-grammar-page-label></span>
        <button class="secondary compact" type="button" data-grammar-page-next aria-label="Nächste Seite">→</button>
      </div>
      <div class="grammar-notebook-page-actions">
        <button class="primary compact" type="button" data-grammar-page-add>+ Neue Seite</button>
        <button class="ghost compact" type="button" data-grammar-page-delete>Seite löschen</button>
      </div>`;
    head.insertAdjacentElement('afterend', pager);

    const label = pager.querySelector('[data-grammar-page-label]');
    const prev = pager.querySelector('[data-grammar-page-prev]');
    const next = pager.querySelector('[data-grammar-page-next]');
    const add = pager.querySelector('[data-grammar-page-add]');
    const remove = pager.querySelector('[data-grammar-page-delete]');

    function persistCurrent() {
      const currentStore = loadNotebookPages();
      const currentState = currentStore[fileId] || state;
      if (!currentState.pages?.length) currentState.pages = [newPage('')];
      currentState.activeIndex = Math.max(0, Math.min(Number(currentState.activeIndex) || 0, currentState.pages.length - 1));
      const page = currentState.pages[currentState.activeIndex];
      page.text = textarea.value;
      page.updatedAt = Date.now();
      currentStore[fileId] = currentState;
      saveNotebookPages(currentStore);
      return currentState;
    }

    function refreshControls(currentState) {
      const index = currentState.activeIndex;
      label.textContent = `Seite ${index + 1} / ${currentState.pages.length}`;
      prev.disabled = index <= 0;
      next.disabled = index >= currentState.pages.length - 1;
      remove.disabled = currentState.pages.length <= 1;
    }

    function openPage(index) {
      const currentStore = loadNotebookPages();
      const currentState = currentStore[fileId] || state;
      if (!currentState.pages?.length) currentState.pages = [newPage('')];
      currentState.activeIndex = Math.max(0, Math.min(index, currentState.pages.length - 1));
      currentStore[fileId] = currentState;
      saveNotebookPages(currentStore);
      textarea.value = currentState.pages[currentState.activeIndex].text || '';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
      refreshControls(currentState);
    }

    textarea.addEventListener('input', () => {
      const currentState = persistCurrent();
      refreshControls(currentState);
    });

    prev.addEventListener('click', () => {
      const currentState = persistCurrent();
      openPage(currentState.activeIndex - 1);
    });

    next.addEventListener('click', () => {
      const currentState = persistCurrent();
      openPage(currentState.activeIndex + 1);
    });

    add.addEventListener('click', () => {
      const currentStore = loadNotebookPages();
      const currentState = persistCurrent();
      currentState.pages.push(newPage(''));
      currentState.activeIndex = currentState.pages.length - 1;
      currentStore[fileId] = currentState;
      saveNotebookPages(currentStore);
      openPage(currentState.activeIndex);
    });

    remove.addEventListener('click', () => {
      const currentState = persistCurrent();
      if (currentState.pages.length <= 1) return;
      if (!window.confirm(`Seite ${currentState.activeIndex + 1} löschen?`)) return;
      const currentStore = loadNotebookPages();
      currentState.pages.splice(currentState.activeIndex, 1);
      currentState.activeIndex = Math.min(currentState.activeIndex, currentState.pages.length - 1);
      currentStore[fileId] = currentState;
      saveNotebookPages(currentStore);
      openPage(currentState.activeIndex);
    });

    openPage(state.activeIndex);
  }

  function positionGrammarToolbar() {
    const toolbar = document.querySelector('.grammar-reader-top');
    const grid = document.getElementById('grammarReaderGrid');
    const workspace = document.getElementById('workspace');
    const topbar = document.querySelector('.topbar');

    if (!toolbar || !grid || !workspace) return;

    toolbar.classList.add('epd14-fixed-grammar-toolbar');
    grid.classList.add('epd14-fixed-toolbar-offset');

    const workspaceRect = workspace.getBoundingClientRect();
    const workspaceStyle = getComputedStyle(workspace);
    const paddingLeft = parseFloat(workspaceStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(workspaceStyle.paddingRight) || 0;
    const topbarHeight = topbar?.getBoundingClientRect().height || 116;
    const gap = window.innerWidth <= 760 ? 8 : 12;

    toolbar.style.top = `${Math.round(topbarHeight + gap)}px`;
    toolbar.style.left = `${Math.round(workspaceRect.left + paddingLeft)}px`;
    toolbar.style.width = `${Math.max(280, Math.round(workspaceRect.width - paddingLeft - paddingRight))}px`;

    const offset = toolbar.getBoundingClientRect().height + 14;
    grid.style.setProperty('--epd14-grammar-toolbar-offset', `${Math.round(offset)}px`);

    markAndHidePdfToolbar();
    ensureNotebookPager();
  }

  let raf = 0;
  function scheduleFix() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(positionGrammarToolbar);
  }

  injectStyle();

  const workspace = document.getElementById('workspace');
  if (workspace) {
    const observer = new MutationObserver(scheduleFix);
    observer.observe(workspace, { childList: true, subtree: true });
  }

  window.addEventListener('resize', scheduleFix, { passive: true });
  window.addEventListener('orientationchange', scheduleFix, { passive: true });
  scheduleFix();
})();
