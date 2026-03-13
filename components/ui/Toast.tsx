"use client";

import { useEffect, useState, useCallback } from "react";

type ToastVariant = "info" | "success" | "error";

interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

const variantClasses: Record<ToastVariant, string> = {
  info: "bg-gray-900 text-white",
  success: "bg-green-600 text-white",
  error: "bg-red-600 text-white",
};

let addToastExternal: ((msg: string, variant?: ToastVariant) => void) | null =
  null;

export function toast(message: string, variant: ToastVariant = "info") {
  addToastExternal?.(message, variant);
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  useEffect(() => {
    addToastExternal = addToast;
    return () => {
      addToastExternal = null;
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg animate-in slide-in-from-right ${variantClasses[t.variant]}`}
          role="alert"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
