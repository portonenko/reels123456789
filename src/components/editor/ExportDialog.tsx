import { useState, useEffect, useRef, useCallback } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Download, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { Slide, Asset } from "@/types";
import { exportVideo, exportPhotos } from "@/utils/videoExport";
import { supabase } from "@/integrations/supabase/client";

interface ProjectData {
  slides: Slide[];
  backgroundMusicUrl: string | null;
  globalOverlay: number;
  projectName: string;
}

interface DownloadItem {
  language: string;
  filename: string;
  url: string;
}

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  projects: Record<string, ProjectData>;
  assets: Asset[];
}

const MAX_LOG_ENTRIES = 50;

export const ExportDialog = ({ open, onClose, projects, assets }: ExportDialogProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [keepMusicAcrossLanguages, setKeepMusicAcrossLanguages] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(new Set());
  const [downloadItems, setDownloadItems] = useState<DownloadItem[]>([]);
  const [logEntries, setLogEntries] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString("ru-RU", { hour12: false });
    setLogEntries((prev) => {
      const newEntries = [...prev, `[${timestamp}] ${message}`];
      return newEntries.slice(-MAX_LOG_ENTRIES);
    });
  }, []);

  const copyLog = () => {
    const logText = logEntries.join("\n");
    navigator.clipboard.writeText(logText).then(() => {
      toast.success("Лог скопирован в буфер обмена");
    });
  };

  // Auto-scroll to bottom when new log entries are added
  useEffect(() => {
    if (showLog && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logEntries, showLog]);

  // Check if any project is a photo carousel
  const isPhotoCarousel = Object.values(projects).some(project => {
    const firstSlide = project.slides[0];
    if (firstSlide?.assetId) {
      const asset = assets.find(a => a.id === firstSlide.assetId);
      return asset?.type === 'image';
    }
    return false;
  });

  // Initialize with all languages selected
  useEffect(() => {
    if (open) {
      setSelectedLanguages(new Set(Object.keys(projects)));
      setDownloadItems([]);
      setLogEntries([]);
      setShowLog(false);
      addLog("Диалог экспорта открыт");
    } else {
      // Cleanup object URLs when dialog closes
      downloadItems.forEach((i) => URL.revokeObjectURL(i.url));
      setDownloadItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projects, addLog]);

  // Load user preference for keeping music
  useEffect(() => {
    const loadPreference = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_preferences")
        .select("keep_music_across_languages")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setKeepMusicAcrossLanguages(data.keep_music_across_languages);
      }
    };
    loadPreference();
  }, []);

  const handleToggleKeepMusic = async (checked: boolean) => {
    setKeepMusicAcrossLanguages(checked);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("user_preferences").upsert({
      user_id: user.id,
      keep_music_across_languages: checked,
    });
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lang)) {
        newSet.delete(lang);
      } else {
        newSet.add(lang);
      }
      return newSet;
    });
  };

  // projects is already organized by language

  const handleExportAll = async () => {
    setIsExporting(true);
    setProgress(0);
    setShowLog(true);
    
    addLog(`Начало экспорта: ${Object.keys(projects).join(", ")}`);
    console.log('Starting export for all projects:', Object.keys(projects));
    
    try {
      const languages = Object.keys(projects).filter(lang => selectedLanguages.has(lang));
      
      if (languages.length === 0) {
        addLog("Ошибка: не выбран ни один язык");
        toast.error("Please select at least one language to export");
        return;
      }

      addLog(`Выбранные языки: ${languages.join(", ")}`);

      // Use first project's music if keeping across languages
      const firstProject = Object.values(projects)[0];
      const sharedMusic = keepMusicAcrossLanguages ? firstProject.backgroundMusicUrl : null;
      
      for (let i = 0; i < languages.length; i++) {
        const lang = languages[i];
        const project = projects[lang];
        
        setCurrentStep(`Exporting ${lang} (${i + 1}/${languages.length})...`);
        addLog(`Экспорт ${lang} (${i + 1}/${languages.length})...`);
        console.log(`Processing export ${i + 1}/${languages.length}: ${lang}`);
        
        try {
          const musicUrl = sharedMusic || project.backgroundMusicUrl;
          await exportLanguageVideo(lang, { ...project, backgroundMusicUrl: musicUrl });
          addLog(`✓ Экспорт ${lang} успешно завершён`);
          console.log(`Successfully exported ${lang}`);
          
          // Small delay between exports to ensure cleanup
          if (i < languages.length - 1) {
            addLog("Пауза перед следующим экспортом...");
            console.log('Waiting before next export...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          addLog(`✗ Ошибка экспорта ${lang}: ${errorMessage}`);
          console.error(`Export failed for ${lang}:`, error);
          toast.error(`Export failed for ${lang}: ${errorMessage}`);
          throw error;
        }
        
        setProgress(((i + 1) / languages.length) * 100);
      }
      
      setProgress(100);
      addLog("Все экспорты завершены успешно");
      setCurrentStep(isPhotoCarousel ? "Готово. Нажмите «Скачать» ниже." : 'Done. Click "Download" below.');
      toast.success(isPhotoCarousel ? "Экспорт готов — скачайте файлы ниже" : "Export ready — download files below");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Экспорт прерван с ошибкой: ${errorMessage}`);
      console.error("Export error:", error);
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportLanguageVideo = async (language: string, project: ProjectData) => {
    addLog(`[${language}] Начало обработки: ${project.slides.length} слайдов`);
    console.log(`Starting export for ${language}`, {
      slidesCount: project.slides.length,
      hasMusicUrl: !!project.backgroundMusicUrl
    });
    
    const langSlides = project.slides;
    
    if (langSlides.length === 0) {
      addLog(`[${language}] Ошибка: слайды не найдены`);
      throw new Error(`No slides found for language: ${language}`);
    }
    
    // Get the background asset for the first slide
    const firstSlide = langSlides[0];
    const backgroundAsset = firstSlide?.assetId 
      ? assets.find(a => a.id === firstSlide.assetId) || null
      : null;

    // Check if this is a photo carousel (all slides use image assets)
    const isPhotoCarouselExport = backgroundAsset?.type === 'image';

    addLog(`[${language}] Тип: ${isPhotoCarouselExport ? 'фото' : 'видео'}, музыка: ${project.backgroundMusicUrl ? 'да' : 'нет'}`);
    console.log(`Calling ${isPhotoCarouselExport ? 'exportPhotos' : 'exportVideo'} for ${language}...`);
    
    const blob = isPhotoCarouselExport 
      ? await exportPhotos(
          langSlides,
          backgroundAsset,
          (progressValue, message) => {
            addLog(`[${language}] ${progressValue}% - ${message}`);
            console.log(`Export progress for ${language}: ${progressValue}% - ${message}`);
            setProgress(progressValue);
            setCurrentStep(`${language}: ${message}`);
          },
          project.globalOverlay
        )
      : await exportVideo(
          langSlides,
          backgroundAsset,
          (progressValue, message) => {
            addLog(`[${language}] ${progressValue}% - ${message}`);
            console.log(`Export progress for ${language}: ${progressValue}% - ${message}`);
            setProgress(progressValue);
            setCurrentStep(`${language}: ${message}`);
          },
          project.backgroundMusicUrl || undefined,
          project.globalOverlay
        );

    addLog(`[${language}] Экспорт завершён, размер: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Export complete for ${language}, preparing download...`);

    const url = URL.createObjectURL(blob);
    const isWebm = blob.type.includes("webm");
    const videoExt = isWebm ? "webm" : "mp4";

    const filename = isPhotoCarouselExport
      ? `photos-${language}-${Date.now()}.zip`
      : `video-${language}-${Date.now()}.${videoExt}`;

    addLog(`[${language}] Готово к скачиванию: ${filename}`);

    // Important: many browsers block automatic downloads after long async work.
    // We store the result and let the user click a Download button (user gesture).
    setDownloadItems((prev) => [...prev, { language, filename, url }]);

    console.log(`Download ready for ${language}: ${filename}`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isPhotoCarousel ? 'Экспорт фото' : 'Export Videos'}
          </DialogTitle>
          <DialogDescription>
            {isPhotoCarousel 
              ? 'Экспорт слайдов как изображений в ZIP архиве (1080×1920)'
              : 'Export your project as MP4 files (1080×1920, ready for social media)'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isPhotoCarousel && (
            <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
              <div className="flex flex-col gap-1">
                <Label htmlFor="keep-music" className="text-sm font-medium cursor-pointer">
                  Keep Same Music Across All Languages
                </Label>
                <p className="text-xs text-muted-foreground">
                  Use the same background music for all exported videos
                </p>
              </div>
              <Switch
                id="keep-music"
                checked={keepMusicAcrossLanguages}
                onCheckedChange={handleToggleKeepMusic}
              />
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              {isPhotoCarousel ? 'Выбрать для экспорта:' : 'Select Videos to Export:'}
            </h4>
            {Object.entries(projects).map(([lang, project]) => (
              <div
                key={lang}
                className="flex items-center gap-3 p-3 bg-secondary rounded-lg"
              >
                <Checkbox
                  id={`export-${lang}`}
                  checked={selectedLanguages.has(lang)}
                  onCheckedChange={() => toggleLanguage(lang)}
                />
                <label
                  htmlFor={`export-${lang}`}
                  className="flex-1 cursor-pointer"
                >
                  <p className="font-medium capitalize">{lang}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.slides.length} slides, {project.slides.reduce((sum, s) => sum + s.durationSec, 0)}s total
                  </p>
                </label>
                <Download className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>

          {(isExporting || logEntries.length > 0) && (
            <div className="space-y-2">
              {isExporting && (
                <>
                  <p className="text-sm text-muted-foreground">{currentStep}</p>
                  <Progress value={progress} />
                </>
              )}
              
              <div className="border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowLog(!showLog)}
                  className="w-full flex items-center justify-between p-2 bg-secondary/50 hover:bg-secondary transition-colors text-sm"
                >
                  <span className="font-medium">Лог экспорта ({logEntries.length})</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyLog();
                      }}
                      className="h-6 px-2"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Копировать
                    </Button>
                    {showLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                
                {showLog && (
                  <ScrollArea className="h-40 bg-background">
                    <div className="p-2 font-mono text-xs space-y-0.5">
                      {logEntries.length === 0 ? (
                        <p className="text-muted-foreground">Лог пуст</p>
                      ) : (
                        logEntries.map((entry, idx) => (
                          <p key={idx} className="text-muted-foreground whitespace-pre-wrap break-all">
                            {entry}
                          </p>
                        ))
                      )}
                      <div ref={logEndRef} />
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}

          {downloadItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                {isPhotoCarousel ? "Скачать результаты:" : "Download results:"}
              </h4>
              <div className="space-y-2">
                {downloadItems.map((item) => (
                  <div
                    key={item.url}
                    className="flex items-center justify-between gap-2 rounded-lg bg-secondary p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium capitalize">{item.language}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.filename}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = item.url;
                        a.download = item.filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                    >
                      {isPhotoCarousel ? "Скачать" : "Download"}
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {isPhotoCarousel
                  ? "Если браузер блокировал автоскачивание — здесь всегда можно скачать вручную."
                  : "If your browser blocked the automatic download, you can always download manually here."}
              </p>
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-xs text-blue-200">
              {isPhotoCarousel 
                ? <><strong>Формат:</strong> Фото экспортируются как PNG изображения в ZIP архиве. Каждый слайд сохраняется как отдельное изображение.</>
                : <><strong>Format:</strong> Videos are exported as MP4 (H.264 + AAC) for maximum compatibility with mobile devices. Note: MP4 conversion takes 1-2 minutes.</>
              }
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExportAll} disabled={isExporting || selectedLanguages.size === 0}>
            {isExporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isPhotoCarousel 
              ? `Экспорт (${selectedLanguages.size})`
              : `Export Selected (${selectedLanguages.size} ${selectedLanguages.size === 1 ? 'video' : 'videos'})`
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
