import { useRef, useState } from 'react';
import { sfx } from '../../core/audio/sfx';
import { CODEX, type CodexCategory } from '../../core/codex';
import { levelProgress } from '../../core/progress/levels';
import { useProgress } from '../../core/progress/store';
import { bossState, challengeState, currentObjective, worldState } from '../../core/quests/unlocks';
import { useSettings } from '../../core/settings';
import { CHALLENGE_BY_ID, WORLDS } from '../../departments/sql';
import { SNOWFLAKE_TRANSLATIONS } from '../../departments/sql/translations';

function Shell({ title, onClose, children, max = 900 }: { title: string; onClose: () => void; children: React.ReactNode; max?: number }) {
  return (
    <div className="overlay" role="dialog" aria-label={title} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="panel" style={{ maxWidth: max }}>
        <div className="overlay-header">
          <h2>{title}</h2>
          <button
            className="btn small red"
            onClick={() => {
              sfx('back');
              onClose();
            }}
            autoFocus
          >
            ✕ Close
          </button>
        </div>
        <div className="scroll" style={{ flex: 1, padding: 14 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function SignOverlay({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <div className="overlay" style={{ alignItems: 'center' }} onClick={onClose} role="dialog" aria-label={title}>
      <div className="panel col bounce-in" style={{ maxWidth: 440, padding: 18, gap: 10 }} onClick={(e) => e.stopPropagation()}>
        <div className="pixel" style={{ fontSize: 12 }}>
          🪧 {title}
        </div>
        <div>{text}</div>
        <button className="btn" onClick={onClose} autoFocus>
          OK
        </button>
      </div>
    </div>
  );
}

export function LessonOverlay({ worldId, onClose }: { worldId: number; onClose: () => void }) {
  const w = WORLDS.find((x) => x.id === worldId);
  const [i, setI] = useState(0);
  if (!w) return <SignOverlay title="Lesson" text="This lesson isn't available yet." onClose={onClose} />;
  const card = w.lesson[i];
  const notes = SNOWFLAKE_TRANSLATIONS.filter((t) => t.worlds.includes(worldId));
  const last = i === w.lesson.length - 1;
  return (
    <Shell title={`📚 ${w.name}: dealer lingo`} onClose={onClose} max={760}>
      <div className="col" style={{ gap: 12 }}>
        <div className="row wrap" style={{ gap: 6 }}>
          {w.concepts.map((c) => (
            <span key={c} className="chip teal">
              {c}
            </span>
          ))}
        </div>
        <div className="card bounce-in" key={i}>
          <div className="pixel" style={{ fontSize: 12, marginBottom: 8 }}>
            {i + 1}/{w.lesson.length} · {card.title}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{card.body}</div>
          {card.sql && (
            <pre className="untangle" style={{ padding: 10, marginTop: 10, whiteSpace: 'pre-wrap' }}>
              {card.sql}
            </pre>
          )}
        </div>
        <div className="row">
          <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
            ◀ Back
          </button>
          <div className="grow" />
          {last ? (
            <button className="btn green" onClick={onClose}>
              Got it!
            </button>
          ) : (
            <button className="btn" onClick={() => setI(i + 1)}>
              Next ▶
            </button>
          )}
        </div>
        {last && notes.length > 0 && (
          <div className="col" style={{ gap: 8 }}>
            <div className="label-pixel">❄️ SNOWFLAKE ↔ DUCKDB</div>
            {notes.map((n) => (
              <div key={n.title} className="card">
                <strong>{n.title}</strong>
                <div className="sf-grid" style={{ marginTop: 6 }}>
                  <div>
                    <div className="tiny muted">Snowflake</div>
                    <pre>{n.snowflake}</pre>
                  </div>
                  <div>
                    <div className="tiny muted">DuckDB (this game)</div>
                    <pre>{n.duckdb}</pre>
                  </div>
                </div>
                {n.note && <div className="tiny muted" style={{ marginTop: 4 }}>{n.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

export function CodexOverlay({ onClose }: { onClose: () => void }) {
  const save = useProgress((s) => s.save);
  const [cat, setCat] = useState<CodexCategory | 'All'>('All');
  const [q, setQ] = useState('');
  const unlocked = new Set(save?.codex ?? []);
  const cats: (CodexCategory | 'All')[] = ['All', 'Inventory', 'Floorplan', 'Sales', 'F&I', 'Service', 'Systems & Data', 'People', 'SQL'];
  const list = CODEX.filter((t) => (cat === 'All' || t.category === cat) && (!q || (t.term + t.definition).toLowerCase().includes(q.toLowerCase())));
  return (
    <Shell title={`📖 Dealer Codex · ${unlocked.size}/${CODEX.length}`} onClose={onClose}>
      <div className="col" style={{ gap: 10 }}>
        <input
          placeholder="Search terms…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ padding: 10, border: '3px solid var(--line)', borderRadius: 10, fontSize: 15, background: 'var(--panel)', color: 'var(--ink)' }}
        />
        <div className="row wrap" style={{ gap: 6 }}>
          {cats.map((c) => (
            <button key={c} className={`btn small ${cat === c ? 'yellow' : 'ghost'}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {list.map((t) =>
            unlocked.has(t.id) ? (
              <div key={t.id} className="card">
                <div className="row">
                  <strong className="grow">{t.term}</strong>
                  <span className="chip tiny">{t.category}</span>
                </div>
                <div style={{ marginTop: 4 }}>{t.definition}</div>
                <div className="tiny" style={{ marginTop: 6 }}>
                  <strong>Why it matters:</strong> {t.why}
                </div>
                {t.example && (
                  <pre className="untangle" style={{ padding: 8, marginTop: 6, fontSize: 12, whiteSpace: 'pre-wrap' }}>
                    {t.example}
                  </pre>
                )}
              </div>
            ) : (
              <div key={t.id} className="card" style={{ opacity: 0.55 }}>
                <strong>🔒 ???</strong>
                <div className="tiny muted">A {t.category} term. Keep playing to unlock it.</div>
              </div>
            ),
          )}
        </div>
      </div>
    </Shell>
  );
}

export function MenuOverlay({ onClose, onQuit }: { onClose: () => void; onQuit: () => void }) {
  const [tab, setTab] = useState<'quests' | 'settings' | 'saves'>('quests');
  return (
    <Shell title="☰ Menu" onClose={onClose} max={760}>
      <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
        {(['quests', 'settings', 'saves'] as const).map((t) => (
          <button key={t} className={`btn small ${tab === t ? 'yellow' : 'ghost'}`} onClick={() => setTab(t)}>
            {t === 'quests' ? '🗺️ Quest log' : t === 'settings' ? '⚙️ Settings' : '💾 Save'}
          </button>
        ))}
      </div>
      {tab === 'quests' && <QuestLog />}
      {tab === 'settings' && <SettingsPanel />}
      {tab === 'saves' && <SavePanel onQuit={onQuit} />}
    </Shell>
  );
}

function QuestLog() {
  const save = useProgress((s) => s.save)!;
  const lp = levelProgress(save.xp);
  const obj = currentObjective(save);
  const solved = Object.keys(save.solved).filter((id) => !CHALLENGE_BY_ID[id]?.bossOnly).length;
  const total = WORLDS.reduce((s, w) => s + w.challenges.length, 0);
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="card">
        <div className="label-pixel">CURRENT OBJECTIVE</div>
        {obj.text}
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="chip purple">
          Lv {lp.level} · {lp.title}
        </span>
        <span className="chip">{save.xp} XP</span>
        <span className="chip yellow">🪙 {save.coins}</span>
        <span className="chip teal">
          {solved}/{total} challenges
        </span>
        <span className="chip">{save.inventory.filter((x) => x.startsWith('golden:')).length} ✨ golden cards</span>
      </div>
      {WORLDS.map((w) => {
        const st = worldState(save, w.id);
        return (
          <div key={w.id} className="card">
            <div className="row">
              <strong className="grow">
                {w.id}. {w.name}
              </strong>
              <span className={`chip ${st === 'cleared' ? 'green' : st === 'open' ? 'orange' : ''}`}>{st}</span>
            </div>
            <div className="tiny muted">{w.tagline}</div>
            {st !== 'locked' && (
              <div className="row wrap" style={{ gap: 4, marginTop: 6 }}>
                {w.challenges.map((id, i) => {
                  const cs = challengeState(save, w, i);
                  return (
                    <span key={id} className={`chip tiny ${cs === 'solved' ? 'green' : cs === 'available' ? 'yellow' : ''}`} title={CHALLENGE_BY_ID[id].title}>
                      {cs === 'solved' ? '✓' : cs === 'available' ? '!' : '🔒'} {i + 1}
                    </span>
                  );
                })}
                <span className={`chip tiny ${bossState(save, w, 'mini') === 'beaten' ? 'green' : ''}`}>⚔️ {w.miniBoss.name}</span>
                <span className={`chip tiny ${bossState(save, w, 'boss') === 'beaten' ? 'green' : ''}`}>👑 {w.boss.name}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SettingsPanel() {
  const s = useSettings();
  const slider = (label: string, key: 'music' | 'sfx') => (
    <label className="col" style={{ gap: 4 }}>
      <span>
        {label}: {Math.round(s[key] * 100)}%
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={s[key]}
        onChange={(e) => {
          s.set({ [key]: Number(e.target.value) });
          if (key === 'sfx') sfx('blip');
        }}
      />
    </label>
  );
  const choice = <K extends 'theme' | 'motion' | 'textSpeed'>(label: string, key: K, opts: string[]) => (
    <div className="col" style={{ gap: 4 }}>
      <span>{label}</span>
      <div className="row wrap" style={{ gap: 6 }}>
        {opts.map((o) => (
          <button key={o} className={`btn small ${s[key] === o ? 'yellow' : 'ghost'}`} onClick={() => s.set({ [key]: o } as never)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="col" style={{ gap: 14 }}>
      {slider('🎵 Music volume', 'music')}
      {slider('🔊 Sound effects volume', 'sfx')}
      <label className="row">
        <input type="checkbox" checked={s.muted} onChange={(e) => s.set({ muted: e.target.checked })} /> Mute everything
      </label>
      {choice('🎨 Theme', 'theme', ['system', 'light', 'dark'])}
      {choice('🌀 Motion', 'motion', ['system', 'reduced', 'full'])}
      {choice('💬 Text speed', 'textSpeed', ['slow', 'normal', 'fast', 'instant'])}
      <label className="row">
        <input type="checkbox" checked={s.pixelDialogue} onChange={(e) => s.set({ pixelDialogue: e.target.checked })} /> Pixel font for dialogue text
      </label>
      <label className="row">
        <input type="checkbox" checked={s.relaxedTimers} onChange={(e) => s.set({ relaxedTimers: e.target.checked })} /> Relaxed timers (bosses and speed rounds get 2× time)
      </label>
    </div>
  );
}

function SavePanel({ onQuit }: { onQuit: () => void }) {
  const store = useProgress();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const exportSave = () => {
    const blob = new Blob([store.exportAll()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dealer-quest-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg('Backup downloaded. Keep it somewhere safe!');
  };
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="card">
        Progress saves automatically to this browser (slot {(store.slot ?? 0) + 1}). Use Export for a backup file you can import on another device.
      </div>
      <div className="row wrap">
        <button className="btn teal" onClick={exportSave}>
          ⬇️ Export progress
        </button>
        <button className="btn blue" onClick={() => file.current?.click()}>
          ⬆️ Import progress
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
              const n = store.importAll(await f.text());
              setMsg(`Imported ${n} save slot(s). Quit to the title screen to load them.`);
            } catch (err) {
              setMsg((err as Error).message);
            }
          }}
        />
      </div>
      {msg && <div className="feedback warn">{msg}</div>}
      <button className="btn red" onClick={onQuit}>
        🚪 Save &amp; quit to title
      </button>
    </div>
  );
}
