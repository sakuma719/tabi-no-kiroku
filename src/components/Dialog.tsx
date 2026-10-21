import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const viewport = window.visualViewport;
    const resize = () => {
      const height = viewport?.height ?? window.innerHeight;
      dialog.style.setProperty('--dialog-height', `${height}px`);
      dialog.style.setProperty(
        '--keyboard-inset',
        `${Math.max(0, window.innerHeight - height - (viewport?.offsetTop ?? 0))}px`,
      );
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-shell">
        <header className="dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" aria-label="閉じる" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const onNavigate = (event: Event) => {
      if (!window.confirm('未保存の変更があります。変更を破棄して閉じますか？'))
        event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    window.addEventListener('travel:before-navigate', onNavigate);
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('travel:before-navigate', onNavigate);
    };
  }, [dirty]);
  return () => !dirty || window.confirm('未保存の変更があります。変更を破棄して閉じますか？');
}

export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p className="error-message" role="alert">
      {message}
    </p>
  ) : null;
}
