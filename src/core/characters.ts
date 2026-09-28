export type NpcId = 'rhonda' | 'tony' | 'priya' | 'earl' | 'walt' | 'marge' | 'devin' | 'jess' | 'nova' | 'scout';

export interface Npc {
  id: NpcId;
  name: string;
  role: string;
  personality: string;
  /** colors for the procedural portrait + sprite */
  look: { skin: string; hair: string; hairStyle: 'short' | 'bun' | 'long' | 'bald' | 'cap' | 'curly' | 'buzz'; shirt: string; accent: string; glasses?: boolean; beard?: boolean };
  /** typewriter blip pitch in Hz */
  voice: number;
  greeting: string;
}

export const NPCS: Record<NpcId, Npc> = {
  rhonda: {
    id: 'rhonda',
    name: 'Rhonda Vance',
    role: 'General Manager',
    personality: "Blunt, big-picture, hates surprises. 'Don't bring me a table, bring me an answer.'",
    look: { skin: '#c68863', hair: '#3b2418', hairStyle: 'bun', shirt: '#2f4b8f', accent: '#ffd23f', glasses: true },
    voice: 330,
    greeting: "You're the new analyst? Good. I've got questions and not a lot of patience.",
  },
  tony: {
    id: 'tony',
    name: 'Tony "Two-Pens" Delgado',
    role: 'Sales Manager',
    personality: 'High energy, always closing, secretly worried about close rate.',
    look: { skin: '#a8714f', hair: '#1c1410', hairStyle: 'short', shirt: '#e0473b', accent: '#ffffff' },
    voice: 440,
    greeting: "My friend! Every lead is a deal waiting to happen. Let's find 'em!",
  },
  priya: {
    id: 'priya',
    name: 'Priya Nair',
    role: 'Service Manager',
    personality: 'Calm, systems-minded, lives by the repair order.',
    look: { skin: '#8d5b3e', hair: '#141018', hairStyle: 'long', shirt: '#14b8a6', accent: '#2b1d3a' },
    voice: 392,
    greeting: 'Every RV that rolls into my bay gets a work order. Every work order tells a story.',
  },
  earl: {
    id: 'earl',
    name: 'Earl "Grease" Buckley',
    role: 'Master Technician',
    personality: 'Grumpy but lovable. 28 years on flat-rate. Has opinions about slide-outs.',
    look: { skin: '#e2b08f', hair: '#d8d8d8', hairStyle: 'cap', shirt: '#4a5d3a', accent: '#ff7a2f', beard: true },
    voice: 180,
    greeting: "Hmph. Another computer person. Fine. Don't touch my torque wrench.",
  },
  walt: {
    id: 'walt',
    name: 'Walt Kimura',
    role: 'F&I Manager',
    personality: 'Smooth, precise, compliance-obsessed. Knows every penetration rate by heart.',
    look: { skin: '#e8c3a0', hair: '#2a2a2a', hairStyle: 'short', shirt: '#1f2937', accent: '#b91c1c', glasses: true },
    voice: 262,
    greeting: 'Welcome to the box. In here, every product must be offered to every customer. Every time.',
  },
  marge: {
    id: 'marge',
    name: 'Margaret "Marge" Okafor',
    role: 'Controller',
    personality: 'Penny-exact. Fears the floorplan audit. Guards the Vault.',
    look: { skin: '#6b4430', hair: '#231816', hairStyle: 'curly', shirt: '#6d3fd6', accent: '#ffd23f', glasses: true },
    voice: 294,
    greeting: 'Every unit on that lot is borrowed money. Borrowed money has a clock on it.',
  },
  devin: {
    id: 'devin',
    name: 'Devin Park',
    role: 'Data Engineer',
    personality: "Hoodie, cold brew, owns the pipelines. 'The -1s are legacy. Not my fault. Okay, partly my fault.'",
    look: { skin: '#f0cfae', hair: '#2d2522', hairStyle: 'buzz', shirt: '#37c46b', accent: '#2b1d3a' },
    voice: 350,
    greeting: "Hey. If you find bad data, tell me early. I'd rather hear it from you than from Rhonda.",
  },
  jess: {
    id: 'jess',
    name: 'Jess Alvarez',
    role: 'HR Lead',
    personality: 'Warm, organized, protective of employee privacy.',
    look: { skin: '#b98260', hair: '#5a2f1c', hairStyle: 'long', shirt: '#f472b6', accent: '#ffffff' },
    voice: 415,
    greeting: "People data is still people. We handle it with care. (And yes, all these numbers are fictional.)",
  },
  nova: {
    id: 'nova',
    name: 'Nova Reyes',
    role: 'AI Lead',
    personality: 'Enthusiastic, slightly chaotic, always has a new model to try.',
    look: { skin: '#d4a07a', hair: '#7c3aed', hairStyle: 'short', shirt: '#0f172a', accent: '#22d3ee' },
    voice: 494,
    greeting: "The AI Lab isn't open yet... but when it is, oh, the things we'll build!",
  },
  scout: {
    id: 'scout',
    name: 'Scout',
    role: 'Lot Porter & your buddy',
    personality: 'Friendly, knows everyone, runs the hint shop.',
    look: { skin: '#f3c9a4', hair: '#e8a33d', hairStyle: 'cap', shirt: '#ff7a2f', accent: '#ffd23f' },
    voice: 523,
    greeting: "Hi hi! I'm Scout. I park the RVs, I know all the gossip, and I sell hints for coins!",
  },
};
