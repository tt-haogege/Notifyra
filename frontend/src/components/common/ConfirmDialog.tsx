import { type ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  confirmTone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  confirmTone = 'primary',
  onConfirm,
  onCancel,
  confirmDisabled = false,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 id="confirm-dialog-title">{title}</h3>
        </div>
        <div className="stack-gap">
          <p className="muted-text" style={{ margin: 0 }}>{description}</p>
          {children}
          <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
            <button className="ghost-button" type="button" onClick={onCancel}>
              {cancelText}
            </button>
            <button
              className={confirmTone === 'danger' ? 'danger-button' : 'primary-button'}
              type="button"
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
