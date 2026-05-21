-- Adds an "admin bootstrap" path: when a Supabase auth user is created whose
-- email matches the JN_ADMIN_BOOTSTRAP_EMAIL GUC, we promote them to admin
-- in public.users instead of the default 'member' role.
--
-- Set the GUC at the database level once (Supabase Studio → Settings →
-- Database → Custom postgres config — or via execute_sql one-time):
--   alter database postgres set jn.admin_bootstrap_email = 'you@example.com';
--
-- Without the GUC set, the trigger behaves identically to the previous
-- version — every new user defaults to 'member'.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  bootstrap_email text;
  assigned_role public.user_role := 'member';
begin
  begin
    bootstrap_email := current_setting('jn.admin_bootstrap_email', true);
  exception when others then
    bootstrap_email := null;
  end;

  if bootstrap_email is not null
     and length(trim(bootstrap_email)) > 0
     and lower(trim(bootstrap_email)) = lower(trim(new.email))
  then
    assigned_role := 'admin';
  end if;

  insert into public.users (id, email, role)
  values (new.id, new.email, assigned_role)
  on conflict (id) do nothing;

  return new;
end;
$$;
