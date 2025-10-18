import { supabase } from "@/integrations/supabase/client";

// Check if user is authenticated
export const checkAuth = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch (error) {
    console.error('Error checking auth:', error);
    return null;
  }
};
