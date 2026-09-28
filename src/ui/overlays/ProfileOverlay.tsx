import { useState } from 'react';
import { sfx } from '../../core/audio/sfx';
import { ACHIEVEMENTS, OTHER_TRACKS, claimDaily, ensureDaily, skillProgress } from '../../core/progress/meta';
import { levelProgress } from '../../core/progress/levels';
import { useProgress } from '../../core/progress/store';
import { CHALLENGE_BY_ID, WORLDS } from '../../departments/sql';
import { monsterDataUrl } from '../../game/sprites/monsters';
import { Portrait } from '../components/Portrait';

export function ProfileOverlay({ onClose }: { onClose: () => void }) {
  ensureDaily();
  const save = useProgress((s) => s.save)!;
  const [tab, setTab] = useState<'daily' | 'skills' | 'trophies' | 'achievements'>('daily');
  const lp = levelProgress(save.xp);
  const skills = skillProgress(save);
  const bosses = WORLDS.flatMap((w) => [w.miniBoss, w.boss]);
  const golden = save.inventory.filter((x) => x.startsWith('golden:'));
  return (
    <div className="overlay" role="dialog" aria-label="Profile">
      <div className="panel" style={{ maxWidth: 860 }}>
        <div className="overlay-header">
          <h2>🏆 {save.player.name}'s Career</h2>
          <button className="btn small red" onClick={onClose} autoFocus>
            ✕ Close
          </button>
        </div>
        <div className="scroll" style={{ padding: 14, flex: 1 }}>
          <div className="row wrap" style={{ gap: 12, marginBottom: 12 }}>
            <Portrait look={{ ...save.player.look, accent: '#ffd23f' }} size={64} expression="happy" />
            <div className="col" style={{ gap: 4 }}>
              <div className="pixel" style={{ fontSize: 12 }}>
                Lv {lp.level} · {lp.title}
              </div>
              <div className="xpbar" style={{ width: 220 }}>
                <div style={{ width: `${Math.round(lp.pct * 100)}%` }} />
              </div>
              <div className="tiny muted">
                {lp.into}/{lp.span} XP to next level · 🔥 {save.streak.count}-day streak · 🧊 {save.streak.freezes} freezes
              </div>
            </div>
          </div>
          <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
            {(['daily', 'skills', 'trophies', 'achievements'] as const).map((t) => (
              <button key={t} className={`btn small ${tab === t ? 'yellow' : 'ghost'}`} onClick={() => setTab(t)}>
                {{ daily: '📅 Daily quests', skills: '🌳 Skill tree', trophies: '🏆 Trophies & cards', achievements: '🎖️ Achievements' }[t]}
              </button>
            ))}
          </div>

          {tab === 'daily' && (
            <div className="col" style={{ gap: 8 }}>
              <div className="tiny muted">New quests every day. Keep your streak alive by solving something daily (a 🧊 freeze covers one missed day; earn one every 7 days).</div>
              {save.daily.quests.map((q) => (
                <div key={q.id} className="card row" style={{ gap: 10 }}>
                  <div className="grow">
                    <strong>{q.label}</strong>
                    <div className="hp" style={{ marginTop: 4 }}>
                      <div style={{ width: `${(q.progress / q.target) * 100}%`, background: 'var(--teal)', height: '100%' }} />
                    </div>
                    <div className="tiny muted">
                      {q.progress}/{q.target} · reward {q.reward} 🪙
                    </div>
                  </div>
                  <button
                    className="btn small green"
                    disabled={q.claimed || q.progress < q.target}
                    onClick={() => {
                      sfx('coin');
                      claimDaily(q.id);
                    }}
                  >
                    {q.claimed ? 'Claimed ✓' : 'Claim'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'skills' && (
            <div className="col" style={{ gap: 10 }}>
              <div className="label-pixel">SQL</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
                {skills.map((n) => {
                  const pct = n.total ? n.done / n.total : 0;
                  return (
                    <div key={n.id} className="card" style={{ borderColor: pct === 1 ? 'var(--green-d)' : undefined, background: pct === 1 ? 'var(--good-bg)' : undefined }}>
                      <strong>
                        {pct === 1 ? '⭐ ' : ''}
                        {n.name}
                      </strong>
                      <div className="hp" style={{ marginTop: 4 }}>
                        <div style={{ width: `${pct * 100}%`, background: 'var(--purple)', height: '100%' }} />
                      </div>
                      <div className="tiny muted">
                        {n.done}/{n.total || '–'} challenges
                      </div>
                    </div>
                  );
                })}
                <div className="card">
                  <strong>Communication</strong>
                  <div className="tiny muted">Stakeholder presentations: {save.stats.stakeholder} · asked early: {save.stats.askedEarly}</div>
                </div>
              </div>
              <div className="label-pixel">COMING IN LATER PHASES</div>
              <div className="row wrap" style={{ gap: 6 }}>
                {OTHER_TRACKS.map((t) => (
                  <span key={t.name} className="chip" style={{ opacity: 0.6 }}>
                    🔒 {t.name} · Phase {t.phase}
                  </span>
                ))}
              </div>
            </div>
          )}

          {tab === 'trophies' && (
            <div className="col" style={{ gap: 12 }}>
              <div className="label-pixel">BOSS TROPHIES</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                {bosses.map((b) => {
                  const rec = save.bosses[b.id];
                  return (
                    <div key={b.id} className="card col center" style={{ gap: 4, opacity: rec ? 1 : 0.45, textAlign: 'center' }}>
                      <img src={monsterDataUrl(b.sprite, 0, 1)} width={64} height={64} style={{ imageRendering: 'pixelated', filter: rec ? undefined : 'grayscale(1) brightness(0.4)' }} alt="" />
                      <div className="tiny">
                        <strong>{rec ? b.name : '???'}</strong>
                      </div>
                      {rec && <span className="chip yellow tiny">Best: {rec.grade}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="label-pixel">✨ GOLDEN QUERY CARDS ({golden.length})</div>
              <div className="tiny muted">Solve a challenge on the first try with no hints to frame your query as a collectible.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
                {Object.entries(save.solved)
                  .filter(([, v]) => v.golden)
                  .map(([id, v]) => (
                    <div key={id} className="card" style={{ background: 'linear-gradient(135deg, #fff7d1, #ffd23f)', color: '#2b1d3a' }}>
                      <strong>✨ {CHALLENGE_BY_ID[id]?.title ?? id}</strong>
                      {v.sql && (
                        <pre className="untangle" style={{ padding: 6, fontSize: 11, marginTop: 6, whiteSpace: 'pre-wrap', maxHeight: 120 }}>
                          {v.sql}
                        </pre>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {tab === 'achievements' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {ACHIEVEMENTS.map((a) => {
                const got = save.achievements.includes(a.id);
                return (
                  <div key={a.id} className="card row" style={{ gap: 10, opacity: got ? 1 : 0.5 }}>
                    <div style={{ fontSize: 28, filter: got ? undefined : 'grayscale(1)' }}>{a.icon}</div>
                    <div>
                      <strong>{a.name}</strong>
                      <div className="tiny muted">{a.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
