/** Startseiten-Zeile: wann lief der Wächter zuletzt? Orange ab 7 Tagen. Kein Push, nur eine stille Erinnerung. */
import { useLocation } from 'wouter';
import { ShieldCheck } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { describeLastChecked } from '@shared/waechter';

export default function WaechterLastChecked() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.waechter.getLastChecked.useQuery();
  if (isLoading) return null;
  const info = describeLastChecked(data?.finishedAt ?? null);
  return (
    <button
      type="button"
      onClick={() => setLocation('/portfolio')}
      title="Zum Wächter (Portfolio-Seite)"
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs sm:text-sm hover:bg-muted/30 ${
        info.stale ? 'border-amber-500/50 text-amber-400' : 'border-border text-muted-foreground'
      }`}
    >
      <ShieldCheck className="w-3.5 h-3.5" />
      {info.text}
    </button>
  );
}
