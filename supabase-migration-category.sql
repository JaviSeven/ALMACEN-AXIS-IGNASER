-- Añadir columna categoría a items (ejecutar en Supabase SQL Editor si ya tienes la tabla)
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS category text DEFAULT '';
