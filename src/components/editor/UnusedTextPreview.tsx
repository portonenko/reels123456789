import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Slide } from "@/types";
import { useState, useEffect } from "react";

interface UnusedTextPreviewProps {
  slides: Slide[];
  lang?: 'en' | 'ru';
}

export const UnusedTextPreview = ({ slides, lang = 'en' }: UnusedTextPreviewProps) => {
  const [unusedText, setUnusedText] = useState("");

  useEffect(() => {
    // Get all text that was parsed from templates
    const storedText = localStorage.getItem('lastParsedText') || '';
    
    if (!storedText) {
      setUnusedText('');
      return;
    }

    // Split by double newlines to get paragraphs/sections
    const allParagraphs = storedText.split(/\n\n+/).filter(p => p.trim());
    
    // Get all text currently used in slides (title + body)
    const usedText = slides.map(slide => {
      const parts = [slide.title];
      if (slide.body) parts.push(slide.body);
      return parts.join('\n').toLowerCase().trim();
    });

    // Find paragraphs that are not used in any slide
    const unused = allParagraphs.filter(paragraph => {
      const normalizedParagraph = paragraph.toLowerCase().trim();
      // Check if this paragraph appears in any slide
      return !usedText.some(used => 
        used.includes(normalizedParagraph) || normalizedParagraph.includes(used)
      );
    });

    setUnusedText(unused.join('\n\n'));
  }, [slides]);

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
