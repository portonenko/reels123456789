import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  content: string;
}

interface StepSourceTextProps {
  sourceText: string;
  captionText: string;
  selectedTemplateId?: string;
  onSourceTextChange: (text: string) => void;
  onCaptionTextChange: (text: string) => void;
  onTemplateSelect: (id: string, content: string) => void;
}

export const StepSourceText = ({
  sourceText,
  captionText,
  selectedTemplateId,
  onSourceTextChange,
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Template selection */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Select from Templates
        </h3>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Loading templates...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {templates.length === 0 
                ? "No templates saved yet" 
                : "No templates match your search"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map((template) => (
                <Button
                  key={template.id}
                  variant={selectedTemplateId === template.id ? "default" : "outline"}
                  className="w-full justify-start text-left h-auto py-3 px-4"
                  onClick={() => onTemplateSelect(template.id, template.content)}
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

      {/* Right: Manual input */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold mb-4">Or Enter Custom Text</h3>

        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">Slides text</div>
            <Textarea
              placeholder={
                "Слайд 1 — Заголовок\n\nСлайд 2 — Заголовок\nОсновной текст\n\nСлайд 3 — Заголовок\nОсновной текст"
              }
              value={sourceText}
              onChange={(e) => onSourceTextChange(e.target.value)}
              className="min-h-[240px] resize-none font-mono text-sm"
            />
            <div className="mt-2 text-xs text-muted-foreground">
              <p>
                Подсказка: первый абзац = титульный слайд. Каждый следующий абзац = новый слайд.
                Внутри абзаца первая строка = заголовок, остальные строки = основной текст.
              </p>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Текст для описания (caption)</div>
            <Textarea
              placeholder="Этот текст останется в описании поста/видео (caption), а не в слайдах…"
              value={captionText}
              onChange={(e) => onCaptionTextChange(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
