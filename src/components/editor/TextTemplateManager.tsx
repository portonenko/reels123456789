import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface TextTemplate {
  id: string;
  name: string;
  content: string;
}

interface TextTemplateManagerProps {
  open: boolean;
  onClose: () => void;
}

export const TextTemplateManager = ({ open, onClose }: TextTemplateManagerProps) => {
  const [templates, setTemplates] = useState<TextTemplate[]>([]);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    const { data, error } = await supabase
      .from("text_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load templates");
      return;
    }

    setTemplates(data || []);
  };

  const addTemplate = async () => {
    if (!newName.trim() || !newContent.trim()) {
      toast.error("Please enter both name and content");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("text_templates").insert({
      user_id: user.id,
      name: newName,
      content: newContent,
    });

    if (error) {
      toast.error("Failed to add template");
      return;
    }

    toast.success("Template added!");
    setNewName("");
    setNewContent("");
    setIsAdding(false);
    loadTemplates();
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("text_templates").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete template");
      return;
    }

    toast.success("Template deleted");
    loadTemplates();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Text Templates</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!isAdding ? (
            <Button onClick={() => setIsAdding(true)} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add New Template
            </Button>
          ) : (
            <Card className="p-4 space-y-3">
              <Input
                placeholder="Template Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Textarea
                placeholder="Template Content (same format as Parse Text)"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="min-h-[200px] font-mono"
              />
              <div className="flex gap-2">
                <Button onClick={addTemplate}>Save</Button>
                <Button variant="outline" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {templates.map((template) => (
              <Card key={template.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">{template.name}</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {template.content.slice(0, 200)}
                      {template.content.length > 200 ? "..." : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteTemplate(template.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
