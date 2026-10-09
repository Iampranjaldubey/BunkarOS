# Bunkar OS — isolated TTS engine (`server/tts/`)

Hindi voice-slip audio generation for SPEC-015 (C9). This folder is a **separate,
optional component** with its **own `package.json`** and dependency.

## Why it is isolated

The speech engine is **[`espeak-ng`](https://www.npmjs.com/package/espeak-ng)
`1.0.2`** (eSpeak-NG compiled to WASM), licensed **GPL-3.0-or-later**. The main
Bunkar OS server is deliberately **zero-dependency** (`node:http` + `node:sqlite`
+ `node:crypto`) and MIT-spirited, so the GPL engine lives here, in its own
folder, is installed separately, and is invoked as a **child process**
(`node server/tts/synth.mjs`) — never `import`ed by the server. If this folder is
not installed, the server still runs; the slip-audio route simply returns
`503 {error:'tts_unavailable'}` and the public slip page falls back to on-device
`speechSynthesis`.

## Install

```bash
cd server/tts
npm ci          # installs espeak-ng@1.0.2 (pinned exact)
```

`npm ci` requires the committed `package-lock.json`. First time (no lock yet):

```bash
cd server/tts
npm install
```

## Use

`synth.mjs` reads UTF-8 text on **stdin** and writes a **mono 11025 Hz 16-bit PCM
WAV** on **stdout** using the Hindi voice (`-v hi`) at a slightly slow rate
(`-s 130`) for clarity, capped at 60 s:

```bash
echo -n 'नमस्ते, आपकी मजदूरी तैयार है।' | node synth.mjs > slip.wav
```

Exit `0` with a WAV on stdout on success; exit `1` with a short reason on stderr
and nothing on stdout on failure (missing engine, empty text, synthesis error).

The server wrapper `server/slip-audio.mjs` spawns this with a 10 s timeout and a
60 s audio cap, caches the result per slip token, and maps any
failure/timeout/missing-engine to `503 tts_unavailable`.

## License

- `espeak-ng` and the generated audio data: **GPL-3.0-or-later** (see the engine's
  bundled `LICENSE`). Because it is run as a separate process and not linked into
  the server, the server's own licensing is unaffected.
