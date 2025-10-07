import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Home, Upload, Trash2, Music, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEditorStore } from "@/store/useEditorStore";

interface MusicTrack {
  id: string;
  name: string;
  url: string;
  duration: number;
  created_at: string;
}

const MusicGallery = () => {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [uploading, setUploading] = useState(false);
  const { setBackgroundMusic } = useEditorStore();

  useEffect(() => {
    loadMusicTracks();
  }, []);

  const loadMusicTracks = async () => {
    const { data, error } = await supabase
      .from("music_tracks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading music:", error);
      return;
    }

    setTracks(data || []);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to upload music");
        return;
      }

      for (const file of Array.from(files)) {
        const url = URL.createObjectURL(file);
        const audio = document.createElement("audio");
        audio.src = url;

        await new Promise((resolve) => {
          audio.onloadedmetadata = async () => {
            const { error } = await supabase.from("music_tracks").insert({
              user_id: user.id,
              name: file.name,
              url: url,
              duration: audio.duration,
            });

            if (error) {
              console.error("Error saving music:", error);
              toast.error("Failed to save music track");
            }
            resolve(null);
          };
        });
      }

      await loadMusicTracks();
      toast.success(`Uploaded ${files.length} track(s)`);
    } catch (error) {
      toast.error("Failed to upload music");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string, url: string) => {
    const { error } = await supabase.from("music_tracks").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete track");
      return;
    }

    URL.revokeObjectURL(url);
    await loadMusicTracks();
    toast.success("Track deleted");
  };

  const handleRandomize = () => {
    if (tracks.length === 0) return;
    const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
    setBackgroundMusic(randomTrack.url);
    toast.success(`Selected: ${randomTrack.name}`);
    navigate("/editor");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
          <h1 className="font-semibold">Music Gallery</h1>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRandomize}
            disabled={tracks.length === 0}
          >
            <Shuffle className="w-4 h-4 mr-2" />
            Random Music
          </Button>
          <label htmlFor="music-upload">
            <Button asChild disabled={uploading}>
              <span className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? "Uploading..." : "Upload Music"}
              </span>
            </Button>
          </label>
        </div>
        <input
          id="music-upload"
          type="file"
          accept="audio/mp3,audio/wav,audio/ogg,audio/m4a"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />
      </header>

      <div className="p-6">
        {tracks.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Music className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No music tracks yet</h2>
            <p className="text-muted-foreground mb-6">
              Upload background music to use in your videos
            </p>
            <label htmlFor="music-upload-2">
              <Button asChild className="bg-gradient-primary">
                <span className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Your First Track
                </span>
              </Button>
            </label>
            <input
              id="music-upload-2"
              type="file"
              accept="audio/mp3,audio/wav,audio/ogg,audio/m4a"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tracks.map((track) => (
              <Card key={track.id} className="group relative overflow-hidden">
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Music className="w-16 h-16 text-primary/40" />
                </div>

                <div className="p-3 bg-card">
                  <div className="text-sm font-medium truncate mb-1">{track.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Duration: {track.duration.toFixed(1)}s
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(track.id, track.url)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicGallery;
