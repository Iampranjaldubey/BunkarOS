import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertCircle, Check, Info } from 'lucide-react';

type ToastTone = 'info' | 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

/** SPEC-M17: toasts are one quiet dark surface; the tone shows as an icon, and they rise in a few pixels. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-8" role="status" aria-live="polite">
        {items.map((t) => {
          const Icon = t.tone === 'success' ? Check : t.tone === 'error' ? AlertCircle : Info;
          return (
            <div key={t.id} className="rise-in pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-ink px-4 py-3 text-base text-bg shadow-float">
              <Icon aria-hidden="true" size={18} className="shrink-0 opacity-80" />
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) return { show: () => {} };
  return ctx;
}
