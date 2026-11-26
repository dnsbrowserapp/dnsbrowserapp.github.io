# DNS Browser Apps

GitHub Pages website for the DNS Browser Apps catalogue.

- **Live site:** https://dnsbrowserapp.github.io/
- **Repository:** https://github.com/dnsbrowserapp/dnsbrowserapp.github.io
- **Publisher:** Miveyo / DNS Browser

## Current status

The first website version contains a responsive New Tab Themes catalogue, sample theme previews, search and category filters, a browser support screen, and an explanation of the planned installation flow.

The listed themes are design placeholders, not downloadable theme packages. Install buttons intentionally display a message until the desktop integration is implemented.

## Browser preview

The site is intended to be opened inside DNS Browser. To review the layout in an ordinary browser during development, use:

https://dnsbrowserapp.github.io/?preview=1

The `preview=1` query is only a design-review bypass. It is not a security boundary. The user-agent check is also a presentation check, not strong authentication. The final host integration should expose a dedicated CefSharp JavaScript object and verify the browser-side operation in the desktop application.

## Deployment

Upload the contents of this folder to the repository root on the `main` branch. GitHub Pages should be configured to deploy from `main` and `/ (root)`.

See `INTEGRATION.md` for the planned website-to-browser contract.
