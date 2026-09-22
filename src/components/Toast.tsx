/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          let icon = <Info className="h-5 w-5 text-blue-500" />;
          let bgClass = 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100';

          switch (toast.type) {
            case 'success':
              icon = <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
              bgClass = 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/55 text-zinc-950 dark:text-zinc-100';
              break;
            case 'error':
              icon = <AlertCircle className="h-5 w-5 text-red-500" />;
              bgClass = 'bg-red-50/90 dark:bg-red-950/40 border-red-200 dark:border-red-900/55 text-zinc-950 dark:text-zinc-100';
              break;
            case 'warning':
              icon = <AlertTriangle className="h-5 w-5 text-amber-500" />;
              bgClass = 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/55 text-zinc-950 dark:text-zinc-100';
              break;
            case 'info':
              icon = <Info className="h-5 w-5 text-sky-500" />;
              bgClass = 'bg-sky-50/90 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/55 text-zinc-950 dark:text-zinc-100';
              break;
          }

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={`pointer-events-auto flex gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md ${bgClass}`}
            >
              <div className="flex-shrink-0 mt-0.5">{icon}</div>
              <div className="flex-grow min-w-0">
                <p className="font-semibold text-sm leading-tight">{toast.title}</p>
                {toast.description && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-normal leading-relaxed">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => onClose(toast.id)}
                className="flex-shrink-0 self-start text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

// Hook simulation helper to manage toasts easily
export function useToastState() {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const addToast = (title: string, type: ToastType = 'info', description?: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, description }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}
