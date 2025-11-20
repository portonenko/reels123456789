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

const PhotoGalleryStorage = () => {
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
      toast.error("Please log in to use the photo gallery");
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
      // Filter only image assets
      const imageAssets = data.filter((a: AssetDb) => {
        const url = a.url.toLowerCase();
        return url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp') || url.includes('.gif');
      });

      // Remove duplicates by ID
      const uniqueAssets = imageAssets.reduce((acc: AssetDb[], curr: AssetDb) => {
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
          duration: Number(a.duration) || 5, // Default 5 seconds for images
          width: a.width,
          height: a.height,
          createdAt: new Date(a.created_at),
          category: a.category || 'default',
          type: 'image' as const,
        };
      });
      
      setAssets(loadedAssets);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!userId) {
      toast.error("Please log in to upload images");
      return;
    }

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        // Create a temporary image element to get dimensions
        const tempUrl = URL.createObjectURL(file);
        const img = document.createElement("img");
        img.src = tempUrl;

        await new Promise((resolve, reject) => {
          img.onload = async () => {
            const assetId = crypto.randomUUID();
            
            try {
              // Upload to Supabase Storage
              const { error: uploadError } = await supabase.storage
                .from('video-assets')
                .upload(`${userId}/${assetId}`, file, {
                  cacheControl: '3600',
                  upsert: false
                });

              if (uploadError) {
                console.error('Upload error:', uploadError);
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
                duration: 5, // Default 5 seconds for images
                width: img.width,
                height: img.height,
                category: newCategory || 'default',
              });

              if (dbError) {
                console.error("Database error:", dbError);
                toast.error("Failed to save image metadata");
                resolve(null);
                return;
              }

              // Add to local store
              const asset = {
                id: assetId,
                url: urlData.publicUrl,
                duration: 5,
                width: img.width,
                height: img.height,
                createdAt: new Date(),
                category: newCategory || 'default',
                type: 'image' as const,
              };
              addAsset(asset);

              resolve(null);
            } catch (error) {
              console.error('Error processing image:', error);
              toast.error(`Failed to process ${file.name}`);
              resolve(null);
            } finally {
              URL.revokeObjectURL(tempUrl);
            }
          };

          img.onerror = () => {
            URL.revokeObjectURL(tempUrl);
            toast.error(`Failed to load ${file.name}`);
            resolve(null);
          };
        });
      }

      toast.success(`Uploaded ${files.length} image(s)`);
      
      // Reload to show new uploads
      if (userId) {
        await loadAssets(userId);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to upload images");
    } finally {
      setUploading(false);
      e.target.value = "";
      setNewCategory("");
    }
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('video-assets')
        .remove([`${userId}/${id}`]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("assets")
        .delete()
        .eq("id", id);

      if (dbError) {
        toast.error("Failed to delete from database");
        return;
      }

      deleteAsset(id);
      toast.success("Image deleted");
    } catch (error) {
      console.error('Delete error:', error);
      toast.error("Failed to delete image");
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    if (categories.includes(folderName)) {
      toast.error("Folder already exists");
      return;
    }

    setCategories([...categories, folderName]);
    setShowCreateFolder(false);
    setFolderName("");
    toast.success(`Folder "${folderName}" created`);
  };

  const filteredAssets = selectedCategory === "all" 
    ? assets.filter(a => a.type === 'image')
    : assets.filter(a => a.type === 'image' && a.category === selectedCategory);

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Photo Gallery</h1>
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <Home className="w-5 h-5" />
        </Button>
      </header>

      <div className="p-6 space-y-6">
        {/* Upload Section */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="category">Upload to folder:</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select folder (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowCreateFolder(true)}
                className="mt-6"
              >
                <FolderPlus className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <Input
                id="photo-upload"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="flex-1"
              />
              <Button disabled={uploading}>
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? "Uploading..." : "Upload Images"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Filter Section */}
        <div className="flex items-center gap-4">
          <Label>Filter by folder:</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Folders</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    {cat}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {filteredAssets.length} image(s)
          </span>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden group relative">
              <div className="aspect-video relative bg-muted">
                <img
                  src={asset.url}
                  alt="Gallery image"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete(asset.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="p-2 text-xs text-muted-foreground">
                {asset.width} × {asset.height}
                {asset.category && ` • ${asset.category}`}
              </div>
            </Card>
          ))}
        </div>

        {filteredAssets.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No images in this folder</p>
            <p className="text-sm mt-2">Upload some images to get started</p>
          </div>
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Enter folder name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFolder(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotoGalleryStorage;
