import { useMemo, useState } from 'react';
import { sfx } from '../../core/audio/sfx';
import { NPCS } from '../../core/characters';
import { useProgress, type RewardEvent } from '../../core/progress/store';
import { completeChallenge, recordAttempt } from '../../departments/sql/runtime';
import type { StakeholderChallenge, WriteChallenge } from '../../departments/sql/types';
import type { SqlEngine } from '../../engines/types';
import { Portrait } from '../components/Portrait';
import { PresentPanel } from './PresentPanel';
import { Workbench } from './Workbench';
import './terminal.css';

type Step = 'vague' | 'clarify' | 'investigate' | 'flag' | 'present' | 'done';

export function StakeholderOverlay({ engine, challenge: c, onClose, onNext }: { engine: SqlEngine; challenge: StakeholderChallenge; onClose: () => void; onNext?: () => void }) {
  const [step, setStep] = useState<Step>('vague');
  const [picked, setPicked] = useState<number[]>([]);
  const [patience, setPatience] = useState(3);
  const [flagChoice, setFlagChoice] = useState<number | null>(null);
  const [reward, setReward] = useState<RewardEvent | null>(null);
  const already = !!useProgress.getState().save?.solved[c.id];
  const npc = NPCS[c.giver];
  const goodCount = c.clarify.filter((x) => x.good).length;
  const need = Math.min(2, goodCount);
  const goodPicked = picked.filter((i) => c.clarify[i].good).length;

  const investigate: WriteChallenge = useMemo(
    () => ({
      id: `${c.id}#investigate`,
      world: c.world,
      type: 'write',
      title: c.title,
      giver: c.giver,
      story: c.clarify
        .filter((x, i) => picked.includes(i) && x.good)
        .map((x) => x.reply)
        .join(' '),
      question: c.investigate.question,
      concepts: c.concepts,
      starter: c.investigate.starter,
      solution: c.investigate.solution,
      orderMatters: c.investigate.orderMatters,
      expectedColumns: c.investigate.expectedColumns,
      hints: c.investigate.hints,
      why: c.why,
      bossOnly: true,
    }),
    [c, picked],
  );

  const steps: Step[] = ['vague', 'clarify', 'investigate', ...(c.flag ? (['flag'] as Step[]) : []), 'present', 'done'];

  return (
    <div className="overlay" role="dialog" aria-label={`Stakeholder quest: ${c.title}`}>
      <div className="panel">
        <div className="overlay-header">
          <span className="chip purple pixel-alt">🤝 Stakeholder</span>
          <h2>{c.title}</h2>
          <button className="btn small red" onClick={onClose}>
            ✕ Exit
          </button>
        </div>
        <div className="row wrap" style={{ gap: 4, padding: '6px 10px', borderBottom: '2px solid var(--line)' }}>
          {steps.map((s, i) => (
            <span key={s} className={`chip tiny ${s === step ? 'yellow' : steps.indexOf(step) > i ? 'green' : ''}`}>
              {i + 1}. {{ vague: 'Request', clarify: 'Clarify', investigate: 'Investigate', flag: 'Flag data', present: 'Present', done: 'Done' }[s]}
            </span>
          ))}
          {step === 'clarify' && <span className="chip red tiny">Patience: {'❤️'.repeat(patience) || '💢'}</span>}
        </div>

        {step === 'investigate' ? (
          <div className="col" style={{ flex: 1, minHeight: 0, gap: 0 }}>
            <Workbench
              engine={engine}
              challenge={investigate}
              mode="step"
              onSolved={() => setTimeout(() => setStep(c.flag ? 'flag' : 'present'), 900)}
            />
          </div>
        ) : (
          <div className="scroll" style={{ flex: 1, padding: 14 }}>
            <div className="col" style={{ gap: 12, maxWidth: 820, margin: '0 auto' }}>
              {step === 'vague' && (
                <>
                  <Say npc={c.giver} text={c.vague} expr="stressed" />
                  <div className="card tiny">
                    {c.story} Vague requests are normal. Your first job is to figure out what they actually need.
                  </div>
                  <button className="btn" onClick={() => setStep('clarify')}>
                    Ask clarifying questions ▶
                  </button>
                </>
              )}

              {step === 'clarify' && (
                <>
                  <Say npc={c.giver} text={c.vague} />
                  <div className="label-pixel">
                    PICK {need} GOOD CLARIFYING QUESTIONS ({goodPicked}/{need})
                  </div>
                  {c.clarify.map((q, i) => (
                    <div key={i} className="col" style={{ gap: 4 }}>
                      <button
                        className={`choice ${picked.includes(i) ? (q.good ? 'right' : 'wrong') : ''}`}
                        disabled={picked.includes(i) || goodPicked >= need}
                        onClick={() => {
                          setPicked((p) => [...p, i]);
                          if (q.good) sfx('select');
                          else {
                            sfx('wrong');
                            setPatience((p) => Math.max(0, p - 1));
                          }
                        }}
                      >
                        🙋 {q.text}
                      </button>
                      {picked.includes(i) && (
                        <div className="row" style={{ gap: 8, paddingLeft: 10 }}>
                          <Portrait npc={c.giver} size={32} expression={q.good ? 'happy' : 'stressed'} />
                          <div className="tiny">{q.reply}</div>
                        </div>
                      )}
                    </div>
                  ))}
                  <button className="btn green" disabled={goodPicked < need} onClick={() => setStep('investigate')}>
                    Got it, let me dig in ▶
                  </button>
                </>
              )}

              {step === 'flag' && c.flag && (
                <>
                  <Say npc="devin" text={c.flag.prompt} />
                  {c.flag.options.map((o, i) => (
                    <div key={i} className="col" style={{ gap: 4 }}>
                      <button
                        className={`choice ${flagChoice === i ? (o.correct ? 'right' : 'wrong') : ''}`}
                        disabled={flagChoice !== null && c.flag!.options[flagChoice].correct}
                        onClick={() => {
                          setFlagChoice(i);
                          sfx(o.correct ? 'select' : 'wrong');
                        }}
                      >
                        {o.text}
                      </button>
                      {flagChoice === i && <div className="tiny" style={{ paddingLeft: 10 }}>{o.reply}</div>}
                    </div>
                  ))}
                  <button className="btn green" disabled={flagChoice === null || !c.flag.options[flagChoice].correct} onClick={() => setStep('present')}>
                    Now brief {npc.name.split(' ')[0]} ▶
                  </button>
                </>
              )}

              {step === 'present' && (
                <>
                  <Say npc={c.giver} text={`So? ${c.vague}`} />
                  <PresentPanel
                    engine={engine}
                    step={c.present}
                    seed={c.id}
                    solved={false}
                    onAnswer={(ok) => {
                      if (!already) recordAttempt(c);
                      if (!ok) {
                        sfx('wrong');
                        return;
                      }
                      sfx('correct');
                      useProgress.getState().update((s) => {
                        s.stats.stakeholder++;
                      });
                      setReward(completeChallenge(c));
                      setTimeout(() => setStep('done'), 900);
                    }}
                  />
                </>
              )}

              {step === 'done' && (
                <div className="col bounce-in" style={{ gap: 10 }}>
                  <Say npc={c.giver} text="That's exactly what I needed. Short, clear, with numbers. Thank you!" expr="happy" />
                  <div className="solved-banner">
                    <div className="big">BRIEFED!</div>
                    {reward && (
                      <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 6 }}>
                        <span className="chip purple">+{reward.xp} XP</span>
                        <span className="chip yellow">+{reward.coins} 🪙</span>
                      </div>
                    )}
                  </div>
                  <div className="card">
                    <div className="label-pixel">WHY THIS MATTERS</div>
                    {c.why}
                  </div>
                  <button className="btn green" onClick={onNext ?? onClose}>
                    Next ▶
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Say({ npc, text, expr = 'neutral' }: { npc: StakeholderChallenge['giver']; text: string; expr?: 'neutral' | 'happy' | 'stressed' }) {
  return (
    <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
      <Portrait npc={npc} size={64} expression={expr} />
      <div className="speech grow">
        <div className="label-pixel">{NPCS[npc].name.toUpperCase()}</div>
        <div style={{ fontSize: 16 }}>{text}</div>
      </div>
    </div>
  );
}
