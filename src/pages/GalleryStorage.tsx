import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home, Upload, Trash2, Folder, FolderPlus } from "lucide-react";
import { useEditorStore } from "@/store/useEditorStore";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface AssetDb {
  id: string;
  url: string;
  duration: number;
  width: number;
  height: number;
  created_at: string;
  category: string;
}

const GalleryStorage = () => {
  const navigate = useNavigate();
  const { assets, setAssets, addAsset, deleteAsset } = useEditorStore();
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [newCategory, setNewCategory] = useState<string>("");
  const [categories, setCategories] = useState<string[]>(["default"]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState("");

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

      // Extract unique categories
      const uniqueCategories = Array.from(new Set(uniqueAssets.map(a => a.category || 'default')));
      setCategories(uniqueCategories);

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
          category: a.category || 'default',
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
            const category = newCategory.trim() || "default";
            const { error: dbError } = await supabase.from("assets").insert({
              id: assetId,
              user_id: userId,
              url: urlData.publicUrl,
              duration: video.duration,
              width: video.videoWidth,
              height: video.videoHeight,
              category: category,
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
              category: category,
            });
            
            // Add to categories if new
            if (!categories.includes(category)) {
              setCategories([...categories, category]);
            }

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

  const handleCreateFolder = () => {
    const trimmedName = folderName.trim();
    if (!trimmedName) {
      toast.error("Введите название папки");
      return;
    }
    
    if (categories.includes(trimmedName)) {
      toast.error("Папка с таким названием уже существует");
      return;
    }

    setCategories([...categories, trimmedName]);
    setNewCategory(trimmedName);
    setFolderName("");
    setShowCreateFolder(false);
    toast.success(`Папка "${trimmedName}" создана`);
  };

  const assetArray = Object.values(assets);
  const filteredAssets = selectedCategory === "all" 
    ? assetArray 
    : assetArray.filter(a => (a as any).category === selectedCategory);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap gap-4 items-end">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Home
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowCreateFolder(true)}
            className="flex items-center gap-2"
            disabled={!userId}
          >
            <FolderPlus className="w-4 h-4" />
            Создать папку
          </Button>

          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="new-category" className="text-sm mb-2 flex items-center gap-1">
              <Folder className="w-4 h-4" />
              Категория для загрузки
            </Label>
            <Select value={newCategory || "default"} onValueChange={setNewCategory}>
              <SelectTrigger id="new-category">
                <SelectValue placeholder="default" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <label htmlFor="video-upload">
            <Button asChild disabled={uploading || !userId}>
              <span className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? "Загрузка..." : "Загрузить видео"}
              </span>
            </Button>
          </label>
          <input
            id="video-upload"
            type="file"
            accept="video/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-4">
          <Label htmlFor="category-filter">Фильтр:</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Gallery Grid */}
        {!userId ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Войдите, чтобы загрузить и просматривать видео
            </p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-12">
            <Upload className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">
              {selectedCategory === "all" ? "Нет видео" : `Нет видео в категории "${selectedCategory}"`}
            </h2>
            <p className="text-muted-foreground mb-6">
              Загрузите видео для использования в качестве фонов
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssets.map((asset) => (
              <Card key={asset.id} className="overflow-hidden group relative">
                <div className="aspect-[9/16] bg-black relative">
                  <video
                    src={asset.url}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    preload="metadata"
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => {
                      e.currentTarget.pause();
                      e.currentTarget.currentTime = 0;
                    }}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(asset.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="p-4">
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <Folder className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium">{(asset as any).category || 'default'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Duration: {asset.duration.toFixed(1)}s
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {asset.width}×{asset.height}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать новую папку</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folder-name">Название папки</Label>
              <Input
                id="folder-name"
                placeholder="Введите название..."
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateFolder}>
              <FolderPlus className="w-4 h-4 mr-2" />
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GalleryStorage;
