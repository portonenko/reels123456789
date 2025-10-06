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
    if (!prompt.trim() && slides.length === 0) {
      toast.error(lang === 'ru' ? "Введите описание или создайте слайды" : "Please enter a description or create slides");
      return;
    }

    setIsGenerating(true);

    try {
      // Calculate video duration and collect slide info
      const totalDuration = slides.reduce((sum, s) => sum + s.durationSec, 0);
      const slideTimings = slides.map((s, idx) => ({
        index: idx + 1,
        title: s.title.replace(/^\[.*?\]\s*/, ''),
        duration: s.durationSec,
        type: s.type,
      }));

      toast.info(lang === 'ru' ? "Создаю музыку... это может занять минуту" : "Generating music... this may take a minute");

      const { data, error } = await supabase.functions.invoke("generate-music", {
        body: {
          prompt: prompt.trim() || "background music that fits the video content",
          duration: totalDuration,
          slideTimings,
          slides: slideTimings,
        },
      });

      // Check if it's the "not implemented" response (501)
      if (data?.error && data?.musicBrief) {
        // Show the AI-generated music brief in a toast
        toast.info(
          lang === 'ru' 
            ? `AI проанализировал ваш контент:\n\n${data.musicBrief.substring(0, 200)}...\n\nДля генерации музыки нужна интеграция с музыкальным API. Пока вы можете загрузить свою музыку или найти похожую на Pixabay/Incompetech.`
            : `AI analyzed your content:\n\n${data.musicBrief.substring(0, 200)}...\n\nMusic generation requires API integration. For now, upload your own music or find matching tracks on Pixabay/Incompetech.`,
          { 
            duration: 8000,
          }
        );
        
        // Also log the full brief to console for the user
        console.log('Full AI Music Brief:', data.musicBrief);
        console.log('Instructions:', data.instructions);
        
        return;
      }

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
            placeholder={lang === 'ru' 
              ? "Опишите стиль музыки (или оставьте пустым для автоматического подбора)" 
              : "Describe music style (or leave empty for auto-detect)"
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
          />
          
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || slides.length === 0}
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
              ? "AI проанализирует слайды и создаст подходящую музыку с учетом тайминга" 
              : "AI will analyze slides and create fitting music with timing adjustments"
            }
          </p>

          {slides.length === 0 && (
            <p className="text-xs text-yellow-500">
              {lang === 'ru' 
                ? "Сначала создайте слайды для генерации музыки" 
                : "Create slides first to generate music"
              }
            </p>
          )}
        </>
      )}
    </div>
  );
};
