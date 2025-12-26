import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Search, Plus, Trash2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  content: string;
}

export interface SlideInput {
  id: string;
  title: string;
  body: string;
}

interface StepSourceTextProps {
  slides: SlideInput[];
  captionText: string;
  selectedTemplateId?: string;
  onSlidesChange: (slides: SlideInput[]) => void;
  onCaptionTextChange: (text: string) => void;
  onTemplateSelect: (id: string, content: string) => void;
}

export const StepSourceText = ({
  slides,
  captionText,
  selectedTemplateId,
  onSlidesChange,
  onCaptionTextChange,
  onTemplateSelect,
}: StepSourceTextProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("text_templates")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addSlide = () => {
    const newSlide: SlideInput = {
      id: crypto.randomUUID(),
      title: "",
      body: "",
    };
    onSlidesChange([...slides, newSlide]);
  };

  const updateSlide = (id: string, field: "title" | "body", value: string) => {
    onSlidesChange(
      slides.map(slide => 
        slide.id === id ? { ...slide, [field]: value } : slide
      )
    );
  };

  const removeSlide = (id: string) => {
    if (slides.length <= 1) {
      toast.error("Нужен минимум один слайд");
      return;
    }
    onSlidesChange(slides.filter(slide => slide.id !== id));
  };

  // Convert template content to slides format
  const handleTemplateSelect = (templateId: string, content: string) => {
    // Parse content: paragraphs separated by double newlines
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
    
    const parsedSlides: SlideInput[] = paragraphs.map(paragraph => {
      const lines = paragraph.split("\n").map(l => l.trim()).filter(l => l);
      return {
        id: crypto.randomUUID(),
        title: lines[0] || "",
        body: lines.slice(1).join("\n"),
      };
    });

    if (parsedSlides.length === 0) {
      parsedSlides.push({ id: crypto.randomUUID(), title: "", body: "" });
    }

    onSlidesChange(parsedSlides);
    onTemplateSelect(templateId, content);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Template selection */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Выберите шаблон
        </h3>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск шаблонов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Загрузка шаблонов...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {templates.length === 0 
                ? "Шаблоны пока не сохранены" 
                : "Ничего не найдено"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map((template) => (
                <Button
                  key={template.id}
                  variant={selectedTemplateId === template.id ? "default" : "outline"}
                  className="w-full justify-start text-left h-auto py-3 px-4"
                  onClick={() => handleTemplateSelect(template.id, template.content)}
                >
                  <div className="truncate">
                    <div className="font-medium">{template.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {template.content.substring(0, 80)}...
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: Slide cards input */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Или введите текст вручную</h3>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={addSlide}
            className="gap-1"
          >
            <Plus className="w-4 h-4" />
            Слайд
          </Button>
        </div>

        <ScrollArea className="h-[280px] pr-2">
          <div className="space-y-3">
            {slides.map((slide, index) => (
              <div 
                key={slide.id} 
                className="bg-muted/50 border border-border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <GripVertical className="w-4 h-4" />
                    Слайд {index + 1}
                    {index === 0 && <span className="text-xs">(титульный)</span>}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSlide(slide.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                
                <Input
                  placeholder="Заголовок"
                  value={slide.title}
                  onChange={(e) => updateSlide(slide.id, "title", e.target.value)}
                  className="font-medium"
                />
                
                <Textarea
                  placeholder="Основной текст (необязательно)"
                  value={slide.body}
                  onChange={(e) => updateSlide(slide.id, "body", e.target.value)}
                  className="min-h-[60px] resize-none text-sm"
                />
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-sm font-medium mb-2">Текст для описания (caption)</div>
          <Textarea
            placeholder="Этот текст останется в описании поста/видео, а не в слайдах…"
            value={captionText}
            onChange={(e) => onCaptionTextChange(e.target.value)}
            className="min-h-[80px] resize-none"
          />
        </div>
      </div>
    </div>
  );
};
