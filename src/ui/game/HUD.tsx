import { useEffect, useState } from 'react';
import { isRvShowWeekend } from '../../core/events';
import { levelProgress } from '../../core/progress/levels';
import { useProgress } from '../../core/progress/store';
import { currentObjective } from '../../core/quests/unlocks';
import { bus } from '../../game/bus';
import { Portrait } from '../components/Portrait';

export function HUD({ onMenu, onCodex, onSchema, onProfile, touch }: { onMenu: () => void; onCodex: () => void; onSchema: () => void; onProfile: () => void; touch: boolean }) {
  const save = useProgress((s) => s.save);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [hour, setHour] = useState(9);
  useEffect(() => {
    const a = bus.on('prompt', (p) => setPrompt(p?.label ?? null));
    const b = bus.on('clock', ({ hour }) => setHour(hour));
    return () => {
      a();
      b();
    };
  }, []);
  if (!save) return null;
  const lp = levelProgress(save.xp);
  const obj = currentObjective(save);
  const h12 = ((hour + 11) % 12) + 1;
  const ampm = hour < 12 ? 'AM' : 'PM';
  const icon = hour >= 6 && hour < 18 ? '☀️' : '🌙';
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-player">
          <Portrait look={{ ...save.player.look, accent: '#ffd23f' }} size={42} />
          <div style={{ minWidth: 0 }}>
            <div className="hud-name">{save.player.name}</div>
            <div className="hud-title">
              Lv {lp.level} · {lp.title}
            </div>
            <div className="xpbar" title={`${lp.into}/${lp.span} XP`}>
              <div style={{ width: `${Math.round(lp.pct * 100)}%` }} />
            </div>
          </div>
        </div>
        <div className="hud-coins" aria-label={`${save.coins} coins`}>
          🪙 {save.coins}
        </div>
        <div className="hud-clock" aria-label="time of day">
          {icon} {h12}:00 {ampm}
        </div>
        <div className="hud-buttons">
          <button className="btn small yellow icon" onClick={onProfile} aria-label="Career, quests and trophies" title="Career, quests and trophies">
            🏆
          </button>
          <button className="btn small teal icon" onClick={onSchema} aria-label="Schema explorer" title="Schema explorer">
            🗂️
          </button>
          <button className="btn small purple icon" onClick={onCodex} aria-label="Dealer Codex" title="Dealer Codex">
            📖
          </button>
          <button className="btn small icon" onClick={onMenu} aria-label="Menu" title="Menu (Esc)">
            ☰
          </button>
        </div>
      </div>
      <div className="hud-objective" role="status">
        <div className="label-pixel">OBJECTIVE</div>
        {obj.text}
      </div>
      {isRvShowWeekend(new Date()) && <div className="show-banner">🎪 RV SHOW WEEKEND · 2× COINS</div>}
      {prompt && (
        <div className={`hud-prompt ${touch ? 'touch' : ''}`}>
          <kbd>{touch ? 'A' : 'E'}</kbd>
          {prompt}
        </div>
      )}
    </div>
  );
}
