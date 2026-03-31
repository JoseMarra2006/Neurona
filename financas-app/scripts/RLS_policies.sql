ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: select own" ON public.profiles;
CREATE POLICY "profiles: select own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: insert own" ON public.profiles;
CREATE POLICY "profiles: insert own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;
CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "transactions: select own" ON public.transactions;
CREATE POLICY "transactions: select own"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions: insert own" ON public.transactions;
CREATE POLICY "transactions: insert own"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions: update own" ON public.transactions;
CREATE POLICY "transactions: update own"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions: delete own" ON public.transactions;
CREATE POLICY "transactions: delete own"
  ON public.transactions FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "goals: select own" ON public.goals;
CREATE POLICY "goals: select own"
  ON public.goals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "goals: insert own" ON public.goals;
CREATE POLICY "goals: insert own"
  ON public.goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "goals: update own" ON public.goals;
CREATE POLICY "goals: update own"
  ON public.goals FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "goals: delete own" ON public.goals;
CREATE POLICY "goals: delete own"
  ON public.goals FOR DELETE
  USING (auth.uid() = user_id);