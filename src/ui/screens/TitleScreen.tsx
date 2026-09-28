import { useEffect, useRef, useState } from 'react';
import { sfx, unlockAudio } from '../../core/audio/sfx';
import { levelProgress } from '../../core/progress/levels';
import { SLOT_COUNT, useProgress } from '../../core/progress/store';
import { rvCanvas } from '../../game/sprites/props';
import { Portrait } from '../components/Portrait';
import './screens.css';

export function TitleScreen({ onNew, onContinue }: { onNew: (slot: number) => void; onContinue: (slot: number) => void }) {
  const slots = useProgress((s) => s.slots);
  const [started, setStarted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    useProgress.getState().refreshSlots();
  }, []);
  useEffect(() => {
    if (started) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started]);

  const start = () => {
    unlockAudio();
    sfx('select');
    setStarted(true);
  };

  return (
    <div className="title-screen" onClick={() => !started && start()}>
      <Sky />
      <div className="title-logo bounce-in">
        <div className="title-small">SUMMIT TRAIL RV presents</div>
        <h1>
          DEALER
          <br />
          QUEST
        </h1>
        <div className="title-sub">Real SQL. Real dealership. Real bosses.</div>
      </div>
      {!started ? (
        <div className="press-start">{matchMedia('(pointer: coarse)').matches ? 'TAP TO START' : 'PRESS START'}</div>
      ) : (
        <div className="slots panel bounce-in" onClick={(e) => e.stopPropagation()}>
          <div className="pixel" style={{ fontSize: 12, marginBottom: 8 }}>
            CHOOSE A SAVE SLOT
          </div>
          {Array.from({ length: SLOT_COUNT }, (_, i) => {
            const s = slots[i];
            if (!s)
              return (
                <button key={i} className="slot empty" onClick={() => onNew(i)}>
                  <span className="pixel-alt">Slot {i + 1}</span>
                  <span className="muted">＋ New game</span>
                </button>
              );
            const lp = levelProgress(s.xp);
            return (
              <div key={i} className="slot">
                <Portrait look={{ ...s.player.look, accent: '#ffd23f' }} size={48} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="pixel-alt" style={{ fontWeight: 700 }}>
                    {s.player.name}
                  </div>
                  <div className="tiny muted">
                    Lv {lp.level} {lp.title} · {Object.keys(s.solved).length} solved · 🪙 {s.coins}
                  </div>
                  <div className="tiny muted">Last played {new Date(s.updatedAt).toLocaleDateString()}</div>
                </div>
                {confirmDelete === i ? (
                  <>
                    <button
                      className="btn small red"
                      onClick={() => {
                        useProgress.getState().deleteSlot(i);
                        setConfirmDelete(null);
                        sfx('back');
                      }}
                    >
                      Delete!
                    </button>
                    <button className="btn small ghost" onClick={() => setConfirmDelete(null)}>
                      Keep
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn small green" onClick={() => onContinue(i)}>
                      ▶ Play
                    </button>
                    <button className="btn small ghost icon" aria-label="Delete save" onClick={() => setConfirmDelete(i)}>
                      🗑️
                    </button>
                  </>
                )}
              </div>
            );
          })}
          <div className="row wrap" style={{ marginTop: 6 }}>
            <button className="btn small blue" onClick={() => file.current?.click()}>
              ⬆️ Import backup
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const n = useProgress.getState().importAll(await f.text());
                  setMsg(`Imported ${n} save slot(s)!`);
                } catch (err) {
                  setMsg((err as Error).message);
                }
              }}
            />
          </div>
          {msg && <div className="feedback warn tiny" style={{ marginTop: 6 }}>{msg}</div>}
        </div>
      )}
      <div className="title-foot tiny">Fictional company · All data generated · Made for learning</div>
    </div>
  );
}

function Sky() {
  const [rvs] = useState(() => {
    const kinds = ['Class A', 'Travel Trailer', 'Fifth Wheel', 'Class C', 'Toy Hauler'] as const;
    return kinds.map((k, i) => ({ url: rvCanvas(k, ['#ff7a2f', '#14b8a6', '#3b82f6', '#8b5cf6', '#e0473b'][i]).toDataURL(), delay: i * 3.1, dur: 14 + i * 2 }));
  });
  return (
    <div className="sky" aria-hidden>
      <div className="mountains" />
      <div className="road" />
      {rvs.map((r, i) => (
        <img key={i} src={r.url} className="title-rv" style={{ animationDelay: `${r.delay}s`, animationDuration: `${r.dur}s`, top: `calc(72% + ${i % 2 ? 12 : 30}px)` }} alt="" />
      ))}
    </div>
  );
}
