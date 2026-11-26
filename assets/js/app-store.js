(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  const search = $('#theme-search');
  const filterContainer = $('#theme-filters');
  const grid = $('#theme-grid');
  const empty = $('#empty-state');
  const loading = $('#catalog-loading');
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

  const themes = new Map();
  let activeFilter = 'all';
  let toastTimer = 0;
  let pendingInstallId = null;

  function categoryKey(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function safeThemeImageUrl(theme) {
    try {
      const url = new URL(theme.imageUrl, window.location.href);
      const expectedPrefix = `/themes/${theme.id}/`;
      if (url.protocol !== 'https:' || url.hostname !== 'dnsbrowserapp.github.io' || !url.pathname.startsWith(expectedPrefix)) return '';
      return url.href;
    } catch (_) {
      return '';
    }
  }

  function showToast(message, type = 'info', themeId = null) {
    if (!toast) {
      console.info('[DNS STORE]', message);
      return;
    }

    const theme = themeId ? themes.get(themeId) : null;
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

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderFilters() {
    if (!filterContainer) return;
    const categories = [...new Set([...themes.values()].map(theme => theme.category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    filterContainer.replaceChildren();
    const addFilter = (label, value) => {
      const button = makeElement('button', 'filter-chip' + (activeFilter === value ? ' active' : ''), label);
      button.type = 'button';
      button.dataset.filter = value;
      button.setAttribute('aria-pressed', String(activeFilter === value));
      button.addEventListener('click', () => {
        activeFilter = value;
        renderFilters();
        filterThemes();
      });
      filterContainer.appendChild(button);
    };

    addFilter('All themes', 'all');
    categories.forEach(category => addFilter(category, categoryKey(category)));
  }

  function renderThemeCard(theme) {
    const card = makeElement('article', 'theme-card');
    card.dataset.category = categoryKey(theme.category);
    card.dataset.search = `${theme.title} ${theme.category} ${theme.description}`.toLowerCase();

    const preview = makeElement('button', 'theme-preview has-theme-image');
    preview.type = 'button';
    preview.dataset.preview = theme.id;
    preview.setAttribute('aria-label', `Preview ${theme.title} theme`);

    const image = makeElement('img', 'theme-card-image');
    image.src = theme.imageUrl;
    image.alt = `${theme.title} wallpaper`;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      image.remove();
      preview.classList.add('theme-image-unavailable');
      const fallback = makeElement('span', 'theme-image-fallback', 'Preview unavailable');
      preview.appendChild(fallback);
    }, { once: true });

    const label = makeElement('span', 'preview-label', 'WALLPAPER PREVIEW');
    preview.append(image, label);

    const info = makeElement('div', 'theme-info');
    const titleRow = makeElement('div', 'theme-title-row');
    titleRow.append(makeElement('h3', '', theme.title), makeElement('span', 'theme-kind', theme.category));
    const description = makeElement('p', '', theme.description || 'A custom New Tab wallpaper for DNS Browser.');
    const bottom = makeElement('div', 'theme-bottom');
    bottom.appendChild(makeElement('span', 'theme-status theme-status-available', 'Available now'));
    const install = makeElement('button', 'text-button', 'Install →');
    install.type = 'button';
    install.dataset.install = theme.id;
    bottom.appendChild(install);
    info.append(titleRow, description, bottom);
    card.append(preview, info);
    return card;
  }

  function renderThemes() {
    if (!grid) return;
    grid.replaceChildren();
    const sorted = [...themes.values()].sort((a, b) => a.title.localeCompare(b.title));
    sorted.forEach(theme => grid.appendChild(renderThemeCard(theme)));
    renderFilters();
    filterThemes();
  }

  function filterThemes() {
    if (!grid || !empty) return;
    const query = search ? search.value.trim().toLowerCase() : '';
    let visibleCount = 0;

    $$('.theme-card').forEach(card => {
      const categoryMatch = activeFilter === 'all' || card.dataset.category === activeFilter;
      const searchableText = `${card.dataset.search || ''} ${card.textContent || ''}`.toLowerCase();
      const searchMatch = !query || searchableText.includes(query);
      const visible = categoryMatch && searchMatch;
      card.hidden = !visible;
      if (visible) visibleCount++;
    });

    grid.hidden = visibleCount === 0;
    empty.hidden = visibleCount !== 0;
    if (visibleCount === 0 && themes.size === 0) {
      const title = empty.querySelector('h3');
      const description = empty.querySelector('p');
      if (title) title.textContent = 'No themes published yet';
      if (description) description.textContent = 'New wallpapers will appear here when they are published.';
    } else if (empty) {
      const title = empty.querySelector('h3');
      const description = empty.querySelector('p');
      if (title) title.textContent = 'No themes found';
      if (description) description.textContent = 'Try another search or choose a different category.';
    }
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
        button.innerHTML = state === 'installed' ? 'Installed ✓' : button.dataset.originalHtml;
      }
    });
  }

  function openPreview(id) {
    const theme = themes.get(id);
    if (!theme || !dialog || !dialogArt || !dialogTitle || !dialogDescription || !dialogInstall) return;

    dialogTitle.textContent = theme.title;
    dialogDescription.textContent = theme.description || 'A custom New Tab wallpaper for DNS Browser.';
    dialogInstall.dataset.install = id;
    dialogArt.replaceChildren();
    dialogArt.className = 'dialog-art dialog-art-real';

    const image = makeElement('img');
    image.src = theme.imageUrl;
    image.alt = `${theme.title} wallpaper preview`;
    image.loading = 'eager';
    image.decoding = 'async';
    dialogArt.appendChild(image);

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
      dialog.style.display = 'block';
    }
  }

  function requestInstall(id) {
    const theme = themes.get(id);
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
      showToast('Open this store inside DNS Browser to install themes.', 'error');
      return;
    }

    try {
      pendingInstallId = id;
      updateInstallButtons(id, 'busy');
      showToast('Downloading ' + theme.title + '…', 'info');
      bridge.PostMessage({ type: 'dnsbrowser_install_theme', themeId: id });
    } catch (error) {
      console.error('[DNS STORE] PostMessage failed:', error);
      updateInstallButtons(id, 'idle');
      pendingInstallId = null;
      showToast('Could not communicate with DNS Browser. Please try again.', 'error');
    }
  }

  async function loadCatalog() {
    try {
      const response = await fetch(`themes/catalog.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Catalogue request failed (${response.status}).`);
      const data = await response.json();
      if (!data || !Array.isArray(data.themes)) throw new Error('The catalogue format is invalid.');

      themes.clear();
      data.themes.forEach(raw => {
        if (!raw || typeof raw.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.id)) return;
        const imageUrl = safeThemeImageUrl(raw);
        if (!imageUrl || !raw.name || !raw.category) return;
        themes.set(raw.id, {
          id: raw.id,
          title: String(raw.name).slice(0, 80),
          category: String(raw.category).slice(0, 30),
          description: String(raw.description || 'A custom New Tab wallpaper for DNS Browser.').slice(0, 500),
          imageUrl
        });
      });

      if (loading) loading.hidden = true;
      renderThemes();
    } catch (error) {
      console.error('[DNS STORE] Catalogue load failed:', error);
      if (loading) {
        loading.hidden = false;
        loading.textContent = 'Could not load the theme catalogue. Please refresh the page.';
      }
      if (empty) empty.hidden = true;
      if (grid) grid.hidden = true;
      showToast('Could not load themes. Check your connection and refresh.', 'error');
    }
  }

  // Native CefSharp confirmation arrives only after download + settings save.
  window.addEventListener('dnsbrowser-theme-install-result', event => {
    const result = event.detail || {};
    const themeId = (typeof result.themeId === 'string' && result.themeId) || pendingInstallId;
    const succeeded = result.success === true;

    if (pendingInstallId) updateInstallButtons(pendingInstallId, succeeded ? 'installed' : 'idle');
    if (themeId && themeId !== pendingInstallId) updateInstallButtons(themeId, succeeded ? 'installed' : 'idle');
    pendingInstallId = null;

    if (succeeded) {
      if (dialog && dialog.open && typeof dialog.close === 'function') dialog.close();
      const theme = themeId ? themes.get(themeId) : null;
      showToast(theme ? `${theme.title} is now your new tab background.` : (result.message || 'Your new tab theme is ready.'), 'success', themeId);
    } else {
      showToast(result.message || 'The theme could not be installed. Check your connection and try again.', 'error');
    }
  });

  if (search) search.addEventListener('input', filterThemes);

  const clearFilters = $('#clear-filters');
  if (clearFilters) {
    clearFilters.addEventListener('click', () => {
      if (search) search.value = '';
      activeFilter = 'all';
      renderFilters();
      filterThemes();
      if (search) search.focus();
    });
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const previewButton = target.closest('[data-preview]');
    if (previewButton) {
      openPreview(previewButton.dataset.preview);
      return;
    }
    const installButton = target.closest('[data-install]');
    if (installButton && !installButton.disabled) {
      event.preventDefault();
      requestInstall(installButton.dataset.install);
    }
  });

  if (toastClose) {
    toastClose.addEventListener('click', () => {
      window.clearTimeout(toastTimer);
      if (toast) toast.classList.remove('show');
    });
  }

  if (dialog) {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
    });
  }

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && search) {
      event.preventDefault();
      search.focus();
    }
    if (event.key === 'Escape' && dialog && dialog.open && typeof dialog.close === 'function') dialog.close();
  });

  const mobileMenu = $('.mobile-menu');
  if (mobileMenu) $$('.mobile-menu a').forEach(link => link.addEventListener('click', () => mobileMenu.removeAttribute('open')));

  loadCatalog();
  console.info('[DNS STORE] Dynamic theme catalogue initialized.');
})();
