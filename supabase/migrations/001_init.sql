-- Hoa Ngữ LMS — HSK 1-9 Student + Admin Platform
-- RLS chặt chẽ:
--   1. private.is_admin() & private.is_approved_user() với SECURITY DEFINER + search_path rỗng
--   2. Khóa cứng account_status ('pending' | 'approved' | 'locked') & role trên profiles_update_self
--   3. Mọi dữ liệu học tập chỉ mở khi tài khoản đã được Admin phê duyệt

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  avatar_url text not null default '',
  role text not null default 'student' check (role in ('student', 'admin')),
  account_status text not null default 'pending' check (account_status in ('pending', 'approved', 'locked')),
  current_hsk_level smallint not null default 0 check (current_hsk_level between 0 and 9),
  target_hsk_level smallint not null default 4 check (target_hsk_level between 1 and 9),
  onboarding_completed boolean not null default false,
  daily_goal_minutes smallint not null default 20 check (daily_goal_minutes between 5 and 240),
  preferred_voice text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.custom_lessons (
  id uuid primary key default gen_random_uuid(),
  hsk_level smallint not null check (hsk_level between 1 and 9),
  title_zh text not null,
  title_pinyin text not null default '',
  title_vi text not null,
  summary text not null default '',
  paragraphs jsonb not null default '[]'::jsonb,
  vocab_items jsonb not null default '[]'::jsonb,
  grammar_notes jsonb not null default '[]'::jsonb,
  quiz_items jsonb not null default '[]'::jsonb,
  is_published boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_sec integer not null default 0 check (duration_sec >= 0),
  mode text not null check (mode in ('flashcard', 'quiz', 'match', 'grammar', 'writing', 'mock_exam')),
  hsk_level smallint not null check (hsk_level between 1 and 9),
  items_completed integer not null default 0 check (items_completed >= 0),
  accuracy_pct numeric(5,2) not null default 0 check (accuracy_pct between 0 and 100),
  device_info jsonb not null default '{}'::jsonb
);

create table if not exists public.user_activity_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.vocab_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  word_id text not null,
  hsk_level smallint not null check (hsk_level between 1 and 9),
  ease_factor numeric(4,2) not null default 2.50,
  interval_days integer not null default 0 check (interval_days >= 0),
  repetitions integer not null default 0 check (repetitions >= 0),
  next_review_at timestamptz not null default now(),
  wrong_count integer not null default 0 check (wrong_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  is_flagged_hard boolean not null default false,
  mastery_status text not null default 'new' check (mastery_status in ('new', 'learning', 'familiar', 'mastered')),
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  target_type text not null check (target_type in ('vocab_pack', 'quiz', 'mock_exam', 'lesson')),
  config jsonb not null default '{}'::jsonb,
  assigned_to jsonb not null default '"all"'::jsonb,
  due_at timestamptz not null,
  pass_score numeric(5,2) not null default 60,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'submitted', 'graded')),
  score numeric(6,2) not null default 0,
  max_score numeric(6,2) not null default 100,
  duration_sec integer not null default 0,
  answers jsonb not null default '{}'::jsonb,
  mistakes jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  admin_feedback text not null default '',
  unique (assignment_id, user_id)
);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  hsk_level smallint not null check (hsk_level between 1 and 9),
  mode text not null check (mode in ('full', 'section')),
  listening_score numeric(5,2) not null default 0,
  reading_score numeric(5,2) not null default 0,
  writing_score numeric(5,2) not null default 0,
  total_score numeric(6,2) not null default 0,
  passed boolean not null default false,
  section_timings jsonb not null default '{}'::jsonb,
  responses jsonb not null default '{}'::jsonb,
  writing_prompt text not null default '',
  writing_text text not null default '',
  admin_reviewed boolean not null default false,
  admin_feedback text not null default '',
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists custom_lessons_level_idx on public.custom_lessons (hsk_level, created_at desc);
create index if not exists study_sessions_user_idx on public.study_sessions (user_id, started_at desc);
create index if not exists activity_events_user_created_idx on public.user_activity_events (user_id, created_at desc);
create index if not exists vocab_progress_user_due_idx on public.vocab_progress (user_id, hsk_level, next_review_at);
create index if not exists assignments_due_idx on public.assignments (due_at desc);
create index if not exists assignments_created_by_idx on public.assignments (created_by);
create index if not exists submissions_assignment_idx on public.assignment_submissions (assignment_id);
create index if not exists submissions_user_idx on public.assignment_submissions (user_id, submitted_at desc);
create index if not exists exam_attempts_user_idx on public.exam_attempts (user_id, created_at desc);

-- Private security helpers
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and account_status = 'approved'
  );
$$;

create or replace function private.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and account_status = 'approved'
  );
$$;

revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;
revoke execute on function private.is_approved_user() from public, anon;
grant execute on function private.is_approved_user() to authenticated;

-- Trigger tự tạo hồ sơ học viên khi đăng ký (trạng thái mặc định: pending)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, account_status, onboarding_completed)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'hocvien'), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''),
    'pending',
    false
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
        avatar_url = case when excluded.avatar_url = '' then excluded.avatar_url else public.profiles.avatar_url end,
        last_seen_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bật RLS cho mọi bảng
alter table public.profiles enable row level security;
alter table public.custom_lessons enable row level security;
alter table public.study_sessions enable row level security;
alter table public.user_activity_events enable row level security;
alter table public.vocab_progress enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.exam_attempts enable row level security;

-- PROFILES
create policy profiles_select on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or (select private.is_admin()));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id and (select private.is_approved_user()))
  with check (
    (select auth.uid()) = id
    and role = (select p.role from public.profiles p where p.id = (select auth.uid()))
    and account_status = (select p.account_status from public.profiles p where p.id = (select auth.uid()))
  );

create policy profiles_admin_manage on public.profiles
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- CUSTOM LESSONS
create policy custom_lessons_select on public.custom_lessons
  for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.is_approved_user()) and is_published = true)
  );

create policy custom_lessons_admin_write on public.custom_lessons
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- STUDY SESSIONS
create policy sessions_select on public.study_sessions
  for select to authenticated
  using (((select auth.uid()) = user_id and (select private.is_approved_user())) or (select private.is_admin()));

create policy sessions_insert on public.study_sessions
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select private.is_approved_user()));

-- ACTIVITY EVENTS
create policy events_select on public.user_activity_events
  for select to authenticated
  using (((select auth.uid()) = user_id and (select private.is_approved_user())) or (select private.is_admin()));

create policy events_insert on public.user_activity_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select private.is_approved_user()));

-- VOCAB PROGRESS
create policy vocab_progress_own on public.vocab_progress
  for all to authenticated
  using ((select auth.uid()) = user_id and (select private.is_approved_user()))
  with check ((select auth.uid()) = user_id and (select private.is_approved_user()));

create policy vocab_progress_admin_read on public.vocab_progress
  for select to authenticated
  using ((select private.is_admin()));

-- ASSIGNMENTS
create policy assignments_select on public.assignments
  for select to authenticated
  using (
    (select private.is_admin())
    or (
      (select private.is_approved_user())
      and (
        assigned_to = '"all"'::jsonb
        or assigned_to ? ((select auth.uid())::text)
      )
    )
  );

create policy assignments_admin_write on public.assignments
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- SUBMISSIONS
create policy submissions_select on public.assignment_submissions
  for select to authenticated
  using (((select auth.uid()) = user_id and (select private.is_approved_user())) or (select private.is_admin()));

create policy submissions_student_write on public.assignment_submissions
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select private.is_approved_user()));

create policy submissions_student_update on public.assignment_submissions
  for update to authenticated
  using ((select auth.uid()) = user_id and (select private.is_approved_user()))
  with check ((select auth.uid()) = user_id and status <> 'graded');

create policy submissions_admin_grade on public.assignment_submissions
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- EXAM ATTEMPTS
create policy exams_select on public.exam_attempts
  for select to authenticated
  using (((select auth.uid()) = user_id and (select private.is_approved_user())) or (select private.is_admin()));

create policy exams_student_insert on public.exam_attempts
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select private.is_approved_user()));

create policy exams_admin_update on public.exam_attempts
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
