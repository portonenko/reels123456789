import { useState, useRef, useEffect } from "react";
import { Slide, TextBlock } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Clock } from "lucide-react";
import { ColorInsertButton } from "./ColorInsertButton";
import { TextBlockTimeline } from "./TextBlockTimeline";

interface SlideEditDialogProps {
  slide: Slide | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<Slide>) => void;
  lang?: 'en' | 'ru';
}

export const SlideEditDialog = ({
  slide,
  open,
  onOpenChange,
  onSave,
  lang = 'ru',
}: SlideEditDialogProps) => {
  const [editTextBlocks, setEditTextBlocks] = useState<TextBlock[]>([]);

  const blockTitleRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const blockBodyRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

  // Update editTextBlocks when slide changes or dialog opens
  useEffect(() => {
    if (slide && open) {
      setEditTextBlocks(slide.textBlocks || [{ title: slide.title, body: slide.body }]);
    }
  }, [slide, open]);

  const handleSave = () => {
    if (!slide) return;
    
    // Keep blocks that have either title or body
    const validBlocks = editTextBlocks.filter(block => 
      block.title.trim() || (block.body && block.body.trim())
    );
    
    onSave({
      textBlocks: validBlocks.length > 0 ? validBlocks : [{ title: "", body: "" }],
      title: validBlocks[0]?.title || "",
      body: validBlocks[0]?.body,
    });
    onOpenChange(false);
  };

  const addTextBlock = () => {
    setEditTextBlocks([...editTextBlocks, { title: "", body: "", delay: 0, duration: 0 }]);
  };

  const removeTextBlock = (index: number) => {
    if (editTextBlocks.length > 1) {
      setEditTextBlocks(editTextBlocks.filter((_, i) => i !== index));
    }
  };

  const updateTextBlock = (index: number, field: "title" | "body" | "delay" | "duration", value: string | number) => {
    const updated = [...editTextBlocks];
    if (field === "delay" || field === "duration") {
      updated[index][field] = value as number;
    } else {
      updated[index][field] = value as string;
    }
    setEditTextBlocks(updated);
  };

  const insertColorIntoBlock = (blockIndex: number, field: "title" | "body", color: string) => {
    const inputEl = field === "title" 
      ? blockTitleRefs.current.get(blockIndex)
      : blockBodyRefs.current.get(blockIndex);
      
    if (!inputEl) return;

    const start = inputEl.selectionStart || 0;
    const end = inputEl.selectionEnd || 0;
    const text = editTextBlocks[blockIndex][field] || "";
    
    const selectedText = text.substring(start, end);
    const colorTag = `[${color}]${selectedText}[]`;
    const newText = text.substring(0, start) + colorTag + text.substring(end);
    
    updateTextBlock(blockIndex, field, newText);
    
    setTimeout(() => {
      const newPos = start + colorTag.length;
      inputEl.setSelectionRange(newPos, newPos);
      inputEl.focus();
    }, 0);
  };

  if (!slide) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {lang === 'ru' ? 'Редактировать слайд' : 'Edit Slide'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Timeline for timing control */}
          {editTextBlocks.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {lang === 'ru' ? 'Таймлайн текстовых блоков' : 'Text Blocks Timeline'}
              </Label>
              <TextBlockTimeline
                blocks={editTextBlocks}
                slideDuration={slide.durationSec}
                onChange={setEditTextBlocks}
              />
            </div>
          )}

          {/* Text blocks */}
          {editTextBlocks.map((block, index) => (
            <div key={index} className="space-y-3 p-4 border rounded-lg bg-card">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  {lang === 'ru' ? `Блок ${index + 1}` : `Block ${index + 1}`}
                </Label>
                <div className="flex gap-2">
                  {editTextBlocks.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeTextBlock(index)}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  )}
                  {index === editTextBlocks.length - 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={addTextBlock}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>{lang === 'ru' ? 'Заголовок (опционально)' : 'Title (optional)'}</Label>
                  <ColorInsertButton
                    onInsert={(color) => insertColorIntoBlock(index, "title", color)}
                  />
                </div>
                <Input
                  ref={(el) => {
                    if (el) blockTitleRefs.current.set(index, el);
                  }}
                  value={block.title}
                  onChange={(e) => updateTextBlock(index, "title", e.target.value)}
                  placeholder={lang === 'ru' ? 'Заголовок (можно оставить пустым)' : 'Title (can be left empty)'}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>{lang === 'ru' ? 'Описание' : 'Body'}</Label>
                  <ColorInsertButton
                    onInsert={(color) => insertColorIntoBlock(index, "body", color)}
                  />
                </div>
                <Textarea
                  ref={(el) => {
                    if (el) blockBodyRefs.current.set(index, el);
                  }}
                  value={block.body || ""}
                  onChange={(e) => updateTextBlock(index, "body", e.target.value)}
                  placeholder={lang === 'ru' ? 'Введите описание...' : 'Enter body text...'}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs">{lang === 'ru' ? 'Задержка (сек)' : 'Delay (sec)'}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={block.delay || 0}
                    onChange={(e) => updateTextBlock(index, "delay", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="text-xs">{lang === 'ru' ? 'Длительность (сек, 0=до конца)' : 'Duration (sec, 0=until end)'}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={block.duration || 0}
                    onChange={(e) => updateTextBlock(index, "duration", parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {lang === 'ru' ? 'Позиция на экране (опционально)' : 'Position on screen (optional)'}
                </Label>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs">{lang === 'ru' ? 'X (%, 0=слева, 50=центр)' : 'X (%, 0=left, 50=center)'}</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={block.position?.x || 50}
                      onChange={(e) => {
                        const x = parseFloat(e.target.value) || 50;
                        const updated = [...editTextBlocks];
                        updated[index].position = { 
                          x, 
                          y: updated[index].position?.y || 50 
                        };
                        setEditTextBlocks(updated);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{lang === 'ru' ? 'Y (%, 0=сверху, 50=центр)' : 'Y (%, 0=top, 50=center)'}</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={block.position?.y || 50}
                      onChange={(e) => {
                        const y = parseFloat(e.target.value) || 50;
                        const updated = [...editTextBlocks];
                        updated[index].position = { 
                          x: updated[index].position?.x || 50, 
                          y 
                        };
                        setEditTextBlocks(updated);
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lang === 'ru' ? 'Если не задано, блок отобразится в центре' : 'If not set, block will be displayed in the center'}
                </p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {lang === 'ru' ? 'Отмена' : 'Cancel'}
          </Button>
          <Button onClick={handleSave}>
            {lang === 'ru' ? 'Сохранить' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
