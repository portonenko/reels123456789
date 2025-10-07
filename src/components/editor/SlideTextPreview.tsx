import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Slide } from "@/types";

interface SlideTextPreviewProps {
  slides: Slide[];
  lang?: 'en' | 'ru';
}

export const SlideTextPreview = ({ slides, lang = 'en' }: SlideTextPreviewProps) => {
  const allText = slides
    .map((slide, index) => {
      let text = `${index + 1}. ${slide.title}`;
      if (slide.body) {
        text += `\n${slide.body}`;
      }
      return text;
    })
    .join("\n\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(allText);
    toast.success(lang === 'ru' ? 'Текст скопирован!' : 'Text copied!');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          {lang === 'ru' ? 'Весь текст слайдов' : 'All Slides Text'}
        </label>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={slides.length === 0}
        >
          <Copy className="w-3 h-3 mr-2" />
          {lang === 'ru' ? 'Копировать' : 'Copy'}
        </Button>
      </div>
      <Textarea
        value={allText}
        readOnly
        className="min-h-[150px] text-xs font-mono resize-none"
        placeholder={lang === 'ru' ? 'Текст слайдов появится здесь...' : 'Slide text will appear here...'}
      />
      <p className="text-xs text-muted-foreground">
        {lang === 'ru' 
          ? `Всего слайдов: ${slides.length}` 
          : `Total slides: ${slides.length}`}
      </p>
    </div>
  );
};
