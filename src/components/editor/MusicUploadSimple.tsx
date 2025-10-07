import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Shuffle } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface MusicUploadSimpleProps {
  lang?: 'en' | 'ru';
}

export const MusicUploadSimple = ({ lang = 'en' }: MusicUploadSimpleProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { backgroundMusicUrl, setBackgroundMusic } = useEditorStore();
  const navigate = useNavigate();
  const [musicTracks, setMusicTracks] = useState<any[]>([]);

  useEffect(() => {
    loadMusicTracks();
  }, []);

  const loadMusicTracks = async () => {
    const { data } = await supabase.from('music_tracks').select('*');
    if (data) setMusicTracks(data);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setBackgroundMusic(url);
    toast.success(lang === 'ru' ? "Музыка загружена" : "Music uploaded");
  };

  const handleRandomize = () => {
    if (musicTracks.length === 0) {
      toast.error(lang === 'ru' ? "Нет треков в библиотеке" : "No tracks in gallery");
      return;
    }
    const randomTrack = musicTracks[Math.floor(Math.random() * musicTracks.length)];
    setBackgroundMusic(randomTrack.url);
    toast.success(lang === 'ru' ? `Выбран: ${randomTrack.name}` : `Selected: ${randomTrack.name}`);
  };

  const handleRemove = () => {
    if (backgroundMusicUrl) {
      URL.revokeObjectURL(backgroundMusicUrl);
      setBackgroundMusic(null);
      toast.success(lang === 'ru' ? "Музыка удалена" : "Music removed");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>{lang === 'ru' ? 'Фоновая музыка' : 'Background Music'}</Label>
        <p className="text-xs text-muted-foreground mb-2">
          {lang === 'ru' 
            ? 'Добавьте музыку к вашему видео'
            : 'Add background music to your video'}
        </p>

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {!backgroundMusicUrl ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {lang === 'ru' ? 'Загрузить' : 'Upload'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/music')}
              >
                {lang === 'ru' ? 'Библиотека' : 'Gallery'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRandomize}
              >
                <Shuffle className="w-4 h-4 mr-2" />
                {lang === 'ru' ? 'Случайный' : 'Random'}
              </Button>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-between p-2 bg-secondary rounded">
              <span className="text-sm text-muted-foreground truncate">
                {lang === 'ru' ? 'Музыка загружена' : 'Music loaded'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="h-6 px-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
