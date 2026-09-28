import { useMemo } from 'react';
import { NPCS, type NpcId } from '../../core/characters';
import { portraitDataUrl, type Expression, type Look } from '../../game/sprites/portrait';

export function Portrait({
  npc,
  look,
  expression = 'neutral',
  size = 64,
  bg,
  title,
}: {
  npc?: NpcId;
  look?: Look;
  expression?: Expression;
  size?: number;
  bg?: string;
  title?: string;
}) {
  const l = look ?? NPCS[npc ?? 'scout'].look;
  const src = useMemo(() => portraitDataUrl(l, expression, 4, bg), [l, expression, bg]);
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={title ?? (npc ? NPCS[npc].name : 'portrait')}
      style={{ imageRendering: 'pixelated', border: '3px solid var(--line)', borderRadius: 10, flexShrink: 0, background: bg ?? '#ffe8b8' }}
    />
  );
}
