"use client";

import { CheckCircle, AlertCircle } from "lucide-react";

interface ValidationIndicatorProps {
  isValid: boolean;
  message?: string;
  show?: boolean;
}

export default function ValidationIndicator({ isValid, message, show = true }: ValidationIndicatorProps) {
  if (!show) return null;

  return (
    <div className="flex items-center gap-2 mt-1">
      {isValid ? (
        <>
          <CheckCircle size={14} className="text-green-400" />
          {message && <span className="text-xs text-green-400">{message}</span>}
        </>
      ) : (
        <>
          <AlertCircle size={14} className="text-yellow-400/70" />
          {message && <span className="text-xs text-yellow-400/70">{message}</span>}
        </>
      )}
    </div>
  );
}
