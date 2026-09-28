import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../core/audio/sfx';
import type { PlayerLook } from '../../core/progress/store';
import { characterSheet, FRAME_H, FRAME_W } from '../../game/sprites/characters';
import { Portrait } from '../components/Portrait';
import './screens.css';

const SKINS = ['#f3d2b3', '#e8b98f', '#d4a07a', '#b98260', '#8d5b3e', '#6b4430'];
const HAIRS = ['#1c1410', '#3b2418', '#7a4a2a', '#c98b3a', '#e8c070', '#d8d8d8', '#b91c1c', '#7c3aed'];
const STYLES: PlayerLook['hairStyle'][] = ['short', 'long', 'bun', 'curly', 'buzz', 'cap'];
const SHIRTS = ['#14b8a6', '#ff7a2f', '#3b82f6', '#8b5cf6', '#e0473b', '#37c46b', '#ffd23f', '#f472b6'];
const PANTS = ['#2b1d3a', '#34406b', '#4a5d3a', '#6b4430', '#9aa1ab'];

export function CharacterCreator({ onDone, onBack }: { onDone: (name: string, look: PlayerLook) => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const [look, setLook] = useState<PlayerLook>({ skin: SKINS[2], hair: HAIRS[1], hairStyle: 'short', shirt: SHIRTS[0], pants: PANTS[0] });
  const set = (p: Partial<PlayerLook>) => {
    sfx('blip');
    setLook((l) => ({ ...l, ...p }));
  };
  const swatches = (label: string, colors: string[], key: 'skin' | 'hair' | 'shirt' | 'pants') => (
    <div className="col" style={{ gap: 4 }}>
      <div className="label-pixel">{label}</div>
      <div className="row wrap" style={{ gap: 6 }}>
        {colors.map((c) => (
          <button
            key={c}
            className={`swatch ${look[key] === c ? 'on' : ''}`}
            style={{ background: c }}
            aria-label={`${label} ${c}`}
            onClick={() => set({ [key]: c })}
          />
        ))}
      </div>
    </div>
  );
  const valid = name.trim().length >= 1;
  return (
    <div className="creator-screen">
      <div className="panel creator bounce-in">
        <div className="pixel" style={{ fontSize: 14 }}>
          NEW EMPLOYEE ONBOARDING
        </div>
        <div className="creator-grid">
          <div className="col center" style={{ gap: 10 }}>
            <WalkingPreview look={look} />
            <Portrait look={{ ...look, accent: '#ffd23f' }} size={72} expression="happy" />
            <div className="chip">Data Analyst · Day 1</div>
          </div>
          <div className="col" style={{ gap: 12 }}>
            <label className="col" style={{ gap: 4 }}>
              <span className="label-pixel">YOUR NAME</span>
              <input
                value={name}
                maxLength={16}
                autoFocus
                placeholder="e.g. Mary"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && valid && onDone(name.trim(), look)}
                style={{ padding: 10, fontSize: 18, border: '3px solid var(--line)', borderRadius: 10, background: 'var(--panel)', color: 'var(--ink)', fontFamily: 'var(--font-pixel-alt)' }}
              />
            </label>
            {swatches('SKIN', SKINS, 'skin')}
            <div className="col" style={{ gap: 4 }}>
              <div className="label-pixel">HAIR STYLE</div>
              <div className="row wrap" style={{ gap: 6 }}>
                {STYLES.map((s) => (
                  <button key={s} className={`btn small ${look.hairStyle === s ? 'yellow' : 'ghost'}`} onClick={() => set({ hairStyle: s })}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {swatches('HAIR COLOR', HAIRS, 'hair')}
            {swatches('SHIRT', SHIRTS, 'shirt')}
            {swatches('PANTS', PANTS, 'pants')}
          </div>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn ghost" onClick={onBack}>
            ◀ Back
          </button>
          <div className="grow" />
          <button className="btn green" disabled={!valid} onClick={() => onDone(name.trim(), look)}>
            Clock in ▶
          </button>
        </div>
      </div>
    </div>
  );
}

function WalkingPreview({ look }: { look: PlayerLook }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const sheet = characterSheet({ ...look, accent: '#ffd23f' });
    const ctx = ref.current!.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    let t = 0;
    const id = setInterval(() => {
      t++;
      const dir = Math.floor(t / 8) % 4;
      const frame = [1, 0, 2, 0][t % 4];
      ctx.clearRect(0, 0, 96, 144);
      ctx.drawImage(sheet, frame * FRAME_W, dir * FRAME_H, FRAME_W, FRAME_H, 0, 0, 96, 144);
    }, 140);
    return () => clearInterval(id);
  }, [look]);
  return <canvas ref={ref} width={96} height={144} style={{ imageRendering: 'pixelated', background: '#79c85a', border: '3px solid var(--line)', borderRadius: 12 }} />;
}
