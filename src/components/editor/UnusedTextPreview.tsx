import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Slide } from "@/types";
import { useState, useEffect } from "react";
import { parseTextToSlides } from "@/utils/textParser";
import { useEditorStore } from "@/store/useEditorStore";

interface UnusedTextPreviewProps {
  slides: Slide[];
  lang?: 'en' | 'ru';
}

export const UnusedTextPreview = ({ slides, lang = 'en' }: UnusedTextPreviewProps) => {
  const [unusedText, setUnusedText] = useState("");
  const { getDefaultStyle, currentLanguage } = useEditorStore();

  useEffect(() => {
    console.log('UnusedTextPreview: checking for unused text, current slides:', slides.length);
    
    // Get all text that was parsed from templates (language-specific)
    const storedText = localStorage.getItem(`lastParsedText_${currentLanguage}`) || '';
    
    console.log('Stored text length:', storedText.length, 'for language:', currentLanguage);
    
    if (!storedText) {
      setUnusedText('');
      return;
    }

    if (slides.length === 0) {
      // If no slides, show all the stored text as unused
      setUnusedText(storedText);
      return;
    }

    try {
      // Parse the original text to get all potential slides
      const allParsedSlides = parseTextToSlides(storedText, "temp", getDefaultStyle());
      console.log('Parsed all slides from stored text:', allParsedSlides.length);
      
      // Get the titles that are currently used in slides (normalize them)
      const usedTitles = new Set(
        slides.map(s => s.title.replace(/^\[.*?\]\s*/, '').trim().toLowerCase())
      );
      
      console.log('Used titles:', Array.from(usedTitles));
      
      // Find slides that weren't used
      const unusedSlides = allParsedSlides.filter(parsedSlide => {
        const normalizedTitle = parsedSlide.title.replace(/^\[.*?\]\s*/, '').trim().toLowerCase();
        return !usedTitles.has(normalizedTitle);
      });
      
      console.log('Found unused slides:', unusedSlides.length);
      
      // Format unused slides as text
      const unused = unusedSlides
        .map(slide => {
          let text = slide.title.replace(/^\[.*?\]\s*/, ''); // Remove language tags
          if (slide.body) {
            text += `\n${slide.body.replace(/^\[.*?\]\s*/, '')}`;
          }
          return text;
        })
        .join('\n\n');

      setUnusedText(unused);
    } catch (error) {
      console.error('Error parsing unused text:', error);
      setUnusedText('');
    }
  }, [slides, getDefaultStyle, currentLanguage]);

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
