-- YA APLICADO en Supabase (proyecto ALMACEN AXIS/IGNASER) el 07/10/2026. Se guarda como referencia.
-- Permite que AXIS solicite unidades de un material existente.
alter table public.inventory_requests
  add column if not exists target_item_id uuid references public.items(id) on delete set null;
create index if not exists idx_inventory_requests_target_item_id on public.inventory_requests(target_item_id);
-- private.review_inventory_request_v2 actualizado: si target_item_id no es null, al aprobar
-- suma las unidades al material existente (ubicación opcional) en vez de crear uno nuevo.
