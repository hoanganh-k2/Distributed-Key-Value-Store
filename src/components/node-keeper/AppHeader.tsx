import { Network } from 'lucide-react';

export default function AppHeader() {
  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto p-4 flex items-center">
        <Network className="h-8 w-8 mr-3" />
        <h1 className="text-2xl font-headline font-semibold">Node Keeper</h1>
      </div>
    </header>
  );
}
