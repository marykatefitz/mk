import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../core/audio/sfx';
import { CODEX_BY_ID } from '../../core/codex';
import { titleFor } from '../../core/progress/levels';
import { useProgress, type RewardEvent } from '../../core/progress/store';
import { prefersReducedMotion } from '../../core/settings';

/** Reward toasts, level-up celebration and confetti, driven by progress.lastReward. */
export function Juice() {
  const reward = useProgress((s) => s.lastReward);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [levelUp, setLevelUp] = useState<RewardEvent | null>(null);
  const [confetti, setConfetti] = useState(0);

  useEffect(() => {
    if (!reward) return;
    const id = Date.now();
    const lines = [`+${reward.xp} XP`, `+${reward.coins} 🪙`];
    if (reward.golden) lines.push('✨ Golden query card!');
    for (const c of reward.codex) lines.push(`📖 Codex: ${CODEX_BY_ID[c]?.term ?? c}`);
    setToasts((t) => [...t, ...lines.map((text, i) => ({ id: id + i, text }))]);
    setTimeout(() => sfx('coin'), 250);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id < id || x.id >= id + lines.length)), 3200);
    if (reward.levelAfter > reward.levelBefore) {
      setTimeout(() => {
        setLevelUp(reward);
        sfx('levelup');
        setConfetti((n) => n + 1);
      }, 700);
    } else if (reward.golden) setConfetti((n) => n + 1);
    useProgress.getState().clearReward();
  }, [reward]);

  return (
    <>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
      {levelUp && (
        <div className="levelup" onClick={() => setLevelUp(null)} role="dialog" aria-label="Level up">
          <div className="panel levelup-card bounce-in">
            <div className="big">LEVEL UP!</div>
            <div className="pixel" style={{ fontSize: 14, marginTop: 10 }}>
              Level {levelUp.levelAfter}
            </div>
            {titleFor(levelUp.levelAfter) !== titleFor(levelUp.levelBefore) && (
              <div style={{ marginTop: 8 }}>
                New title: <strong>{titleFor(levelUp.levelAfter)}</strong> 🎉
              </div>
            )}
            <button className="btn green" style={{ marginTop: 14 }} onClick={() => setLevelUp(null)}>
              Sweet!
            </button>
          </div>
        </div>
      )}
      {confetti > 0 && <Confetti key={confetti} />}
    </>
  );
}

export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    c.width = innerWidth;
    c.height = innerHeight;
    const colors = ['#ff7a2f', '#14b8a6', '#ffd23f', '#8b5cf6', '#ff4f5e', '#37c46b'];
    const parts = Array.from({ length: 120 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight / 3,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      s: 4 + Math.random() * 5,
      c: colors[Math.floor(Math.random() * colors.length)],
      r: Math.random() * 6,
    }));
    let raf = 0;
    let frames = 0;
    const tick = () => {
      frames++;
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of parts) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += 0.2;
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, p.s, p.s * (0.5 + Math.abs(Math.sin(p.r)) * 0.5));
      }
      if (frames < 150) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="confetti" />;
}
