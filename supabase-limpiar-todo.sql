-- Limpiar todo: eliminar todos los ítems y movimientos (empezar de 0)
-- Ejecutar en: Supabase → SQL Editor → New query

-- Primero los movimientos (historial), luego los ítems
DELETE FROM public.movements;
DELETE FROM public.items;
