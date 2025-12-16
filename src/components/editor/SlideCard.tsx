import { Slide } from "@/types";
import { Button } from "@/components/ui/button";
import { Copy, Trash2, GripVertical, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface SlideCardProps {
  slide: Slide;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<Slide>) => void;
  index: number;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDraggable?: boolean;
}

export const SlideCard = ({
  slide,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
  onUpdate,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  isDraggable = false,
}: SlideCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(slide.title);
  const [editBody, setEditBody] = useState(slide.body || "");

  const handleSave = () => {
    onUpdate({
      title: editTitle,
      body: editBody || undefined,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(slide.title);
    setEditBody(slide.body || "");
    setIsEditing(false);
  };

  return (
    <div
      onClick={onSelect}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group p-4 rounded-lg border cursor-pointer transition-all",
        isSelected
          ? "bg-primary/10 border-primary shadow-lg"
          : "bg-card border-border hover:bg-panel-hover hover:border-primary/50"
      )}
    >
      <div className="flex items-start gap-3">
        {isDraggable && (
          <div 
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                slide.type === "title-only"
                  ? "bg-accent/20 text-accent"
                  : "bg-primary/20 text-primary"
              )}
            >
              {slide.type === "title-only" ? "Title" : "Title + Body"}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {slide.durationSec}s
            </span>
          </div>

          {isEditing ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Title"
                className="h-8 text-sm"
              />
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                placeholder="Body (optional)"
                className="min-h-[60px] text-xs resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} className="h-7 text-xs">
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel} className="h-7 text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h4 className="font-medium text-sm mb-1 line-clamp-1">{slide.title}</h4>
              {slide.body && (
                <p className="text-xs text-muted-foreground line-clamp-2">{slide.body}</p>
              )}
            </>
          )}
        </div>
      </div>

      {!isEditing && (
        <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="h-7 px-2"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="h-7 px-2"
          >
            <Copy className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-7 px-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
};
