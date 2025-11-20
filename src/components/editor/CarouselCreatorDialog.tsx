import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface CarouselCreatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateCarousel: (slideCount: number) => void;
}

export const CarouselCreatorDialog = ({
  open,
  onOpenChange,
  onCreateCarousel,
}: CarouselCreatorDialogProps) => {
  const [slideCount, setSlideCount] = useState<string>("5");

  const handleCreate = () => {
    const count = parseInt(slideCount);
    
    if (isNaN(count) || count < 1) {
      toast.error("Please enter a valid number of slides (minimum 1)");
      return;
    }
    
    if (count > 50) {
      toast.error("Maximum 50 slides allowed");
      return;
    }

    onCreateCarousel(count);
    onOpenChange(false);
    setSlideCount("5"); // Reset to default
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Photo Carousel</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="slide-count">Number of Slides</Label>
            <Input
              id="slide-count"
              type="number"
              min="1"
              max="50"
              value={slideCount}
              onChange={(e) => setSlideCount(e.target.value)}
              placeholder="Enter number of slides"
            />
            <p className="text-sm text-muted-foreground">
              Create empty slides that you can fill with photos from your gallery
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>
            Create Carousel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
