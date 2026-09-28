import { useEffect, useMemo, useState } from 'react';
import { sfx } from '../../core/audio/sfx';
import { computeFacts, fillCard, scorePresentation, SLOTS, type PresentScore } from '../../departments/sql/present';
import { shuffleOptions } from '../../departments/sql/predict';
import type { PresentCard, PresentStep } from '../../departments/sql/types';
import type { SqlEngine } from '../../engines/types';

export function PresentPanel({
  engine,
  step,
  seed,
  solved,
  locked,
  onAnswer,
}: {
  engine: SqlEngine;
  step: PresentStep;
  seed: string;
  solved: boolean;
  locked?: boolean;
  onAnswer: (ok: boolean) => void;
}) {
  const [facts, setFacts] = useState<Record<string, number | string> | null>(null);
  const [slots, setSlots] = useState<(PresentCard | null)[]>([null, null, null]);
  const [score, setScore] = useState<PresentScore | null>(null);
  const pool = useMemo(() => shuffleOptions(step.cards, seed), [step, seed]);

  useEffect(() => {
    computeFacts(engine, step).then(setFacts);
    setSlots([null, null, null]);
    setScore(null);
  }, [engine, step]);

  useEffect(() => {
    if (solved) {
      const right = SLOTS.map((s) => step.cards.find((c) => c.role === s.role) ?? null);
      setSlots(right);
    }
  }, [solved, step]);

  if (!facts) return <div className="muted">Pulling the numbers…</div>;
  const used = new Set(slots.filter(Boolean).map((c) => c!.id));
  const place = (c: PresentCard) => {
    if (solved || locked) return;
    const i = slots.findIndex((s) => !s);
    if (i === -1) return;
    sfx('blip');
    setScore(null);
    setSlots((s) => s.map((x, j) => (j === i ? c : x)));
  };
  const unplace = (i: number) => {
    if (solved || locked) return;
    setScore(null);
    setSlots((s) => s.map((x, j) => (j === i ? null : x)));
  };
  const submit = () => {
    const sc = scorePresentation(slots);
    setScore(sc);
    onAnswer(sc.ok);
  };

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="tiny muted">Build a 3-sentence answer: tap cards to place them. Great updates go Answer → So-what → Detail, with real numbers.</div>
      <div className="col" style={{ gap: 6 }}>
        {SLOTS.map((s, i) => (
          <button key={s.role} className={`present-slot ${slots[i] ? 'filled' : ''}`} onClick={() => unplace(i)} disabled={!slots[i] || solved}>
            <span className="label-pixel">{s.label}</span>
            <span>{slots[i] ? fillCard(slots[i]!.text, facts) : <em className="muted">{s.tip}</em>}</span>
          </button>
        ))}
      </div>
      {!solved && (
        <>
          <div className="label-pixel">CARDS</div>
          <div className="col" style={{ gap: 6 }}>
            {pool
              .filter((c) => !used.has(c.id))
              .map((c) => (
                <button key={c.id} className="choice" onClick={() => place(c)} disabled={locked}>
                  {fillCard(c.text, facts)}
                </button>
              ))}
          </div>
          <button className="btn green" onClick={submit} disabled={slots.some((s) => !s) || locked}>
            🗣️ Present it
          </button>
        </>
      )}
      {score && !score.ok && (
        <div className="feedback bad">
          <strong>Not quite. Here's the feedback:</strong>
          <ul>
            {score.feedback.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {(solved || score?.ok) && <div className="feedback good">✅ Clear, specific and short. That's how you brief a GM.</div>}
    </div>
  );
}
