# Installable mobile website

## Research and decision — 2026-09-21

Use the existing Next.js storefront as a Progressive Web App (PWA). Customers
install from their browser and launch from their home screen in a standalone
window. The website and installed app share the same deployment and backend.
No store submission, separate native codebase, or new database is needed.

Sources:
- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps): App Router manifest and service-worker integration.
- [MDN installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable): HTTPS, manifest, 192/512 icons and standalone display.
- [MDN install prompt](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event): optional browser event; never assume availability.
- [Apple installation](https://support.apple.com/en-za/guide/iphone/iphea86e5236/ios): Safari Share, Add to Home Screen, Open as Web App where shown, Add.

## Implementation plan

1. Generate the manifest from shared business content. Stable ID `/`, launch
   `/`, scope `/`, standalone display, existing cream/forest palette. Produce
   192 and 512 PNG icons, a maskable icon and a 180px Apple touch icon from the
   existing logo artwork.
2. Register a production-only service worker. Cache only a self-contained
   offline document. Pass APIs, POSTs, assets and cross-origin traffic through.
   Never cache catalogue HTML, account pages, orders or checkout responses.
   Do not queue transactions or force a refresh while a customer is checking out.
3. Add `/install` and a footer link. Capture the optional install event at the
   storefront shell so navigation does not lose it. Show a button only when
   supported, handle dismissal/errors, and show manual Android/iPhone steps.
   Recognize standalone mode and completed installation.
4. Respect bottom safe areas without covering the existing mobile navigation.
5. Run TypeScript, production build, worker behavior tests and HTTP checks.
   Check the installation page at phone size where browser tooling permits.

## Release checks

Local checks: `npx tsc --noEmit`, `npm run build`, and
`node --test scripts/test-pwa.mjs`. Icon assets can be regenerated with
`node scripts/generate-pwa-icons.mjs` (uses Sharp bundled with Next.js).
With the production server running, use `node scripts/check-pwa-http.mjs`
(optionally pass its origin as the first argument) to verify served assets.
Use a separate local port for each project: browser workers are scoped to
origins, so reusing another project's port can serve its old offline screen.
The worker handles full document navigations; Next.js client navigation and
already-open pages still depend on their normal network/error behavior.

- Deploy on the canonical HTTPS domain after owner authorization.
- Android Chrome: open site, install from page or browser menu, confirm icon,
  standalone home launch, navigation and account/cart behavior.
- iPhone Safari: Share > Add to Home Screen; enable Open as Web App if shown;
  Add, then launch and check navigation and home-indicator spacing.
- After an online visit, disconnect and reload: offline screen, no stale order
  confirmation. Reconnect and retry. Also check existing-tab client navigation.
- Release another version: reopen app and confirm updated content without a
  forced mid-checkout reload. Browser storage/login may differ from the original
  browser session; do not promise session or cart transfer on installation.

## Boundaries

Browsing, login and ordering require internet. No push notifications, offline
checkout, app-store distribution or new payment processing in this change.
The Panama implementation is not present in this checkout; this plan uses the
requested installation behavior without assuming its implementation details.
