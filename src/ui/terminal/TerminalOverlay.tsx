import { useEffect } from 'react';
import { sfx } from '../../core/audio/sfx';
import { CHALLENGE_BY_ID, WORLDS } from '../../departments/sql';
import type { SqlEngine } from '../../engines/types';
import { Workbench } from './Workbench';

export function TerminalOverlay({
  engine,
  challengeId,
  onClose,
  onNext,
}: {
  engine: SqlEngine;
  challengeId: string;
  onClose: () => void;
  onNext?: () => void;
}) {
  const c = CHALLENGE_BY_ID[challengeId];
  const world = WORLDS.find((w) => w.id === c.world);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target as HTMLElement)?.closest?.('.cm-editor')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" role="dialog" aria-label={`Terminal: ${c.title}`}>
      <div className="panel">
        <div className="overlay-header">
          <span className="chip orange pixel-alt">{world?.name ?? 'SQL'}</span>
          <h2>{c.title}</h2>
          <button
            className="btn small red"
            onClick={() => {
              sfx('back');
              onClose();
            }}
          >
            ✕ Exit
          </button>
        </div>
        <Workbench engine={engine} challenge={c} mode="quest" onNext={onNext} />
      </div>
    </div>
  );
}
