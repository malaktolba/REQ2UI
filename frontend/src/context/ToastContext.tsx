import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CheckIcon, XIcon, InfoIcon } from "../components/Icons";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((type: ToastType, message: string) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const value: ToastContextValue = {
    success: (msg) => add("success", msg),
    error: (msg) => add("error", msg),
    info: (msg) => add("info", msg),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm max-w-sm w-full pointer-events-auto",
              "animate-[slideIn_0.2s_ease-out]",
              t.type === "success"
                ? "bg-green-950 border-green-700/50 text-green-300"
                : t.type === "error"
                ? "bg-red-950 border-red-700/50 text-red-300"
                : "bg-slate-800 border-slate-700 text-slate-200",
            ].join(" ")}
          >
            <span className="flex-shrink-0 mt-0.5">
              {t.type === "success" ? <CheckIcon size={16} /> : t.type === "error" ? <XIcon size={16} /> : <InfoIcon size={16} />}
            </span>
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
