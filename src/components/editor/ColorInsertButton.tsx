import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette } from "lucide-react";

interface ColorInsertButtonProps {
  onInsert: (color: string) => void;
}

const QUICK_COLORS = [
  "#FF1430", "#FF6B00", "#FFD700", "#00FF00",
  "#00BFFF", "#9370DB", "#FF69B4", "#FFFFFF"
];

export const ColorInsertButton = ({ onInsert }: ColorInsertButtonProps) => {
  const [open, setOpen] = useState(false);

  const handleColorClick = (color: string) => {
    onInsert(color);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
