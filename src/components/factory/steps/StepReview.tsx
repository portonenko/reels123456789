import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Download, 
  Save, 
  Video, 
  Image, 
  LayoutGrid,
  CheckCircle2,
  Loader2,
  Music
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
import { Asset } from "@/types";

interface StepReviewProps {
  generatedContent: GeneratedContent[];
  assets: Asset[];
  
}

const FORMAT_ICONS: Record<ContentFormat, React.ReactNode> = {
  video: <Video className="w-4 h-4" />,
  carousel: <LayoutGrid className="w-4 h-4" />,
  "static-single": <Image className="w-4 h-4" />,
  "static-multi": <Image className="w-4 h-4" />,
};

export const StepReview = ({ generatedContent, assets }: StepReviewProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());

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

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();

      for (const content of generatedContent) {
        const langName = FACTORY_LANGUAGES.find(l => l.code === content.language)?.name || content.language;
        const formatName = CONTENT_FORMATS.find(f => f.code === content.format)?.name?.replace(/\s+/g, '_') || content.format;
        const folderName = `${langName}_${formatName}`;
        const folder = zip.folder(folderName);
        
        if (!folder) continue;

        // For now, export slide data as JSON
        // Full video/image export would require canvas rendering
        folder.file("slides.json", JSON.stringify(content.slides, null, 2));
        
        if (content.musicUrl) {
          folder.file("music_url.txt", content.musicUrl);
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `content_factory_export_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Download started!");
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error(`Failed to download: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
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

                  {content.slides.length > 0 && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs truncate">
                      {content.slides[0]?.title}
                    </div>
                  )}
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
