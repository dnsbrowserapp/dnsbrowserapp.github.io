const encoder = new TextEncoder();
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_CATEGORIES = new Set(['Anime', 'Minimal', 'Nature', 'Abstract', 'Gaming', 'Dark', 'Aesthetic', 'Other']);

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (origin && origin !== env.ALLOWED_ORIGIN) return new Response('Origin not allowed.', { status: 403 });

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/login' && request.method === 'POST') {
        return await handleLogin(request, env, origin);
      }

      if (url.pathname === '/api/catalog' && request.method === 'GET') {
        const { catalog } = await readCatalog(env);
        return jsonResponse(catalog, 200, origin, env, { 'Cache-Control': 'no-store' });
      }

      if (url.pathname === '/api/themes' && request.method === 'POST') {
        if (!(await isAuthorized(request, env))) return jsonResponse({ error: 'Your admin session expired. Please sign in again.' }, 401, origin, env);
        const result = await saveTheme(request, env);
        return jsonResponse(result, 200, origin, env);
      }

      const deleteMatch = url.pathname.match(/^\/api\/themes\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
      if (deleteMatch && request.method === 'DELETE') {
        if (!(await isAuthorized(request, env))) return jsonResponse({ error: 'Your admin session expired. Please sign in again.' }, 401, origin, env);
        const result = await removeTheme(deleteMatch[1], env);
        return jsonResponse(result, 200, origin, env);
      }

      return jsonResponse({ error: 'Not found.' }, 404, origin, env);
    } catch (error) {
      console.error('[theme-admin]', error && error.stack ? error.stack : error);
      return jsonResponse({ error: error instanceof Error ? error.message : 'The request failed.' }, 500, origin, env);
    }
  }
};

function corsHeaders(origin, env) {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  });
  if (origin && origin === env.ALLOWED_ORIGIN) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function jsonResponse(value, status, origin, env, extraHeaders = {}) {
  const headers = corsHeaders(origin, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  for (const [key, val] of Object.entries(extraHeaders)) headers.set(key, val);
  return new Response(JSON.stringify(value), { status, headers });
}

async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function constantTimePasswordMatch(entered, configured) {
  if (typeof entered !== 'string' || typeof configured !== 'string' || !configured) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(entered)),
    crypto.subtle.digest('SHA-256', encoder.encode(configured))
  ]);
  const aa = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function signPayload(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function handleLogin(request, env, origin) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || !env.GITHUB_TOKEN) {
    return jsonResponse({ error: 'Admin service is not configured. Add its Cloudflare secrets first.' }, 503, origin, env);
  }
  const body = await request.json().catch(() => null);
  if (!body || !(await constantTimePasswordMatch(body.password, env.ADMIN_PASSWORD))) {
    return jsonResponse({ error: 'Incorrect admin password.' }, 401, origin, env);
  }
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({ sub: 'dns-theme-admin', exp: expiresAt })));
  const signature = await signPayload(payload, env.SESSION_SECRET);
  return jsonResponse({ token: `${payload}.${signature}`, expiresAt }, 200, origin, env);
}

async function isAuthorized(request, env) {
  if (!env.SESSION_SECRET) return false;
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice(7);
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  try {
    const expected = await signPayload(parts[0], env.SESSION_SECRET);
    const a = encoder.encode(expected);
    const b = encoder.encode(parts[1]);
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    if (diff !== 0) return false;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0])));
    return payload.sub === 'dns-theme-admin' && Number(payload.exp) > Date.now();
  } catch (_) {
    return false;
  }
}

function githubHeaders(env) {
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'DNS-Browser-Theme-Admin'
  };
}

function githubPath(path) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

async function githubRequest(path, env, init = {}) {
  const headers = new Headers(githubHeaders(env));
  if (init.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}${path}`, { ...init, headers });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { message: raw.slice(0, 500) }; }
  if (!response.ok) {
    const detail = data.message || `GitHub returned ${response.status}.`;
    throw new Error(`Repository operation failed: ${detail}`);
  }
  return data;
}

function decodeGitHubText(content) {
  const compact = String(content || '').replace(/\s/g, '');
  const binary = atob(compact);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeGitHubContent(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function getGitHubFile(path, env) {
  const ref = encodeURIComponent(env.GITHUB_BRANCH || 'main');
  try {
    return await githubRequest(`/contents/${githubPath(path)}?ref=${ref}`, env);
  } catch (error) {
    if (String(error.message).includes('Not Found')) return null;
    throw error;
  }
}

async function readCatalog(env) {
  const file = await getGitHubFile('themes/catalog.json', env);
  if (!file || !file.content) throw new Error('themes/catalog.json could not be read.');
  const catalog = JSON.parse(decodeGitHubText(file.content));
  if (!catalog || !Array.isArray(catalog.themes)) throw new Error('The theme catalogue JSON is invalid.');
  return { sha: file.sha, catalog };
}

async function putGitHubFile(path, bytes, message, env, sha = null) {
  const body = {
    message,
    content: encodeGitHubContent(bytes),
    branch: env.GITHUB_BRANCH || 'main'
  };
  if (sha) body.sha = sha;
  return githubRequest(`/contents/${githubPath(path)}`, env, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function deleteGitHubFile(path, message, env) {
  const file = await getGitHubFile(path, env);
  if (!file || !file.sha) return false;
  await githubRequest(`/contents/${githubPath(path)}`, env, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha: file.sha, branch: env.GITHUB_BRANCH || 'main' })
  });
  return true;
}

function oldAssetPath(imageUrl, id, env) {
  try {
    const url = new URL(imageUrl);
    const baseHost = new URL(env.GITHUB_PAGES_BASE).hostname;
    if (url.protocol !== 'https:' || url.hostname !== baseHost) return null;
    const path = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!path.startsWith(`themes/${id}/`) || !/^themes\/[a-z0-9-]+\/[a-zA-Z0-9._-]+$/.test(path)) return null;
    return path;
  } catch (_) {
    return null;
  }
}

function validateSlug(value) {
  return typeof value === 'string' && value.length >= 2 && value.length <= 48 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function validateImage(file) {
  if (!file || file.size <= 0) throw new Error('Choose a wallpaper image.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be 15 MB or smaller.');
  if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Only PNG and JPEG images are supported.');
}

async function saveTheme(request, env) {
  const form = await request.formData();
  const id = String(form.get('id') || '').trim();
  const name = String(form.get('name') || '').trim();
  const category = String(form.get('category') || '').trim();
  const description = String(form.get('description') || '').trim();
  const image = form.get('image');

  if (!validateSlug(id)) throw new Error('Theme ID must use lowercase letters, numbers and hyphens (2–48 characters).');
  if (name.length < 2 || name.length > 80) throw new Error('Theme name must be between 2 and 80 characters.');
  if (!ALLOWED_CATEGORIES.has(category)) throw new Error('Choose a supported theme category.');
  if (!description || description.length > 500) throw new Error('Description is required and must be 500 characters or fewer.');

  const { sha: catalogSha, catalog } = await readCatalog(env);
  const existingIndex = catalog.themes.findIndex(theme => theme && theme.id === id);
  const previous = existingIndex >= 0 ? catalog.themes[existingIndex] : null;
  const hasImage = image && typeof image.arrayBuffer === 'function' && image.size > 0;

  if (!previous && !hasImage) throw new Error('A wallpaper image is required for a new theme.');

  let imageUrl = previous ? previous.imageUrl : '';
  let imageHash = previous ? previous.sha256 : '';
  let newAssetPath = null;
  let previousAssetPath = previous ? oldAssetPath(previous.imageUrl, id, env) : null;

  if (hasImage) {
    validateImage(image);
    const bytes = new Uint8Array(await image.arrayBuffer());
    const isPng = image.type === 'image/png' && bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    const isJpeg = image.type === 'image/jpeg' && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!isPng && !isJpeg) throw new Error('The file extension and image contents do not match.');

    imageHash = await sha256Hex(bytes);
    const extension = isPng ? 'png' : 'jpg';
    newAssetPath = `themes/${id}/background-${imageHash.slice(0, 16)}.${extension}`;
    const alreadyUploaded = await getGitHubFile(newAssetPath, env);
    if (!alreadyUploaded) {
      await putGitHubFile(newAssetPath, bytes, `${previous ? 'Replace' : 'Add'} ${name} theme wallpaper`, env);
    }
    imageUrl = `${env.GITHUB_PAGES_BASE.replace(/\/$/, '')}/${newAssetPath}`;
  }

  if (!imageUrl || !imageHash) throw new Error('This theme has no valid published wallpaper.');

  const entry = { id, name, category, description, imageUrl, sha256: imageHash };
  if (existingIndex >= 0) catalog.themes[existingIndex] = entry;
  else catalog.themes.push(entry);
  catalog.schemaVersion = 1;

  try {
    const catalogBytes = encoder.encode(JSON.stringify(catalog, null, 2) + '\n');
    await putGitHubFile('themes/catalog.json', catalogBytes, `${previous ? 'Update' : 'Publish'} theme: ${name}`, env, catalogSha);
  } catch (error) {
    // The old catalogue still points to its old immutable image URL, so it remains usable.
    if (newAssetPath && newAssetPath !== previousAssetPath) {
      try { await deleteGitHubFile(newAssetPath, `Clean up unpublished asset for ${name}`, env); } catch (_) { /* Leave an orphaned asset rather than hiding the original error. */ }
    }
    throw error;
  }

  // Delete old immutable wallpaper only after the catalogue points at the new file.
  if (newAssetPath && previousAssetPath && previousAssetPath !== newAssetPath) {
    try { await deleteGitHubFile(previousAssetPath, `Remove old wallpaper for ${name}`, env); }
    catch (error) { console.warn('[theme-admin] Old wallpaper cleanup failed:', error); }
  }

  return { ok: true, theme: entry, message: previous ? `${name} updated successfully.` : `${name} published successfully.` };
}

async function removeTheme(id, env) {
  const { sha: catalogSha, catalog } = await readCatalog(env);
  const index = catalog.themes.findIndex(theme => theme && theme.id === id);
  if (index < 0) throw new Error('That theme is not in the catalogue.');
  const [removed] = catalog.themes.splice(index, 1);
  const assetPath = oldAssetPath(removed.imageUrl, id, env);
  catalog.schemaVersion = 1;
  const bytes = encoder.encode(JSON.stringify(catalog, null, 2) + '\n');
  await putGitHubFile('themes/catalog.json', bytes, `Remove theme: ${removed.name}`, env, catalogSha);

  let assetDeleted = true;
  if (assetPath) {
    try { await deleteGitHubFile(assetPath, `Delete wallpaper for ${removed.name}`, env); }
    catch (error) {
      assetDeleted = false;
      console.warn('[theme-admin] Wallpaper cleanup failed:', error);
    }
  }
  return {
    ok: true,
    message: assetDeleted ? `${removed.name} removed.` : `${removed.name} removed from the catalogue; its old image file could not be cleaned up.`
  };
}
