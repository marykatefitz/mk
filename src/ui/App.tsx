import { useEffect, useState } from 'react';
import { useProgress, type PlayerLook } from '../core/progress/store';
import { applySettingsToDocument } from '../core/settings';
import { CharacterCreator } from './screens/CharacterCreator';
import { GameScreen } from './screens/GameScreen';
import { TitleScreen } from './screens/TitleScreen';

type Screen = { kind: 'title' } | { kind: 'create'; slot: number } | { kind: 'game' };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'title' });
  useEffect(() => {
    applySettingsToDocument();
    // Dev/test helper: ?slot=N&unlockall jumps straight into a game.
    const params = new URLSearchParams(location.search);
    const slot = params.get('slot');
    if (slot !== null) {
      const store = useProgress.getState();
      const i = Number(slot);
      if (!store.loadSlot(i)) store.newGame(i, params.get('name') ?? 'Tester', { skin: '#d4a07a', hair: '#3b2418', hairStyle: 'short', shirt: '#14b8a6', pants: '#2b1d3a' });
      if (params.has('unlockall')) store.setFlag('unlockAll', true);
      if (params.has('skipintro')) store.setFlag('introDone', true);
      setScreen({ kind: 'game' });
    }
  }, []);
  if (screen.kind === 'create')
    return (
      <CharacterCreator
        onBack={() => setScreen({ kind: 'title' })}
        onDone={(name: string, look: PlayerLook) => {
          useProgress.getState().newGame(screen.slot, name, look);
          setScreen({ kind: 'game' });
        }}
      />
    );
  if (screen.kind === 'game') return <GameScreen onQuit={() => setScreen({ kind: 'title' })} />;
  return (
    <TitleScreen
      onNew={(slot) => setScreen({ kind: 'create', slot })}
      onContinue={(slot) => {
        if (useProgress.getState().loadSlot(slot)) setScreen({ kind: 'game' });
      }}
    />
  );
}
