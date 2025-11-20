-- Add type column to assets table to differentiate between videos and images
ALTER TABLE public.assets 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'video';

-- Add a check constraint to ensure only valid types
ALTER TABLE public.assets 
ADD CONSTRAINT assets_type_check 
CHECK (type IN ('video', 'image'));

-- Update existing records to have 'video' type (they are all videos currently)
UPDATE public.assets 
SET type = 'video' 
WHERE type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.assets.type IS 'Type of asset: video or image';