(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const search = $('#theme-search');
  const cards = $$('.theme-card');
  const filters = $$('.filter-chip');
  const grid = $('#theme-grid');
  const empty = $('#empty-state');
  const toast = $('#toast');
  let activeFilter = 'all';
  let toastTimer;

  const themes = {
    cloudline: { title: 'Cloudline', description: 'A quiet blue horizon with plenty of breathing room.', category: 'Minimal', art: 'preview-cloudline' },
    lavender: { title: 'Lavender Quiet', description: 'A soft pastel concept with a calm, dreamy mood.', category: 'Anime', art: 'preview-lavender' },
    moss: { title: 'Moss Morning', description: 'Muted greens inspired by a slow morning outdoors.', category: 'Nature', art: 'preview-moss' },
    geometry: { title: 'Soft Geometry', description: 'Rounded shapes and gentle color for a clean desktop.', category: 'Abstract', art: 'preview-geometry' }
  };

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
  }

  function filterThemes() {
    const query = (search.value || '').trim().toLowerCase();
    let visible = 0;
    cards.forEach(card => {
      const categoryMatch = activeFilter === 'all' || card.dataset.category === activeFilter;
      const searchMatch = !query || (card.dataset.search + ' ' + card.textContent).toLowerCase().includes(query);
      const show = categoryMatch && searchMatch;
      card.hidden = !show;
      if (show) visible++;
    });
    empty.hidden = visible !== 0;
    grid.hidden = visible === 0;
  }

  function setFilter(filter) {
    activeFilter = filter;
    filters.forEach(button => {
      const active = button.dataset.filter === filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    filterThemes();
  }

  function openPreview(id) {
    const theme = themes[id];
    if (!theme) return;
    $('#dialog-title').textContent = theme.title;
    $('#dialog-description').textContent = theme.description + ' This is a catalogue preview.';
    $('#dialog-art').className = 'dialog-art ' + theme.art;
    $('#dialog-install').dataset.install = id;
    const dialog = $('#theme-dialog');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else showToast(theme.title + ' — preview is available in the catalogue.');
  }

function requestInstall(id) {
    const theme = themes[id];

    if (!theme) {
        showToast('Unknown theme.');
        return;
    }

    console.log('[DNS STORE] Install clicked:', id);

    const bridge = window.CefSharp || window.cefSharp;

    if (!bridge || typeof bridge.PostMessage !== 'function') {
        console.error('[DNS STORE] CefSharp bridge unavailable.');
        showToast('DNS Browser connection unavailable. Open this page directly in DNS Browser.');
        return;
    }

    try {
        bridge.PostMessage({
            type: 'dnsbrowser_install_theme',
            themeId: id
        });

        showToast('Installation request sent to DNS Browser…');

    } catch (error) {
        console.error('[DNS STORE] PostMessage failed:', error);
        showToast('Could not communicate with DNS Browser.');
    }
}

    // Send only a catalogue ID. DNS Browser resolves the ID against its
    // trusted HTTPS catalogue and never trusts a URL supplied by this page.
    window.CefSharp.PostMessage({ type: 'dnsbrowser_install_theme', themeId: id });
    showToast('Sending the installation request to DNS Browser…');
  }

  window.addEventListener('dnsbrowser-theme-install-result', event => {
    const result = event.detail || {};
    showToast(result.message || (result.success ? 'Theme installed.' : 'Theme installation failed.'));
  });

  filters.forEach(button => button.addEventListener('click', () => setFilter(button.dataset.filter)));
  search.addEventListener('input', filterThemes);
  $('#clear-filters').addEventListener('click', () => { search.value = ''; setFilter('all'); search.focus(); });
  $$('[data-preview]').forEach(button => button.addEventListener('click', () => openPreview(button.dataset.preview)));

  document.addEventListener('click', event => {
    const installButton = event.target.closest('[data-install]');
    if (!installButton) return;
    event.preventDefault();
    requestInstall(installButton.dataset.install);
  });

  $('#theme-dialog').addEventListener('click', event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      search.focus();
    }
  });

  const mobileMenu = $('.mobile-menu');
  if (mobileMenu) $$('.mobile-menu a').forEach(link => link.addEventListener('click', () => mobileMenu.removeAttribute('open')));
  filterThemes();
})();
