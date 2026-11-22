// Tiny WebAudio blips; no audio files. Muted state is a per-browser preference.
const KEY = 'backcountry-road-muted';
let ctx: AudioContext | null = null;
let muted = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();

export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* not remembered */ }
}

/** Notes as [frequency Hz, seconds]; played back to back. */
function play(notes: [number, number][], type: OscillatorType = 'square', vol = 0.06) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    let t = ctx.currentTime;
    for (const [f, d] of notes) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + d);
      t += d;
    }
  } catch { /* no audio support */ }
}

export const sfx = {
  shot: () => play([[140, 0.08]], 'sawtooth', 0.08),
  hit: () => play([[660, 0.06], [880, 0.08]]),
  event: () => play([[440, 0.08], [554, 0.1]], 'triangle', 0.1),
  death: () => play([[220, 0.25], [165, 0.4]], 'triangle', 0.12),
  won: () => play([[392, 0.12], [494, 0.12], [587, 0.12], [784, 0.3]], 'triangle', 0.1),
  lost: () => play([[294, 0.2], [262, 0.2], [196, 0.5]], 'triangle', 0.1),
};
