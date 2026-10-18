# Guardian — More room for what matters

A premium, responsive landing page introducing **Guardian**, a planned intelligent personal companion app. This is a polished **coming soon / product vision** website, not a functioning AI service.

## Experience

- Interactive glass globe with simplified Natural Earth geographic outlines (public-domain dataset), drag / touch / keyboard rotation and contextual capability cards.
- Living Guardian character with cursor-following eyes, soft blush, blinks, idle glances, happy and surprised reactions, and sleep behavior.
- Editorial scroll storytelling with three real-life scenarios and a synchronized visual demonstration.
- Four interactive mobile-app concept screens: Today, Learn, Explore, Memory.
- Responsive layouts, accessible navigation and button labels, reduced-motion support.
- No tracking SDKs, third-party JavaScript, paid libraries, or build step. Uses vanilla HTML, CSS and JavaScript.

## Run locally

From the repository root:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Deploy using GitHub Pages

Repo: `https://github.com/askorza/guardian-website`

In Settings → Pages, deploy from `main` → `/(root)`. After commits to `main`, GitHub Pages automatically deploys to:

`https://askorza.github.io/guardian-website/`

This is static hosting. Animations, globe, storytelling and app-preview tabs work on GitHub Pages. **The waitlist form does not save submissions on GitHub Pages.** It transparently reports that signups are not yet available.

## Working waitlist (optional future setup)

`functions/api/waitlist.js` is a Cloudflare Pages Function requiring a D1 database bound under the variable name `DB`. The table schema is in `schema.sql`. Deploy using Cloudflare Pages, create/bind the D1 database and apply the schema before accepting real signup emails. Publish a privacy notice and add abuse prevention and unsubscribe handling before collecting or emailing subscribers. GitHub Pages does not run serverless functions.

## About product claims

All shown app screens, assistant replies, personal memory and tutoring behavior are **illustrative planned capabilities**, not an integrated AI model or promises of results. The page uses no fabricated testimonials, performance metrics, user counts or affiliations.
## Encrypted Private Vault beta

A separate-origin, client-side encrypted prototype is in [`private/`](private/README.md). It is intended for its own free Cloudflare Pages `*.pages.dev` site (build output directory: `private`), **not** for use on the shared `github.io` marketing origin. The vault uses browser-side AES-256-GCM encryption and requires a user passphrase; encrypted notes stay on-device. It is experimental and not independently security-audited. It has no AI model or cloud sync. See [`private/privacy.html`](private/privacy.html) and the [deployment instructions](private/README.md).

