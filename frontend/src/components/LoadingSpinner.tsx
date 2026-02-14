import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="rounded-full border border-white/70 bg-white/75 p-3 shadow-lg backdrop-blur-sm">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-600)]" />
      </div>
      <p className="text-sm font-medium text-[var(--ink-500)]">{message}</p>
    </div>
  );
}
