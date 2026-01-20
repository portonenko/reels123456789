import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Video, FileText, Copy, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VideoTranscribeDialogProps {
  open: boolean;
  onClose: () => void;
  onUseText?: (text: string) => void;
}

export function VideoTranscribeDialog({ open, onClose, onUseText }: VideoTranscribeDialogProps) {
  const [videoUrl, setVideoUrl] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleTranscribe = async () => {
    if (!videoUrl.trim()) {
      toast.error("Введите URL видео");
      return;
    }

    // Validate URL
    try {
      new URL(videoUrl);
    } catch {
      toast.error("Неверный формат URL");
      return;
    }

    setIsTranscribing(true);
    setError("");
    setTranscribedText("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("transcribe-video", {
        body: { videoUrl: videoUrl.trim() },
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.transcription) {
        setTranscribedText(data.transcription);
        toast.success("Текст успешно извлечён!");
      } else {
        throw new Error("Не удалось получить транскрипцию");
      }
    } catch (err) {
      console.error("Transcription error:", err);
      const message = err instanceof Error ? err.message : "Ошибка при транскрипции";
      setError(message);
      toast.error(message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(transcribedText);
    setCopied(true);
    toast.success("Скопировано!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseText = () => {
    if (onUseText && transcribedText) {
      onUseText(transcribedText);
      onClose();
    }
  };

  const handleClose = () => {
    setVideoUrl("");
    setTranscribedText("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Извлечь текст из видео (OCR)
          </DialogTitle>
          <DialogDescription>
            Вставьте ссылку на видео для извлечения текста с экрана (субтитры, надписи, заголовки)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-url">URL видео</Label>
            <div className="flex gap-2">
              <Input
                id="video-url"
                placeholder="https://example.com/video.mp4"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={isTranscribing}
              />
              <Button
                onClick={handleTranscribe}
                disabled={isTranscribing || !videoUrl.trim()}
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Обработка...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Извлечь
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              ⚠️ Только прямые ссылки на видеофайлы (.mp4, .webm, .mov). 
              <br />
              <span className="text-destructive/80">Instagram, TikTok, YouTube не поддерживаются</span> — нужен прямой URL вида https://example.com/video.mp4
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {transcribedText && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Извлечённый текст</Label>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <Check className="w-4 h-4 mr-1" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1" />
                  )}
                  {copied ? "Скопировано" : "Копировать"}
                </Button>
              </div>
              <Textarea
                value={transcribedText}
                readOnly
                className="min-h-[200px] font-mono text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Закрыть
                </Button>
                {onUseText && (
                  <Button onClick={handleUseText}>
                    Использовать для слайдов
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
