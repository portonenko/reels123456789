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

const GalleryStorage = () => {
  const navigate = useNavigate();
  const { assets, setAssets, addAsset, deleteAsset } = useEditorStore();
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkUserAndLoadAssets();
  }, []);

  const checkUserAndLoadAssets = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please log in to use the gallery");
      return;
    }
    setUserId(user.id);
    loadAssets(user.id);
  };

  const loadAssets = async (uid: string) => {
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading assets:", error);
      return;
    }

    if (data) {
      // Remove duplicates by ID
      const uniqueAssets = data.reduce((acc: AssetDb[], curr: AssetDb) => {
        if (!acc.find(a => a.id === curr.id)) {
          acc.push(curr);
        }
        return acc;
      }, []);

      const loadedAssets = uniqueAssets.map((a: AssetDb) => {
        // Get the storage URL for each asset
        const { data: urlData } = supabase.storage
          .from('video-assets')
          .getPublicUrl(`${uid}/${a.id}`);
        
        return {
          id: a.id,
          url: urlData.publicUrl,
          duration: Number(a.duration),
          width: a.width,
          height: a.height,
          createdAt: new Date(a.created_at),
        };
      });
      
      setAssets(loadedAssets);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!userId) {
      toast.error("Please log in to upload videos");
      return;
    }

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        // Create a temporary video element to get metadata
        const tempUrl = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.src = tempUrl;

        await new Promise((resolve, reject) => {
          video.onloadedmetadata = async () => {
            const assetId = crypto.randomUUID();
            
            // Upload to storage
            const { error: uploadError } = await supabase.storage
              .from('video-assets')
              .upload(`${userId}/${assetId}`, file, {
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
              .from('video-assets')
              .getPublicUrl(`${userId}/${assetId}`);

            // Save metadata to database
            const { error: dbError } = await supabase.from("assets").insert({
              id: assetId,
              user_id: userId,
              url: urlData.publicUrl,
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight,
            });

            if (dbError) {
              console.error("Database error:", dbError);
              toast.error("Failed to save video metadata");
              resolve(null);
              return;
            }

            // Add to local store
            addAsset({
              id: assetId,
              url: urlData.publicUrl,
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight,
              createdAt: new Date(),
            });

            URL.revokeObjectURL(tempUrl);
            resolve(null);
          };
          
          video.onerror = (err) => {
            URL.revokeObjectURL(tempUrl);
            reject(err);
          };
        });
      }

      toast.success(`Uploaded ${files.length} video(s)`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload videos");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('video-assets')
      .remove([`${userId}/${id}`]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      toast.error("Failed to delete video file");
      return;
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("assets")
      .delete()
      .eq("id", id);

    if (dbError) {
      console.error("Database delete error:", dbError);
      toast.error("Failed to delete video metadata");
      return;
    }

    deleteAsset(id);
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
          <Button asChild disabled={uploading || !userId}>
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
        {!userId ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <h2 className="text-2xl font-bold mb-2">Please log in</h2>
            <p className="text-muted-foreground">
              You need to be logged in to access the video gallery
            </p>
          </div>
        ) : assets.length === 0 ? (
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
                    preload="metadata"
                    crossOrigin="anonymous"
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => {
                      e.currentTarget.pause();
                      e.currentTarget.currentTime = 0;
                    }}
                    onError={(e) => {
                      console.error('Video load error:', asset.url);
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
                  onClick={() => handleDelete(asset.id)}
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

export default GalleryStorage;
