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
  const { currentLanguage } = useEditorStore();

  useEffect(() => {
    console.log('UnusedTextPreview: checking for unused text, current slides:', slides.length);
    
    // Simply read the saved unused text for this language
    const savedUnusedText = localStorage.getItem(`lastUnusedText_${currentLanguage}`) || '';
    
    console.log('Found unused text for language', currentLanguage, ':', savedUnusedText.substring(0, 100));
    setUnusedText(savedUnusedText);
  }, [slides, currentLanguage]);

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
