import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  Save,
  Video,
  Image,
  LayoutGrid,
  CheckCircle2,
  Loader2,
  Music,
  Eye,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { 
  GeneratedContent, 
  ContentFormat,
  FACTORY_LANGUAGES,
  CONTENT_FORMATS 
} from "@/types/contentFactory";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { exportVideo, exportPhotos } from "@/utils/videoExport";
import { Asset, Slide } from "@/types";
import { renderSlideText } from "@/utils/canvasTextRenderer";

interface StepReviewProps {
  generatedContent: GeneratedContent[];
  assets: Asset[];
}

interface ExportProgress {
  currentItem: number;
  totalItems: number;
  itemName: string;
  itemProgress: number;
  stage: string;
}

interface SingleExportState {
  id: string;
  progress: number;
  stage: string;
}

const FORMAT_ICONS: Record<ContentFormat, React.ReactNode> = {
  video: <Video className="w-4 h-4" />,
  carousel: <LayoutGrid className="w-4 h-4" />,
  "static-single": <Image className="w-4 h-4" />,
  "static-multi": <Image className="w-4 h-4" />,
};

// Simple slide preview renderer
const SlidePreviewCanvas = ({ slide, size = 120 }: { slide: Slide; size?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, size, size);

    // Draw simple text preview
    const style = (slide.style || {}) as Record<string, any>;
    ctx.fillStyle = (style.textColor as string) || "#ffffff";
    ctx.font = `bold ${Math.max(10, size / 10)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const text = slide.title || "";
    const lines = text.split("\n").slice(0, 3);
    const lineHeight = size / 8;
    const startY = size / 2 - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, i) => {
      const truncated = line.length > 15 ? line.slice(0, 15) + "…" : line;
      ctx.fillText(truncated, size / 2, startY + i * lineHeight);
    });
  }, [slide, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded border border-border"
    />
  );
};

export const StepReview = ({ generatedContent, assets }: StepReviewProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string | null>(null);
  
  // Single item export
  const [singleExport, setSingleExport] = useState<SingleExportState | null>(null);
  
  // Preview dialog
  const [previewContent, setPreviewContent] = useState<GeneratedContent | null>(null);

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      for (const content of generatedContent) {
        const langName = FACTORY_LANGUAGES.find(l => l.code === content.language)?.name || content.language;
        const formatName = CONTENT_FORMATS.find(f => f.code === content.format)?.name || content.format;
        
        const projectData = {
          slides: content.slides,
          globalOverlay: 30,
          backgroundMusicUrl: content.musicUrl || null,
        };

        await supabase.from("projects").insert({
          user_id: user.id,
          name: `${langName} - ${formatName}`,
          language: content.language,
          data: projectData,
        });

        setSavedItems(prev => new Set([...prev, content.id]));
      }

      toast.success(`Saved ${generatedContent.length} projects to your account!`);
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Export single item
  const handleExportSingle = async (content: GeneratedContent) => {
    const langName =
      FACTORY_LANGUAGES.find((l) => l.code === content.language)?.name || content.language;
    const formatName =
      CONTENT_FORMATS.find((f) => f.code === content.format)?.name?.replace(/\s+/g, "_") ||
      content.format;
    const baseName = `${langName}_${formatName}_${Date.now()}`;

    setSingleExport({ id: content.id, progress: 0, stage: "Подготовка..." });

    try {
      if (content.format === "video") {
        const videoAsset = assets.find((a) => a.type === "video" || !a.type);
        setSingleExport({ id: content.id, progress: 10, stage: "Рендеринг видео..." });

        const videoBlob = await exportVideo(
          content.slides,
          videoAsset || null,
          (progress, message) => {
            setSingleExport({ id: content.id, progress: 10 + progress * 0.9, stage: message });
          },
          content.musicUrl,
          undefined
        );

        const isWebm = videoBlob.type.includes("webm");
        const ext = isWebm ? "webm" : "mp4";
        const filename = `${baseName}.${ext}`;

        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // iOS/Safari fallback (opens in new tab)
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);

        toast.success(`Видео «${langName} — ${formatName}» скачано!`);
        return;
      }

      // Non-video formats are exported as ZIP
      const zip = new JSZip();

      if (content.format === "carousel" || content.format === "static-single" || content.format === "static-multi") {
        const imageAsset = assets.find((a) => a.type === "image");
        setSingleExport({ id: content.id, progress: 10, stage: "Рендеринг изображений..." });

        const photosZipBlob = await exportPhotos(
          content.slides,
          imageAsset || null,
          (progress, message) => {
            setSingleExport({ id: content.id, progress: 10 + progress * 0.8, stage: message });
          },
          undefined
        );

        const innerZip = await JSZip.loadAsync(photosZipBlob);
        for (const [fileName, file] of Object.entries(innerZip.files)) {
          if (!file.dir) {
            const fileData = await file.async("blob");
            zip.file(fileName, fileData);
          }
        }
      }

      if (content.musicUrl) {
        zip.file("music_url.txt", content.musicUrl);
      }

      if (content.captionText) {
        zip.file("caption.txt", content.captionText);
      }

      setSingleExport({ id: content.id, progress: 95, stage: "Создание ZIP..." });

      const blob = await zip.generateAsync({ type: "blob" });
      const filename = `${baseName}.zip`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      toast.success(`Экспорт «${langName} — ${formatName}» завершён!`);
    } catch (error: any) {
      console.error("Single export error:", error);
      toast.error(`Ошибка экспорта: ${error.message}`);
    } finally {
      setSingleExport(null);
    }
  };

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    // reset previous download
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    setDownloadName(null);

    setExportProgress({
      currentItem: 0,
      totalItems: generatedContent.length,
      itemName: "Подготовка...",
      itemProgress: 0,
      stage: "Инициализация"
    });

    try {
      const mainZip = new JSZip();

      for (let i = 0; i < generatedContent.length; i++) {
        const content = generatedContent[i];
        const langName = FACTORY_LANGUAGES.find(l => l.code === content.language)?.name || content.language;
        const formatName = CONTENT_FORMATS.find(f => f.code === content.format)?.name?.replace(/\s+/g, '_') || content.format;
        const folderName = `${langName}_${formatName}`;
        const folder = mainZip.folder(folderName);
        
        if (!folder) continue;

        setExportProgress({
          currentItem: i + 1,
          totalItems: generatedContent.length,
          itemName: folderName,
          itemProgress: 0,
          stage: content.format === "video" ? "Рендеринг видео" : "Рендеринг изображений"
        });

        // Export based on format
        if (content.format === "video") {
          const videoAsset = assets.find((a) => a.type === "video" || !a.type);

          try {
            const videoBlob = await exportVideo(
              content.slides,
              videoAsset || null,
              (progress, message) => {
                setExportProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        itemProgress: progress,
                        stage: message,
                      }
                    : null
                );
              },
              content.musicUrl,
              undefined
            );

            const isWebm = videoBlob.type.includes("webm");
            folder.file(isWebm ? "video.webm" : "video.mp4", videoBlob);
          } catch (videoError: any) {
            console.error("Video export failed:", videoError);
            folder.file("slides.json", JSON.stringify(content.slides, null, 2));
            folder.file("export_error.txt", `Video export failed: ${videoError.message}`);
          }

          if (content.musicUrl) {
            folder.file("music_url.txt", content.musicUrl);
          }
        } else {
          const imageAsset = assets.find((a) => a.type === "image");

          try {
            const photosZipBlob = await exportPhotos(
              content.slides,
              imageAsset || null,
              (progress, message) => {
                setExportProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        itemProgress: progress,
                        stage: message,
                      }
                    : null
                );
              },
              undefined
            );

            const innerZip = await JSZip.loadAsync(photosZipBlob);

            for (const [fileName, file] of Object.entries(innerZip.files)) {
              if (!file.dir) {
                const fileData = await file.async("blob");
                folder.file(fileName, fileData);
              }
            }
          } catch (photoError: any) {
            console.error("Photo export failed:", photoError);
            folder.file("slides.json", JSON.stringify(content.slides, null, 2));
            folder.file("export_error.txt", `Photo export failed: ${photoError.message}`);
          }
        }

        if (content.captionText) {
          folder.file("caption.txt", content.captionText);
        }
      }

      setExportProgress({
        currentItem: generatedContent.length,
        totalItems: generatedContent.length,
        itemName: "Финализация",
        itemProgress: 100,
        stage: "Создание ZIP архива..."
      });

      const blob = await mainZip.generateAsync({ type: "blob" });
      const filename = `content_factory_export_${Date.now()}.zip`;

      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setDownloadName(filename);

      // Try to auto-trigger download (helps on desktop). If blocked (iOS/Safari), the "Скачать ZIP" button remains.
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {
        // ignore
      }

      toast.success("ZIP готов. Если загрузка не началась — нажмите «Скачать ZIP».", { duration: 5000 });
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error(`Ошибка экспорта: ${error.message}`);
    } finally {
      setIsDownloading(false);
      setExportProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Preview Dialog */}
      <Dialog open={!!previewContent} onOpenChange={() => setPreviewContent(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewContent && FORMAT_ICONS[previewContent.format]}
              {previewContent && FACTORY_LANGUAGES.find(l => l.code === previewContent.language)?.name}
              {" — "}
              {previewContent && CONTENT_FORMATS.find(f => f.code === previewContent.format)?.name}
            </DialogTitle>
          </DialogHeader>
          
          {previewContent && (
            <div className="space-y-4">
              <ScrollArea className="h-[50vh]">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 p-2">
                  {previewContent.slides.map((slide, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <SlidePreviewCanvas slide={slide} size={100} />
                      <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {previewContent.captionText && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs font-medium mb-1">Caption:</div>
                  <p className="text-sm whitespace-pre-wrap">{previewContent.captionText}</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPreviewContent(null)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Закрыть
                </Button>
                <Button
                  onClick={() => {
                    setPreviewContent(null);
                    handleExportSingle(previewContent);
                  }}
                  disabled={!!singleExport}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Скачать
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Download ready */}
      {downloadUrl && downloadName && (
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium">ZIP готов к скачиванию</div>
            <div className="text-muted-foreground text-xs break-all">{downloadName}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                const a = document.createElement("a");
                a.href = downloadUrl;
                a.download = downloadName;
                a.rel = "noopener";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
            >
              Скачать ZIP
            </Button>
            <Button asChild variant="outline">
              <a href={downloadUrl} target="_blank" rel="noreferrer">
                Открыть
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Export Progress Bar */}
      {exportProgress && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="font-medium">
                Экспорт {exportProgress.currentItem}/{exportProgress.totalItems}
              </span>
            </div>
            <Badge variant="secondary">{exportProgress.itemName}</Badge>
          </div>
          
          {/* Overall progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Общий прогресс</span>
              <span>{Math.round((exportProgress.currentItem / exportProgress.totalItems) * 100)}%</span>
            </div>
            <Progress 
              value={(exportProgress.currentItem / exportProgress.totalItems) * 100} 
              className="h-2"
            />
          </div>

          {/* Current item progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{exportProgress.stage}</span>
              <span>{Math.round(exportProgress.itemProgress)}%</span>
            </div>
            <Progress 
              value={exportProgress.itemProgress} 
              className="h-1.5"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-4 justify-center">
        <Button
          size="lg"
          onClick={handleSaveAll}
          disabled={isSaving || savedItems.size === generatedContent.length}
          className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : savedItems.size === generatedContent.length ? (
            <CheckCircle2 className="w-5 h-5 mr-2" />
          ) : (
            <Save className="w-5 h-5 mr-2" />
          )}
          {savedItems.size === generatedContent.length 
            ? "All Saved!" 
            : `Save All to Account (${generatedContent.length})`}
        </Button>

        <Button
          size="lg"
          variant="outline"
          onClick={handleDownloadAll}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <Download className="w-5 h-5 mr-2" />
          )}
          Download as ZIP
        </Button>
      </div>

      {/* Content grid */}
      <ScrollArea className="h-[400px]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {generatedContent.map((content) => {
            const langInfo = FACTORY_LANGUAGES.find(l => l.code === content.language);
            const formatInfo = CONTENT_FORMATS.find(f => f.code === content.format);
            const isSaved = savedItems.has(content.id);
            const isExporting = singleExport?.id === content.id;

            return (
              <div 
                key={content.id}
                className={`bg-card border rounded-lg p-4 transition-all ${
                  isSaved ? 'border-green-500 bg-green-500/5' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-muted rounded">
                      {FORMAT_ICONS[content.format]}
                    </div>
                    <div>
                      <div className="font-medium">{langInfo?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatInfo?.name}
                      </div>
                    </div>
                  </div>
                  {isSaved && (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                </div>

                {/* Slide previews */}
                <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
                  {content.slides.slice(0, 4).map((slide, idx) => (
                    <SlidePreviewCanvas key={idx} slide={slide} size={50} />
                  ))}
                  {content.slides.length > 4 && (
                    <div className="w-[50px] h-[50px] rounded border border-border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      +{content.slides.length - 4}
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Slides:</span>
                    <Badge variant="secondary">{content.slides.length}</Badge>
                  </div>
                  
                  {content.musicUrl && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Music className="w-3 h-3" />
                      <span className="text-xs">Music attached</span>
                    </div>
                  )}
                </div>

                {/* Single export progress */}
                {isExporting && singleExport && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{singleExport.stage}</span>
                      <span>{Math.round(singleExport.progress)}%</span>
                    </div>
                    <Progress value={singleExport.progress} className="h-1.5" />
                  </div>
                )}

                {/* Card actions */}
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setPreviewContent(content)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Просмотр
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => handleExportSingle(content)}
                    disabled={!!singleExport || isDownloading}
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-1" />
                    )}
                    Скачать
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Summary */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Generated <strong>{generatedContent.length}</strong> content items
          {savedItems.size > 0 && (
            <span> • <strong>{savedItems.size}</strong> saved to account</span>
          )}
        </p>
      </div>
    </div>
  );
};