import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Slide } from "@/types";
import { useEditorStore } from "@/store/useEditorStore";
import { parseTextToSlides } from "@/utils/textParser";
import { useState, useEffect } from "react";

interface UnusedTextPreviewProps {
  slides: Slide[];
  lang?: 'en' | 'ru';
}

export const UnusedTextPreview = ({ slides, lang = 'en' }: UnusedTextPreviewProps) => {
  const [unusedText, setUnusedText] = useState("");
  const { getDefaultStyle } = useEditorStore();

  useEffect(() => {
    // Get all text from the text templates/storage
    const storedText = localStorage.getItem('lastParsedText') || '';
    
    if (storedText && slides.length > 0) {
      // Parse the stored text to get all potential slides
      const allParsedSlides = parseTextToSlides(storedText, "temp", getDefaultStyle());
      
      // Get the text that's currently used in slides
      const usedTitles = new Set(slides.map(s => s.title.trim()));
      
      // Find unused slides
      const unused = allParsedSlides
        .filter(parsedSlide => !usedTitles.has(parsedSlide.title.trim()))
        .map(slide => {
          let text = slide.title;
          if (slide.body) text += `\n${slide.body}`;
          return text;
        })
        .join("\n\n");
      
      setUnusedText(unused);
    }
  }, [slides, getDefaultStyle]);

  const handleCopy = () => {
    navigator.clipboard.writeText(unusedText);
    toast.success(lang === 'ru' ? 'Неиспользованный текст скопирован!' : 'Unused text copied!');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          {lang === 'ru' ? 'Неиспользованный текст' : 'Unused Text'}
        </label>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={!unusedText}
        >
          <Copy className="w-3 h-3 mr-2" />
          {lang === 'ru' ? 'Копировать' : 'Copy'}
        </Button>
      </div>
      <Textarea
        value={unusedText}
        readOnly
        className="min-h-[150px] text-xs font-mono resize-none"
        placeholder={lang === 'ru' ? 'Неиспользованный текст появится здесь...' : 'Unused text will appear here...'}
      />
      <p className="text-xs text-muted-foreground">
        {lang === 'ru' 
          ? 'Текст, который не был использован на слайдах' 
          : 'Text that was not used on slides'}
      </p>
    </div>
  );
};
