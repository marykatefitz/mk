// Chiptune soundtrack, composed in code with Tone.js (lazy-loaded after the
// first user gesture). Original melodies over common chord progressions.

import { useSettings } from '../settings';

export type Track = 'title' | 'overworld' | 'interior' | 'miniboss' | 'boss' | 'victory' | 'arcade' | 'none';

type ToneNS = typeof import('tone');

let Tone: ToneNS | null = null;
let loading: Promise<ToneNS> | null = null;
let current: Track = 'none';
let wanted: Track = 'none';
let parts: { dispose(): void; stop?(t?: number): unknown }[] = [];
let bus: import('tone').Volume | null = null;

const NOTE = (n: string) => n;

interface Song {
  bpm: number;
  lead: (string | null)[];
  bass: (string | null)[];
  chords?: (string[] | null)[];
  drums: string; // x = kick, s = snare, h = hat, . = rest (16 steps per bar)
  leadType: OscillatorType;
  loop: boolean;
}

// 8th-note grids
const SONGS: Record<Exclude<Track, 'none'>, Song> = {
  title: {
    bpm: 96,
    leadType: 'triangle',
    lead: ['E5', null, 'G5', null, 'C6', null, 'B5', 'G5', 'A5', null, 'G5', null, 'E5', null, null, null, 'F5', null, 'A5', null, 'C6', null, 'B5', 'A5', 'G5', null, null, null, null, null, null, null],
    bass: ['C3', null, 'C3', null, 'G2', null, 'G2', null, 'A2', null, 'A2', null, 'E2', null, 'E2', null, 'F2', null, 'F2', null, 'C3', null, 'C3', null, 'G2', null, 'G2', null, 'G2', null, 'B2', null],
    drums: 'x...h...s...h...',
    loop: true,
  },
  overworld: {
    bpm: 118,
    leadType: 'square',
    lead: [
      'C5', 'E5', 'G5', 'E5', 'A5', null, 'G5', 'E5', 'D5', 'E5', 'G5', null, 'E5', null, null, null,
      'A4', 'C5', 'E5', 'C5', 'F5', null, 'E5', 'C5', 'D5', null, 'B4', 'C5', 'D5', null, null, null,
      'C5', 'E5', 'G5', 'E5', 'A5', null, 'G5', 'A5', 'C6', null, 'B5', 'A5', 'G5', null, 'E5', null,
      'F5', null, 'E5', 'D5', 'C5', null, 'D5', 'E5', 'C5', null, null, null, null, null, null, null,
    ],
    bass: [
      'C3', null, 'G3', null, 'C3', null, 'G3', null, 'G2', null, 'D3', null, 'G2', null, 'D3', null,
      'A2', null, 'E3', null, 'A2', null, 'E3', null, 'F2', null, 'C3', null, 'G2', null, 'D3', null,
      'C3', null, 'G3', null, 'C3', null, 'G3', null, 'A2', null, 'E3', null, 'A2', null, 'E3', null,
      'F2', null, 'C3', null, 'G2', null, 'D3', null, 'C3', null, 'G2', null, 'C3', null, null, null,
    ],
    drums: 'x...h.x.s...h...',
    loop: true,
  },
  interior: {
    bpm: 100,
    leadType: 'triangle',
    lead: ['G4', null, 'C5', null, 'E5', null, 'D5', null, 'C5', null, 'A4', null, 'G4', null, null, null, 'A4', null, 'D5', null, 'F5', null, 'E5', null, 'D5', null, 'B4', null, 'C5', null, null, null],
    bass: ['C3', null, null, null, 'A2', null, null, null, 'F2', null, null, null, 'G2', null, null, null, 'D3', null, null, null, 'G2', null, null, null, 'C3', null, null, null, 'G2', null, null, null],
    drums: 'x.......h.......',
    loop: true,
  },
  miniboss: {
    bpm: 140,
    leadType: 'square',
    lead: ['E5', null, 'E5', 'G5', null, 'E5', 'D5', null, 'C5', null, 'D5', 'E5', null, null, 'B4', null, 'E5', null, 'E5', 'A5', null, 'G5', 'E5', null, 'D5', null, 'E5', null, null, null, null, null],
    bass: ['A2', 'A2', 'A3', 'A2', 'A2', 'A3', 'A2', 'A3', 'F2', 'F2', 'F3', 'F2', 'G2', 'G3', 'G2', 'G3', 'A2', 'A2', 'A3', 'A2', 'A2', 'A3', 'A2', 'A3', 'E2', 'E2', 'E3', 'E2', 'E2', 'E3', 'G#2', 'B2'],
    drums: 'x.h.s.h.x.x.s.h.',
    loop: true,
  },
  boss: {
    bpm: 156,
    leadType: 'sawtooth',
    lead: [
      'A4', null, 'C5', 'E5', 'A5', null, 'G5', 'E5', 'F5', null, 'E5', 'D5', 'E5', null, null, null,
      'A4', null, 'C5', 'E5', 'A5', null, 'B5', 'C6', 'B5', null, 'G5', null, 'G#5', null, null, null,
    ],
    bass: ['A1', 'A2', 'A1', 'A2', 'A1', 'A2', 'A1', 'A2', 'F1', 'F2', 'F1', 'F2', 'G1', 'G2', 'G1', 'G2', 'A1', 'A2', 'A1', 'A2', 'A1', 'A2', 'A1', 'A2', 'E1', 'E2', 'E1', 'E2', 'E1', 'E2', 'G#1', 'G#2'],
    drums: 'x.hxs.h.x.hxs.hs',
    loop: true,
  },
  victory: {
    bpm: 132,
    leadType: 'square',
    lead: ['C5', 'C5', 'C5', 'C5', 'G#4', null, 'A#4', null, 'C5', null, 'A#4', 'C5', null, null, null, null],
    bass: ['C3', null, null, null, 'G#2', null, 'A#2', null, 'C3', null, null, null, null, null, null, null],
    drums: 'x...x...x.......',
    loop: false,
  },
  arcade: {
    bpm: 150,
    leadType: 'square',
    lead: ['C5', 'E5', 'G5', 'C6', 'G5', 'E5', 'C5', 'E5', 'D5', 'F5', 'A5', 'D6', 'A5', 'F5', 'D5', 'F5', 'E5', 'G5', 'B5', 'E6', 'B5', 'G5', 'E5', 'G5', 'F5', 'A5', 'C6', 'A5', 'G5', 'B5', 'D6', 'B5'],
    bass: ['C3', null, 'C3', null, 'D3', null, 'D3', null, 'E3', null, 'E3', null, 'F3', null, 'G3', null, 'C3', null, 'C3', null, 'D3', null, 'D3', null, 'E3', null, 'E3', null, 'F3', null, 'G3', null],
    drums: 'x.h.s.h.x.h.s.hh',
    loop: true,
  },
};

function volumeDb() {
  const s = useSettings.getState();
  const v = s.muted ? 0 : s.music;
  return v <= 0.001 ? -Infinity : 20 * Math.log10(v) - 10;
}

async function load(): Promise<ToneNS> {
  if (Tone) return Tone;
  loading ??= import('tone').then((t) => {
    Tone = t;
    bus = new t.Volume(volumeDb()).toDestination();
    useSettings.subscribe(() => {
      if (bus) bus.volume.rampTo(volumeDb(), 0.1);
    });
    return t;
  });
  return loading;
}

function stopAll() {
  for (const p of parts) {
    try {
      p.stop?.();
      p.dispose();
    } catch {
      /* ignore */
    }
  }
  parts = [];
}

async function start(track: Track) {
  const T = await load();
  if (wanted !== track) return;
  await T.start();
  stopAll();
  const transport = T.getTransport();
  transport.stop();
  transport.cancel();
  current = track;
  if (track === 'none') return;
  const song = SONGS[track];
  transport.bpm.value = song.bpm;
  const lead = new T.Synth({ oscillator: { type: song.leadType }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.1 }, volume: -14 }).connect(bus!);
  const bass = new T.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.2, sustain: 0.5, release: 0.1 }, volume: -8 }).connect(bus!);
  const kick = new T.MembraneSynth({ volume: -12 }).connect(bus!);
  const snare = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 }, volume: -24 }).connect(bus!);
  const hat = new T.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 }, volume: -32 }).connect(bus!);
  parts.push(lead, bass, kick, snare, hat);
  const mk = (notes: (string | null)[], synth: import('tone').Synth, dur: string) => {
    const seq = new T.Sequence(
      (time, n) => {
        if (!n) return;
        try {
          synth.triggerAttackRelease(NOTE(n), dur, time);
        } catch {
          /* two notes on the same tick after a restart: skip */
        }
      },
      notes,
      '8n',
    );
    seq.loop = song.loop;
    seq.start(0);
    parts.push(seq);
  };
  mk(song.lead, lead, '16n');
  mk(song.bass, bass, '8n');
  const bars = Math.max(1, Math.ceil(song.lead.length / 8));
  const drumSteps = Array.from({ length: bars * 16 }, (_, i) => song.drums[i % 16]);
  const drums = new T.Sequence(
    (time, d) => {
      try {
        if (d === 'x') kick.triggerAttackRelease('C1', '8n', time);
        else if (d === 's') snare.triggerAttackRelease('16n', time);
        else if (d === 'h') hat.triggerAttackRelease('32n', time);
      } catch {
        /* skip */
      }
    },
    drumSteps,
    '16n',
  );
  drums.loop = song.loop;
  drums.start(0);
  parts.push(drums);
  transport.start('+0.05');
}

export const music = {
  play(track: Track) {
    if (track === wanted && track === current) return;
    wanted = track;
    // Only start once audio has been unlocked by a gesture.
    if (typeof window === 'undefined') return;
    void start(track).catch(() => {
      /* audio unavailable: play silently */
    });
  },
  current: () => current,
};
