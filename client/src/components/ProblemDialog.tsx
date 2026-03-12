import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ISSUE_TYPE_LABELS } from "@/lib/constants";
import { AlertTriangle } from "lucide-react";

interface ProblemDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (issueType: string, note: string) => void;
  isLoading?: boolean;
}

export function ProblemDialog({ open, onClose, onSubmit, isLoading }: ProblemDialogProps) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [note, setNote] = useState("");

  const handleSubmit = () => {
    if (!selectedType) return;
    onSubmit(selectedType, note);
    setSelectedType("");
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Problem melden
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(ISSUE_TYPE_LABELS).map(([key, label]) => (
              <Button
                key={key}
                variant={selectedType === key ? "default" : "secondary"}
                className="h-12 text-base justify-start"
                onClick={() => setSelectedType(key)}
                data-testid={`button-issue-type-${key}`}
              >
                {label}
              </Button>
            ))}
          </div>
          <Textarea
            placeholder="Kurze Beschreibung (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[80px]"
            data-testid="input-issue-note"
          />
          <Button
            className="w-full h-12 text-base"
            variant="destructive"
            onClick={handleSubmit}
            disabled={!selectedType || isLoading}
            data-testid="button-submit-problem"
          >
            Problem melden
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
