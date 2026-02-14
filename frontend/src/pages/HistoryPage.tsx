import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Calendar } from 'lucide-react';
import EcoScoreBadge from '../components/EcoScoreBadge';
import { clearScanHistory, getScanHistory } from '../lib/history';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const items = useMemo(() => getScanHistory(), [version]);

  const handleClear = () => {
    clearScanHistory();
    setVersion((v) => v + 1);
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <main className="app-shell">
        <section className="glass-panel fade-up mx-auto w-full max-w-5xl rounded-3xl p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="hero-title text-3xl text-[var(--ink-900)]">Scan History</h1>
            {items.length > 0 && (
              <button onClick={handleClear} className="ui-btn btn-secondary">
                <Trash2 className="h-4 w-4" />
                Clear History
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="py-10 text-center text-[var(--ink-500)]">
              No saved scans yet. Take a photo from Camera and open a product to save it.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/product/${item.product_code}`)}
                  className="surface-card flex items-start gap-4 rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <img
                    src={item.captured_image}
                    alt={item.captured_image_name || item.product_name}
                    className="h-24 w-24 rounded-xl border border-[var(--line-soft)] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--ink-900)]">{item.product_name}</p>
                    {item.brands && <p className="truncate text-sm text-[var(--ink-500)]">{item.brands}</p>}
                    <div className="mt-2">
                      <EcoScoreBadge grade={item.ecoscore_grade} score={item.ecoscore_score} size="sm" />
                    </div>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--ink-500)]">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(item.saved_at).toLocaleString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
