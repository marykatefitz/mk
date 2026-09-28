import type { SqlEngine } from '../engines/types';
import { SignOverlay } from '../ui/overlays/Overlays';

export function ArcadeOverlay({ onClose }: { engine: SqlEngine; onClose: () => void }) {
  return <SignOverlay title="Arcade" text="Coming soon!" onClose={onClose} />;
}
