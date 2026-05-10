# Security Hardening — SQL to run in Supabase SQL Editor

הרץ את כל הבלוק הבא ב־Supabase Dashboard → SQL Editor של ההתקנה העצמית שלך.
זה מחזק RLS, יוצר טריגר ליצירת פרופיל אוטומטית, ומגביל את ה־Storage לתמונות בלבד עד 5MB.

```sql
-- =========================================================
-- 1. profiles: trigger ליצירת פרופיל אוטומטי בעת signup
--    כך אין צורך ב־INSERT מצד הלקוח (פחות משטח תקיפה).
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================================
-- 2. RLS על profiles — כל משתמש רואה/מעדכן רק את עצמו.
-- =========================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- אדמין רואה הכול (דרך has_role שכבר קיים)
drop policy if exists "profiles admin select" on public.profiles;
create policy "profiles admin select"
on public.profiles for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 3. RLS על user_images (אם הטבלה קיימת)
-- =========================================================
do $$
begin
  if to_regclass('public.user_images') is not null then
    execute 'alter table public.user_images enable row level security';
    execute 'drop policy if exists "ui select own" on public.user_images';
    execute 'create policy "ui select own" on public.user_images for select to authenticated using (auth.uid() = user_id)';
    execute 'drop policy if exists "ui insert own" on public.user_images';
    execute 'create policy "ui insert own" on public.user_images for insert to authenticated with check (auth.uid() = user_id)';
    execute 'drop policy if exists "ui delete own" on public.user_images';
    execute 'create policy "ui delete own" on public.user_images for delete to authenticated using (auth.uid() = user_id)';
  end if;
end $$;

-- =========================================================
-- 4. Storage bucket: upload — מגבלת גודל וסוגי קובץ
--    (כל בדיקת MIME מתבצעת גם ב־DB וגם בקליינט)
-- =========================================================
update storage.buckets
set
  file_size_limit = 5242880, -- 5 MB
  allowed_mime_types = array['image/png','image/jpeg']
where id = 'upload';

-- אם רוצים שתמונות יהיו פרטיות (לא פומביות), הרץ:
-- update storage.buckets set public = false where id = 'upload';
-- אז הקליינט חייב להשתמש ב־createSignedUrl במקום getPublicUrl.

-- =========================================================
-- 5. Storage policies — רק משתמשים מאומתים מעלים, רק לתיקיה שלהם
-- =========================================================
drop policy if exists "upload: auth insert own folder" on storage.objects;
create policy "upload: auth insert own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'upload'
  and (storage.foldername(name))[1] is not null
  and (
    -- מסלולים מותרים: products/<uid>/... או user-uploads/<uid>/...
    (storage.foldername(name))[2] = auth.uid()::text
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists "upload: public read" on storage.objects;
create policy "upload: public read"
on storage.objects for select
to public
using (bucket_id = 'upload');
-- אם בחרת bucket פרטי, החלף את ה־policy לעיל ב:
-- to authenticated using (
--   bucket_id = 'upload' and (
--     (storage.foldername(name))[2] = auth.uid()::text
--     or (storage.foldername(name))[1] = auth.uid()::text
--     or public.has_role(auth.uid(),'admin')
--   )
-- );

drop policy if exists "upload: auth delete own" on storage.objects;
create policy "upload: auth delete own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'upload'
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or (storage.foldername(name))[1] = auth.uid()::text
    or public.has_role(auth.uid(),'admin')
  )
);
```

## Hardening נוסף ב־Supabase Dashboard (חייב ידני)

1. **Auth → Providers → Email**: הפעל **Password HIBP Check** (חוסם סיסמאות שדלפו).
2. **Auth → Rate Limits**: הפחת `Token refresh / hour`, `Email sign-ins / hour`, `Sign-ups / hour` לערכים נמוכים (למשל 5–10 לדקה לכתובת IP).
3. **Auth → Settings**: הפעל **Captcha (hCaptcha/Turnstile)** על login + signup — חוסם brute-force.
4. **Auth → Email**: ודא **Confirm email** מופעל (גם אם לא חובה — מקטין enumeration).
5. **Project Settings → API**: וודא שה־`service_role` **לא** משותף לאף אחד; **רק** `anon` בקוד הצד־לקוח (וזה מה שיש לנו).
6. **Studio Dashboard** של ה־self-hosted ב־`supabase.mako-chat.com`:
   - שנה את הסיסמה של ה־Studio למשהו חזק וייחודי.
   - הגן את הסאבדומיין דרך Cloudflare Access / Basic Auth / IP allowlist.
   - אם יש `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD` ב־`docker-compose.yml` — שנה אותם.
7. **רוטציה של מפתחות JWT**: ה־ANON_KEY שצילמת ופרסמת — **החלף אותו**. ב־self-hosted ערוך את `JWT_SECRET` ב־`.env` של Supabase והפעל מחדש; צור anon/service חדשים.
