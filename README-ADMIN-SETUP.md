# DNS Browser Theme Admin — setup

This package adds a password-protected theme manager at `/admin/` and makes the public store read `themes/catalog.json` dynamically.

## What's included

- `index.html` — current store page, updated to load theme cards from the catalogue and includes an Admin link.
- `assets/js/app-store.js` — dynamic store renderer; keeps the existing CefSharp install bridge and confirmation toast.
- `assets/css/app-store-ui.css` — retains the existing store additions and adds loading states.
- `themes/catalog.json` — existing Lavender Quiet entry, with a description added.
- `admin/` — password login, theme list, add/edit/delete form, image preview.
- `cloudflare-worker/` — backend that verifies the password and performs GitHub repository commits using a token stored as a Cloudflare secret.

## Important security note

GitHub Pages is static hosting. A password embedded in `admin.js`, HTML, or any other public file is not private and can be read or bypassed. This package does **not** embed the password you supplied in the chat. The password is checked by the Cloudflare Worker and stored as a Cloudflare secret. The GitHub token is also stored only as a Cloudflare secret and is never sent to the admin page.

Use a fresh, unique admin password in Cloudflare rather than reusing a personal/account password. The admin session token stays in browser memory and expires after 8 hours.

## 1. Upload the website files to GitHub Pages

Copy only the website files into the root of `dnsbrowserapp/dnsbrowserapp.github.io`, preserving folders: replace `index.html`, `assets/js/app-store.js`, `assets/css/app-store-ui.css`, and `themes/catalog.json`, and add the new `admin/` folder. Keep the existing `assets/css/app-store.css` and `themes/lavender/background.png` unchanged.

Keep the `cloudflare-worker/` folder somewhere local for deployment; it does not need to be uploaded to GitHub Pages. Commit and push the website files to `main`.

## 2. Create a least-privilege GitHub token

Create a **fine-grained personal access token** for the `dnsbrowserapp` owner:

- Repository access: only `dnsbrowserapp.github.io`.
- Repository permissions: `Contents` = Read and write. `Metadata` is read-only.
- Add an expiry. Do not paste this token into the website or commit it.

The Worker uses this token to upload wallpaper files and update `themes/catalog.json`.

## 3. Deploy the Cloudflare Worker

Install Node.js if it is not already installed. Open PowerShell in the `cloudflare-worker` folder:

```powershell
npx wrangler login
npx wrangler deploy
```

The deploy output includes a URL similar to:

`https://dnsbrowser-theme-admin.YOUR-SUBDOMAIN.workers.dev`

Now add the three secrets. Each command prompts for the value; paste it into the prompt, not into a source file:

```powershell
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

For `GITHUB_TOKEN`, paste the fine-grained token from step 2. For `ADMIN_PASSWORD`, set a new unique password for this admin page. For `SESSION_SECRET`, use a separate random secret (at least 32 random bytes). Cloudflare stores these as Worker secrets, not as public variables. `wrangler secret put` deploys a new Worker version when each secret is added.

Cloudflare secret documentation: https://developers.cloudflare.com/workers/configuration/secrets/

## 4. Connect the admin page to your Worker

Open `admin/index.html` and replace the placeholder value in this line with the actual Worker URL printed by Wrangler:

```html
<meta name="dns-theme-admin-api" content="https://REPLACE-WITH-YOUR-WORKER.workers.dev">
```

Commit and push that change. Then visit:

`https://dnsbrowserapp.github.io/admin/`

Sign in with the `ADMIN_PASSWORD` you configured in Cloudflare.

## 5. Add a theme

Fill in the theme name, ID, category, description, and choose a PNG or JPEG wallpaper (maximum 15 MB). Click **Publish theme**. The Worker uploads the wallpaper to `themes/<id>/`, computes its SHA-256 digest, and updates `themes/catalog.json` in a GitHub commit. The public store automatically renders entries from that catalogue.

Editing a theme updates its metadata. Uploading a replacement wallpaper stores it under a new immutable filename first, switches the catalogue entry, then attempts to remove the old image. Removing a theme deletes it from the catalogue before cleaning up its image file.

## Categories

Anime, Minimal, Nature, Abstract, Gaming, Dark, Aesthetic, Other.

## Notes

- The admin page is public as a URL, but its write API requires the Worker-issued signed session token.
- The Worker only accepts browser requests from `https://dnsbrowserapp.github.io` (CORS allowlist).
- The password and GitHub token are never stored in localStorage or repository files.
- The Worker currently allows PNG/JPEG images up to 15 MB. This is below the DNS Browser download service's 20 MB ceiling.
- For production, add a Cloudflare rate-limit rule for `POST /api/login` to reduce password-guessing attempts.
- GitHub Pages and its CDN may take a little time to show a new catalogue/image after a commit.
