import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Home, Upload, Trash2 } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AssetDb {
  id: string;
  url: string;
  duration: number;
  width: number;
  height: number;
  created_at: string;
}

const Gallery = () => {
  const navigate = useNavigate();
  const { assets, setAssets, addAsset, deleteAsset } = useEditorStore();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Not logged in, use local store only
      return;
    }

    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading assets:", error);
      return;
    }

    if (data) {
      const loadedAssets = data.map((a: AssetDb) => ({
        id: a.id,
        url: a.url,
        duration: Number(a.duration),
        width: a.width,
        height: a.height,
        createdAt: new Date(a.created_at),
      }));
      setAssets(loadedAssets);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const url = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.src = url;

        await new Promise((resolve) => {
          video.onloadedmetadata = async () => {
            const asset = {
              id: crypto.randomUUID(),
              url,
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight,
              createdAt: new Date(),
            };

            // Save to store
            addAsset(asset);

            // Save to database if logged in
            if (user) {
              const { error } = await supabase.from("assets").insert({
                id: asset.id,
                user_id: user.id,
                url: asset.url,
                duration: asset.duration,
                width: asset.width,
                height: asset.height,
              });

              if (error) {
                console.error("Error saving asset:", error);
                toast.error("Failed to save to database");
              }
            }

            resolve(null);
          };
        });
      }

      toast.success(`Uploaded ${files.length} video(s)`);
    } catch (error) {
      toast.error("Failed to upload videos");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string, url: string) => {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase.from("assets").delete().eq("id", id);
      if (error) {
        toast.error("Failed to delete from database");
        return;
      }
    }

    deleteAsset(id);
    URL.revokeObjectURL(url);
    toast.success("Video deleted");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
          <h1 className="font-semibold">Video Gallery</h1>
        </div>

        <label htmlFor="video-upload">
          <Button asChild disabled={uploading}>
            <span className="cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Uploading..." : "Upload Videos"}
            </span>
          </Button>
        </label>
        <input
          id="video-upload"
          type="file"
          accept="video/mp4,video/webm"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />
      </header>

      <div className="p-6">
        {assets.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No videos yet</h2>
            <p className="text-muted-foreground mb-6">
              Upload background videos to use in your vertical video projects
            </p>
            <label htmlFor="video-upload-2">
              <Button asChild className="bg-gradient-primary">
                <span className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Your First Video
                </span>
              </Button>
            </label>
            <input
              id="video-upload-2"
              type="file"
              accept="video/mp4,video/webm"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {assets.map((asset) => (
              <Card key={asset.id} className="group relative overflow-hidden">
                <div className="aspect-video bg-black">
                  <video
                    src={asset.url}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => {
                      e.currentTarget.pause();
                      e.currentTarget.currentTime = 0;
                    }}
                  />
                </div>

                <div className="p-3 bg-card">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Duration: {asset.duration.toFixed(1)}s</div>
                    <div>Resolution: {asset.width}×{asset.height}</div>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(asset.id, asset.url)}
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

export default Gallery;
