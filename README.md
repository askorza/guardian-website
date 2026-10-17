# Guardian — Coming Soon

Responsive, premium landing page for **Guardian**, a future personal AI assistant. Ivory / ecru visual language, rotatable 3D-projected globe, cursor-tracking robotic eyes, capabilities that change as the globe rotates, illustrative chat demo, mobile navigation, and a waitlist form wired to a real endpoint.

## Features

- No paid library or build step required. HTML, CSS and vanilla JavaScript.
- Interactive canvas-rendered sphere with simplified public-domain Natural Earth coastline data, drag + keyboard arrow + touch and on-screen arrow controls.
- Guardian's robotic eyes track the cursor, blink, smile on hover, look surprised when clicked, and drift to sleep after inactivity. Animated cloud companion responds to the illustrative dialogue. Reduced-motion preferences respected.
- Responsive desktop and mobile design, accessible labels and keyboard controls.
- Illustrated feature cards and click-to-switch example chat interactions. **This is a marketing preview, not a live AI assistant.**
- Cloudflare Pages Function endpoint `/api/waitlist`, storing deduplicated emails in a D1 database **once configured**.
- No tracking SDK and no analytics by default.

## Preview locally

Serve the folder from a local HTTP server:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. Globe and other interactions work without any server-side setup. The email signup **will not work** until a Cloudflare D1 database and Pages Function are deployed.


## Launch on GitHub Pages (static preview)

This is the quickest **free public demo** for `askorza/guardian-website`:

1. Go to **https://github.com/askorza/guardian-website/settings/pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **main**, then **/(root)**, and click **Save**.
4. Once deployed, visit **https://askorza.github.io/guardian-website/** (it may take several minutes).

GitHub Pages only serves static files: the globe, animations and illustrative conversations work, but the **waitlist does not accept signups on GitHub Pages**. For working signups, use Cloudflare Pages + D1 as below or integrate another backend. The form deliberately reports that signups are not live when no backend exists.

## Publish using GitHub + Cloudflare Pages

1. Create a GitHub repository and push the complete contents of this folder.
2. In Cloudflare Dashboard → **Workers & Pages** → create a Pages project → connect your GitHub repo.
3. Build command: **none**. Build output directory: `/` (root of your repository). Leave the root directory unchanged.
4. In Cloudflare D1, create a database named e.g. `guardian-waitlist`.
5. Run the statements in `schema.sql` using the D1 console (or Wrangler).
6. In the Pages project under Settings → Bindings, add a D1 binding with variable name **DB** pointing to `guardian-waitlist`. Redeploy.
7. Test the email submission; it should return an HTTP 200 JSON `{"ok":true}` and store the email in the `waitlist` table.

Cloudflare Pages should automatically deploy the `functions/api/waitlist.js` serverless function at `/api/waitlist` when deploying a repository project. For a local function preview, use Wrangler Pages development with a D1 binding.

## Before a public launch

- Replace `hello@example.com` footer placeholder with your real contact address and publish a privacy notice covering email collection, retention, and erasure requests.
- Consider Cloudflare Turnstile and rate limiting to protect against fake signups.
- Configure an email marketing provider to deliver updates and unsubscribe handling before sending any marketing email.
- Consider social image PNG generation for platforms that don't support SVG Open Graph images.
- Get a domain name and connect it to the Cloudflare Pages project.

## License and credits

The globe includes simplified Natural Earth public-domain coastal outlines. The site was prepared as a working marketing prototype; copy describes planned product capabilities rather than implying a finished AI service.