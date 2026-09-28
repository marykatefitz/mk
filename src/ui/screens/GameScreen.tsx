import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx } from '../../core/audio/sfx';
import { dialogueFor, type DialogueAction, type DialogueScript } from '../../core/dialogue/scripts';
import { useProgress } from '../../core/progress/store';
import { bossState, challengeState, world, worldState } from '../../core/quests/unlocks';
import type { LoadStage } from '../../engines/duckdb';
import type { SqlEngine } from '../../engines/types';
import { bus, type Interaction } from '../../game/bus';
import { BUILDING_BY_ID } from '../../game/world/buildings';
import { LoadingScreen } from '../components/LoadingScreen';
import { DialogueBox } from '../game/DialogueBox';
import { HUD } from '../game/HUD';
import { Juice } from '../game/Juice';
import { TouchControls, useIsTouch } from '../game/TouchControls';
import '../game/game.css';
import { CodexOverlay, LessonOverlay, MenuOverlay, SignOverlay } from '../overlays/Overlays';
import { SchemaExplorer } from '../overlays/SchemaExplorer';
import { TerminalOverlay } from '../terminal/TerminalOverlay';
import { BossBattle } from '../boss/BossBattle';
import { ArcadeOverlay } from '../../minigames/ArcadeOverlay';

type Overlay =
  | { kind: 'dialogue'; script: DialogueScript }
  | { kind: 'terminal'; challengeId: string; building: string }
  | { kind: 'lesson'; world: number }
  | { kind: 'codex' }
  | { kind: 'menu' }
  | { kind: 'schema' }
  | { kind: 'sign'; title: string; text: string }
  | { kind: 'boss'; world: number; which: 'mini' | 'boss' }
  | { kind: 'arcade' };

const needsDb = (o: Overlay | null) => o?.kind === 'terminal' || o?.kind === 'schema' || o?.kind === 'boss' || o?.kind === 'arcade';

export function GameScreen({ onQuit }: { onQuit: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [engine, setEngine] = useState<SqlEngine | null>(null);
  const [dbStage, setDbStage] = useState<LoadStage>('engine');
  const [dbError, setDbError] = useState<string | null>(null);
  const [currentBuilding, setCurrentBuilding] = useState<string | null>(null);
  const touch = useIsTouch();
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  const loadDb = useCallback(() => {
    import('../../engines/duckdb')
      .then(({ getDealerDb }) => getDealerDb(setDbStage))
      .then((e) => setEngine(e))
      .catch((e) => setDbError(String(e?.message ?? e)));
  }, []);

  // Boot Phaser lazily.
  useEffect(() => {
    let destroy: (() => void) | null = null;
    let cancelled = false;
    import('../../game').then(({ createGame }) => {
      if (cancelled || !host.current) return;
      destroy = createGame(host.current).destroy;
    });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, []);

  // Pause the world while any overlay is open.
  useEffect(() => {
    if (overlay) bus.emit('pause');
    else bus.emit('resume');
    if (needsDb(overlay) && !engine) loadDb();
  }, [overlay, engine, loadDb]);

  // Track scene & prefetch the database once the player steps into a department.
  useEffect(() => {
    return bus.on('scene', ({ building }) => {
      setCurrentBuilding(building);
      if (building && !engine) {
        const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 800));
        idle(() => loadDb());
      }
    });
  }, [engine, loadDb]);

  // New game: Rhonda greets you.
  useEffect(() => {
    const save = useProgress.getState().save;
    if (save && !save.flags.introDone) {
      const t = setTimeout(() => setOverlay({ kind: 'dialogue', script: dialogueFor('rhonda', save, null) }), 900);
      return () => clearTimeout(t);
    }
  }, []);

  const handleInteract = useCallback((it: Interaction) => {
    if (overlayRef.current) return;
    const save = useProgress.getState().save!;
    switch (it.kind) {
      case 'npc':
        setOverlay({ kind: 'dialogue', script: dialogueFor(it.npc, save, it.building) });
        break;
      case 'building':
        sfx('door');
        bus.emit('enterBuilding', { building: it.building });
        break;
      case 'exit':
        sfx('door');
        bus.emit('exitBuilding');
        break;
      case 'sign':
        setOverlay({ kind: 'sign', title: it.title, text: it.text });
        break;
      case 'arcade':
        setOverlay({ kind: 'arcade' });
        break;
      case 'desk': {
        const b = BUILDING_BY_ID[it.building];
        const w = world(b.world!);
        if (!w) return;
        const idx = w.challenges.indexOf(it.challengeId);
        if (challengeState(save, w, idx) === 'locked') {
          setOverlay({ kind: 'sign', title: `Terminal ${idx + 1} is locked`, text: `Solve terminal ${idx} first. Quests unlock in order.` });
          return;
        }
        setOverlay({ kind: 'terminal', challengeId: it.challengeId, building: it.building });
        break;
      }
      case 'boss-door': {
        const b = BUILDING_BY_ID[it.building];
        const wid = b.world!;
        if (wid === 8) {
          if (worldState(save, 8) === 'locked') setOverlay({ kind: 'sign', title: 'The Monthly Ops Review', text: 'Rhonda will call you in once you have beaten all seven department bosses.' });
          else setOverlay({ kind: 'boss', world: 8, which: 'boss' });
          return;
        }
        const w = world(wid);
        if (!w) return;
        const st = bossState(save, w, it.boss);
        if (st === 'locked') {
          const text = it.boss === 'mini' ? `Solve 5 terminals in the ${w.name} to face ${w.miniBoss.name}.` : `Solve every terminal and beat ${w.miniBoss.name} first.`;
          setOverlay({ kind: 'sign', title: 'Locked', text });
        } else setOverlay({ kind: 'boss', world: wid, which: it.boss });
        break;
      }
    }
  }, []);

  useEffect(() => bus.on('interact', handleInteract), [handleInteract]);

  // Esc opens the menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !overlayRef.current) setOverlay({ kind: 'menu' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = useCallback(() => {
    setOverlay(null);
    bus.emit('refresh');
  }, []);

  const onDialogueAction = useCallback(
    (a: DialogueAction) => {
      switch (a.type) {
        case 'close':
          close();
          break;
        case 'finishIntro':
          useProgress.getState().update((s) => {
            s.flags.introDone = true;
            for (const c of ['dms', 'crm']) if (!s.codex.includes(c)) s.codex.push(c);
          });
          sfx('unlock');
          close();
          break;
        case 'lesson':
          setOverlay({ kind: 'lesson', world: a.world });
          break;
        case 'enter':
          setOverlay(null);
          bus.emit('enterBuilding', { building: a.building });
          break;
        case 'codex':
          setOverlay({ kind: 'codex' });
          break;
        case 'boss':
          setOverlay({ kind: 'boss', world: a.world, which: a.which });
          break;
        default:
          close();
      }
    },
    [close],
  );

  const nextChallenge = (id: string, building: string) => {
    const w = world(BUILDING_BY_ID[building].world!);
    if (!w) return close();
    const idx = w.challenges.indexOf(id);
    const save = useProgress.getState().save!;
    const nextIdx = idx + 1;
    if (nextIdx < w.challenges.length && challengeState(save, w, nextIdx) !== 'locked') {
      setOverlay({ kind: 'terminal', challengeId: w.challenges[nextIdx], building });
    } else close();
  };

  const dbGate = needsDb(overlay) && !engine;

  return (
    <div className="game-root">
      <div ref={host} className="game-canvas" />
      <HUD
        touch={touch}
        onMenu={() => setOverlay({ kind: 'menu' })}
        onCodex={() => setOverlay({ kind: 'codex' })}
        onSchema={() => setOverlay({ kind: 'schema' })}
      />
      {touch && !overlay && <TouchControls />}
      {overlay?.kind === 'dialogue' && <DialogueBox script={overlay.script} onAction={onDialogueAction} />}
      {overlay?.kind === 'sign' && <SignOverlay title={overlay.title} text={overlay.text} onClose={close} />}
      {overlay?.kind === 'lesson' && <LessonOverlay worldId={overlay.world} onClose={close} />}
      {overlay?.kind === 'codex' && <CodexOverlay onClose={close} />}
      {overlay?.kind === 'menu' && (
        <MenuOverlay
          onClose={close}
          onQuit={() => {
            useProgress.getState().quit();
            onQuit();
          }}
        />
      )}
      {dbGate && (
        <div className="overlay" style={{ padding: 0 }}>
          <div style={{ width: '100%' }}>
            <LoadingScreen stage={dbStage} error={dbError} />
            <div className="center">
              <button className="btn small ghost" onClick={close}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {engine && overlay?.kind === 'terminal' && (
        <TerminalOverlay engine={engine} challengeId={overlay.challengeId} onClose={close} onNext={() => nextChallenge(overlay.challengeId, overlay.building)} />
      )}
      {engine && overlay?.kind === 'schema' && <SchemaExplorer engine={engine} onClose={close} />}
      {engine && overlay?.kind === 'boss' && <BossBattle engine={engine} worldId={overlay.world} which={overlay.which} onClose={close} />}
      {engine && overlay?.kind === 'arcade' && <ArcadeOverlay engine={engine} onClose={close} />}
      <Juice />
      <span className="sr-only" aria-live="polite">
        {currentBuilding ? `Inside ${BUILDING_BY_ID[currentBuilding]?.name}` : 'On the campus'}
      </span>
    </div>
  );
}
