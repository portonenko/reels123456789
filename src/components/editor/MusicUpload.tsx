import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Music, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "@/store/useEditorStore";
import { AIMusicGenerator } from "./AIMusicGenerator";

interface MusicUploadProps {
  lang?: 'en' | 'ru';
}

export const MusicUpload = ({ lang = 'en' }: MusicUploadProps) => {
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
    <Tabs defaultValue="ai" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="ai">
          {lang === 'ru' ? 'AI музыка' : 'AI Music'}
        </TabsTrigger>
        <TabsTrigger value="upload">
          {lang === 'ru' ? 'Загрузить' : 'Upload'}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ai" className="space-y-3 mt-3">
        <AIMusicGenerator lang={lang} />
      </TabsContent>

      <TabsContent value="upload" className="space-y-3 mt-3">
        <Label className="flex items-center gap-2">
          <Music className="w-4 h-4" />
          {lang === 'ru' ? 'Фоновая музыка' : 'Background Music'}
        </Label>
        
        {backgroundMusicUrl ? (
          <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
            <Music className="w-4 h-4 text-primary" />
            <span className="text-sm flex-1">
              {lang === 'ru' ? 'Музыка загружена' : 'Music uploaded'}
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
              {isUploading 
                ? (lang === 'ru' ? 'Загрузка...' : 'Uploading...') 
                : (lang === 'ru' ? 'Загрузить' : 'Upload')
              }
            </Button>
          </div>
        )}
        
        <p className="text-xs text-muted-foreground">
          {lang === 'ru' 
            ? 'Загрузите музыку без авторских прав для ваших видео' 
            : 'Upload royalty-free music to add to your video exports'
          }
        </p>
      </TabsContent>
    </Tabs>
  );
};
