// React import removed: JSX is handled by automatic runtime
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { SpanPlusApp } from '@/components/span-plus-app';

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="span-plus-theme">
      <div className="min-h-screen bg-background">
        <SpanPlusApp />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}

export default App;