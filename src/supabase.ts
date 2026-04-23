import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jvhfwxtvrecliuddgckr.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aGZ3eHR2cmVjbGl1ZGRnY2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Mzc0NjQsImV4cCI6MjA5MjUxMzQ2NH0.syDhL6s6w2YNWPWIlAJMqbYLyYhtbd0T3ENQlZxoti4';

export const supabase = createClient(supabaseUrl, supabaseKey);
