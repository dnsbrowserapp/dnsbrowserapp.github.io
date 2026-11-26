(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const API_BASE = (document.querySelector('meta[name="dns-theme-admin-api"]')?.content || '').replace(/\/$/, '');
  const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

  const loginScreen = $('#login-screen');
  const dashboard = $('#dashboard');
  const loginForm = $('#login-form');
  const loginPassword = $('#admin-password');
  const loginButton = $('#login-button');
  const loginError = $('#login-error');
  const themeForm = $('#theme-form');
  const themeList = $('#theme-list');
  const themeCount = $('#theme-count');
  const themeName = $('#theme-name');
  const themeId = $('#theme-id');
  const themeCategory = $('#theme-category');
  const themeDescription = $('#theme-description');
  const themeImage = $('#theme-image');
  const imagePreviewWrap = $('#image-preview-wrap');
  const imagePreview = $('#image-preview');
  const imagePreviewName = $('#image-preview-name');
  const imagePreviewSize = $('#image-preview-size');
  const imageRequiredLabel = $('#image-required-label');
  const editorHeading = $('#editor-heading');
  const editorMode = $('#editor-mode');
  const saveButton = $('#save-theme-button');
  const formStatus = $('#form-status');
  const descriptionCount = $('#description-count');
  const toast = $('#admin-toast');
  const deleteDialog = $('#delete-dialog');
  const deleteDescription = $('#delete-description');
  const confirmDelete = $('#confirm-delete');

  let sessionToken = null;
  let currentThemes = [];
  let editingId = null;
  let pendingDeleteId = null;
  let previewObjectUrl = null;

  function showToast(message, type = '') {
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 4200);
  }

  function setFormStatus(message, type = '') {
    formStatus.textContent = message;
    formStatus.className = 'form-status' + (type ? ' ' + type : '');
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function imageUrlIsTrusted(value, id) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'dnsbrowserapp.github.io' && url.pathname.startsWith(`/themes/${id}/`);
    } catch (_) {
      return false;
    }
  }

  async function api(path, options = {}) {
    if (!API_BASE || API_BASE.includes('REPLACE-WITH-YOUR-WORKER')) {
      throw new Error('Set the Cloudflare Worker URL in admin/index.html before using the dashboard.');
    }
    const headers = new Headers(options.headers || {});
    if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`);
    const response = await fetch(API_BASE + path, { ...options, headers });
    let data = {};
    try { data = await response.json(); } catch (_) { /* non-JSON response */ }
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }

  async function login(password) {
    const response = await fetch(API_BASE + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Invalid password.');
    if (!data.token) throw new Error('The authentication service returned no session token.');
    return data.token;
  }

  function showDashboard() {
    loginScreen.hidden = true;
    dashboard.hidden = false;
  }

  function showLogin() {
    sessionToken = null;
    dashboard.hidden = true;
    loginScreen.hidden = false;
    loginPassword.value = '';
    loginPassword.focus();
  }

  function resetForm() {
    themeForm.reset();
    editingId = null;
    delete themeId.dataset.userEdited;
    themeId.disabled = false;
    editorHeading.textContent = 'Add a new theme';
    editorMode.textContent = 'NEW THEME';
    imageRequiredLabel.textContent = 'Required';
    saveButton.innerHTML = 'Publish theme <span>→</span>';
    setFormStatus('');
    updateDescriptionCount();
    clearImagePreview();
  }

  function clearImagePreview(clearInput = true) {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
    imagePreview.removeAttribute('src');
    imagePreviewWrap.hidden = true;
    if (clearInput) themeImage.value = '';
  }

  function updateDescriptionCount() {
    descriptionCount.textContent = String(themeDescription.value.length);
  }

  function selectedImagePreview(file) {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      themeImage.value = '';
      showToast('Choose a PNG or JPEG image.', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      themeImage.value = '';
      showToast('Image must be 15 MB or smaller.', 'error');
      return;
    }
    clearImagePreview(false);
    previewObjectUrl = URL.createObjectURL(file);
    imagePreview.src = previewObjectUrl;
    imagePreviewName.textContent = file.name;
    imagePreviewSize.textContent = formatBytes(file.size);
    imagePreviewWrap.hidden = false;
  }

  function renderThemes() {
    themeList.replaceChildren();
    currentThemes = Array.isArray(currentThemes) ? currentThemes : [];
    themeCount.textContent = `${currentThemes.length} ${currentThemes.length === 1 ? 'theme' : 'themes'}`;

    if (!currentThemes.length) {
      const empty = document.createElement('div');
      empty.className = 'list-empty';
      empty.textContent = 'No themes published yet. Add your first wallpaper using the form.';
      themeList.appendChild(empty);
      return;
    }

    currentThemes.forEach(theme => {
      const row = document.createElement('article');
      row.className = 'theme-row';
      const image = document.createElement('img');
      image.src = imageUrlIsTrusted(theme.imageUrl, theme.id) ? theme.imageUrl : '';
      image.alt = `${theme.name} wallpaper`;
      const copy = document.createElement('div');
      copy.className = 'theme-row-copy';
      const name = document.createElement('strong');
      name.textContent = theme.name;
      const meta = document.createElement('small');
      meta.textContent = `${theme.category} · ${theme.id}`;
      copy.append(name, meta);
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      const edit = document.createElement('button');
      edit.type = 'button'; edit.title = 'Edit theme'; edit.setAttribute('aria-label', `Edit ${theme.name}`); edit.textContent = '✎';
      edit.addEventListener('click', () => editTheme(theme.id));
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'remove-theme'; remove.title = 'Remove theme'; remove.setAttribute('aria-label', `Remove ${theme.name}`); remove.textContent = '×';
      remove.addEventListener('click', () => askDelete(theme));
      actions.append(edit, remove);
      row.append(image, copy, actions);
      themeList.appendChild(row);
    });
  }

  async function loadThemes() {
    themeList.innerHTML = '<div class="list-loading">Refreshing catalogue…</div>';
    const data = await api('/api/catalog', { method: 'GET', cache: 'no-store' });
    currentThemes = Array.isArray(data.themes) ? data.themes : [];
    renderThemes();
  }

  function editTheme(id) {
    const theme = currentThemes.find(item => item.id === id);
    if (!theme) return;
    resetForm();
    editingId = id;
    themeName.value = theme.name || '';
    themeId.value = theme.id || '';
    themeId.disabled = true;
    themeCategory.value = theme.category || 'Other';
    themeDescription.value = theme.description || '';
    editorHeading.textContent = 'Edit theme';
    editorMode.textContent = 'EDITING';
    imageRequiredLabel.textContent = 'Optional · leave blank to keep current wallpaper';
    saveButton.innerHTML = 'Save changes <span>→</span>';
    if (theme.imageUrl && imageUrlIsTrusted(theme.imageUrl, theme.id)) {
      imagePreview.src = theme.imageUrl;
      imagePreviewName.textContent = 'Current wallpaper';
      imagePreviewSize.textContent = 'Upload a new image to replace it';
      imagePreviewWrap.hidden = false;
    }
    updateDescriptionCount();
    setFormStatus('Editing an existing theme. You can update its details or replace the wallpaper.');
    themeName.focus();
  }

  function askDelete(theme) {
    pendingDeleteId = theme.id;
    deleteDescription.textContent = `“${theme.name}” will be removed from the public catalogue and its wallpaper file will be deleted from the repository.`;
    if (typeof deleteDialog.showModal === 'function') deleteDialog.showModal();
    else if (window.confirm(`Remove ${theme.name}?`)) performDelete();
  }

  async function performDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    confirmDelete.disabled = true;
    confirmDelete.textContent = 'Removing…';
    try {
      await api('/api/themes/' + encodeURIComponent(id), { method: 'DELETE' });
      if (deleteDialog.open) deleteDialog.close();
      showToast('Theme removed from the catalogue.', 'success');
      if (editingId === id) resetForm();
      pendingDeleteId = null;
      await loadThemes();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      confirmDelete.disabled = false;
      confirmDelete.textContent = 'Remove theme';
    }
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginError.hidden = true;
    if (!API_BASE || API_BASE.includes('REPLACE-WITH-YOUR-WORKER')) {
      loginError.textContent = 'The admin API is not configured yet. Set the Worker URL in admin/index.html.';
      loginError.hidden = false;
      return;
    }
    loginButton.disabled = true;
    loginButton.textContent = 'Verifying…';
    try {
      sessionToken = await login(loginPassword.value);
      loginPassword.value = '';
      showDashboard();
      await loadThemes();
    } catch (error) {
      sessionToken = null;
      loginError.textContent = error.message;
      loginError.hidden = false;
    } finally {
      loginButton.disabled = false;
      loginButton.innerHTML = 'Unlock dashboard <span>→</span>';
    }
  });

  themeName.addEventListener('input', () => {
    if (!editingId && !themeId.dataset.userEdited) {
      themeId.value = themeName.value.toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48);
    }
  });
  themeId.addEventListener('input', () => { themeId.dataset.userEdited = 'true'; });
  themeDescription.addEventListener('input', updateDescriptionCount);
  themeImage.addEventListener('change', () => selectedImagePreview(themeImage.files?.[0]));
  $('#clear-image-button').addEventListener('click', clearImagePreview);
  $('#reset-form-button').addEventListener('click', resetForm);

  themeForm.addEventListener('submit', async event => {
    event.preventDefault();
    const file = themeImage.files?.[0] || null;
    if (!editingId && !file) {
      setFormStatus('Choose a wallpaper image before publishing a new theme.', 'error');
      return;
    }
    if (file && (!['image/png', 'image/jpeg'].includes(file.type) || file.size > MAX_IMAGE_BYTES)) {
      setFormStatus('Use a PNG or JPEG image up to 15 MB.', 'error');
      return;
    }

    const form = new FormData();
    form.set('id', themeId.value.trim());
    form.set('name', themeName.value.trim());
    form.set('category', themeCategory.value);
    form.set('description', themeDescription.value.trim());
    if (file) form.set('image', file, file.name);

    saveButton.disabled = true;
    saveButton.textContent = file ? 'Uploading wallpaper…' : 'Saving details…';
    setFormStatus('Uploading and committing changes to the theme repository…');
    try {
      const result = await api('/api/themes', { method: 'POST', body: form });
      setFormStatus(result.message || 'Theme published successfully.', 'success');
      showToast(result.message || 'Theme published successfully.', 'success');
      resetForm();
      await loadThemes();
    } catch (error) {
      setFormStatus(error.message, 'error');
      showToast(error.message, 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.innerHTML = editingId ? 'Save changes <span>→</span>' : 'Publish theme <span>→</span>';
    }
  });

  $('#refresh-button').addEventListener('click', async () => {
    try { await loadThemes(); showToast('Catalogue refreshed.', 'success'); }
    catch (error) { showToast(error.message, 'error'); }
  });

  $('#logout-button').addEventListener('click', () => {
    sessionToken = null;
    currentThemes = [];
    resetForm();
    showLogin();
  });

  $('#cancel-delete').addEventListener('click', () => {
    pendingDeleteId = null;
    if (deleteDialog.open) deleteDialog.close();
  });
  confirmDelete.addEventListener('click', performDelete);
  deleteDialog.addEventListener('click', event => {
    if (event.target === deleteDialog) {
      pendingDeleteId = null;
      deleteDialog.close();
    }
  });

  window.addEventListener('beforeunload', () => {
    sessionToken = null;
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  });
})();
