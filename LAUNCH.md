# Cloudflare Pages launch

Build command: `npm run build`. Output directory: `dist`. Node: 22.12 or newer.
Use the project directory as the build root. No Functions or server runtime is needed.
Keep the default Pages SPA fallback (no top-level 404.html): real `/TEAM/YEAR/index.html` pages serve route-specific social metadata; other URLs recover in the app.

No custom domain is required. `CF_PAGES_URL` supplies absolute social-image/canonical URLs during a Pages build. Set `VITE_SITE_URL` to the final stable pages.dev or custom URL when known. Team/year remain the only URL state.

Google Analytics: set `VITE_GA_MEASUREMENT_ID` to the GA4 web-stream measurement ID and rebuild. Blank means no analytics script or outbound analytics requests. Disable automatic page/history measurement and enhanced measurement in the GA property; this app sends explicit `season_view`, `team_change`, `season_change`, `play_season_start`, `play_season_complete`, `touchdown_select`, `type_filter`, `theme_toggle`, and `help_open` events. Payloads are team/year and relevant type, source play ID, or theme only. Ad features are disabled, consent defaults deny storage, and Do Not Track disables the adapter. Cookieless GA measurement does not provide persistent-user/session analysis. Verify delivery in GA after supplying the real measurement ID.

Run every `test:*` script, then `npm run build` and `npm run preview`. Preview the production app at port 4173. No lint configuration currently exists; TypeScript strict checking is part of the build.

Cloudflare routing: https://developers.cloudflare.com/pages/configuration/serving-pages/
GA manual page measurements: https://developers.google.com/analytics/devguides/collection/ga4/views
