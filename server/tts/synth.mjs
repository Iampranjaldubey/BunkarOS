// Bunkar OS — isolated Hindi TTS synth (SPEC-015 C9).
//
// Reads UTF-8 text on stdin, writes a mono 11025 Hz 16-bit PCM WAV on stdout
// using the espeak-ng WASM Hindi voice ('hi') at a slightly slow rate for
// clarity. GPL-3.0 engine, kept out of the zero-dependency server and run as a
// SEPARATE process (`node server/tts/synth.mjs`) so the server never links it.
//
// Exit codes: 0 ok (WAV on stdout) · 1 engine/synthesis failure (nothing on
// stdout). The caller (server/slip-audio.mjs) treats a non-zero exit, a crash,
// or a timeout as `tts_unavailable` (503).
import process from 'node:process';

const SPEAK_RATE = 130;       // words/min — slightly slow for low-literacy clarity
const OUT_RATE = 11025;       // target sample rate (Hz), mono 16-bit
const MAX_SECONDS = 60;       // SPEC-015: clip ≤ 60 s

/** Read all of stdin as a UTF-8 string. */
function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

/** Parse a canonical PCM WAV buffer → { sampleRate, channels, bits, samples:Int16Array }. */
function parseWav(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length < 44) throw new Error('wav_too_small');
  if (String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) !== 'RIFF') throw new Error('not_riff');
  // Walk chunks to find fmt + data (espeak emits a canonical header, but be safe).
  let offset = 12;
  let sampleRate = 22050;
  let channels = 1;
  let bits = 16;
  let dataOffset = -1;
  let dataLen = 0;
  while (offset + 8 <= buf.length) {
    const id = String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
    const size = dv.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = dv.getUint16(body + 2, true);
      sampleRate = dv.getUint32(body + 4, true);
      bits = dv.getUint16(body + 14, true);
    } else if (id === 'data') {
      dataOffset = body;
      dataLen = size;
    }
    offset = body + size + (size % 2); // chunks are word-aligned
  }
  if (dataOffset < 0) throw new Error('no_data_chunk');
  const sampleCount = Math.floor(Math.min(dataLen, buf.length - dataOffset) / 2);
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) samples[i] = dv.getInt16(dataOffset + i * 2, true);
  return { sampleRate, channels, bits, samples };
}

/** Downsample mono Int16 samples to targetRate by averaging windows (anti-alias-ish). */
function resampleMono(samples, srcRate, targetRate) {
  if (srcRate === targetRate) return samples;
  const ratio = srcRate / targetRate;
  const outLen = Math.floor(samples.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let n = 0;
    for (let j = start; j < end; j++) { sum += samples[j]; n++; }
    out[i] = n > 0 ? Math.max(-32768, Math.min(32767, Math.round(sum / n))) : 0;
  }
  return out;
}

/** Wrap mono Int16 samples in a canonical PCM WAV at the given sample rate. */
function buildWav(samples, sampleRate) {
  const dataLen = samples.length * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);          // fmt chunk size
  buf.writeUInt16LE(1, 20);           // PCM
  buf.writeUInt16LE(1, 22);           // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate (mono 16-bit)
  buf.writeUInt16LE(2, 32);           // block align
  buf.writeUInt16LE(16, 34);          // bits per sample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(samples[i], 44 + i * 2);
  return buf;
}

async function main() {
  const text = (await readStdin()).trim();
  if (!text) { process.stderr.write('empty_text\n'); process.exit(1); }

  // espeak-ng is a GPL-3.0 WASM CLI; load it lazily so a missing install fails
  // cleanly (caught below) rather than at module top-level.
  const { default: ESpeakNg } = await import('espeak-ng');
  const mod = await ESpeakNg({
    arguments: ['-v', 'hi', '-s', String(SPEAK_RATE), '-w', 'out.wav', text],
    print: () => {},
    printErr: () => {},
  });
  const raw = Buffer.from(mod.FS.readFile('out.wav'));
  const { sampleRate, samples } = parseWav(raw);

  let mono = resampleMono(samples, sampleRate, OUT_RATE);
  // Cap at MAX_SECONDS of audio.
  const maxSamples = OUT_RATE * MAX_SECONDS;
  if (mono.length > maxSamples) mono = mono.subarray(0, maxSamples);

  const wav = buildWav(mono, OUT_RATE);
  process.stdout.write(wav);
}

main().catch((err) => {
  process.stderr.write(`tts_error: ${err && err.message ? err.message : err}\n`);
  process.exit(1);
});
