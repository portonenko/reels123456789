import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Home, Upload, Trash2 } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { toast } from "sonner";

const Gallery = () => {
  const navigate = useNavigate();
  const { assets, addAsset, deleteAsset } = useEditorStore();
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        // Create a temporary URL for preview
        const url = URL.createObjectURL(file);
        
        // Get video metadata
        const video = document.createElement("video");
        video.src = url;
        
        await new Promise((resolve) => {
          video.onloadedmetadata = () => {
            const asset = {
              id: crypto.randomUUID(),
              url,
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight,
              createdAt: new Date(),
            };
            addAsset(asset);
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
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-sm text-yellow-200">
            <strong>Note:</strong> Videos are stored temporarily in your browser. If you refresh the page or navigate away, you'll need to re-upload them.
          </p>
        </div>

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
                  onClick={() => {
                    deleteAsset(asset.id);
                    URL.revokeObjectURL(asset.url);
                    toast.success("Video deleted");
                  }}
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
