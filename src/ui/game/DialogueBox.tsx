import { useCallback, useEffect, useRef, useState } from 'react';
import { NPCS, type NpcId } from '../../core/characters';
import { sfx } from '../../core/audio/sfx';
import type { DialogueAction, DialogueScript } from '../../core/dialogue/scripts';
import { useProgress } from '../../core/progress/store';
import { useSettings } from '../../core/settings';
import { Portrait } from '../components/Portrait';

const SPEED = { slow: 45, normal: 24, fast: 10, instant: 0 };

export function DialogueBox({ script, onAction }: { script: DialogueScript; onAction: (a: DialogueAction) => void }) {
  const [nodeId, setNodeId] = useState(script.start);
  const [shown, setShown] = useState(0);
  const [sel, setSel] = useState(0);
  const textSpeed = useSettings((s) => s.textSpeed);
  const pixel = useSettings((s) => s.pixelDialogue);
  const save = useProgress((s) => s.save);
  const node = script.nodes[nodeId];
  const full = node?.text ?? '';
  const done = shown >= full.length;
  const lock = useRef(false);

  useEffect(() => {
    setShown(SPEED[textSpeed] === 0 ? full.length : 0);
    setSel(0);
  }, [nodeId, full, textSpeed]);

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => {
      setShown((n) => Math.min(full.length, n + 1));
      const ch = full[shown];
      if (ch && /[a-z0-9]/i.test(ch) && shown % 2 === 0) {
        const pitch = node.speaker === 'player' ? 470 : NPCS[node.speaker as NpcId].voice;
        sfx('type', pitch * (0.9 + Math.random() * 0.2));
      }
    }, SPEED[textSpeed]);
    return () => clearTimeout(t);
  }, [shown, done, full, textSpeed, node]);

  const act = useCallback(
    (a: DialogueAction) => {
      if (a.type === 'goto') setNodeId(a.node);
      else onAction(a);
    },
    [onAction],
  );

  const advance = useCallback(() => {
    if (!node) return;
    if (!done) {
      setShown(full.length);
      return;
    }
    if (node.choices?.length) return;
    sfx('blip');
    if (node.then) return act(node.then);
    const i = script.order.indexOf(nodeId);
    if (i !== -1 && i < script.order.length - 1) setNodeId(script.order[i + 1]);
    else onAction({ type: 'close' });
  }, [node, done, full, act, script, nodeId, onAction]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lock.current) return;
      if (node?.choices?.length && done) {
        if (e.key === 'ArrowDown' || e.key === 's') setSel((s) => (s + 1) % node.choices!.length);
        else if (e.key === 'ArrowUp' || e.key === 'w') setSel((s) => (s - 1 + node.choices!.length) % node.choices!.length);
        else if (e.key === 'Enter' || e.key === ' ' || e.key === 'e') {
          e.preventDefault();
          sfx('select');
          act(node.choices[sel].action);
        } else if (e.key === 'Escape') onAction({ type: 'close' });
        return;
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'e') {
        e.preventDefault();
        advance();
      } else if (e.key === 'Escape') onAction({ type: 'close' });
    };
    // Ignore the key press that opened the dialogue.
    lock.current = true;
    const t = setTimeout(() => (lock.current = false), 180);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [node, done, sel, advance, act, onAction]);

  // Gamepad A/B/d-pad
  useEffect(() => {
    let raf = 0;
    let prev = { a: true, b: true, up: true, down: true };
    const poll = () => {
      const pad = navigator.getGamepads?.()[0];
      if (pad) {
        const cur = { a: !!pad.buttons[0]?.pressed, b: !!pad.buttons[1]?.pressed, up: !!pad.buttons[12]?.pressed, down: !!pad.buttons[13]?.pressed };
        if (cur.a && !prev.a) {
          if (node?.choices?.length && done) act(node.choices[sel].action);
          else advance();
        }
        if (cur.b && !prev.b) onAction({ type: 'close' });
        if (cur.down && !prev.down && node?.choices) setSel((s) => (s + 1) % node.choices!.length);
        if (cur.up && !prev.up && node?.choices) setSel((s) => (s - 1 + node.choices!.length) % node.choices!.length);
        prev = cur;
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [node, done, sel, advance, act, onAction]);

  if (!node) return null;
  const isPlayer = node.speaker === 'player';
  const speakerName = isPlayer ? save?.player.name ?? 'You' : NPCS[node.speaker as NpcId].name;
  return (
    <div className="dialogue-wrap" onClick={advance} role="dialog" aria-label={`${speakerName} says`}>
      <div className="dialogue panel bounce-in" onClick={(e) => e.stopPropagation()}>
        <div className="dialogue-portrait">
          {isPlayer ? (
            <Portrait look={{ ...save!.player.look, accent: '#ffd23f' }} size={84} />
          ) : (
            <Portrait npc={node.speaker as NpcId} expression={node.expression ?? 'neutral'} size={84} />
          )}
        </div>
        <div className="dialogue-body" onClick={advance}>
          <div className="dialogue-name">
            {speakerName}
            {!isPlayer && <span className="dialogue-role"> · {NPCS[node.speaker as NpcId].role}</span>}
          </div>
          <div className={`dialogue-text ${pixel ? 'pixelish' : ''}`} aria-live="polite">
            {full.slice(0, shown)}
            <span style={{ visibility: 'hidden' }}>{full.slice(shown)}</span>
          </div>
          {done && node.choices && (
            <div className="dialogue-choices">
              {node.choices.map((c, i) => (
                <button
                  key={i}
                  className={`dialogue-choice ${i === sel ? 'sel' : ''}`}
                  onMouseEnter={() => setSel(i)}
                  onClick={(e) => {
                    e.stopPropagation();
                    sfx('select');
                    act(c.action);
                  }}
                >
                  {i === sel ? '▶ ' : ''}
                  {c.label}
                </button>
              ))}
            </div>
          )}
          {done && !node.choices && <div className="dialogue-next">▼</div>}
        </div>
      </div>
    </div>
  );
}
