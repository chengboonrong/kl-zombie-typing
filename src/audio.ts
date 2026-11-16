let ctx: AudioContext | null = null;
let out: GainNode;
let noise: AudioBuffer;

// Must be called from a user gesture.
export function initAudio() {
  if (ctx) { void ctx.resume(); return; }
  ctx = new AudioContext();
  out = ctx.createGain();
  out.gain.value = 0.5;
  out.connect(ctx.createDynamicsCompressor()).connect(ctx.destination); // layers stack without clipping
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function env(vol: number, t: number, dur: number) {
  const g = ctx!.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  g.connect(out);
  return g;
}

function hiss(vol: number, dur: number, freq: number, type: BiquadFilterType = 'lowpass', at = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  src.connect(f).connect(env(vol, t, dur));
  src.start(t);
  src.stop(t + dur);
}

function tone(type: OscillatorType, f0: number, f1: number, vol: number, dur: number, at = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  o.connect(env(vol, t, dur));
  o.start(t);
  o.stop(t + dur);
}

export const sfx = {
  squirt: () => hiss(0.5, 0.06, 2500, 'bandpass'),
  cure: () => { tone('triangle', 523, 523, 0.35, 0.12); tone('triangle', 784, 784, 0.35, 0.22, 0.1); },
  miss: () => tone('square', 110, 90, 0.2, 0.08),
  hurt: () => { tone('sine', 90, 40, 0.8, 0.2); tone('sawtooth', 260, 90, 0.4, 0.25); },
  groan: () => tone('sawtooth', 70 + Math.random() * 40, 50, 0.12, 0.7),
  wave: () => { tone('square', 220, 220, 0.25, 0.15); tone('square', 330, 330, 0.25, 0.3, 0.18); },
  over: () => tone('sawtooth', 300, 40, 0.5, 1.2),
};
