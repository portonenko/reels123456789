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

      if (error) throw error;

      // Check if it's the "not implemented" response
      if (data?.status === 'api_not_integrated' && data?.musicBrief) {
        // Show a nice summary toast
        toast.success(
          lang === 'ru' 
            ? 'AI проанализировал ваш контент! Смотрите консоль браузера для деталей.'
            : 'AI analyzed your content! Check browser console for details.',
          { duration: 5000 }
        );
        
        // Log the full brief and suggestions to console
        console.log('═══════════════════════════════════════════════');
        console.log('🎵 AI Music Brief for Your Video');
        console.log('═══════════════════════════════════════════════');
        console.log('\n📋 Full Music Specification:\n');
        console.log(data.musicBrief);
        console.log('\n💡 Suggestions:\n');
        data.suggestions?.forEach((s: string, i: number) => console.log(`${i + 1}. ${s}`));
        console.log('\n' + data.instructions);
        console.log('═══════════════════════════════════════════════\n');
        
        return;
      }

      // Handle real audio generation
      if (data?.audioData) {
        // Convert base64 to blob
        const binaryString = atob(data.audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        
        setBackgroundMusic(audioUrl);
        
        toast.success(
          lang === 'ru' 
            ? '🎵 Музыка успешно сгенерирована!'
            : '🎵 Music generated successfully!',
          { duration: 3000 }
        );
        
        console.log('Music Brief:', data.musicBrief);
        return;
      }

      throw new Error("No audio data returned");

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
