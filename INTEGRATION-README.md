# DNS Browser Apps — theme installer integration (v2)

This package is an integration patch, not a compiled change to your VB.NET project. Apply the snippets in the order below. The store catalogue cards are still sample entries until real theme images and matching hashes are published.

## 1. Add settings

In Project Properties → Settings, add `newtabthemeid` (String, User, default `default`) and `newtabthemeimagepath` (String, User, empty). See `My.Settings.txt`.

## 2. Add ThemeStoreService.vb

Add the supplied class to the DNS Browser project. It downloads the official JSON catalogue, accepts only HTTPS files hosted on `dnsbrowserapp.github.io` below `/themes/`, enforces PNG/JPEG content types and size/dimension limits, checks SHA-256, then stores the image under `%LOCALAPPDATA%\DNS Browser\Themes\<theme-id>`. It never accepts a local file path or image URL from the page.

## 3. Patch newpageui.vb

Use `newpageui-theme.patch.vb`. Add the fields/methods inside `newpageui`, subscribe to `ThemeStoreService.ThemeInstalled` in `newpageui_Load`, and call `ApplySavedThemeBackground()` at the very end of `newpageui_Load`. The supplied patch makes `Panel1`, `PictureBox1`, `PictureBox2`, `FlowLayoutPanel1`, and `Label1` transparent. Shortcut tiles and `Panel2` stay white. No Designer layout coordinates need to change.

## 4. Patch webuin.vb

Use `webuin-JavascriptMessageReceived.patch.vb`. Change the existing handler to `Async Sub`, then insert the message branch immediately after `eventType` is read. Add the helper methods inside `webuin`. Preserve the current video and login detection code. The event validates the main frame and exact HTTPS store host before accepting the ID.

## 5. Update the website

- Copy `assets/js/app-store.js` over the website's `assets/js/app-store.js`.
- Replace the inline user-agent check in `index.html` with `support-detection-script.html`.
- Publish `themes/catalog.json` using `themes/catalog.example.json` as a template.
- Publish each real theme image under `/themes/<id>/background.png` or `.jpg`.
- Replace the example SHA-256 with the actual SHA-256 hash of the uploaded image bytes.

The four existing catalogue cards are presentation samples. The matching image assets and catalogue entries do not exist yet, so pressing Install will fail safely until you publish real theme files.

## 6. How live refresh works

After successful download and settings save, `ThemeStoreService.NotifyThemeInstalled()` raises a shared event. Every open `newpageui` instance subscribed to it reloads the new wallpaper. New tabs and later browser launches also load the path from `My.Settings`.

## 7. Test checklist

1. Compile after adding settings and `ThemeStoreService.vb`.
2. Apply the `newpageui` and `webuin` patches; compile again.
3. Publish one real theme image and a matching catalogue entry/hash.
4. Open `https://dnsbrowserapp.github.io/` in DNS Browser 3.0.
5. Press Install and verify the website's result message.
6. Open a new tab and verify the background.
7. Keep an existing New Tab open during install and verify it refreshes too.
8. Restart DNS Browser and verify the theme persists.

## Security notes

The unsupported-browser page is a compatibility screen, not access control. A static GitHub Pages site cannot stop direct HTTP requests. The trust boundary is the native browser handler: it checks the message's main-frame HTTPS origin, accepts only a theme ID, downloads only from the fixed official catalogue and allowed theme path, validates image bytes and verifies the catalogue checksum.
