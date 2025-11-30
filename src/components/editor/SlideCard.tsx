import { Slide, TextBlock } from "@/types";
import { Button } from "@/components/ui/button";
import { Copy, Trash2, GripVertical, Edit2, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ColorToolbar } from "./ColorToolbar";

// Helper to remove color tags from text for display
const stripColorTags = (text: string): string => {
  return text.replace(/\[#[0-9a-fA-F]{6}\](.*?)\[\]/g, '$1');
};

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
  const [activeInput, setActiveInput] = useState<{ ref: HTMLInputElement | HTMLTextAreaElement | null; blockIndex: number; field: "title" | "body" } | null>(null);
  const isApplyingColor = useRef(false);

  const applyColorToActiveInput = (color: string) => {
    if (!activeInput || !activeInput.ref) return;
    
    isApplyingColor.current = true;
    
    const { blockIndex, field, ref } = activeInput;
    const start = ref.selectionStart || 0;
    const end = ref.selectionEnd || 0;
    const value = field === "title" ? editTextBlocks[blockIndex].title : (editTextBlocks[blockIndex].body || "");
    
    if (start === end) {
      isApplyingColor.current = false;
      return; // No selection
    }
    
    // Wrap selected text with color tag
    const selectedText = value.slice(start, end);
    const newValue = value.slice(0, start) + `[${color}]${selectedText}[]` + value.slice(end);
    updateTextBlock(blockIndex, field, newValue);
    
    // Keep focus and restore cursor
    setTimeout(() => {
      ref.focus();
      const newCursorPos = start + color.length + 2 + selectedText.length + 2;
      ref.setSelectionRange(newCursorPos, newCursorPos);
      isApplyingColor.current = false;
    }, 10);
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
                  <Input
                    ref={(el) => inputRefs.current[`${blockIndex}-title`] = el}
                    value={block.title}
                    onChange={(e) => updateTextBlock(blockIndex, "title", e.target.value)}
                    onFocus={(e) => setActiveInput({ ref: e.target, blockIndex, field: "title" })}
                    onBlur={() => {
                      if (!isApplyingColor.current) {
                        setTimeout(() => setActiveInput(null), 300);
                      }
                    }}
                    placeholder="Заголовок"
                    className="h-8 text-sm"
                  />
                  <Textarea
                    ref={(el) => inputRefs.current[`${blockIndex}-body`] = el}
                    value={block.body || ""}
                    onChange={(e) => updateTextBlock(blockIndex, "body", e.target.value)}
                    onFocus={(e) => setActiveInput({ ref: e.target, blockIndex, field: "body" })}
                    onBlur={() => {
                      if (!isApplyingColor.current) {
                        setTimeout(() => setActiveInput(null), 300);
                      }
                    }}
                    placeholder="Описание (опционально)"
                    className="min-h-[50px] text-xs resize-none"
                  />
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
                      <h4 className="font-medium text-sm mb-0.5 line-clamp-1">{stripColorTags(block.title)}</h4>
                      {block.body && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{stripColorTags(block.body)}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <h4 className="font-medium text-sm mb-1 line-clamp-1">{stripColorTags(slide.title)}</h4>
                  {slide.body && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{stripColorTags(slide.body)}</p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      
      {isEditing && activeInput && (
        <ColorToolbar 
          targetRef={activeInput.ref} 
          onColorApply={applyColorToActiveInput}
        />
      )}

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
