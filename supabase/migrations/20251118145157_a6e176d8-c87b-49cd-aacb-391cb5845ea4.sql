-- Add default_video_category to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN default_video_category TEXT DEFAULT 'all';