DNS Browser Apps — Ready-to-upload Theme Store UI files
========================================================

This package contains the actual finished files. There is no PowerShell script.

Copy/extract these paths into the ROOT of your existing dnsbrowserapp.github.io repository:

  index.html                         REPLACE the existing file
  assets/js/app-store.js             REPLACE the existing file
  assets/css/app-store-ui.css        ADD this new file

Do not delete or replace your existing assets/css/app-store.css. The new stylesheet is
loaded after it and contains only the extra preview/toast styles.

What changed:
- Lavender Quiet uses the real themes/lavender/background.png image in the card and dialog.
- The install notification has a success/error state, theme name, thumbnail and close button.
- The install buttons show Installing… and then Installed ✓ only after the browser sends
  the dnsbrowser-theme-install-result event.
- The three unpublished sample themes are marked Preview only / Coming soon and cannot
  accidentally be sent to DNS Browser for installation.
- ?preview=1 displays the website outside DNS Browser for visual testing only; it does not
  emulate or enable the CefSharp installation bridge.

The existing catalog image remains at themes/lavender/background.png and is not included
in this package. Keep your existing themes folder and themes/catalog.json.

After uploading, hard-refresh the site (Ctrl+F5). Test an actual install from inside
DNS Browser 3.0, because a normal browser can preview the page but cannot install themes.
