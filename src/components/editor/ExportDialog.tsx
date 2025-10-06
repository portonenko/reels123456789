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
import { Slide } from "@/types";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  slides: Slide[];
}

export const ExportDialog = ({ open, onClose, slides }: ExportDialogProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");

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
    // For MVP: Create a simple JSON export
    // Full video rendering would require ffmpeg.wasm implementation
    const exportData = {
      language,
      slides: langSlides.map(s => ({
        title: s.title.replace(/^\[.*?\]\s*/, ''),
        body: s.body?.replace(/^\[.*?\]\s*/, ''),
        duration: s.durationSec,
        style: s.style,
      })),
      metadata: {
        totalDuration: langSlides.reduce((sum, s) => sum + s.durationSec, 0),
        slideCount: langSlides.length,
        resolution: "1080x1920",
      }
    };

    // Download as JSON (placeholder for actual video export)
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: "application/json" 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-${language}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
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

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <p className="text-xs text-yellow-200">
              <strong>Note:</strong> This is an MVP version. Currently exports project data as JSON. Full MP4 rendering with ffmpeg.wasm will be added in the next update.
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
