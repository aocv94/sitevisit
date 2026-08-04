-- =====================================================================
-- Relacion memberships -> profiles
--
-- memberships.user_id apunta a auth.users y profiles.id tambien, pero no
-- hay ninguna clave foranea ENTRE ellas. PostgREST resuelve los joins
-- embebidos leyendo las claves foraneas del esquema, asi que
-- `select=role,profile:profiles(...)` fallaba con PGRST200: los datos
-- estaban bien, la consulta era imposible.
--
-- Es justo la consulta que necesita el listado de equipo de una empresa.
--
-- La alternativa era pedir memberships y profiles por separado y cruzarlos
-- en el cliente, pero eso son dos viajes y una relacion que existe de
-- verdad pero que la base de datos no declara.
--
-- El orden de insercion ya lo respeta la Edge Function: el trigger
-- on_auth_user_created crea el perfil en la misma transaccion que el alta
-- en auth.users, antes de que se inserte ninguna membresia.
-- =====================================================================
alter table memberships
  add constraint memberships_user_id_profiles_fkey
  foreign key (user_id) references profiles (id) on delete cascade;
