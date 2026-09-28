import { useEffect, useState } from 'react';
import { music } from '../core/audio/music';
import { sfx } from '../core/audio/sfx';
import { useProgress } from '../core/progress/store';
import type { SqlEngine } from '../engines/types';
import { BugHunt, ClauseOrder, JoinJam, LingoMatch, RowRoulette } from './games';
import { MinigameShell } from './Shell';
import './minigames.css';

const GAMES = [
  { id: 'clause-order', title: 'Clause Order', icon: '🧩', seconds: 60, blurb: 'Tap clauses in the order SQL really runs them.', howTo: ['You see the clauses of a real query, shuffled.', 'Tap them in LOGICAL order: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT.', 'Wrong taps cost 3 seconds.'] },
  { id: 'join-jam', title: 'Join Jam', icon: '🔗', seconds: 75, blurb: 'Connect tables by their keys. Watch for composite keys!', howTo: ['Tap a column on the left table, then the matching key on the right.', 'Some levels need TWO pairs (composite keys like wo_number + location_id).', 'Wrong links cost 3 seconds.'] },
  { id: 'bug-hunt', title: 'Bug Hunt', icon: '🐞', seconds: 75, blurb: 'Tap the token that breaks the query.', howTo: ['Each query has exactly one bug.', 'Tap the word or symbol that causes it.', 'You will see why after each squash.'] },
  { id: 'row-roulette', title: 'Row Count Roulette', icon: '🎰', seconds: 60, blurb: 'Guess how many rows. Streaks pay more!', howTo: ['Read the query.', 'Pick the bracket its row count falls into.', 'Correct answers in a row build a streak bonus.'] },
  { id: 'lingo-match', title: 'Lingo Match', icon: '🃏', seconds: 90, blurb: 'Memory match: dealer terms ↔ meanings.', howTo: ['Flip two cards at a time.', 'Match a term with its definition.', 'Uses the codex terms you have unlocked.'] },
] as const;

type GameId = (typeof GAMES)[number]['id'];

export function ArcadeOverlay({ engine, onClose }: { engine: SqlEngine; onClose: () => void }) {
  const [game, setGame] = useState<GameId | null>(null);
  const save = useProgress((s) => s.save);
  useEffect(() => {
    music.play('arcade');
    return () => music.play('overworld');
  }, []);
  const g = GAMES.find((x) => x.id === game);
  return (
    <div className="overlay" role="dialog" aria-label="Arcade">
      <div className="panel arcade" style={{ maxWidth: 900 }}>
        {!g ? (
          <>
            <div className="overlay-header">
              <h2>🕹️ Arcade Trailer</h2>
              <button className="btn small red" onClick={onClose} autoFocus>
                ✕ Leave
              </button>
            </div>
            <div className="scroll" style={{ padding: 14, flex: 1 }}>
              <div className="cabinets">
                {GAMES.map((x) => (
                  <button
                    key={x.id}
                    className="cabinet"
                    onClick={() => {
                      sfx('select');
                      setGame(x.id);
                    }}
                  >
                    <div style={{ fontSize: 40 }}>{x.icon}</div>
                    <div className="pixel" style={{ fontSize: 11 }}>
                      {x.title}
                    </div>
                    <div className="tiny">{x.blurb}</div>
                    <span className="chip yellow tiny">Best: {save?.minigames[x.id] ?? 0}</span>
                  </button>
                ))}
                <div className="cabinet locked">
                  <div style={{ fontSize: 40 }}>🕵️</div>
                  <div className="pixel" style={{ fontSize: 11 }}>
                    DAX Detective
                  </div>
                  <div className="tiny">Figure out the filter context. Opens with the BI Studio.</div>
                  <span className="chip tiny">🔒 Coming soon</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <MinigameShell id={g.id} title={g.title} icon={g.icon} howTo={[...g.howTo]} seconds={g.seconds} onExit={() => setGame(null)}>
            {(api) =>
              g.id === 'clause-order' ? (
                <ClauseOrder api={api} />
              ) : g.id === 'join-jam' ? (
                <JoinJam api={api} />
              ) : g.id === 'bug-hunt' ? (
                <BugHunt api={api} />
              ) : g.id === 'row-roulette' ? (
                <RowRoulette api={api} engine={engine} />
              ) : (
                <LingoMatch api={api} />
              )
            }
          </MinigameShell>
        )}
      </div>
    </div>
  );
}
