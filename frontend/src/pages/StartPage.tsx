import { useNavigate } from 'react-router-dom';
import { Camera, History, Leaf } from 'lucide-react';

export default function StartPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen px-4 py-6 md:py-8">
      <main className="app-shell flex min-h-[calc(100dvh-4rem)] items-center justify-center">
        <section className="glass-panel fade-up relative w-full max-w-3xl overflow-hidden rounded-3xl p-6 md:p-8">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-green-200/40 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-8 h-44 w-44 rounded-full bg-emerald-100/40 blur-2xl" />

          <div className="relative text-center">
            <div className="mx-auto mb-3 inline-flex items-center gap-3">
              <Leaf className="h-8 w-8 text-green-700" />
              <h1 className="hero-title text-4xl leading-tight text-[var(--ink-900)] md:text-6xl">ShelfScan</h1>
            </div>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--ink-700)] md:text-base">
              Snap a food label and get a clean, quick summary of nutrition, eco-score, and better alternatives.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button onClick={() => navigate('/scan')} className="ui-btn btn-primary">
                <Camera className="h-5 w-5" />
                Start Scan
              </button>
              <button onClick={() => navigate('/history')} className="ui-btn btn-secondary">
                <History className="h-5 w-5" />
                View History
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
