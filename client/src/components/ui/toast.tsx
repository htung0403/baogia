import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ShowToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  showToast: (options: ShowToastOptions) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-indigo-200 bg-indigo-50 text-indigo-900',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((options: ShowToastOptions) => {
    const id = crypto.randomUUID();
    const variant = options.variant ?? 'info';

    setToasts((prev) => [
      ...prev,
      {
        id,
        title: options.title,
        description: options.description,
        variant,
        duration: options.duration ?? 3500,
      },
    ]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (title: string, description?: string) =>
        showToast({ title, description, variant: 'success' }),
      error: (title: string, description?: string) =>
        showToast({ title, description, variant: 'error' }),
      info: (title: string, description?: string) =>
        showToast({ title, description, variant: 'info' }),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      <Toast.Provider swipeDirection="right">
        {children}

        {toasts.map((item) => (
          <Toast.Root
            key={item.id}
            duration={item.duration}
            onOpenChange={(open) => {
              if (!open) removeToast(item.id);
            }}
            className={`group pointer-events-auto w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border px-4 py-3 shadow-lg transition-all ${variantStyles[item.variant]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Toast.Title className="text-[13px] font-bold">{item.title}</Toast.Title>
                {item.description ? (
                  <Toast.Description className="mt-1 text-[12px] text-slate-600">
                    {item.description}
                  </Toast.Description>
                ) : null}
              </div>
              <Toast.Close
                className="rounded-md p-1 text-slate-500 hover:bg-white/60 hover:text-slate-700"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </Toast.Close>
            </div>
          </Toast.Root>
        ))}

        <Toast.Viewport className="fixed bottom-4 right-4 z-[9999] flex w-[380px] max-w-full flex-col gap-2 outline-none" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
