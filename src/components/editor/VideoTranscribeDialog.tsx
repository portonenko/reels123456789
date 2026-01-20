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
  const [videoUrl, setVideoUrl] = useState(""); // OCR dialog
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const invokeTranscribe = async (url: string) => {
    const { data, error: fnError } = await supabase.functions.invoke("transcribe-video", {
      body: { videoUrl: url },
    });

    // Supabase marks non-2xx as an error, but may still provide a parsed JSON body.
    // Prefer the backend-provided message (and debug) over the generic FunctionsHttpError.
    if (data?.error) {
      const dbg = data?.debug ? `\n\n${data.debug}` : "";
      throw new Error(`${data.error}${dbg}`);
    }

    if (fnError) throw fnError;

    if (!data?.transcription) {
      throw new Error("Не удалось получить текст из видео");
    }

    return data.transcription as string;
  };

  const handleTranscribeFromUrl = async () => {
    if (!videoUrl.trim()) {
      toast.error("Введите URL видео");
      return;
    }

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
      const text = await invokeTranscribe(videoUrl.trim());
      setTranscribedText(text);
      toast.success("Текст успешно извлечён!");
    } catch (err) {
      console.error("Transcription error:", err);
      const message = err instanceof Error ? err.message : "Ошибка при извлечении текста";
      setError(message);
      toast.error("Не удалось извлечь текст");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleUploadAndTranscribe = async () => {
    if (!videoFile) {
      toast.error("Выберите видеофайл");
      return;
    }

    if (!videoFile.type.startsWith("video/")) {
      toast.error("Файл должен быть видео");
      return;
    }

    setIsTranscribing(true);
    setError("");
    setTranscribedText("");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error("Нужно войти в аккаунт, чтобы загрузить видео");

      const ext = (videoFile.name.split(".").pop() || "mp4").toLowerCase();
      const objectPath = `${userId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("video-assets")
        .upload(objectPath, videoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: videoFile.type,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("video-assets")
        .getPublicUrl(objectPath);

      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) throw new Error("Не удалось получить ссылку на загруженное видео");

      const text = await invokeTranscribe(publicUrl);
      setTranscribedText(text);
      toast.success("Текст успешно извлечён!");
    } catch (err) {
      console.error("Upload/transcription error:", err);
      const message = err instanceof Error ? err.message : "Ошибка при извлечении текста";
      setError(message);
      toast.error("Не удалось извлечь текст");
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
                onClick={handleTranscribeFromUrl}
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
              Instagram/TikTok/YouTube ссылки могут иногда блокироваться публичными инстансами.
              Для максимальной надёжности используйте загрузку файла ниже или прямой URL.
            </p>

            <div className="mt-3 grid gap-2">
              <Label htmlFor="video-file">Или загрузите видеофайл</Label>
              <Input
                id="video-file"
                type="file"
                accept="video/*"
                disabled={isTranscribing}
                onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              />
              <Button
                variant="secondary"
                onClick={handleUploadAndTranscribe}
                disabled={isTranscribing || !videoFile}
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 mr-2" />
                    Загрузить и извлечь
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Видео будет загружено в хранилище проекта и обработано OCR.
              </p>
            </div>
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
