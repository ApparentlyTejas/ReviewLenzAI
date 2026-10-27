import { useState } from "react";

interface ConfirmDeleteButtonProps {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  disabled?: boolean;
}

/** A delete button that asks for one inline confirmation before firing — avoids a
 * native confirm() popup, and keeps state local so each row in a list manages its
 * own confirm/cancel independently of its siblings. */
export function ConfirmDeleteButton({
  onConfirm,
  label = "Delete",
  confirmLabel = "Confirm",
  disabled,
}: ConfirmDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="confirm-delete-group">
        <button
          type="button"
          className="danger small"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setConfirming(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          className="secondary small"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setConfirming(false);
          }}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="secondary small"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        setConfirming(true);
      }}
    >
      {label}
    </button>
  );
}
