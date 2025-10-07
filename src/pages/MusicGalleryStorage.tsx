import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Home, Upload, Trash2, Music, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MusicTrack {
  id: string;
  name: string;
  url: string;
  duration: number;
  created_at: string;
}

const MusicGalleryStorage = () => {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkUserAndLoadTracks();
  }, []);

  const checkUserAndLoadTracks = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please log in to use the music gallery");
      return;
    }
    setUserId(user.id);
    loadTracks(user.id);
  };

  const loadTracks = async (uid: string) => {
    const { data, error } = await supabase
      .from("music_tracks")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading tracks:", error);
      return;
    }

    if (data) {
      // Remove duplicates by ID and use the URL already stored in the database
      const uniqueTracks = data.reduce((acc: any[], curr: any) => {
        if (!acc.find(t => t.id === curr.id)) {
          acc.push(curr);
        }
        return acc;
      }, []);

      setTracks(uniqueTracks);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!userId) {
      toast.error("Please log in to upload music");
      return;
    }

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        // Create a temporary audio element to get duration
        const tempUrl = URL.createObjectURL(file);
        const audio = document.createElement("audio");
        audio.src = tempUrl;

        await new Promise((resolve, reject) => {
          audio.onloadedmetadata = async () => {
            const trackId = crypto.randomUUID();
            
            // Upload to storage
            const { error: uploadError } = await supabase.storage
              .from('music-tracks')
              .upload(`${userId}/${trackId}`, file, {
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) {
              console.error("Upload error:", uploadError);
              toast.error(`Failed to upload ${file.name}`);
              resolve(null);
              return;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
              .from('music-tracks')
              .getPublicUrl(`${userId}/${trackId}`);

            // Save metadata to database
            const { error: dbError } = await supabase.from("music_tracks").insert({
              id: trackId,
              user_id: userId,
              name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
              url: urlData.publicUrl,
              duration: audio.duration,
            });

            if (dbError) {
              console.error("Database error:", dbError);
              toast.error("Failed to save music metadata");
              resolve(null);
              return;
            }

            // Add to local state
            setTracks(prev => [{
              id: trackId,
              name: file.name.replace(/\.[^/.]+$/, ""),
              url: urlData.publicUrl,
              duration: audio.duration,
              created_at: new Date().toISOString(),
            }, ...prev]);

            URL.revokeObjectURL(tempUrl);
            resolve(null);
          };
          
          audio.onerror = (err) => {
            URL.revokeObjectURL(tempUrl);
            reject(err);
          };
        });
      }

      toast.success(`Uploaded ${files.length} track(s)`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload music");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!userId) return;

    // Stop playback if playing
    if (playingId === id) {
      const audio = audioElements.get(id);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setPlayingId(null);
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('music-tracks')
      .remove([`${userId}/${id}`]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      toast.error("Failed to delete music file");
      return;
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("music_tracks")
      .delete()
      .eq("id", id);

    if (dbError) {
      console.error("Database delete error:", dbError);
      toast.error("Failed to delete music metadata");
      return;
    }

    setTracks(prev => prev.filter(t => t.id !== id));
    toast.success(`Deleted "${name}"`);
  };

  const handlePlayPause = (track: MusicTrack) => {
    let audio = audioElements.get(track.id);
    
    if (!audio) {
      audio = new Audio(track.url);
      audio.crossOrigin = "anonymous";
      setAudioElements(prev => new Map(prev).set(track.id, audio!));
    }

    if (playingId === track.id) {
      audio.pause();
      setPlayingId(null);
    } else {
      // Pause any currently playing track
      if (playingId) {
        const currentAudio = audioElements.get(playingId);
        if (currentAudio) {
          currentAudio.pause();
        }
      }
      audio.play();
      setPlayingId(track.id);
      audio.onended = () => setPlayingId(null);
    }
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

        <label htmlFor="music-upload">
          <Button asChild disabled={uploading || !userId}>
            <span className="cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Uploading..." : "Upload Music"}
            </span>
          </Button>
        </label>
        <input
          id="music-upload"
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />
      </header>

      <div className="p-6">
        {!userId ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <h2 className="text-2xl font-bold mb-2">Please log in</h2>
            <p className="text-muted-foreground">
              You need to be logged in to access the music gallery
            </p>
          </div>
        ) : tracks.length === 0 ? (
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
              accept="audio/mpeg,audio/mp3,audio/wav"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            {tracks.map((track) => (
              <Card key={track.id} className="p-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePlayPause(track)}
                  >
                    {playingId === track.id ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>

                  <div className="flex-1">
                    <h3 className="font-medium">{track.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Duration: {track.duration.toFixed(1)}s
                    </p>
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(track.id, track.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicGalleryStorage;
