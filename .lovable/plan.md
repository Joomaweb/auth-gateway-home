## מה אעשה

### 1. אבטחה – CSRF / XSS / Headers

**מצב נוכחי (חשוב להבין):**
- כל משתמש מחובר כבר מקבל **JWT אקראי וייחודי** מ-Supabase (access_token + refresh_token שמתחלף אוטומטית). זה בדיוק "טוקן לכל חיבור" שביקשת – אין צורך להמציא מנגנון חדש, וזה גם הסטנדרט בתעשייה.
- ה-Token נשלח ב-Header `Authorization: Bearer` ולא ב-Cookie, ולכן **CSRF כבר לא רלוונטי** לקריאות API (CSRF דורש cookie-based session).
- XSS – React כבר עושה escape אוטומטי לכל טקסט, ויש לנו `sanitizeText()` שמסיר HTML tags מקלטים של משתמשים.

**מה אוסיף בכל זאת כדי להעלות את הרף:**

א. **Security Headers** ב-`src/server.ts` על כל תגובת SSR:
   - `Content-Security-Policy` – חוסם הזרקת סקריפטים זרים (הגנת XSS אמיתית בדפדפן)
   - `X-Frame-Options: DENY` – מונע clickjacking
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy` – מגביל גישה למצלמה/מיקרופון/מיקום
   - `Strict-Transport-Security` (HSTS) – כפיית HTTPS

ב. **חיזוק sanitizeText** – אוסיף בדיקה גם נגד `javascript:` ו-`data:` URIs בשדות שמקבלים URL.

ג. **Rate Limit למשתמש** – הגבלת קצב על שדות upsert בפרופיל/הודעות (הגנה מ-spam/abuse).

### 2. SEO – מילות מפתח באדמין

א. עדכון `src/hooks/use-site-branding.tsx`:
   - הוספת שדות `seo_keywords`, `seo_title`, `seo_description` ל-Branding type.

ב. עדכון `src/routes/admin.settings.tsx`:
   - סקשן חדש "SEO וגוגל" עם 3 שדות:
     - כותרת לגוגל (title) – ~60 תווים
     - תיאור (description) – ~160 תווים
     - מילות מפתח (keywords) – מופרדות בפסיקים

ג. עדכון `src/routes/__root.tsx` / `src/routes/index.tsx`:
   - שימוש בערכי ה-branding ב-`head()` של הדף הראשי, עם fallback לערכים הקיימים.
   - הוספת `<meta name="keywords">` דינמי.
   - הוספת JSON-LD Organization עם שם החנות.

### קבצים שישתנו
- `src/server.ts` – security headers
- `src/lib/security.ts` – חיזוק sanitization + URL validator
- `src/hooks/use-site-branding.tsx` – שדות SEO חדשים
- `src/routes/admin.settings.tsx` – סקשן SEO באדמין
- `src/routes/index.tsx` – meta tags דינמיים מה-branding

### מה לא אעשה
- לא אוסיף מנגנון CSRF token עצמאי – זה מיותר ויסבך כי Supabase JWT כבר פותר את זה. אם חשוב לך שאוסיף את זה בכל זאת כסנן נוסף, תגיד לי.
