import type { SqlEngine } from '../../engines/types';
import { SignOverlay } from '../overlays/Overlays';

export function BossBattle({ onClose }: { engine: SqlEngine; worldId: number; which: 'mini' | 'boss'; onClose: () => void }) {
  return <SignOverlay title="Boss battle" text="Coming in the next milestone!" onClose={onClose} />;
}
