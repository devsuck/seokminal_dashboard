export type ToastType = "info" | "success" | "warn" | "error";

export interface ToastLink {
  href: string;
  label: string;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  link?: ToastLink;
}

type Listener = (toasts: Toast[]) => void;

let _toasts: Toast[] = [];
const _listeners = new Set<Listener>();

function notify() {
  _listeners.forEach(fn => fn([..._toasts]));
}

export const toast = {
  show(message: string, type: ToastType = "info", durationMs = 5000, link?: ToastLink) {
    const id = crypto.randomUUID();
    _toasts = [..._toasts, { id, message, type, link }];
    notify();
    setTimeout(() => toast.dismiss(id), durationMs);
  },
  dismiss(id: string) {
    _toasts = _toasts.filter(t => t.id !== id);
    notify();
  },
  subscribe(fn: Listener): () => void {
    _listeners.add(fn);
    fn([..._toasts]);
    return () => _listeners.delete(fn);
  },
};
