import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Music, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "@/store/useEditorStore";
import { supabase } from "@/integrations/supabase/client";

interface AIMusicGeneratorProps {
  lang?: 'en' | 'ru';
}

export const AIMusicGenerator = ({ lang = 'en' }: AIMusicGeneratorProps) => {
  const { backgroundMusicUrl, setBackgroundMusic, slides } = useEditorStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState("");

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error(lang === 'ru' ? "Введите описание музыки" : "Please enter a music description");
      return;
    }

    setIsGenerating(true);

    try {
      // Calculate video duration
      const totalDuration = slides.reduce((sum, s) => sum + s.durationSec, 0);

      toast.info(lang === 'ru' ? "Создаю музыку... это может занять минуту" : "Generating music... this may take a minute");

      const { data, error } = await supabase.functions.invoke("generate-music", {
        body: {
          prompt: `${prompt}. Duration: ${totalDuration} seconds. Loopable background music.`,
          duration: totalDuration,
        },
      });

      if (error) throw error;

      if (!data?.audioUrl) {
        throw new Error("No audio URL returned");
      }

      setBackgroundMusic(data.audioUrl);
      toast.success(lang === 'ru' ? "Музыка создана!" : "Music generated!");
    } catch (error: any) {
      console.error("Music generation error:", error);
      
      if (error.message?.includes("429") || error.message?.includes("Rate limit")) {
        toast.error(lang === 'ru' ? "Превышен лимит запросов. Попробуйте позже." : "Rate limit exceeded. Please try again later.");
      } else if (error.message?.includes("402") || error.message?.includes("Payment")) {
        toast.error(lang === 'ru' ? "Требуется пополнение. Добавьте средства в аккаунт Lovable." : "Payment required. Please add credits to your Lovable workspace.");
      } else {
        toast.error(lang === 'ru' ? `Ошибка создания музыки: ${error.message}` : `Music generation failed: ${error.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemove = () => {
    if (backgroundMusicUrl) {
      URL.revokeObjectURL(backgroundMusicUrl);
    }
    setBackgroundMusic(null);
    setPrompt("");
    toast.success(lang === 'ru' ? "Музыка удалена" : "Music removed");
  };

  return (
    <div className="space-y-3">
      {backgroundMusicUrl ? (
        <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
          <Music className="w-4 h-4 text-primary" />
          <span className="text-sm flex-1">
            {lang === 'ru' ? "Музыка загружена" : "Music uploaded"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <>
          <Label className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            {lang === 'ru' ? "Создать AI музыку" : "Generate AI Music"}
          </Label>
          
          <Input
            placeholder={lang === 'ru' ? "Опишите музыку (например: энергичная электронная музыка)" : "Describe the music (e.g., upbeat electronic music)"}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
          />
          
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {isGenerating 
              ? (lang === 'ru' ? "Создаю музыку..." : "Generating...") 
              : (lang === 'ru' ? "Создать музыку" : "Generate Music")
            }
          </Button>
          
          <p className="text-xs text-muted-foreground">
            {lang === 'ru' 
              ? "AI создаст уникальную фоновую музыку для вашего видео" 
              : "AI will create custom background music for your video"
            }
          </p>
        </>
      )}
    </div>
  );
};
