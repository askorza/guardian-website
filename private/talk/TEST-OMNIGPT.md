# Guardian × OmniGPT Gateway — experimental local integration

This adapter is **not an official ChatGPT API integration**, and is for private prototyping only. [OmniGPT Gateway](https://github.com/zxevil11/OmniGPT-Gateway) uses browser automation of subscription chat sites; this is brittle and may violate service terms. **Do not connect paying customers, share account cookies, or deploy the gateway to Cloudflare.**

## 1. Start the local test gateway on your computer

Install and start OmniGPT Gateway using **its own documentation**. It must be responding locally at `http://127.0.0.1:8000/healthz`; the integration cannot work until that separate application runs and has a functioning browser session. Never paste your session tokens or passwords into Guardian or this repository.

## 2. Start Guardian's pairing bridge

Download `test-bridge.py` from this repository to your Mac. In Terminal, run:

```bash
OMNIGPT_TOKEN=dummy123 python3 test-bridge.py
```

Set `OMNIGPT_TOKEN` to the **local OmniGPT gateway's token** if you changed it; it is read only by the local Python process and is never sent to the Guardian website. The script binds **only to `127.0.0.1:8787`**, requires an exact Cloudflare Origin, and prints a random **one-time pairing code**.

## 3. Pair in Guardian Talk

Open `https://guardian-private-vault.skorzaartur.workers.dev/talk/`, unlock the encrypted vault and expand **Test AI connection**. Paste the bridge **pairing code**, choose **Connect local AI** and let the browser connect to loopback if prompted. This temporary code is kept in **tab memory only** and is cleared by locking or leaving the page. If successful, Guardian sends your prompts to the local bridge, which forwards them to OmniGPT; the text answer returns to Guardian and is encrypted as Markdown in your existing vault.

**Privacy:** Your prompts (and optionally a *small selection of memories* if you explicitly check the box) are sent to the gateway and ultimately to whichever web AI service it uses. That provider and OmniGPT may retain conversations or logs. This is not local-only AI processing. Do not send sensitive personal data. The uploaded code contains no passwords or ChatGPT cookies.

## Troubleshooting

- **Bridge unreachable / CORS / Local Network Access:** make sure the Python bridge runs on the **same Mac and in the same browser** as Guardian. Chrome might request permission to connect to a local companion service. Browser implementations differ; public HTTPS pages may not be permitted to access `http://127.0.0.1` even when the service is running. If blocked, use a localhost-hosted development copy or a properly authenticated secure endpoint rather than exposing the gateway publicly.
- **503 or gateway offline:** check the OmniGPT service separately. The bridge can't launch it.
- **Invalid pairing:** restart the bridge to print a new code and pair again.
- **No AI model connected:** without a paired running bridge, Guardian intentionally keeps its clearly labelled, local example responses.
- **Provider terms:** do not use web subscription automation as your product's permanent API. Switch to a supported provider for release.

No Cloudflare secrets, remote tunnels, or permanent public proxy are required for this test. Guardian's encrypted vault records remain stored under the same Cloudflare site origin.