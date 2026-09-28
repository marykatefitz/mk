import { useEffect, useRef, useState } from 'react';
import { music } from '../core/audio/music';
import { sfx } from '../core/audio/sfx';
import { trackActivity } from '../core/progress/meta';
import { useProgress } from '../core/progress/store';
import { useSettings } from '../core/settings';
import { Confetti } from '../ui/game/Juice';
import './minigames.css';

export interface GameApi {
  addScore: (n: number) => void;
  penalty: (seconds: number) => void;
  end: () => void;
  timeLeft: number;
}

/** Common frame: instructions → timed play → results with best score and coins. */
export function MinigameShell({
  id,
  title,
  icon,
  howTo,
  seconds,
  onExit,
  children,
}: {
  id: string;
  title: string;
  icon: string;
  howTo: string[];
  seconds: number;
  onExit: () => void;
  children: (api: GameApi) => React.ReactNode;
}) {
  const relaxed = useSettings((s) => s.relaxedTimers);
  const total = seconds * (relaxed ? 2 : 1);
  const [phase, setPhase] = useState<'intro' | 'play' | 'done'>('intro');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(total);
  const [result, setResult] = useState<{ best: number; newBest: boolean; coins: number } | null>(null);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  useEffect(() => {
    if (phase !== 'play') return;
    const t = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === 'play' && timeLeft === 0) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, phase]);

  const finish = () => {
    if (phase === 'done') return;
    const s = scoreRef.current;
    const store = useProgress.getState();
    const prev = store.save?.minigames[id] ?? 0;
    const coins = Math.min(40, Math.floor(s / 10));
    store.update((sv) => {
      sv.minigames[id] = Math.max(prev, s);
      sv.stats.minigames++;
    });
    if (coins > 0) store.grant(title, Math.min(30, Math.floor(s / 5)), coins);
    trackActivity('minigame');
    setResult({ best: Math.max(prev, s), newBest: s > prev, coins });
    sfx(s > prev ? 'victory' : 'coin');
    setPhase('done');
  };

  const start = () => {
    setScore(0);
    setTimeLeft(total);
    setResult(null);
    setPhase('play');
    sfx('select');
    music.play('arcade');
  };

  const api: GameApi = {
    addScore: (n) => setScore((s) => s + n),
    penalty: (sec) => setTimeLeft((t) => Math.max(0, t - sec)),
    end: finish,
    timeLeft,
  };

  return (
    <div className="mg">
      <div className="mg-head">
        <button className="btn small ghost" onClick={onExit}>
          ◀ Arcade
        </button>
        <div className="pixel grow" style={{ fontSize: 12 }}>
          {icon} {title}
        </div>
        {phase === 'play' && (
          <>
            <span className="chip yellow pixel-alt">⭐ {score}</span>
            <span className={`chip pixel-alt ${timeLeft <= 10 ? 'red' : ''}`}>⏱ {timeLeft}s</span>
          </>
        )}
      </div>
      <div className="mg-body">
        {phase === 'intro' && (
          <div className="col center bounce-in" style={{ gap: 14, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 56 }}>{icon}</div>
            <div className="pixel" style={{ fontSize: 16 }}>
              {title}
            </div>
            <ul className="card" style={{ textAlign: 'left', maxWidth: 480, margin: 0, paddingLeft: 30 }}>
              {howTo.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <div className="tiny muted">Best: {useProgress.getState().save?.minigames[id] ?? 0}</div>
            <button className="btn green" onClick={start} autoFocus>
              ▶ Start ({total}s)
            </button>
          </div>
        )}
        {phase === 'play' && children(api)}
        {phase === 'done' && result && (
          <div className="col center bounce-in" style={{ gap: 12, padding: 20, textAlign: 'center' }}>
            {result.newBest && <Confetti />}
            <div className="pixel" style={{ fontSize: 18, color: 'var(--orange)' }}>
              {result.newBest ? 'NEW BEST!' : 'TIME!'}
            </div>
            <div className="pixel" style={{ fontSize: 28 }}>
              ⭐ {score}
            </div>
            <div className="muted">
              Best: {result.best} · +{result.coins} 🪙
            </div>
            <div className="row">
              <button className="btn ghost" onClick={onExit}>
                Arcade
              </button>
              <button className="btn green" onClick={start}>
                Play again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
