import { useState } from "react";
import { Slide } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface SlideEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slide: Slide | null;
  onSave: (updates: { title: string; body?: string }) => void;
}

export const SlideEditDialog = ({
  open,
  onOpenChange,
  slide,
  onSave,
}: SlideEditDialogProps) => {
  const [title, setTitle] = useState(slide?.title || "");
  const [body, setBody] = useState(slide?.body || "");

  const handleSave = () => {
    onSave({
      title,
      body: body.trim() || undefined,
    });
    onOpenChange(false);
  };

  // Update local state when slide changes
  if (slide && (title !== slide.title || body !== (slide.body || ""))) {
    setTitle(slide.title);
    setBody(slide.body || "");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Редактировать слайд</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Заголовок</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите заголовок..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Текст (опционально)</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Введите текст слайда..."
              rows={6}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
