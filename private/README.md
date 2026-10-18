# Guardian Private Vault (encrypted beta)

A small client-side encrypted memory vault. **Experimental; not independently security-audited.** Not a live AI assistant, and not a substitute for a password manager or encrypted drive.

## Free, isolated HTTPS site on Cloudflare Pages

We cannot safely use the existing `https://askorza.github.io/guardian-website/` origin for personal data, because other projects on the same GitHub Pages host may share its origin.

The repository includes the encrypted app in `private/`. To make an isolated site using **Cloudflare Pages**:

1. Sign in at https://dash.cloudflare.com (a free plan is sufficient for this static site).
2. Open **Workers & Pages → Create → Pages → Connect to Git**.
3. Connect GitHub and select the repository `askorza/guardian-website`.
4. Choose an available Cloudflare Pages project name, e.g. `guardian-vault-beta` (the specific name and URL are not guaranteed available).
5. Set **Production branch:** `main`. **Framework preset:** None. **Build command:** leave empty. **Build output directory:** `private`. **Root directory:** repository root (leave default). Save and deploy.
6. Confirm HTTPS is active and the site shows the encryption vault at the root `https://<your-selected-name>.pages.dev/`. Use the URL Cloudflare actually assigns; don't guess it.
7. In the Cloudflare Dashboard, confirm the HTTP response headers in `private/_headers` are applied (CSP, anti-embedding, no-sniff, no-referrer, HSTS). Use a real browser/DevTools to check. No custom domain is needed; Pages provides a free HTTPS subdomain.

The app **intentionally disables access on `*.github.io`** so visitors can't accidentally use the private vault on the marketing origin. The older `/lab/` prototype on GitHub Pages does **not** have this encryption; don't use it for private information.

### No secrets or deployment tokens

The vault needs no API keys, database credentials or server-side storage. It makes **zero application network requests**. Hosting the HTML/JS/CSS necessarily requires normal requests to Cloudflare, and the host can have connection logs. HTTPS protects bytes in transit; browser-side encryption protects saved memories at rest.

## User capabilities

- Set a device-only passphrase (12–256 characters), unlock/lock, 10-minute inactivity lock.
- PBKDF2-SHA-256 with 400,000 iterations and a random 128-bit salt derives a non-extractable AES-256-GCM key.
- Unique 96-bit nonce per encrypted Markdown record with authenticated record ID (AES-GCM AAD).
- OPFS keeps one `.md.enc` record per memory on supported browsers; encrypted IndexedDB fallback where OPFS is unavailable.
- Original media files are not copied. Their filenames, sizes and optional SHA-256 fingerprints are saved inside the encrypted record. Re-access requires choosing the file again.
- Filter/delete by category or individual memory, or remove all records; encrypted backup export/import with original passphrase.
- Plaintext Markdown export only after explicit confirmation. Treat it as sensitive.

## Privacy and safety limitations

- The passphrase is **not recoverable**. Browser data may be deleted/evicted. Create an encrypted backup and remember your passphrase.
- Locked memory is encrypted at rest, but active content is plaintext while unlocked and could be seen by malicious extensions, malware, injected scripts, compromised devices or the user themselves.
- This is not hardened against physical forensic recovery of erased flash cells, compromised browser backups, or previously downloaded plaintext files. Deleting a record is not forensic secure erasure.
- OPFS storage is **not** a file in Finder / Files until exported. Original file references aren't persistent file access permissions.
- Encryption code has not undergone an external cryptographic or penetration audit. Use test data only until security review.
- No AI analysis, cloud backups, cloud sync, account login or payment is present. Any future hosted inference will require separate opt-in and a clear provider privacy policy.
- A static site must be served from a **dedicated origin with its own trusted scripts**. Never add third-party analytics, tag managers, untrusted widgets or remote JavaScript to this vault.
- CSP headers can help reduce XSS, but cannot prevent all malicious JavaScript if the served site itself is compromised.
- The free hosting subdomain is not a commercial trademark clearance or registered domain owned by Guardian.

## Testing

- `node --check` for `vault-core.js` and `vault-app.js`.
- Real `crypto.webcrypto` Node test (separate test harness) exercised encrypt/decrypt, wrong-password rejection, Markdown roundtrip, lock, delete and backup restore. No plaintext was present in the stored encrypted record payloads.
- Chromium screenshot/layout checks at 390px and 1440px found no horizontal overflow.
- Mocked-browser UI checks exercised create, save, encrypted backup, category delete and lock at desktop and mobile widths.
- The sandbox prevented direct HTTPS URL navigation; **a fully deployed, live-domain cross-browser security/compatibility test is still required**.

See [`privacy.html`](privacy.html) for the concise public-facing privacy notice.
