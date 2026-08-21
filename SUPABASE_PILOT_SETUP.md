# הגדרת Supabase לפיילוט — פורטה בקרה

שלב ביניים מינימלי: דיווחים ומשובים נשמרים בענן, יהודה פורטה רואה הכול ב-`/master`.

---

## 1. יצירת פרויקט Supabase

1. היכנסו ל-[supabase.com](https://supabase.com) → **New Project**
2. בחרו שם (למשל `forte-pilot`) וסיסמת DB
3. המתינו לסיום ההקמה (~2 דקות)

---

## 2. הרצת SQL

1. בפרויקט: **SQL Editor** → **New query**
2. העתיקו את כל התוכן מ:
   ```
   supabase/migrations/001_pilot_tables.sql
   ```
3. לחצו **Run**
4. ודאו שנוצרו הטבלאות `pilot_faults` ו-`pilot_feedback`

---

## 3. מפתחות API

1. **Project Settings** → **API**
2. העתיקו:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 4. Environment Variables ב-Vercel

ב-Vercel → Project → **Settings** → **Environment Variables**:

| משתנה | דוגמה | הערות |
|--------|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | חובה לענן |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` | חובה לענן |
| `MASTER_CODE` | קוד פנימי (למשל `forte2026`) | **שרת בלבד** — גישה ל-`/master` |
| `FORTE_SESSION_SECRET` | מחרוזת אקראית ארוכה | חובה ל-session של APIs מוגנים |

**אין** להגדיר `NEXT_PUBLIC_MASTER_CODE` — הקוד לא יורד לדפדפן.  
(אם עדיין קיים ב-Vercel מהעבר, השרת יכול לקרוא אותו זמנית — אך מומלץ להעביר ל-`MASTER_CODE` ולמחוק.)

אופציונלי (קיים):
- `NEXT_PUBLIC_APP_ROLE=expert` — מסך מומחה
- `NEXT_PUBLIC_SITE_URL` — SEO

לאחר הוספה: **Redeploy** ב-Vercel.

---

## 5. בדיקה שהנתונים נשמרים בענן

### א. מכשיר משתמש
1. פתחו את האתר ב-Vercel
2. שלחו דיווח תקלה או משוב
3. הנתונים נשמרים גם ב-localStorage (גיבוי)

### ב. Supabase Dashboard
1. **Table Editor** → `pilot_faults` — שורה חדשה אחרי דיווח
2. **Table Editor** → `pilot_feedback` — שורה חדשה אחרי משוב

### ג. מסך ניהול
1. גלשו ל-`https://your-app.vercel.app/master`
2. הזינו את `MASTER_CODE` (לא נחשף ב-JS של הדפדפן)
3. ודאו שהדיווח/משוב מופיעים

---

## 6. ללא Supabase

אם המשתנים לא מוגדרים:
- האפליקציה **לא קורסת**
- נתונים נשמרים ב-localStorage בלבד
- ב-`/master` תוצג אזהרה

---

## אבטחה (שלב ביניים)

- טבלאות פתוחות ל-anon key (RLS פתוח) — מתאים לפיילוט קצר בלבד
- קוד `/master` חשוף ב-client (`NEXT_PUBLIC_*`) — החליפו ב-auth מלא לפני מסחור
- **אל תשתפו** את קוד הגישה עם לקוחות

---

## קישורים שימושיים

- מסך ניהול: `/master` (לא בתפריט)
- קוד מקור ענן: `lib/pilot-cloud.ts`
- SQL: `supabase/migrations/001_pilot_tables.sql`
