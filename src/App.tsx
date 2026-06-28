import { Button } from '@/components/ui/button';

export function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">imahe</p>
        <h1 className="text-2xl font-semibold tracking-tight">Generate Assets with ima2</h1>
        <Button>Start generating</Button>
      </div>
    </main>
  );
}
