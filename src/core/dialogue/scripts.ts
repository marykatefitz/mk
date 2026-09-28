// NPC dialogue scripts. Each call builds a small dialogue tree from the
// current save, so NPCs react to your progress.

import { NPCS, type NpcId } from '../characters';
import type { SaveData } from '../progress/store';
import { bossState, currentObjective, world, worldState } from '../quests/unlocks';
import { isRvShowWeekend } from '../events';
import type { Expression } from '../../game/sprites/portrait';

export type DialogueAction =
  | { type: 'close' }
  | { type: 'goto'; node: string }
  | { type: 'finishIntro' }
  | { type: 'lesson'; world: number }
  | { type: 'enter'; building: string }
  | { type: 'codex' }
  | { type: 'boss'; world: number; which: 'mini' | 'boss' }
  | { type: 'stakeholder'; id: string };

export interface DialogueNode {
  speaker: NpcId | 'player';
  text: string;
  expression?: Expression;
  choices?: { label: string; action: DialogueAction }[];
  /** action when advancing past a node without choices (default: next node / close) */
  then?: DialogueAction;
}

export interface DialogueScript {
  nodes: Record<string, DialogueNode>;
  start: string;
  /** linear order used when a node has no `then` */
  order: string[];
}

function linear(nodes: DialogueNode[]): DialogueScript {
  const rec: Record<string, DialogueNode> = {};
  const order = nodes.map((_, i) => `n${i}`);
  nodes.forEach((n, i) => (rec[`n${i}`] = n));
  return { nodes: rec, start: 'n0', order };
}

const WORLD_OF: Partial<Record<NpcId, number>> = { tony: 2, priya: 3, walt: 4, marge: 5, devin: 6, jess: 7 };
const BUILDING_OF: Partial<Record<NpcId, string>> = { tony: 'showroom', priya: 'service', walt: 'fi', marge: 'vault', devin: 'data', jess: 'hr', rhonda: 'lot' };

export function dialogueFor(npc: NpcId, save: SaveData, building: string | null): DialogueScript {
  const name = save.player.name;
  const obj = currentObjective(save);

  if (npc === 'rhonda' && !save.flags.introDone) {
    return withIds(
      [['n0', 'n1', 'n2', 'n3'], { what: 4, start: 5 }],
      [
        { speaker: 'rhonda', text: `You must be ${name}, the new analyst. I'm Rhonda Vance, General Manager here at Summit Trail RV.`, expression: 'neutral' },
        { speaker: 'rhonda', text: 'Twelve stores. About fifteen hundred RVs. Two years of data in the DMS, the CRM and the floorplan portal. And a lot of it is... messy.', expression: 'stressed' },
        { speaker: 'rhonda', text: "Everybody here has questions. Tony wants leads, Priya wants her techs measured, Marge wants to know what's costing us interest.", expression: 'neutral' },
        {
          speaker: 'rhonda',
          text: 'Your job is to answer them with SQL. Real queries, real data. Questions before you start?',
          choices: [
            { label: 'What exactly does an analyst do here?', action: { type: 'goto', node: 'what' } },
            { label: 'Where do I start?', action: { type: 'goto', node: 'start' } },
          ],
        },
        { speaker: 'rhonda', text: "Turn raw tables into answers people can act on. Don't bring me a table, bring me an answer. And if you're stuck or the data looks wrong, say so early.", then: { type: 'goto', node: 'start' } },
        { speaker: 'rhonda', text: 'Start on the lot. The Lot Office is just east of here (look for the orange roof). Its terminals will get you querying the units table.', expression: 'happy', then: { type: 'finishIntro' } },
      ],
    );
  }

  // Quest givers inside (or outside) their building.
  const wid = npc === 'rhonda' ? (building === 'hq' ? 8 : 1) : WORLD_OF[npc];
  if (wid) {
    const st = worldState(save, wid);
    const w = world(wid);
    const b = BUILDING_OF[npc] ?? (wid === 8 ? 'hq' : null);
    const greet = NPCS[npc].greeting;
    if (st === 'locked') {
      return linear([
        { speaker: npc, text: greet },
        { speaker: npc, text: "I'll have work for you soon. Finish up with the department before mine first.", expression: 'neutral' },
        { speaker: npc, text: `Right now: ${obj.text}` },
      ]);
    }
    if (st === 'building' || !w) {
      return linear([
        { speaker: npc, text: greet },
        { speaker: npc, text: "My department's quests are still being set up. Come back after the next update!", expression: 'happy' },
      ]);
    }
    const choices: { label: string; action: DialogueAction }[] = [];
    if (!building && b) choices.push({ label: `Let's go inside (${w.name})`, action: { type: 'enter', building: b } });
    choices.push({ label: `Teach me the lingo (${w.name} lesson)`, action: { type: 'lesson', world: wid } });
    if (bossState(save, w, 'mini') === 'available') choices.push({ label: `I'm ready for ${w.miniBoss.name}!`, action: { type: 'boss', world: wid, which: 'mini' } });
    if (bossState(save, w, 'boss') === 'available') choices.push({ label: `Bring on ${w.boss.name}!`, action: { type: 'boss', world: wid, which: 'boss' } });
    choices.push({ label: 'What should I work on?', action: { type: 'goto', node: 'obj' } });
    choices.push({ label: 'Bye!', action: { type: 'close' } });
    const cleared = st === 'cleared';
    return {
      start: 'hi',
      order: ['hi'],
      nodes: {
        hi: {
          speaker: npc,
          text: cleared ? `${name}! You beat ${w.boss.name}. The ${w.name} runs smoother thanks to you.` : greet,
          expression: cleared ? 'happy' : 'neutral',
          choices,
        },
        obj: { speaker: npc, text: obj.text, then: { type: 'goto', node: 'hi' } },
      },
    };
  }

  switch (npc) {
    case 'scout':
      return linear([
        { speaker: 'scout', text: isRvShowWeekend(new Date()) ? "It's RV Show weekend! Tents on the lot, crowds everywhere. Everything pays DOUBLE coins!" : "Hi hi! Need a hint? Open any terminal and tap the 💡 buttons. Costs a few coins, no shame.", expression: 'happy' },
        { speaker: 'scout', text: 'Gossip of the day: ' + gossip(save), expression: 'surprised' },
        { speaker: 'scout', text: `Your objective: ${obj.text}` },
      ]);
    case 'earl':
      return linear([
        { speaker: 'earl', text: NPCS.earl.greeting, expression: 'stressed' },
        { speaker: 'earl', text: "Flat rate means the book says a slide-out adjustment is 1.5 hours. I do it in one. That's why my efficiency is over 150%.", expression: 'neutral' },
        { speaker: 'earl', text: "And if some data person joins work orders on WO number alone? Every store has an RO 10001, genius. Hmph.", expression: 'stressed' },
      ]);
    case 'nova':
      return linear([
        { speaker: 'nova', text: NPCS.nova.greeting, expression: 'happy' },
        { speaker: 'nova', text: 'Python, pandas, lead scoring, forecasting... and LLMs that write SQL! The AI Lab opens in a future phase.', expression: 'surprised' },
      ]);
    default:
      return linear([{ speaker: npc, text: NPCS[npc].greeting }]);
  }
}

function withIds(meta: [string[], Record<string, number>], nodes: DialogueNode[]): DialogueScript {
  const [order, named] = meta;
  const rec: Record<string, DialogueNode> = {};
  nodes.forEach((n, i) => (rec[`n${i}`] = n));
  for (const [k, i] of Object.entries(named)) rec[k] = nodes[i];
  return { nodes: rec, start: 'n0', order };
}

function gossip(save: SaveData): string {
  const lines = [
    "Devin says the CRM migration in March 2025 duplicated a bunch of leads. Nobody's cleaned it up yet.",
    'Boise has units that have been on the lot for WAY too long. Marge keeps muttering about curtailments.',
    'Tucson sells plenty of RVs, but their F&I numbers look... thin.',
    "Earl has worked here since 1998. He's still the fastest tech in the company.",
    'Somebody entered -1 as the salesperson on a few deals. Tony is NOT happy.',
    'Phoenix carries the most expensive Class A units. Big floorplan balances there!',
  ];
  return lines[(Object.keys(save.solved).length + new Date().getDate()) % lines.length];
}
