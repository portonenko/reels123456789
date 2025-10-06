import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface TranslationDialogProps {
  open: boolean;
  onClose: () => void;
  onTranslate: (languages: string[]) => Promise<void>;
}

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "de", name: "German" },
  { code: "pl", name: "Polish" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "uk", name: "Ukrainian" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
];

export const TranslationDialog = ({
  open,
  onClose,
  onTranslate,
}: TranslationDialogProps) => {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleToggleLanguage = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code)
        ? prev.filter((l) => l !== code)
        : [...prev, code]
    );
  };

  const handleTranslate = async () => {
    if (selectedLanguages.length === 0) {
      toast.error("Please select at least one language");
      return;
    }

    setIsTranslating(true);
    try {
      await onTranslate(selectedLanguages);
      toast.success(`Translated to ${selectedLanguages.length} language(s)`);
      onClose();
      setSelectedLanguages([]);
    } catch (error) {
      toast.error("Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Translate Slides</DialogTitle>
          <DialogDescription>
            Select languages to translate your slides into
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            {LANGUAGES.map((lang) => (
              <div key={lang.code} className="flex items-center space-x-2">
                <Checkbox
                  id={lang.code}
                  checked={selectedLanguages.includes(lang.code)}
                  onCheckedChange={() => handleToggleLanguage(lang.code)}
                />
                <Label
                  htmlFor={lang.code}
                  className="text-sm font-normal cursor-pointer"
                >
                  {lang.name}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isTranslating}>
            Cancel
          </Button>
          <Button
            onClick={handleTranslate}
            disabled={selectedLanguages.length === 0 || isTranslating}
          >
            {isTranslating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Translate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
