-- Create text templates table
CREATE TABLE public.text_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.text_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own text templates"
ON public.text_templates
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own text templates"
ON public.text_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own text templates"
ON public.text_templates
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own text templates"
ON public.text_templates
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_text_templates_updated_at
BEFORE UPDATE ON public.text_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();