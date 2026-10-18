# Guardian — first conversation and voice preview

Preview path: /talk/ on the dedicated Guardian Private Vault Cloudflare Worker.

## Working now

The interface uses the same origin and encrypted OPFS/IndexedDB memory as Private Vault. Unlock with the existing passphrase. Each completed text exchange is saved as a Markdown record encrypted through the existing Vault.save method, and can be exported or forgotten via the vault UI. Clearing the *chat view* doesn't erase encrypted records.

Voice input uses the browser's optional Web Speech Recognition interface when available. It asks for explicit informed consent before the microphone activates because some browser providers send audio to their speech recognition servers. Guardian does not save raw audio. Voice output currently uses speechSynthesis voices provided by the browser or operating system. Typing always works, regardless of speech support.

The replies are explicitly marked **local, rule-based preview**, NOT an AI model. No API, external JavaScript, telemetry, voice models, payments or cloud memory have been connected.

## Future Tortoise integration

[Tortoise TTS](https://github.com/neonbjb/tortoise-tts) is an Apache-2.0 multi-voice *synthesis* model, not speech recognition. It cannot run as a static asset on Cloudflare Workers; it needs Python, model weights and substantial computing resources, ideally a supported GPU. A later optional authenticated same-origin TTS gateway can synthesize a message, deliver an audio response and fall back to browser speech. Don't expose an unauthenticated synthesis endpoint, store user's browser session, or claim Tortoise works before it has been deployed and measured.

Avoid voice imitation without permission. Any off-device text processing needs an opt-in privacy disclosure.

## Hosting

The existing private Worker has root directory `private`, build command empty, deploy command `npx wrangler deploy`, and static assets `./`. This subdirectory needs no new Worker, API key or database. Security review is still required before private or sensitive real-world data.
