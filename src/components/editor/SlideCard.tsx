import { Slide, TextBlock } from "@/types";
import { Button } from "@/components/ui/button";
import { Copy, Trash2, GripVertical, Edit2, Plus, Minus, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SlideCardProps {
  slide: Slide;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<Slide>) => void;
  index: number;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDraggable?: boolean;
}

export const SlideCard = ({
  slide,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
  onUpdate,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  isDraggable = false,
}: SlideCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(slide.title);
  const [editBody, setEditBody] = useState(slide.body || "");
  const [editTextBlocks, setEditTextBlocks] = useState<TextBlock[]>(
    slide.textBlocks || [{ title: slide.title, body: slide.body }]
  );
  
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | HTMLTextAreaElement | null }>({});
  const [activeField, setActiveField] = useState<string | null>(null);

  const colorPalette = [
    { name: "Красный", color: "#FF0000" },
    { name: "Оранжевый", color: "#FF8800" },
    { name: "Желтый", color: "#FFFF00" },
    { name: "Зеленый", color: "#00FF00" },
    { name: "Голубой", color: "#00FFFF" },
    { name: "Синий", color: "#0000FF" },
    { name: "Фиолетовый", color: "#FF00FF" },
    { name: "Розовый", color: "#FF69B4" },
    { name: "Белый", color: "#FFFFFF" },
  ];

  const applyColor = (color: string, blockIndex: number, field: "title" | "body") => {
    const fieldKey = `${blockIndex}-${field}`;
    const input = inputRefs.current[fieldKey];
    
    if (!input) return;
    
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const value = field === "title" ? editTextBlocks[blockIndex].title : (editTextBlocks[blockIndex].body || "");
    
    if (start === end) {
      // No selection, just insert color tag at cursor
      const newValue = value.slice(0, start) + `[${color}]текст[]` + value.slice(end);
      updateTextBlock(blockIndex, field, newValue);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + color.length + 2, start + color.length + 2 + 5); // Select "текст"
      }, 0);
    } else {
      // Wrap selected text with color tag
      const selectedText = value.slice(start, end);
      const newValue = value.slice(0, start) + `[${color}]${selectedText}[]` + value.slice(end);
      updateTextBlock(blockIndex, field, newValue);
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start, start + color.length + 2 + selectedText.length + 2);
      }, 0);
    }
  };

  const handleSave = () => {
    // If using text blocks
    if (editTextBlocks.length > 1 || (editTextBlocks.length === 1 && editTextBlocks[0].title !== editTitle)) {
      onUpdate({
        textBlocks: editTextBlocks.filter(block => block.title.trim()),
        title: editTextBlocks[0]?.title || editTitle, // Keep first block title for backward compatibility
        body: editTextBlocks[0]?.body,
      });
    } else {
      // Single block, use original structure
      onUpdate({
        title: editTitle,
        body: editBody || undefined,
        textBlocks: undefined,
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(slide.title);
    setEditBody(slide.body || "");
    setEditTextBlocks(slide.textBlocks || [{ title: slide.title, body: slide.body }]);
    setIsEditing(false);
  };

  const addTextBlock = () => {
    setEditTextBlocks([...editTextBlocks, { title: "", body: "" }]);
  };

  const removeTextBlock = (index: number) => {
    if (editTextBlocks.length > 1) {
      setEditTextBlocks(editTextBlocks.filter((_, i) => i !== index));
    }
  };

  const updateTextBlock = (index: number, field: "title" | "body", value: string) => {
    const updated = [...editTextBlocks];
    updated[index][field] = value;
    setEditTextBlocks(updated);
  };

  return (
    <div
      onClick={onSelect}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group p-4 rounded-lg border cursor-pointer transition-all",
        isSelected
          ? "bg-primary/10 border-primary shadow-lg"
          : "bg-card border-border hover:bg-panel-hover hover:border-primary/50"
      )}
    >
      <div className="flex items-start gap-3">
        {isDraggable && (
          <div 
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                slide.type === "title-only"
                  ? "bg-accent/20 text-accent"
                  : "bg-primary/20 text-primary"
              )}
            >
              {slide.type === "title-only" ? "Title" : "Title + Body"}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {slide.durationSec}s
            </span>
          </div>

          {isEditing ? (
            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
              {editTextBlocks.map((block, blockIndex) => (
                <div key={blockIndex} className="space-y-2 p-3 border border-border rounded-md bg-background/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Блок {blockIndex + 1}
                    </span>
                    {editTextBlocks.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTextBlock(blockIndex)}
                        className="h-6 w-6 p-0"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Input
                      ref={(el) => inputRefs.current[`${blockIndex}-title`] = el}
                      value={block.title}
                      onChange={(e) => updateTextBlock(blockIndex, "title", e.target.value)}
                      onFocus={() => setActiveField(`${blockIndex}-title`)}
                      placeholder="Заголовок"
                      className="h-8 text-sm flex-1"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 shrink-0"
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Palette className="w-4 h-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-2" onClick={(e) => e.stopPropagation()}>
                        <div className="text-xs font-medium mb-2">Выберите цвет:</div>
                        <div className="grid grid-cols-3 gap-1">
                          {colorPalette.map((c) => (
                            <button
                              key={c.color}
                              onClick={() => applyColor(c.color, blockIndex, "title")}
                              className="h-8 rounded border border-border hover:scale-110 transition-transform"
                              style={{ backgroundColor: c.color }}
                              title={c.name}
                            />
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Выделите текст перед выбором цвета
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex gap-1">
                    <Textarea
                      ref={(el) => inputRefs.current[`${blockIndex}-body`] = el}
                      value={block.body || ""}
                      onChange={(e) => updateTextBlock(blockIndex, "body", e.target.value)}
                      onFocus={() => setActiveField(`${blockIndex}-body`)}
                      placeholder="Описание (опционально)"
                      className="min-h-[50px] text-xs resize-none flex-1"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 shrink-0"
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Palette className="w-4 h-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-2" onClick={(e) => e.stopPropagation()}>
                        <div className="text-xs font-medium mb-2">Выберите цвет:</div>
                        <div className="grid grid-cols-3 gap-1">
                          {colorPalette.map((c) => (
                            <button
                              key={c.color}
                              onClick={() => applyColor(c.color, blockIndex, "body")}
                              className="h-8 rounded border border-border hover:scale-110 transition-transform"
                              style={{ backgroundColor: c.color }}
                              title={c.name}
                            />
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Выделите текст перед выбором цвета
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={addTextBlock}
                className="w-full h-7 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Добавить блок
              </Button>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} className="h-7 text-xs">
                  Сохранить
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel} className="h-7 text-xs">
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <>
              {slide.textBlocks && slide.textBlocks.length > 0 ? (
                <div className="space-y-2">
                  {slide.textBlocks.map((block, blockIndex) => (
                    <div key={blockIndex} className="border-l-2 border-primary/30 pl-2">
                      <h4 className="font-medium text-sm mb-0.5 line-clamp-1">{block.title}</h4>
                      {block.body && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{block.body}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <h4 className="font-medium text-sm mb-1 line-clamp-1">{slide.title}</h4>
                  {slide.body && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{slide.body}</p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {!isEditing && (
        <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="h-7 px-2"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="h-7 px-2"
          >
            <Copy className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-7 px-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
};
