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
  const toastIcon = $('#toast-icon');
  const toastTitle = $('#toast-title');
  const toastMessage = $('#toast-message');
  const toastImage = $('#toast-image');
  const toastClose = $('#toast-close');

  let activeFilter = 'all';
  let toastTimer = 0;
  let pendingInstallId = null;

  const themes = {
    cloudline: {
      title: 'Cloudline',
      description: 'A quiet blue horizon with plenty of breathing room.',
      category: 'Minimal'
    },
    lavender: {
      title: 'Lavender Quiet',
      description: 'A soft pastel concept with a calm, dreamy mood.',
      category: 'Anime',
      imageUrl: 'themes/lavender/background.png'
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

  function showToast(message, type = 'info', themeId = null) {
    if (!toast) {
      console.info('[DNS STORE]', message);
      return;
    }

    const theme = themeId ? themes[themeId] : null;
    const labels = {
      success: ['✓', 'Theme installed'],
      error: ['!', 'Installation failed'],
      info: ['i', 'DNS Browser Apps']
    };
    const label = labels[type] || labels.info;

    if (toastIcon) toastIcon.textContent = label[0];
    if (toastTitle) toastTitle.textContent = label[1];
    if (toastMessage) toastMessage.textContent = message;

    if (toastImage) {
      if (type === 'success' && theme && theme.imageUrl) {
        toastImage.src = theme.imageUrl;
        toastImage.alt = theme.title + ' wallpaper';
        toastImage.hidden = false;
      } else {
        toastImage.removeAttribute('src');
        toastImage.alt = '';
        toastImage.hidden = true;
      }
    }

    toast.classList.remove('toast-success', 'toast-error', 'toast-info');
    toast.classList.add('toast-' + type, 'show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 6500);
  }

  function updateInstallButtons(themeId, state) {
    $$('[data-install]').forEach(button => {
      if (button.dataset.install !== themeId) return;
      if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;

      if (state === 'busy') {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.textContent = 'Installing…';
      } else {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.innerHTML = state === 'installed'
          ? 'Installed <span aria-hidden="true">✓</span>'
          : button.dataset.originalHtml;
      }
    });
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

  function appendFallbackArtwork(dialogElement, sourcePreview) {
    dialogElement.className = 'dialog-art ' + (sourcePreview
      ? Array.from(sourcePreview.classList).filter(c => c.startsWith('preview-')).join(' ')
      : '');

    if (sourcePreview) {
      Array.from(sourcePreview.children).forEach(child => {
        if (!child.classList.contains('theme-card-image')) {
          dialogElement.appendChild(child.cloneNode(true));
        }
      });
    }
  }

  function openPreview(id) {
    const theme = themes[id];
    const sourcePreview = document.querySelector(`[data-preview="${id}"]`);

    if (!theme || !dialog || !dialogArt || !dialogTitle || !dialogDescription || !dialogInstall) {
      console.error('[DNS STORE] Preview elements missing for theme:', id);
      showToast('The theme preview could not be opened.', 'error');
      return;
    }

    dialogTitle.textContent = theme.title;
    dialogDescription.textContent = theme.description;
    dialogInstall.dataset.install = id;
    dialogArt.replaceChildren();

    if (theme.imageUrl) {
      dialogArt.className = 'dialog-art dialog-art-real';
      const image = document.createElement('img');
      image.src = theme.imageUrl;
      image.alt = theme.title + ' wallpaper preview';
      image.loading = 'eager';
      image.decoding = 'async';
      image.addEventListener('error', () => {
        dialogArt.replaceChildren();
        appendFallbackArtwork(dialogArt, sourcePreview);
      }, { once: true });
      dialogArt.appendChild(image);
    } else {
      appendFallbackArtwork(dialogArt, sourcePreview);
    }

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
      dialog.style.display = 'block';
      showToast(`${theme.title} preview opened.`, 'info');
    }
  }

  function requestInstall(id) {
    const theme = themes[id];

    if (!theme) {
      showToast('Unknown theme.', 'error');
      return;
    }

    if (pendingInstallId) {
      showToast('A theme is already being installed. Please wait for it to finish.', 'info');
      return;
    }

    const bridge = window.CefSharp || window.cefSharp;
    if (!bridge || typeof bridge.PostMessage !== 'function') {
      console.warn('[DNS STORE] CefSharp PostMessage bridge is unavailable.');
      showToast('Open this store inside DNS Browser to install themes.', 'error');
      return;
    }

    try {
      pendingInstallId = id;
      updateInstallButtons(id, 'busy');
      showToast('Downloading ' + theme.title + '…', 'info');
      bridge.PostMessage({
        type: 'dnsbrowser_install_theme',
        themeId: id
      });
    } catch (error) {
      console.error('[DNS STORE] PostMessage failed:', error);
      updateInstallButtons(id, 'idle');
      pendingInstallId = null;
      showToast('Could not communicate with DNS Browser. Please try again.', 'error');
    }
  }

  // webuin dispatches this event only after the download and settings save finish.
  window.addEventListener('dnsbrowser-theme-install-result', event => {
    const result = event.detail || {};
    const themeId = (typeof result.themeId === 'string' && result.themeId) || pendingInstallId;
    const succeeded = result.success === true;

    if (pendingInstallId) updateInstallButtons(pendingInstallId, succeeded ? 'installed' : 'idle');
    if (themeId && themeId !== pendingInstallId) updateInstallButtons(themeId, succeeded ? 'installed' : 'idle');
    pendingInstallId = null;

    if (succeeded) {
      if (dialog && dialog.open && typeof dialog.close === 'function') dialog.close();
      const theme = themeId ? themes[themeId] : null;
      showToast(
        theme ? theme.title + ' is now your new tab background.' : (result.message || 'Your new tab theme is ready.'),
        'success',
        themeId
      );
    } else {
      showToast(result.message || 'The theme could not be installed. Check your connection and try again.', 'error');
    }
  });

  if (toastClose) {
    toastClose.addEventListener('click', () => {
      window.clearTimeout(toastTimer);
      if (toast) toast.classList.remove('show');
    });
  }

  filters.forEach(button => {
    button.addEventListener('click', () => setFilter(button.dataset.filter || 'all'));
  });

  if (search) search.addEventListener('input', filterThemes);

  const clearFilters = $('#clear-filters');
  if (clearFilters) {
    clearFilters.addEventListener('click', () => {
      if (search) search.value = '';
      setFilter('all');
      if (search) search.focus();
    });
  }

  $$('[data-preview]').forEach(button => {
    button.addEventListener('click', () => openPreview(button.dataset.preview));
  });

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const installButton = target ? target.closest('[data-install]') : null;
    if (!installButton || installButton.disabled) return;

    event.preventDefault();
    requestInstall(installButton.dataset.install);
  });

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

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && search) {
      event.preventDefault();
      search.focus();
    }

    if (event.key === 'Escape' && dialog && dialog.open && typeof dialog.close === 'function') {
      dialog.close();
    }
  });

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
