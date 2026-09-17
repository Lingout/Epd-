(() => {
  const STYLE_ID = 'epd14-grammar-followup-style';

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
      @media (max-width: 760px) {
        .grammar-reader-top.epd14-fixed-grammar-toolbar {
          position: fixed !important;
        }
        .grammar-pdf-pane .pdf-frame {
          height: 70vh !important;
          min-height: 500px !important;
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
