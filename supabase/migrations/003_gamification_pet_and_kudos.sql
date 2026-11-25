-- Hoa Ngữ Cô Mai v3: Gamification (XP, Streak), 3D Pet Preferences & Teacher Kudos

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp_points integer NOT NULL DEFAULT 0 CHECK (xp_points >= 0),
  ADD COLUMN IF NOT EXISTS streak_days integer NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
  ADD COLUMN IF NOT EXISTS longest_streak integer NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  ADD COLUMN IF NOT EXISTS last_study_date date,
  ADD COLUMN IF NOT EXISTS pet_type text NOT NULL DEFAULT 'cat' CHECK (pet_type IN ('cat','shiba','panda','rabbit','fox','dragon','baozi')),
  ADD COLUMN IF NOT EXISTS pet_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.teacher_kudos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sticker text NOT NULL DEFAULT 'star' CHECK (sticker IN ('star','trophy','panda','flower','rocket','heart')),
  message text NOT NULL DEFAULT '',
  xp_bonus integer NOT NULL DEFAULT 20 CHECK (xp_bonus >= 0 AND xp_bonus <= 500),
  is_seen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_kudos_student_created
  ON public.teacher_kudos(student_id, created_at DESC);

ALTER TABLE public.teacher_kudos ENABLE ROW LEVEL SECURITY;

CREATE POLICY kudos_select_own_or_admin ON public.teacher_kudos
  FOR SELECT USING (student_id = (select auth.uid()) OR private.is_admin());

CREATE POLICY kudos_admin_insert ON public.teacher_kudos
  FOR INSERT WITH CHECK (private.is_admin());

CREATE POLICY kudos_update_seen_or_admin ON public.teacher_kudos
  FOR UPDATE
  USING (student_id = (select auth.uid()) OR private.is_admin())
  WITH CHECK (student_id = (select auth.uid()) OR private.is_admin());

CREATE POLICY kudos_admin_delete ON public.teacher_kudos
  FOR DELETE USING (private.is_admin());
