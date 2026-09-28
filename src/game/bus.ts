// Tiny typed event bus between React (UI) and Phaser (world).
import type { NpcId } from '../core/characters';

export type Interaction =
  | { kind: 'npc'; npc: NpcId; building: string | null }
  | { kind: 'building'; building: string }
  | { kind: 'exit' }
  | { kind: 'desk'; building: string; challengeId: string }
  | { kind: 'boss-door'; building: string; boss: 'mini' | 'boss' }
  | { kind: 'sign'; title: string; text: string }
  | { kind: 'arcade' };

export interface BusEvents {
  interact: Interaction;
  /** the prompt shown when near something interactable */
  prompt: { label: string } | null;
  /** React → game */
  pause: void;
  resume: void;
  refresh: void;
  enterBuilding: { building: string };
  exitBuilding: void;
  scene: { scene: 'campus' | 'interior'; building: string | null };
  clock: { hour: number };
}

type Handler<T> = (payload: T) => void;

class Bus {
  private handlers = new Map<keyof BusEvents, Set<Handler<unknown>>>();
  on<K extends keyof BusEvents>(event: K, fn: Handler<BusEvents[K]>): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn as Handler<unknown>);
    return () => this.handlers.get(event)?.delete(fn as Handler<unknown>);
  }
  emit<K extends keyof BusEvents>(event: K, ...payload: BusEvents[K] extends void ? [] : [BusEvents[K]]) {
    this.handlers.get(event)?.forEach((fn) => fn(payload[0]));
  }
}

export const bus = new Bus();

/** Virtual joystick / button state written by React touch controls, read by the game loop. */
export const virtualInput = { x: 0, y: 0, action: false, run: false };
