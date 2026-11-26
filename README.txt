DNS Browser Apps — Store UI Fix

Files:
- assets/js/app-store.js: complete replacement. Removes the broken leftover fragment which caused a parse-time syntax error and prevented all store interactions from initializing. Also makes the theme preview dialog reuse the card artwork.
- INDEX-HEAD-SCRIPT.txt: replacement inline browser detection script for index.html. Restores the ?preview=1 development preview bypass. Preview bypass only shows the store UI; install still requires the CefSharp PostMessage bridge.

Upload steps:
1. Replace assets/js/app-store.js in dnsbrowserapp/dnsbrowserapp.github.io with the file in this package.
2. Replace the current inline detection script in index.html with the script in INDEX-HEAD-SCRIPT.txt.
3. Change the app-store.js script reference to assets/js/app-store.js?v=5 to bust the cached broken script.
4. Commit to main and wait for GitHub Pages deployment.
5. In DNS Browser, open https://dnsbrowserapp.github.io/?preview=1 to test card previews, category filters and search. Then open the URL without ?preview=1 to test the actual CefSharp bridge.

Expected:
- Clicking the preview artwork opens the modal and shows the card artwork.
- Search and category filters work.
- Clicking Install in a normal browser preview shows “Installation is available inside DNS Browser.”
- Clicking Install inside DNS Browser sends { type: 'dnsbrowser_install_theme', themeId: '<id>' } using CefSharp.PostMessage.

Note:
Only Lavender Quiet currently exists in themes/catalog.json, so it is the only published downloadable theme. The other cards remain design/demo items until their assets and catalogue hashes are published.
