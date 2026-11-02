import { ReactFlowProvider } from '@xyflow/react';
import { Toaster } from 'sonner';
import { useStore } from './store';
import { Sidebar } from './components/Sidebar';
import { Home } from './components/Home';
import { MindCanvas } from './components/MindCanvas';
import { SettingsDialog } from './components/SettingsDialog';
import { ShortcutLayer } from './components/ShortcutLayer';
import { ReviewDeck } from './components/ReviewDeck';
import { CompareDialog } from './components/CompareDialog';

export default function App() {
  const currentId = useStore((s) => s.currentId);
  const hasMap = useStore((s) => (s.currentId ? Boolean(s.maps[s.currentId]) : false));

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />
      <main className="relative min-w-0 flex-1">
        {hasMap && currentId ? (
          <ReactFlowProvider key={currentId}>
            <MindCanvas mapId={currentId} />
          </ReactFlowProvider>
        ) : (
          <Home />
        )}
      </main>
      <SettingsDialog />
      <ShortcutLayer />
      <ReviewDeck />
      <CompareDialog />
      <Toaster position="top-center" richColors toastOptions={{ style: { borderRadius: 14 } }} />
    </div>
  );
}
