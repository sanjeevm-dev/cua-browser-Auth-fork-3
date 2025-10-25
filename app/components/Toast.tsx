"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertCircle,
};

const toastStyles = {
  success: "border-green-500/30 bg-green-500/10",
  error: "border-red-500/30 bg-red-500/10",
  info: "border-blue-500/30 bg-blue-500/10",
  warning: "border-yellow-500/30 bg-yellow-500/10",
};

const iconStyles = {
  success: "text-green-400",
  error: "text-red-400",
  info: "text-blue-400",
  warning: "text-yellow-400",
};

export default function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = toastIcons[toast.type];

  useEffect(() => {
    const duration = toast.duration || 4000;
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className={`
        flex items-start gap-2 md:gap-3 p-3 md:p-4 rounded-lg md:rounded-xl border backdrop-blur-xl
        ${toastStyles[toast.type]}
        shadow-lg w-full md:w-auto md:max-w-md md:min-w-[320px]
      `}
    >
      <Icon size={18} className={`flex-shrink-0 mt-0.5 ${iconStyles[toast.type]} md:w-5 md:h-5`} />
      <p className="flex-1 text-xs md:text-sm text-gray-200 leading-relaxed">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-1.5 md:p-1 hover:bg-white/[0.08] rounded-lg transition-colors min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 flex items-center justify-center"
        aria-label="Dismiss notification"
      >
        <X size={14} className="text-gray-400 md:w-4 md:h-4" />
      </button>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed top-4 left-4 right-4 md:top-6 md:left-auto md:right-6 md:w-auto z-[100000] flex flex-col gap-2 md:gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
