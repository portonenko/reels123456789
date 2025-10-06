import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Music, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "@/store/useEditorStore";

export const MusicUpload = () => {
  const { backgroundMusicUrl, setBackgroundMusic } = useEditorStore();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("audio/")) {
      toast.error("Please upload an audio file");
      return;
    }

    setIsUploading(true);

    try {
      // Create object URL for the audio file
      const url = URL.createObjectURL(file);
      setBackgroundMusic(url);
      toast.success("Background music uploaded!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload music");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    if (backgroundMusicUrl) {
      URL.revokeObjectURL(backgroundMusicUrl);
    }
    setBackgroundMusic(null);
    toast.success("Background music removed");
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Music className="w-4 h-4" />
        Background Music
      </Label>
      
      {backgroundMusicUrl ? (
        <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
          <Music className="w-4 h-4 text-primary" />
          <span className="text-sm flex-1">Music uploaded</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="cursor-pointer"
          />
          <Button
            variant="outline"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
            disabled={isUploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        Upload royalty-free music to add to your video exports
      </p>
    </div>
  );
};
