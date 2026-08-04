-- =====================================================================
-- Arreglo del guardia de is_app_owner
--
-- La version de 0002 comprobaba solo `not is_app_owner()`, y esa funcion se
-- apoya en auth.uid(). En el SQL Editor, en una migracion o con service_role
-- no hay usuario autenticado: auth.uid() es NULL, is_app_owner() devuelve
-- false y el trigger salta.
--
-- Resultado: bloqueaba el UNICO camino que existe para nombrar al primer
-- dueño de la app, que por definicion no puede crearse desde la aplicacion.
--
-- El guardia existe para que un usuario final logueado no se ascienda solo
-- editando su propia fila (la policy profile_update_self le deja tocar la
-- fila entera, incluida esta columna). Cuando no hay usuario final detras no
-- protege nada: esos contextos ya se saltan RLS por otras vias.
-- =====================================================================
create or replace function block_privilege_escalation()
returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  if new.is_app_owner is distinct from old.is_app_owner
     -- auth.uid() no nulo = la peticion viene de un usuario logueado a
     -- traves de PostgREST. Es el unico caso que hay que vigilar.
     and auth.uid() is not null
     and not is_app_owner() then
    raise exception 'Solo el dueño de la app puede cambiar is_app_owner';
  end if;
  return new;
end;
$$;
