import { useState } from "react";
import { Button } from "./Button";
import { Card } from "./Card";

type Props = {
  label: string;
  question: string;
  onConfirm: () => void;
  pending: boolean;
  error?: string;
  // Lets the page clear its delete error when the user backs out.
  onCancel?: () => void;
};

// A destructive action behind an inline confirmation: a red button first, then the question
// with Cancel and Delete.
export function ConfirmDelete({ label, question, onConfirm, pending, error, onCancel }: Props) {
  const [confirming, setConfirming] = useState(false);

  function cancel() {
    setConfirming(false);
    onCancel?.();
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {confirming ? (
        <Card className="flex flex-col gap-3 p-4">
          <p className="font-medium">{question}</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={cancel} disabled={pending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onConfirm} disabled={pending}>
              Delete
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="danger" onClick={() => setConfirming(true)} className="w-full">
          {label}
        </Button>
      )}
    </div>
  );
}
