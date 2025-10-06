import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface TextInputDialogProps {
  open: boolean;
  onClose: () => void;
  onParse: (text: string) => void;
}

export const TextInputDialog = ({ open, onClose, onParse }: TextInputDialogProps) => {
  const [text, setText] = useState("");

  const handleParse = () => {
    if (text.trim()) {
      onParse(text);
      onClose();
      setText("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Paste Your Text
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here...&#10;&#10;Supports headings and body text.&#10;Use blank lines to separate slides.&#10;&#10;Example:&#10;Your Main Title&#10;&#10;First Topic&#10;Your body text here...&#10;&#10;Second Topic&#10;More body text..."
            className="min-h-[300px] font-mono text-sm"
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleParse} disabled={!text.trim()} className="bg-gradient-primary">
              <Sparkles className="w-4 h-4 mr-2" />
              Parse Text
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
