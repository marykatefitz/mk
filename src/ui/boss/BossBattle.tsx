import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { music } from '../../core/audio/music';
import { sfx } from '../../core/audio/sfx';
import { useProgress } from '../../core/progress/store';
import { prefersReducedMotion, useSettings } from '../../core/settings';
import { CHALLENGE_BY_ID, FINAL_BOSS, WORLDS } from '../../departments/sql';
import type { BossDef } from '../../departments/sql/types';
import type { SqlEngine } from '../../engines/types';
import { monsterDataUrl } from '../../game/sprites/monsters';
import { Portrait } from '../components/Portrait';
import { Confetti } from '../game/Juice';
import { Workbench } from '../terminal/Workbench';
import { bossReward, recordBossResult } from './rewards';
import './boss.css';

type Stage = 'intro' | 'fight' | 'phase' | 'victory' | 'defeat';

const WRONG_DMG = 15;
const TIMEOUT_DMG = 20;
const HINT_DMG = [5, 10, 15];

export function BossBattle({ engine, worldId, which, onClose }: { engine: SqlEngine; worldId: number; which: 'mini' | 'boss'; onClose: () => void }) {
  const boss: BossDef | null = useMemo(() => {
    if (worldId === 8) return FINAL_BOSS;
    const w = WORLDS.find((x) => x.id === worldId);
    return w ? (which === 'mini' ? w.miniBoss : w.boss) : null;
  }, [worldId, which]);
  const relaxed = useSettings((s) => s.relaxedTimers);
  const save = useProgress((s) => s.save)!;

  const questions = useMemo(() => boss?.phases.flatMap((p, pi) => p.questions.map((q) => ({ id: q, phase: pi }))) ?? [], [boss]);
  const [stage, setStage] = useState<Stage>('intro');
  const [qi, setQi] = useState(0);
  const [hp, setHp] = useState(100);
  const [bossHp, setBossHp] = useState(questions.length);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hits, setHits] = useState<{ id: number; text: string; crit?: boolean; player?: boolean }[]>([]);
  const [shake, setShake] = useState<'boss' | 'player' | 'screen' | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [firstTry, setFirstTry] = useState(true);
  const [result, setResult] = useState<ReturnType<typeof bossReward> | null>(null);
  const [locked, setLocked] = useState(false);
  const started = useRef(Date.now());
  const correctCount = useRef(0);

  const timerSec = Math.round((boss?.timer ?? 120) * (relaxed ? 2 : 1));
  const q = questions[qi];
  const phase = q?.phase ?? 0;
  const challenge = q ? CHALLENGE_BY_ID[q.id] : null;

  useEffect(() => {
    music.play(boss?.mini ? 'miniboss' : 'boss');
    return () => music.play('overworld');
  }, [boss]);

  const bump = (who: 'boss' | 'player' | 'screen') => {
    if (prefersReducedMotion()) return;
    setShake(who);
    setTimeout(() => setShake(null), 450);
  };
  const floatText = (text: string, opts: { crit?: boolean; player?: boolean } = {}) => {
    const id = Date.now() + Math.random();
    setHits((h) => [...h, { id, text, ...opts }]);
    setTimeout(() => setHits((h) => h.filter((x) => x.id !== id)), 1100);
  };

  const hurt = useCallback(
    (dmg: number, label: string) => {
      sfx('hurt');
      bump('player');
      floatText(`-${dmg} HP ${label}`, { player: true });
      setHp((h) => {
        const n = Math.max(0, h - dmg);
        if (n === 0) {
          setTimeout(() => {
            sfx('defeat');
            music.play('none');
            recordBossResult(boss!, null, correctCount.current);
            setStage('defeat');
          }, 600);
        }
        return n;
      });
    },
    [boss],
  );

  // timer
  useEffect(() => {
    if (stage !== 'fight' || locked) return;
    setTimeLeft(timerSec);
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          hurt(TIMEOUT_DMG, '(time!)');
          setFirstTry(false);
          return timerSec;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [stage, qi, locked, timerSec, hurt]);

  const onAttempt = (ok: boolean) => {
    if (!ok) {
      setFirstTry(false);
      hurt(WRONG_DMG, '');
    }
  };

  const onSolved = () => {
    const crit = firstTry;
    correctCount.current++;
    setLocked(true);
    sfx(crit ? 'crit' : 'hit');
    bump(crit ? 'screen' : 'boss');
    const shown = Math.round(100 * (0.8 + 0.4 * (timeLeft / timerSec))) * (crit ? 2 : 1);
    floatText(crit ? `CRIT! ${shown}` : `${shown}`, { crit });
    setBossHp((h) => h - 1);
    setTimeout(() => {
      setLocked(false);
      setFirstTry(true);
      const next = qi + 1;
      if (next >= questions.length) {
        const r = bossReward(boss!, { hp, hintsUsed, seconds: (Date.now() - started.current) / 1000 });
        recordBossResult(boss!, r, correctCount.current);
        setResult(r);
        music.play('victory');
        sfx('victory');
        setStage('victory');
      } else if (questions[next].phase !== phase) {
        setQi(next);
        setStage('phase');
        sfx('crit');
      } else setQi(next);
    }, 1100);
  };

  const onHint = (tier: number) => {
    setHintsUsed((n) => n + 1);
    setFirstTry(false);
    hurt(HINT_DMG[tier] ?? 10, '(hint)');
    return true;
  };

  if (!boss) return null;
  const bossPct = bossHp / questions.length;
  const giver = challenge?.giver ?? 'scout';

  return (
    <div className={`boss-root ${shake === 'screen' ? 'shake' : ''}`} role="dialog" aria-label={`Boss battle: ${boss.name}`}>
      <div className={`arena ${boss.mini ? 'mini' : ''}`}>
        <div className="arena-bg" />
        <div className="bar boss-bar">
          <div className="bar-name">{boss.name}</div>
          <div className="hp">
            <div style={{ width: `${bossPct * 100}%`, background: bossPct > 0.5 ? 'var(--green)' : bossPct > 0.2 ? 'var(--yellow)' : 'var(--red)' }} />
          </div>
          <div className="tiny">
            Phase {phase + 1}/{boss.phases.length}: {boss.phases[phase]?.name}
          </div>
        </div>
        <img
          className={`monster ${shake === 'boss' ? 'hit' : ''} ${stage === 'victory' ? 'dissolve' : ''}`}
          src={monsterDataUrl(boss.sprite, stage === 'victory' ? 0 : phase)}
          alt={boss.name}
        />
        <div className={`player-spot ${shake === 'player' ? 'shake' : ''}`}>
          <Portrait look={{ ...save.player.look, accent: '#ffd23f' }} size={56} expression={hp < 35 ? 'stressed' : 'neutral'} />
          <div className="bar player-bar">
            <div className="bar-name">{save.player.name}</div>
            <div className="hp">
              <div style={{ width: `${hp}%`, background: hp > 50 ? 'var(--green)' : hp > 25 ? 'var(--yellow)' : 'var(--red)' }} />
            </div>
            <div className="tiny">{hp}/100 HP</div>
          </div>
        </div>
        {stage === 'fight' && (
          <div className={`timer ${timeLeft <= 15 ? 'low' : ''}`} aria-label="time left">
            ⏱ {timeLeft}s
          </div>
        )}
        {hits.map((h) => (
          <div key={h.id} className={`float ${h.crit ? 'crit' : ''} ${h.player ? 'on-player' : ''}`}>
            {h.text}
          </div>
        ))}
        <button className="btn small red flee" onClick={onClose}>
          🏃 Flee
        </button>
      </div>

      <div className="boss-bottom">
        {stage === 'intro' && (
          <Cutscene
            title={boss.mini ? 'MINI-BOSS' : 'BOSS BATTLE'}
            text={boss.intro}
            npc={giver}
            button="⚔️ Fight!"
            onNext={() => {
              sfx('select');
              setStage('fight');
            }}
          />
        )}
        {stage === 'phase' && (
          <Cutscene
            title={`PHASE ${phase + 1}: ${boss.phases[phase].name.toUpperCase()}`}
            text={`"${boss.phases[phase].taunt}"`}
            button="Keep going!"
            onNext={() => setStage('fight')}
          />
        )}
        {stage === 'fight' && challenge && (
          <div className="boss-bench panel">
            <Workbench key={challenge.id} engine={engine} challenge={challenge} mode="boss" onAttempt={onAttempt} onSolved={onSolved} onHint={onHint} locked={locked} />
          </div>
        )}
        {stage === 'victory' && result && (
          <div className="panel col bounce-in cutscene">
            <Confetti />
            <div className="pixel" style={{ fontSize: 18, color: 'var(--orange)' }}>
              VICTORY!
            </div>
            <div>{boss.victory}</div>
            <div className="row wrap" style={{ gap: 8, justifyContent: 'center' }}>
              <span className={`grade grade-${result.grade}`}>{result.grade}</span>
              <span className="chip purple">+{result.xp} XP</span>
              <span className="chip yellow">+{result.coins} 🪙</span>
              {result.firstWin && <span className="chip orange">🏆 {boss.name} trophy</span>}
              {result.betterGrade && !result.firstWin && <span className="chip green">New best grade!</span>}
            </div>
            <div className="tiny muted">
              Grade: S = 90+ HP and no hints · A = 70+ HP · B = 40+ HP · C = survived
            </div>
            <button className="btn green" onClick={onClose} autoFocus>
              Collect loot ▶
            </button>
          </div>
        )}
        {stage === 'defeat' && (
          <div className="panel col bounce-in cutscene">
            <div className="pixel" style={{ fontSize: 16, color: 'var(--red)' }}>
              DEFEATED…
            </div>
            <div>
              {boss.name} wins this round. You keep {correctCount.current * 10} XP for the questions you got right. Review the hints, try X-Ray, and come back swinging!
            </div>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={onClose}>
                Retreat
              </button>
              <button
                className="btn green"
                onClick={() => {
                  setHp(100);
                  setBossHp(questions.length);
                  setQi(0);
                  setHintsUsed(0);
                  correctCount.current = 0;
                  started.current = Date.now();
                  music.play(boss.mini ? 'miniboss' : 'boss');
                  setStage('intro');
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Cutscene({ title, text, npc, button, onNext }: { title: string; text: string; npc?: Parameters<typeof Portrait>[0]['npc']; button: string; onNext: () => void }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= text.length) return;
    const t = setTimeout(() => setShown((n) => n + 2), 18);
    return () => clearTimeout(t);
  }, [shown, text]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (shown < text.length) setShown(text.length);
        else onNext();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [shown, text, onNext]);
  return (
    <div className="panel col bounce-in cutscene" onClick={() => (shown < text.length ? setShown(text.length) : undefined)}>
      <div className="pixel" style={{ fontSize: 14, color: 'var(--red)' }}>
        {title}
      </div>
      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        {npc && <Portrait npc={npc} size={56} expression="surprised" />}
        <div style={{ fontSize: 16 }}>{text.slice(0, shown)}</div>
      </div>
      <button className="btn red" onClick={onNext} disabled={shown < text.length}>
        {button}
      </button>
    </div>
  );
}
