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
  const [customColor, setCustomColor] = useState("#FF1430");

  const handleColorClick = (color: string) => {
    onInsert(color);
    setOpen(false);
  };

  const handleCustomColorClick = () => {
    onInsert(customColor);
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
        <div className="grid grid-cols-4 gap-2 mb-3">
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
        <div className="border-t pt-2">
          <div className="text-xs text-muted-foreground mb-2 px-1">
            Свой цвет:
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-10 h-10 rounded border-2 border-border cursor-pointer"
            />
            <button
              type="button"
              onClick={handleCustomColorClick}
              className="flex-1 px-3 py-2 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              Вставить {customColor}
            </button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mt-2 px-1">
          Выделите текст и нажмите цвет
        </div>
      </PopoverContent>
    </Popover>
  );
};
