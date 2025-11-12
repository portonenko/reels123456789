import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Plus, Trash2 } from "lucide-react";

interface TextInputDialogProps {
  open: boolean;
  onClose: () => void;
  onParse: (text: string) => void;
}

interface ManualSlide {
  title: string;
  body: string;
}

export const TextInputDialog = ({ open, onClose, onParse }: TextInputDialogProps) => {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [manualSlides, setManualSlides] = useState<ManualSlide[]>([{ title: "", body: "" }]);

  const handleParse = () => {
    if (mode === "auto" && text.trim()) {
      onParse(text);
      onClose();
      setText("");
      setManualSlides([{ title: "", body: "" }]);
    } else if (mode === "manual" && manualSlides.some(s => s.title.trim())) {
      // Convert manual slides to text format that parseTextToSlides understands
      const formattedText = manualSlides
        .filter(s => s.title.trim())
        .map(s => `${s.title}${s.body.trim() ? '\n\n' + s.body : ''}`)
        .join('\n\n');
      onParse(formattedText);
      onClose();
      setText("");
      setManualSlides([{ title: "", body: "" }]);
    }
  };

  const addSlide = () => {
    setManualSlides([...manualSlides, { title: "", body: "" }]);
  };

  const removeSlide = (index: number) => {
    if (manualSlides.length > 1) {
      setManualSlides(manualSlides.filter((_, i) => i !== index));
    }
  };

  const updateSlide = (index: number, field: "title" | "body", value: string) => {
    const updated = [...manualSlides];
    updated[index][field] = value;
    setManualSlides(updated);
  };

  const canParse = mode === "auto" 
    ? text.trim() 
    : manualSlides.some(s => s.title.trim());

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Добавить текст
          </DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "auto" | "manual")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="auto">Авто</TabsTrigger>
            <TabsTrigger value="manual">Вручную</TabsTrigger>
          </TabsList>

          <TabsContent value="auto" className="space-y-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Вставьте текст сюда...&#10;&#10;Поддерживаются заголовки и основной текст.&#10;Используйте пустые строки для разделения слайдов.&#10;&#10;Пример:&#10;Главный заголовок&#10;&#10;Первая тема&#10;Текст первого слайда...&#10;&#10;Вторая тема&#10;Текст второго слайда..."
              className="min-h-[300px] font-mono text-sm"
            />
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {manualSlides.map((slide, index) => (
                <div key={index} className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Слайд {index + 1}
                    </span>
                    {manualSlides.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSlide(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder="Заголовок слайда"
                    value={slide.title}
                    onChange={(e) => updateSlide(index, "title", e.target.value)}
                  />
                  <Textarea
                    placeholder="Основной текст (опционально)"
                    value={slide.body}
                    onChange={(e) => updateSlide(index, "body", e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={addSlide}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить слайд
            </Button>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" onClick={handleParse} disabled={!canParse} className="bg-gradient-primary">
            <Sparkles className="w-4 h-4 mr-2" />
            Создать слайды
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
