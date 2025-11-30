import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette } from "lucide-react";

interface ColorInsertButtonProps {
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  currentValue: string;
  onValueChange: (value: string) => void;
}

const QUICK_COLORS = [
  "#FF1430", "#FF6B00", "#FFD700", "#00FF00",
  "#00BFFF", "#9370DB", "#FF69B4", "#FFFFFF"
];

export const ColorInsertButton = ({ inputRef, currentValue, onValueChange }: ColorInsertButtonProps) => {
  const [open, setOpen] = useState(false);
  const [savedSelection, setSavedSelection] = useState<{ start: number; end: number } | null>(null);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && inputRef.current) {
      // Save selection before opening
      const start = inputRef.current.selectionStart || 0;
      const end = inputRef.current.selectionEnd || 0;
      setSavedSelection({ start, end });
    }
    setOpen(isOpen);
  };

  const handleColorClick = (color: string) => {
    if (!savedSelection) {
      setOpen(false);
      return;
    }

    const { start, end } = savedSelection;
    const selectedText = currentValue.substring(start, end) || "текст";
    const colorTag = `[${color}]${selectedText}[]`;
    const newValue = currentValue.substring(0, start) + colorTag + currentValue.substring(end);
    
    onValueChange(newValue);
    setOpen(false);
    
    // Restore focus and cursor position
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = start + colorTag.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-4 gap-2">
          {QUICK_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleColorClick(color)}
              className="w-8 h-8 rounded border-2 border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-2 px-1">
          Выделите текст и нажмите цвет
        </div>
      </PopoverContent>
    </Popover>
  );
};
