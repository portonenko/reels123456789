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

interface ProjectData {
  slides: Slide[];
  backgroundMusicUrl: string | null;
  globalOverlay: number;
  projectName: string;
}

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  projects: Record<string, ProjectData>;
  assets: Asset[];
}

export const ExportDialog = ({ open, onClose, projects, assets }: ExportDialogProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");

  // projects is already organized by language

  const handleExportAll = async () => {
    setIsExporting(true);
    setProgress(0);
    
    console.log('Starting export for all projects:', Object.keys(projects));
    
    try {
      const languages = Object.keys(projects);
      
      if (languages.length === 0) {
        toast.error("No projects to export");
        return;
      }
      
      for (let i = 0; i < languages.length; i++) {
        const lang = languages[i];
        const project = projects[lang];
        
        setCurrentStep(`Exporting ${lang} (${i + 1}/${languages.length})...`);
        console.log(`Processing export ${i + 1}/${languages.length}: ${lang}`);
        
        try {
          await exportLanguageVideo(lang, project);
          console.log(`Successfully exported ${lang}`);
          
          // Small delay between exports to ensure cleanup
          if (i < languages.length - 1) {
            console.log('Waiting before next export...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`Export failed for ${lang}:`, error);
          toast.error(`Export failed for ${lang}. Continuing with others...`);
        }
        
        setProgress(((i + 1) / languages.length) * 100);
      }
      
      toast.success(`Export complete!`);
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

  const exportLanguageVideo = async (language: string, project: ProjectData) => {
    console.log(`Starting export for ${language}`, {
      slidesCount: project.slides.length,
      hasMusicUrl: !!project.backgroundMusicUrl
    });
    
    const langSlides = project.slides;
    
    if (langSlides.length === 0) {
      throw new Error(`No slides found for language: ${language}`);
    }
    
    // Get the background asset for the first slide
    const firstSlide = langSlides[0];
    const backgroundAsset = firstSlide?.assetId 
      ? assets.find(a => a.id === firstSlide.assetId) || null
      : null;

    console.log(`Calling exportVideo for ${language}...`);
    const videoBlob = await exportVideo(
      langSlides,
      backgroundAsset,
      (progress, message) => {
        console.log(`Export progress for ${language}: ${progress}% - ${message}`);
        setProgress(progress);
        setCurrentStep(`${language}: ${message}`);
      },
      project.backgroundMusicUrl || undefined
    );

    console.log(`Export complete for ${language}, downloading...`);
    // Download the video as MP4
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-${language}-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Cleanup URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 100);
    console.log(`Download triggered for ${language}`);
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
            {Object.entries(projects).map(([lang, project]) => (
              <div
                key={lang}
                className="flex items-center justify-between p-3 bg-secondary rounded-lg"
              >
                <div>
                  <p className="font-medium capitalize">{lang}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.slides.length} slides, {project.slides.reduce((sum, s) => sum + s.durationSec, 0)}s total
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
              <strong>Format:</strong> Videos are exported as MP4 (H.264 + AAC) for maximum compatibility with mobile devices. Note: MP4 conversion takes 1-2 minutes.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExportAll} disabled={isExporting}>
            {isExporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Export All ({Object.keys(projects).length} videos)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
