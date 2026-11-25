-- Sửa lỗi đệ quy RLS (42P17) trên public.profiles và bổ sung quyền Admin xóa học viên

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role from public.profiles where id = (select auth.uid())), 'student');
$$;

create or replace function private.current_user_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select account_status from public.profiles where id = (select auth.uid())), 'pending');
$$;

revoke execute on function private.current_user_role() from public, anon;
grant execute on function private.current_user_role() to authenticated;
revoke execute on function private.current_user_status() from public, anon;
grant execute on function private.current_user_status() to authenticated;

alter policy profiles_update_self on public.profiles
  with check (
    (select auth.uid()) = id
    and role = (select private.current_user_role())
    and account_status = (select private.current_user_status())
  );

create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using ((select private.is_admin()));
