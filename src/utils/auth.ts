import { supabase } from "@/integrations/supabase/client";

// Initialize anonymous authentication automatically
export const ensureAnonymousAuth = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Sign in anonymously
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error('Anonymous auth failed:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error ensuring auth:', error);
    throw error;
  }
};
