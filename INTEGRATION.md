# DNS Browser Apps — integration notes

## Current website-side hook

The Install buttons call this temporary JavaScript host contract when it exists:

```js
window.dnsBrowserApp.installNewTabTheme({
  id: 'theme-id',
  name: 'Theme name',
  category: 'Anime'
});
```

Until the CefSharp application exposes that object, the page shows an informational message. It does not fake a successful installation.

## Expected final flow

1. DNS Browser opens `https://dnsbrowserapp.github.io/` in its CefSharp browser.
2. The application exposes a narrowly scoped JavaScript object using CefSharp's JavaScript binding mechanism.
3. The user selects a theme and clicks Install.
4. The website sends a theme identifier and validated manifest URL or package metadata to the host.
5. DNS Browser validates the trusted catalogue origin and theme manifest, downloads the theme assets, checks file types and size limits, and stores them in an application-managed themes directory.
6. DNS Browser updates the selected-theme setting in `My.Settings`, persists it, and refreshes the NewPageUI.

## Security and compatibility

- Do not let the website pass arbitrary local paths or arbitrary executable content to the host.
- The host should use an allowlisted HTTPS origin and validate theme IDs, manifest URLs, content types, file size, and image dimensions.
- Keep the exposed JavaScript API limited to theme installation and status reporting; do not expose general filesystem or process access.
- A user-agent token can help display an unsupported-browser page, but it can be spoofed. The host-side bridge is the reliable capability check.
- The website's `?preview=1` parameter is intended only for design review and must not be treated as an authentication or security mechanism.
- Apply a theme only after all files pass validation and the download completes successfully. Preserve the previously selected theme if installation fails.

## Next files needed

Review the DNS Browser CefSharp `webuin` control and the NewPageUI code to determine:

- how the current New Tab background is loaded and updated;
- the exact `My.Settings` key and persistence pattern;
- how to register and bind the JavaScript host object;
- how to download and safely store theme assets;
- how to refresh an already-open New Tab page.
