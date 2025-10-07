import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";
import { Slide, Asset } from "@/types";
import { exportVideo } from "@/utils/videoExport";
import { useEditorStore } from "@/store/useEditorStore";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  slides: Slide[];
  assets: Asset[];
}

export const ExportDialog = ({ open, onClose, slides, assets }: ExportDialogProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const { backgroundMusicUrl } = useEditorStore();

  // Group slides by language
  const slidesByLanguage = slides.reduce((acc, slide) => {
    const lang = slide.language || "original";
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(slide);
    return acc;
  }, {} as Record<string, Slide[]>);

  const handleExportAll = async () => {
    setIsExporting(true);
    setProgress(0);
    
    try {
      const languages = Object.keys(slidesByLanguage);
      
      for (let i = 0; i < languages.length; i++) {
        const lang = languages[i];
        const langSlides = slidesByLanguage[lang];
        
        setCurrentStep(`Exporting ${lang} (${i + 1}/${languages.length})...`);
        await exportLanguageVideo(lang, langSlides);
        
        setProgress(((i + 1) / languages.length) * 100);
      }
      
      toast.success(`Exported ${languages.length} video(s) successfully!`);
      onClose();
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
      setProgress(0);
      setCurrentStep("");
    }
  };

  const exportLanguageVideo = async (language: string, langSlides: Slide[]) => {
    try {
      // Get the background asset for this language
      const firstSlide = langSlides[0];
      const backgroundAsset = firstSlide?.assetId 
        ? assets.find(a => a.id === firstSlide.assetId) || null
        : null;

      const videoBlob = await exportVideo(
        langSlides,
        backgroundAsset,
        (progress, message) => {
          setProgress(progress);
          setCurrentStep(`${language}: ${message}`);
        },
        backgroundMusicUrl
      );

      // Download the video
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement("a");
      a.href = url;
      // Check if it's MP4 or WebM based on blob type
      const extension = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
      a.download = `video-${language}-${Date.now()}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Export error for ${language}:`, error);
      throw error;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Videos</DialogTitle>
          <DialogDescription>
            Export your project as MP4 files (1080×1920, ready for social media)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Available Versions:</h4>
            {Object.entries(slidesByLanguage).map(([lang, langSlides]) => (
              <div
                key={lang}
                className="flex items-center justify-between p-3 bg-secondary rounded-lg"
              >
                <div>
                  <p className="font-medium capitalize">{lang}</p>
                  <p className="text-xs text-muted-foreground">
                    {langSlides.length} slides, {langSlides.reduce((sum, s) => sum + s.durationSec, 0)}s total
                  </p>
                </div>
                <Download className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>

          {isExporting && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{currentStep}</p>
              <Progress value={progress} />
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-xs text-blue-200">
              <strong>Format:</strong> Videos are exported as MP4 (H.264 + AAC) when possible. If conversion fails due to video length or browser limitations, WebM format is used as fallback. Convert WebM to MP4 using CloudConvert if needed.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExportAll} disabled={isExporting}>
            {isExporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Export All ({Object.keys(slidesByLanguage).length} videos)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
