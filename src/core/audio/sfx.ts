// Tiny WebAudio sound effects: no files, no dependencies, instant.
import { useSettings } from '../settings';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  audio();
}

function vol() {
  const s = useSettings.getState();
  return s.muted ? 0 : s.sfx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', gain = 0.12, slideTo?: number) {
  const a = audio();
  if (!a || !master) return;
  const v = vol();
  if (v <= 0) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain * v, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(start: number, dur: number, gain = 0.1) {
  const a = audio();
  if (!a || !master) return;
  const v = vol();
  if (v <= 0) return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = gain * v;
  src.buffer = buf;
  src.connect(g).connect(master);
  src.start(a.currentTime + start);
}

export type Sfx =
  | 'blip'
  | 'select'
  | 'back'
  | 'type'
  | 'run'
  | 'correct'
  | 'wrong'
  | 'coin'
  | 'levelup'
  | 'hit'
  | 'crit'
  | 'hurt'
  | 'victory'
  | 'defeat'
  | 'door'
  | 'unlock'
  | 'step';

export function sfx(name: Sfx, pitch = 1) {
  switch (name) {
    case 'blip':
      return tone(660 * pitch, 0, 0.05, 'square', 0.06);
    case 'type':
      return tone(pitch, 0, 0.03, 'square', 0.035);
    case 'select':
      tone(523, 0, 0.06);
      return tone(784, 0.06, 0.08);
    case 'back':
      tone(523, 0, 0.06);
      return tone(392, 0.06, 0.08);
    case 'run':
      return tone(220, 0, 0.14, 'sawtooth', 0.07, 660);
    case 'correct':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.12, 'square', 0.1));
      return;
    case 'wrong':
      tone(220, 0, 0.12, 'triangle', 0.14);
      return tone(185, 0.12, 0.2, 'triangle', 0.14);
    case 'coin':
      tone(988, 0, 0.06, 'square', 0.08);
      return tone(1319, 0.06, 0.18, 'square', 0.08);
    case 'levelup':
      [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.14, 'square', 0.1));
      return;
    case 'hit':
      noise(0, 0.12, 0.15);
      return tone(160, 0, 0.12, 'square', 0.1, 60);
    case 'crit':
      noise(0, 0.25, 0.25);
      tone(880, 0, 0.1, 'square', 0.1);
      return tone(220, 0.05, 0.3, 'sawtooth', 0.12, 50);
    case 'hurt':
      return tone(300, 0, 0.25, 'sawtooth', 0.1, 90);
    case 'victory':
      [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.16, 'square', 0.1));
      return;
    case 'defeat':
      [392, 370, 349, 330].forEach((f, i) => tone(f, i * 0.2, 0.25, 'triangle', 0.12));
      return;
    case 'door':
      return noise(0, 0.08, 0.08);
    case 'unlock':
      [659, 880, 1175].forEach((f, i) => tone(f, i * 0.08, 0.12, 'triangle', 0.1));
      return;
    case 'step':
      return noise(0, 0.02, 0.02);
  }
}
