(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  const search = $('#theme-search');
  const cards = $$('.theme-card');
  const filters = $$('.filter-chip');
  const grid = $('#theme-grid');
  const empty = $('#empty-state');
  const toast = $('#toast');
  const dialog = $('#theme-dialog');
  const dialogArt = $('#dialog-art');
  const dialogTitle = $('#dialog-title');
  const dialogDescription = $('#dialog-description');
  const dialogInstall = $('#dialog-install');

  let activeFilter = 'all';
  let toastTimer = 0;

  const themes = {
    cloudline: {
      title: 'Cloudline',
      description: 'A quiet blue horizon with plenty of breathing room.',
      category: 'Minimal'
    },
    lavender: {
      title: 'Lavender Quiet',
      description: 'A soft pastel concept with a calm, dreamy mood.',
      category: 'Anime'
    },
    moss: {
      title: 'Moss Morning',
      description: 'Muted greens inspired by a slow morning outdoors.',
      category: 'Nature'
    },
    geometry: {
      title: 'Soft Geometry',
      description: 'Rounded shapes and gentle color for a clean desktop.',
      category: 'Abstract'
    }
  };

  function showToast(message) {
    if (!toast) {
      console.info('[DNS STORE]', message);
      return;
    }

    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 4200);
  }

  function filterThemes() {
    if (!search || !grid || !empty) return;

    const query = search.value.trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach(card => {
      const categoryMatch = activeFilter === 'all' || card.dataset.category === activeFilter;
      const searchableText = `${card.dataset.search || ''} ${card.textContent || ''}`.toLowerCase();
      const searchMatch = query.length === 0 || searchableText.includes(query);
      const visible = categoryMatch && searchMatch;

      card.hidden = !visible;
      if (visible) visibleCount++;
    });

    grid.hidden = visibleCount === 0;
    empty.hidden = visibleCount !== 0;
  }

  function setFilter(filter) {
    activeFilter = filter;

    filters.forEach(button => {
      const selected = button.dataset.filter === filter;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });

    filterThemes();
  }

  function openPreview(id) {
    const theme = themes[id];
    const sourcePreview = document.querySelector(`[data-preview="${id}"]`);

    if (!theme || !dialog || !dialogArt || !dialogTitle || !dialogDescription || !dialogInstall) {
      console.error('[DNS STORE] Preview elements missing for theme:', id);
      showToast('The theme preview could not be opened.');
      return;
    }

    dialogTitle.textContent = theme.title;
    dialogDescription.textContent = theme.description;
    dialogInstall.dataset.install = id;

    // Reuse the actual preview artwork from the catalogue card.
    // This keeps the modal preview visually consistent with its card.
    dialogArt.className = `dialog-art ${sourcePreview ? Array.from(sourcePreview.classList).filter(c => c.startsWith('preview-')).join(' ') : ''}`;
    dialogArt.style.position = 'relative';
    dialogArt.style.overflow = 'hidden';
    dialogArt.replaceChildren();

    if (sourcePreview) {
      Array.from(sourcePreview.children).forEach(child => {
        dialogArt.appendChild(child.cloneNode(true));
      });
    }

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      // Fallback for older Chromium builds.
      dialog.setAttribute('open', '');
      dialog.style.display = 'block';
      showToast(`${theme.title} preview opened.`);
    }
  }

  function requestInstall(id) {
    const theme = themes[id];

    if (!theme) {
      showToast('Unknown theme.');
      return;
    }

    console.info('[DNS STORE] Install clicked:', id);

    const bridge = window.CefSharp || window.cefSharp;

    if (!bridge || typeof bridge.PostMessage !== 'function') {
      console.warn('[DNS STORE] CefSharp PostMessage bridge is unavailable.');
      showToast('Installation is available inside DNS Browser.');
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

  // Receive the completion/failure event dispatched by webuin.vb.
  window.addEventListener('dnsbrowser-theme-install-result', event => {
    const result = event.detail || {};
    showToast(result.message || (result.success ? 'Theme installed.' : 'Theme installation failed.'));
  });

  // Category filters.
  filters.forEach(button => {
    button.addEventListener('click', () => setFilter(button.dataset.filter || 'all'));
  });

  // Search box.
  if (search) search.addEventListener('input', filterThemes);

  // Clear search/filter state.
  const clearFilters = $('#clear-filters');
  if (clearFilters) {
    clearFilters.addEventListener('click', () => {
      if (search) search.value = '';
      setFilter('all');
      if (search) search.focus();
    });
  }

  // Preview buttons.
  $$('[data-preview]').forEach(button => {
    button.addEventListener('click', () => openPreview(button.dataset.preview));
  });

  // Install buttons (both catalogue cards and the preview dialog).
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const installButton = target ? target.closest('[data-install]') : null;
    if (!installButton) return;

    event.preventDefault();
    requestInstall(installButton.dataset.install);
  });

  // Close the dialog when its backdrop is clicked.
  if (dialog) {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) {
        if (typeof dialog.close === 'function') dialog.close();
        else {
          dialog.removeAttribute('open');
          dialog.style.display = '';
        }
      }
    });
  }

  // Keyboard shortcuts.
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && search) {
      event.preventDefault();
      search.focus();
    }

    if (event.key === 'Escape' && dialog && dialog.open && typeof dialog.close === 'function') {
      dialog.close();
    }
  });

  // Close the mobile menu after navigation.
  const mobileMenu = $('.mobile-menu');
  if (mobileMenu) {
    $$('.mobile-menu a').forEach(link => {
      link.addEventListener('click', () => mobileMenu.removeAttribute('open'));
    });
  }

  filterThemes();
  console.info('[DNS STORE] Store UI initialized. Preview buttons:', $$('[data-preview]').length,
               'Install buttons:', $$('[data-install]').length);
})();
