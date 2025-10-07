import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEditorStore } from "@/store/useEditorStore";
import { parseTextToSlides } from "@/utils/textParser";

export const RandomVideoButton = () => {
  const { setSlides, addAsset, setBackgroundMusic, getDefaultStyle } = useEditorStore();

  const generateRandomVideo = async () => {
    try {
      // 1. Get random text template
      const { data: templates, error: templatesError } = await supabase
        .from("text_templates")
        .select("*");

      if (templatesError || !templates || templates.length === 0) {
        toast.error("No text templates found. Please add some first!");
        return;
      }

      const randomTemplate = templates[Math.floor(Math.random() * templates.length)];

      // 2. Get random assets
      const { data: assets, error: assetsError } = await supabase
        .from("assets")
        .select("*");

      if (assetsError || !assets || assets.length === 0) {
        toast.error("No video assets found. Please upload some first!");
        return;
      }

      // 3. Get random music
      const { data: music, error: musicError } = await supabase
        .from("music_tracks")
        .select("*");

      if (musicError || !music || music.length === 0) {
        toast.error("No music tracks found. Please upload some first!");
        return;
      }

      const randomMusic = music[Math.floor(Math.random() * music.length)];

      // 4. Parse text to slides
      const projectId = crypto.randomUUID();
      const parsedSlides = parseTextToSlides(
        randomTemplate.content,
        projectId,
        getDefaultStyle()
      );

      // 5. Pick ONE random asset for ALL slides
      const randomAsset = assets[Math.floor(Math.random() * assets.length)];
      const slidesWithAssets = parsedSlides.map((slide) => ({
        ...slide,
        assetId: randomAsset.id,
      }));

      // 6. Update store
      setSlides(slidesWithAssets);
      setBackgroundMusic(randomMusic.url);

      // 7. Add all used assets to the store
      assets.forEach((asset) => {
        addAsset({
          id: asset.id,
          url: asset.url,
          duration: Number(asset.duration),
          width: asset.width,
          height: asset.height,
          createdAt: new Date(asset.created_at),
        });
      });

      toast.success(`Random video created from "${randomTemplate.name}"!`);
    } catch (error) {
      console.error("Error generating random video:", error);
      toast.error("Failed to generate random video");
    }
  };

  return (
    <Button
      onClick={generateRandomVideo}
      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
    >
      <Sparkles className="w-4 h-4 mr-2" />
      Random Video
    </Button>
  );
};
