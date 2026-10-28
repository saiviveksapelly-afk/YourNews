import { useCallback, useEffect, useState } from 'react';
import './ToastMessage.css';

type ToastMessageProps = {
  message: string;
  onDismiss: () => void;
};

function ToastMessage({ message, onDismiss }: ToastMessageProps) {
  const [isLeaving, setIsLeaving] = useState(false);
  const dismiss = useCallback(onDismiss, [onDismiss]);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setIsLeaving(true), 3600);
    const dismissTimer = window.setTimeout(dismiss, 4000);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [message, dismiss]);

  return (
    <div
      className={`toast-message${isLeaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="toast-message-check" aria-hidden="true">✓</span>
      <span>{message}</span>
      <span className="toast-message-progress" aria-hidden="true" />
    </div>
  );
}

export default ToastMessage;
