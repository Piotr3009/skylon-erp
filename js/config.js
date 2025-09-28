// Konfiguracja Supabase
// UWAGA: Ten plik NIE powinien być commitowany do repozytorium!
// Jest w .gitignore

const SUPABASE_URL = 'https://iszkquzpoktokmkjmuuq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzemtxdXpwb2t0b2tta2ptdXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0Mzg3NTksImV4cCI6MjA2ODAxNDc1OX0.hijtNZIitJkc3BIQsYUkUTi3_l8OlCGSiJZdM9G3ywA';

// Inicjalizacja Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
console.log('Supabase ready:', supabaseClient);
