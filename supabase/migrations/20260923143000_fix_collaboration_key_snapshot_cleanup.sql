-- The service-role Edge Function owns migration from legacy encrypted room
-- snapshots to a stable scene collaboration key.
grant select, delete on table public.board_scenes to service_role;
