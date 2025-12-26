import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  ContentMatrixSelection, 
  FactoryLanguage, 
  ContentFormat,
  FACTORY_LANGUAGES,
  CONTENT_FORMATS 
} from "@/types/contentFactory";
import { Video, Image, LayoutGrid, Globe, AlertCircle } from "lucide-react";

interface StepContentMatrixProps {
  matrix: ContentMatrixSelection;
  onMatrixChange: (matrix: ContentMatrixSelection) => void;
}

const FORMAT_ICONS: Record<ContentFormat, React.ReactNode> = {
  video: <Video className="w-4 h-4" />,
  carousel: <LayoutGrid className="w-4 h-4" />,
  "static-single": <Image className="w-4 h-4" />,
  "static-multi": <Image className="w-4 h-4" />,
};

export const StepContentMatrix = ({
  matrix,
  onMatrixChange,
}: StepContentMatrixProps) => {
  const toggleLanguage = (lang: FactoryLanguage) => {
    const newLanguages = matrix.languages.includes(lang)
      ? matrix.languages.filter(l => l !== lang)
      : [...matrix.languages, lang];
    onMatrixChange({ ...matrix, languages: newLanguages });
  };

  const toggleFormat = (format: ContentFormat) => {
    const newFormats = matrix.formats.includes(format)
      ? matrix.formats.filter(f => f !== format)
      : [...matrix.formats, format];
    onMatrixChange({ ...matrix, formats: newFormats });
  };

  const totalItems = matrix.languages.length * matrix.formats.length;

  return (
    <div className="space-y-8">
      {/* Languages */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Languages
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FACTORY_LANGUAGES.map((lang) => (
            <label
              key={lang.code}
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                matrix.languages.includes(lang.code)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground"
              }`}
            >
              <Checkbox
                checked={matrix.languages.includes(lang.code)}
                onCheckedChange={() => toggleLanguage(lang.code)}
              />
              <div className="flex-1">
                <div className="font-medium">{lang.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  ENERGIA → <span className="font-mono">{lang.energiaReplacement}</span>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Formats */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <LayoutGrid className="w-5 h-5" />
          Content Formats
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CONTENT_FORMATS.map((format) => (
            <label
              key={format.code}
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                matrix.formats.includes(format.code)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground"
              }`}
            >
              <Checkbox
                checked={matrix.formats.includes(format.code)}
                onCheckedChange={() => toggleFormat(format.code)}
              />
              <div className="flex-1 flex items-start gap-3">
                <div className="p-2 bg-muted rounded">
                  {FORMAT_ICONS[format.code]}
                </div>
                <div>
                  <div className="font-medium">{format.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {format.description}
                  </div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-muted/50 border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Generation Summary</div>
            <div className="text-sm text-muted-foreground">
              {matrix.languages.length} language(s) × {matrix.formats.length} format(s)
            </div>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {totalItems} items
          </Badge>
        </div>

        {totalItems === 0 && (
          <div className="flex items-center gap-2 text-amber-500 mt-4">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Select at least one language and one format to continue.</span>
          </div>
        )}

        {totalItems > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {matrix.languages.map(lang => 
              matrix.formats.map(format => (
                <Badge 
                  key={`${lang}-${format}`} 
                  variant="outline"
                  className="text-xs"
                >
                  {FACTORY_LANGUAGES.find(l => l.code === lang)?.name} - {CONTENT_FORMATS.find(f => f.code === format)?.name}
                </Badge>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
