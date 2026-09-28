import { useEffect, useRef, useState } from 'react';
import { virtualInput } from '../../game/bus';

export function useIsTouch() {
  const [touch, setTouch] = useState(() => typeof window !== 'undefined' && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window));
  useEffect(() => {
    const on = () => setTouch(true);
    window.addEventListener('touchstart', on, { once: true });
    return () => window.removeEventListener('touchstart', on);
  }, []);
  return touch;
}

export function TouchControls() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [aDown, setADown] = useState(false);
  const [bDown, setBDown] = useState(false);
  const pointer = useRef<number | null>(null);

  useEffect(
    () => () => {
      virtualInput.x = 0;
      virtualInput.y = 0;
      virtualInput.action = false;
      virtualInput.run = false;
    },
    [],
  );

  const move = (e: React.PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    const r = base.current!.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = r.width / 2 - 14;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    setKnob({ x: dx, y: dy });
    const nx = dx / max;
    const ny = dy / max;
    virtualInput.x = Math.abs(nx) > 0.2 ? nx : 0;
    virtualInput.y = Math.abs(ny) > 0.2 ? ny : 0;
  };
  const end = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    virtualInput.x = 0;
    virtualInput.y = 0;
  };

  return (
    <div className="touch" aria-hidden>
      <div
        ref={base}
        className="joy"
        onPointerDown={(e) => {
          pointer.current = e.pointerId;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <button
        className={`touch-btn a ${aDown ? 'down' : ''}`}
        onPointerDown={() => {
          virtualInput.action = true;
          setADown(true);
        }}
        onPointerUp={() => {
          virtualInput.action = false;
          setADown(false);
        }}
        onPointerLeave={() => {
          virtualInput.action = false;
          setADown(false);
        }}
      >
        A
      </button>
      <button
        className={`touch-btn b ${bDown ? 'down' : ''}`}
        onPointerDown={() => {
          virtualInput.run = !virtualInput.run;
          setBDown(virtualInput.run);
        }}
      >
        RUN
      </button>
    </div>
  );
}
