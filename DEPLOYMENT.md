# פריסת פורטה בקרה ל-Vercel (גרסת דמו)

מדריך להעלאת המערכת לאינטרנט כך שניתן לפתוח אותה בטלפון דרך קישור.

## לפני הפריסה

- [ ] `APP_ROLE` בברירת מחדל הוא `client` (ללא `NEXT_PUBLIC_APP_ROLE=expert`)
- [ ] `npm run build` עובר ללא שגיאות
- [ ] `npm run qa` עובר (50+ בדיקות)
- [ ] אין קבצי `.env` עם סודות ב-repository
- [ ] הנתונים ב-`lib/data.ts` הם דמו בלבד

## שלב 1 — הכנת Repository

1. צרו repository ב-GitHub (או GitLab / Bitbucket).
2. ודאו ש-`.gitignore` כולל `.env*` ו-`.vercel`.
3. דחפו את הקוד:

```bash
git add .
git commit -m "Prepare demo deployment"
git push origin main
```

## שלב 2 — חיבור ל-Vercel

1. היכנסו ל-[vercel.com](https://vercel.com) והתחברו עם GitHub.
2. לחצו **Add New Project**.
3. בחרו את ה-repository `forte-bakara-app`.
4. Vercel מזהה אוטומטית Next.js — אין צורך בשינוי Build Command:
   - **Build Command:** `npm run build`
   - **Output Directory:** (ברירת מחדל — ריק)
   - **Install Command:** `npm install`

## שלב 3 — משתני סביבה (אופציונלי)

ב-**Project Settings → Environment Variables**:

| משתנה | ערך מומלץ לדמו | הערה |
|--------|----------------|------|
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` | לכתובת ה-URL הסופית (sitemap, SEO) |
| `NEXT_PUBLIC_APP_ROLE` | *(ריק / לא להגדיר)* | השאירו ריק לדמו ציבורי |

> **אל תגדירו** `NEXT_PUBLIC_APP_ROLE=expert` בפריסה ציבורית — זה יחשוף את מסך המומחה.

לבדיקה פנימית של מסך המומחה: הגדירו `NEXT_PUBLIC_APP_ROLE=expert` בסביבת **Preview** בלבד, או בהרצה מקומית ב-`.env.local`.

## שלב 4 — Deploy

1. לחצו **Deploy**.
2. המתינו לסיום הבנייה (כ-1–2 דקות).
3. קבלו קישור: `https://forte-bakara-app.vercel.app` (או שם דומה).

## שלב 5 — בדיקה בטלפון

פתחו את הקישור בדפדפן הנייד ובדקו:

| דף | צפוי |
|----|------|
| `/` | דף בית עם סטטיסטיקות |
| `/report` | טופס דיווח |
| `/history` | 10 תקלות לדוגמה |
| `/building` | פרטי מגדל פורטה |
| `/expert` | הפניה ל-`/` (חסום) |
| `/expert/print` | הפניה ל-`/` (חסום) |

ודאו שבתפריט התחתון **אין** כפתור "מסך מומחה".

## עדכונים עתידיים

כל `git push` ל-branch `main` מפעיל deploy אוטומטי ב-Vercel.

## דומיין מותאם (אופציונלי)

1. **Project Settings → Domains**
2. הוסיפו דומיין (למשל `bakara.example.com`)
3. עדכנו DNS לפי ההוראות ב-Vercel
4. עדכנו `NEXT_PUBLIC_SITE_URL` לדומיין החדש

## פתרון תקלות

| בעיה | פתרון |
|------|--------|
| Build נכשל | הריצו `npm run build` מקומית ותקנו שגיאות TypeScript |
| מסך מומחה מופיע | הסירו `NEXT_PUBLIC_APP_ROLE=expert` מ-Vercel |
| עברית לא נטענת | ודאו `lang="he" dir="rtl"` ב-layout (כבר מוגדר) |
| 404 בדפים | ודאו שכל הקבצים ב-`app/` נדחפו ל-Git |

## אבטחה בדמו

- אין API keys בקוד
- אין מסד נתונים — נתונים סטטיים בלבד
- דפי `/expert/*` חסומים ב-middleware לתפקיד `client`
- קבצי `.env` לא נכנסים ל-Git (`.gitignore`)

## מה נדרש לפני גרסה מסחרית

ראו סעיף "לפני גרסה מסחרית" ב-README או בדוח הפריסה שסופק עם הפרויקט.
