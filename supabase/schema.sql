-- =====================================================================================
-- 보조금 레이더 (GrantRadar KR) — Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에서 그대로 실행하면 됩니다.
-- 앱은 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 설정된 경우에만 이 테이블을 사용하고,
-- 설정이 없으면 자동으로 "기기 저장(게스트) 모드"로 동작합니다.
-- =====================================================================================

create extension if not exists "pgcrypto";

-- 1) 사용자 상황 프로필 ---------------------------------------------------------------
create table if not exists public.user_profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  gender           text        not null default 'all' check (gender in ('all', 'male', 'female')),
  birth_year       integer     check (birth_year between 1900 and 2100),
  region           text        not null default '전국',
  jobs             text[]      not null default '{}',
  households       text[]      not null default '{}',
  domains          text[]      not null default '{}',
  income           text        not null default 'unknown' check (income in ('unknown', 'low', 'middle', 'high')),
  onboarding_done  boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.user_profiles is '보조금 레이더 - 사용자 상황(성별·출생연도·직군·가구·관심분야)';
comment on column public.user_profiles.jobs is 'student, employee, jobseeker, self_employed, freelancer, artist, pre_founder';
comment on column public.user_profiles.households is 'single, married, single_parent, multi_child, homeless, pregnant, disabled, low_income';
comment on column public.user_profiles.domains is 'housing, medical, finance, childcare, education, employment, business, senior_welfare';

-- 2) 저장한 보조금 + 체크리스트 -------------------------------------------------------
create table if not exists public.saved_policies (
  id          bigserial primary key,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  policy_id   text        not null,
  checklist   jsonb       not null default '{}'::jsonb,
  memo        text,
  created_at  timestamptz not null default now(),
  unique (user_id, policy_id)
);

comment on table public.saved_policies is '보조금 레이더 - 저장한 정책과 신청 전 체크리스트';
comment on column public.saved_policies.policy_id is '예: bokjiro:WLF00006061, youthcenter:20240109005400100001';

create index if not exists saved_policies_user_idx on public.saved_policies (user_id, created_at desc);

-- 3) updated_at 자동 갱신 -------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_touch on public.user_profiles;
create trigger trg_user_profiles_touch
  before update on public.user_profiles
  for each row execute function public.touch_updated_at();

-- 4) RLS: 본인 데이터만 읽고 쓸 수 있게 -------------------------------------------------
alter table public.user_profiles enable row level security;
alter table public.saved_policies enable row level security;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
  on public.user_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own"
  on public.user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_profiles_delete_own" on public.user_profiles;
create policy "user_profiles_delete_own"
  on public.user_profiles for delete
  using (auth.uid() = user_id);

drop policy if exists "saved_policies_select_own" on public.saved_policies;
create policy "saved_policies_select_own"
  on public.saved_policies for select
  using (auth.uid() = user_id);

drop policy if exists "saved_policies_insert_own" on public.saved_policies;
create policy "saved_policies_insert_own"
  on public.saved_policies for insert
  with check (auth.uid() = user_id);

drop policy if exists "saved_policies_update_own" on public.saved_policies;
create policy "saved_policies_update_own"
  on public.saved_policies for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "saved_policies_delete_own" on public.saved_policies;
create policy "saved_policies_delete_own"
  on public.saved_policies for delete
  using (auth.uid() = user_id);

-- 5) (선택) 탈퇴 시 데이터 자동 삭제: auth.users 삭제 시 on delete cascade 로 함께 지워집니다.
