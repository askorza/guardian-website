# Guardian — Local-first MVP architecture (proposal)

**Status:** design proposal / partial local-memory proof-of-concept, **not** a claim that the full companion app exists.

## Product promise

**Guardian remembers what matters. You decide what stays.**

Guardian's default memory should live on the user's device, be portable as Markdown, and be deletable by category, source, timeframe, or individual memory. AI processing and cloud synchronization are separately opt-in capabilities. “Local-first” means **local storage**, not automatically **local inference**.

## MVP (first release)

1. Browser-based app / installable PWA with a few useful workflows: chat, “Plan my day”, and “Explain / quiz me”.
2. Local conversation transcript records and selected long-term memories. Make “Save to memory” explicit first. Extracting suggestions for memories can use the AI model, but no suggested memory is saved without consent until the user enables auto-memory.
3. Markdown portability. Write or export every response and user-authored note as `.md`; use a compact on-disk index for quick search. Avoid summarizing *every message into separate long-term memory*; derive memory from useful facts and projects to avoid noise and API spend.
4. Source-reference records for images/documents, including SHA-256 hash when practical; **never claim re-access without permission**. No automatic file duplication into a cloud account. A user can explicitly opt into storing a copy for portability.
5. Memory Center UI: show what was kept and why; filter by project, source, type, category, and date; **Forget** and bulk forget; export full or partial archive.
6. One inexpensive model provider to start, with task-specific routing, spend caps, abuse protection, and usage-based limits. Do not promise 100% free inference for a commercial service.
7. Paid tier later: opt-in encrypted cloud backup and multi-device sync; optional stronger model limits.

## High-level data flow

```text
User browser/PWA
 ├── Markdown store (OPFS where available)
 ├── Fast index (IndexedDB or SQLite-WASM, local)
 ├── Local media source refs (handle when supported; fallback re-select)
 ├── Review / Forget / Export control
 └── UI selects relevant local context (not entire history)
         │
         │ HTTPS request only when AI needed, with explicit remote-processing notice
         ▼
Small backend gateway (Cloudflare Worker)
 ├── Auth + per-user rate limit + budget control
 ├── Model router (cheap model default, premium escalation)
 ├── No persistent prompts by default; redacted error logging
 └── Hosted model (provider retention/settings must be verified)
         │
         ▼
     Response → user's local `.md` store and UI
```

**Note:** “no server storage” is not the same as “no external processing.” A hosted model receives transmitted inputs. We must disclose subprocessors, choose settings/terms that fit our privacy promises, and avoid automatic sensitive-content extraction. Use a separate opt-in for images and personal documents.

## Storage strategy

| Data | MVP storage | Rationale |
|---|---|---|
| User messages / AI replies | Markdown, local OPFS; optional export bundle | Portable canonical format |
| Curated long-term memory | Separate Markdown notes, plus local index | Small, inspectable, selective recall |
| Full-text search metadata | IndexedDB / SQLite-WASM, rebuildable from `.md` | Search performance without another cloud DB |
| Original photos / documents | User's original files; only reference metadata, hash, description, tags | No duplicate bytes by default |
| Media analysis | Optional derived Markdown explanation; may be processed remotely only after informed consent | Saves space, respects source ownership |
| Server metadata | Minimal auth/billing/usage only | Cost control and legal/account lifecycle |
| Optional cloud sync | Client-side encrypted objects, opt-in paid feature | Multi-device functionality |

Do not assume a browser can remember arbitrary files by path. User-visible file handles require browser support and permission; Safari/mobile compatibility varies. For a pure web app use OPFS for reliably written Markdown, and make `.md`/ZIP export a prominent feature. Browser storage may be evicted or erased by clearing site data; offer manual backup and consider installable native shells if users need dependable physical files. An OPFS file is **not** a file visible in Finder/Files without export.

### Example memory file

```markdown
---
id: mem_01KEXAMPLE
category: study
project: calculus-homework
created_at: 2026-10-18T12:00:00Z
source_refs:
  - sha256:examplehash
consent: user-approved
expires_at: null
---

I learn faster with diagrams and practice questions.

## Why saved
User explicitly chose “Remember this.”
```

### Conversation file

```markdown
---
conversation_id: c_01KEXAMPLE
created_at: 2026-10-18T12:00:00Z
model: provider-model
remote_processing: true
---

## User
Help me create a revision plan.

## Guardian
Let's start with three realistic blocks...
```

Image references should record filename, size, MIME type, SHA-256 if practical, local-handle availability, analysis consent, and any user-approved descriptive summary; **not** the raw image in Markdown. This is a tradeoff: without retaining an image copy, the image cannot be reanalyzed if the user moves or deletes it or revokes access.

## Forgetting semantics (privacy contract)

Deleting a memory must remove its canonical `.md`, entries in local indexes, embeddings, cached text, and any linked summaries that reproduce the forgotten fact. Cloud-synced copies and backups (if enabled later) need a deletion protocol and retention windows. Simply deleting one `.md` while a summary still contains the fact is *not* complete forgetting. Distinguish **forget locally**, **stop using as context**, and **delete remote backups** in UX. An external LLM provider's prior processing is not retroactively erasable by deleting a local record; provider retention policies apply.

## Low-cost initial stack

- **Static frontend:** current GitHub Pages landing page; web application can run there for prototype or on Cloudflare Pages.
- **Client:** plain TypeScript / Vite when growing; prototype intentionally has no framework and no dependencies.
- **Local storage:** OPFS `.md` + local search index; IndexedDB fallback and clear export/backup messaging.
- **Gateway:** Cloudflare Worker with per-user spend caps and server-side API keys.
- **AI:** compare paid low-cost models (and acceptable free development tiers) by quality/cost/privacy; route requests by complexity. Free-tier rate limits are typically shared at project level. **Do not embed provider API keys in browser JavaScript.**
- **Operations:** D1 for usage/auth metadata if needed, not the user's full history. Usage monitoring and abuse/rate limits are mandatory before public beta.
- **Search & memory:** simple lexical/recency relevance first. Add embeddings only when product tests show a need.
- **Payments:** subscriptions once retention and unit economics justify it.

## Milestones / acceptance tests

**Prototype** (current Lab): local notes saved and deleted, category forgetting, Markdown export, optional file-reference metadata, no network calls or AI. Browser OPFS/IndexedDB behavior verified on desktop and mobile.

**Closed beta:** actual chat and study/plan flows, explicit memory approval, local transcripts exported as Markdown, backend spending and security controls, provider privacy review, accessibility and cross-browser tests.

**Paid beta:** reliability, billing, opt-in encrypted sync, account recovery, documented privacy policy, retention and deletion controls, trial-to-paid conversion data.

## External references

- MDN OPFS: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
- MDN quotas/eviction: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- Cloudflare Workers: https://developers.cloudflare.com/workers/platform/pricing/
- D1: https://developers.cloudflare.com/d1/platform/pricing/
- Groq free limits: https://console.groq.com/docs/rate-limits
- Gemini API: https://ai.google.dev/gemini-api/docs/pricing
- OpenRouter free model limits: https://openrouter.ai/pricing
- API listing, **verify providers independently**: https://github.com/OuterSpacee/free-ai-apis