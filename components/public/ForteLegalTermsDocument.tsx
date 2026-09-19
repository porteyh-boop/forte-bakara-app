import { BRAND_APP, BRAND_EDITOR_NAME, BRAND_FORTE } from "@/lib/brand";
import {
  PUBLIC_SALES_LEAD_TERMS_DISPLAY_DATE,
  PUBLIC_SALES_LEAD_TERMS_VERSION,
} from "@/lib/sales-lead-terms";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-[#0d1b3e]">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-[#0d1b3e]/90">
        {children}
      </div>
    </section>
  );
}

interface ForteLegalTermsDocumentProps {
  showHeader?: boolean;
}

export default function ForteLegalTermsDocument({
  showHeader = true,
}: ForteLegalTermsDocumentProps) {
  return (
    <article className="space-y-5 text-right" dir="rtl">
      {showHeader ? (
        <header className="text-center">
          <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0d1b3e] text-xl font-black text-white shadow-lg">
            F
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0d1b3e]">
            {BRAND_FORTE}
          </h1>
          <p className="mt-1 text-sm text-[#5b6b82]">{BRAND_APP}</p>
          <p className="mt-3 text-base font-semibold text-[#0d1b3e]">
            תנאי שימוש ומדיניות פרטיות
          </p>
          <p className="mt-1 text-xs text-[#5b6b82]">
            גרסה {PUBLIC_SALES_LEAD_TERMS_VERSION} · עודכן {PUBLIC_SALES_LEAD_TERMS_DISPLAY_DATE}
          </p>
        </header>
      ) : null}

      <div className="space-y-5 rounded-2xl border border-[#d7deea] bg-white p-5 md:p-6">
        <Section title="מטרת השירות">
          <p>
            האתר, טופס השארת הפרטים ומערכת {BRAND_APP} של {BRAND_EDITOR_NAME}{" "}
            ({BRAND_FORTE}) מאפשרים לקבל מידע על שירותי FORTE, ליצור קשר ולהעביר
            פרטים לצורך בחינת פנייה ומתן שירות מקצועי.
          </p>
          <p>
            מידע כללי המופיע באתר, בטפסים או במערכת אינו מהווה חוות דעת מקצועית
            ביחס למעלית, בניין, חוזה, הצעת מחיר, תקלה או מקרה מסוים.
          </p>
        </Section>

        <Section title="המידע הנאסף">
          <p>בהתאם לטופס שבו משתמשים, עשויים להיאסף בין היתר:</p>
          <ul className="list-disc pr-5 space-y-1">
            <li>שם</li>
            <li>מספר טלפון</li>
            <li>דואר אלקטרוני</li>
            <li>שם או כתובת הבניין</li>
            <li>פרטי איש קשר</li>
            <li>סוג השירות המבוקש</li>
            <li>תוכן הפנייה</li>
            <li>מידע נוסף שהפונה בוחר למסור</li>
          </ul>
        </Section>

        <Section title="מטרות השימוש במידע">
          <p>המידע יכול לשמש לצורך:</p>
          <ul className="list-disc pr-5 space-y-1">
            <li>טיפול בפנייה ויצירת קשר עם הפונה</li>
            <li>בירור הצורך המקצועי והכנת הצעת שירות</li>
            <li>ניהול ומעקב אחר הפנייה ופתיחת ליד במערכת FORTE</li>
            <li>
              במקרה של התקשרות — ניהול הלקוח, הבניין והפרויקט ותיעוד הקשר המקצועי
            </li>
            <li>תפעול, אבטחה ושיפור השירות</li>
            <li>עמידה בדרישות הדין ככל שנדרש</li>
          </ul>
        </Section>

        <Section title="מערכת FORTE">
          <p>
            פרטים שנמסרים באמצעות הטפסים עשויים להישמר במערכת ניהול הפניות והלקוחות
            של FORTE ({BRAND_APP}). כאשר פנייה מתקדמת להתקשרות, מידע רלוונטי עשוי
            להמשיך ולהישמר במסגרת כרטיס הלקוח, הבניין או הפרויקט.
          </p>
        </Section>

        <Section title="יצירת קשר בעקבות הפנייה">
          <p>
            לאחר מסירת הפרטים ניתן ליצור קשר עם הפונה בקשר לפנייה ולשירות המבוקש
            באמצעות הטלפון, הדואר האלקטרוני או WhatsApp, בהתאם לפרטים שמסר. אין
            בכך אישור לקבלת דיוור שיווקי, מבצעים או הודעות פרסומיות.
          </p>
        </Section>

        <Section title="מסירת מידע לצדדים שלישיים">
          <p>
            FORTE אינה מוכרת את המידע האישי שנמסר. מידע עשוי להיות מעובד באמצעות
            ספקי שירות טכנולוגיים הנדרשים להפעלת האתר, מערכת FORTE, אחסון, תקשורת
            ואבטחה, וכן להימסר כאשר קיימת חובה חוקית לעשות זאת.
          </p>
        </Section>

        <Section title="אבטחת מידע">
          <p>
            ננקטים אמצעים סבירים להגנת המידע, אך אין אפשרות להבטיח חסינות מוחלטת
            של מערכות מחשוב ותקשורת.
          </p>
        </Section>

        <Section title="שמירת מידע">
          <p>
            המידע עשוי להישמר למשך הזמן הדרוש לצורך טיפול בפנייה, ניהול הקשר, מתן
            השירות, תיעוד מקצועי ועמידה בדרישות הדין.
          </p>
        </Section>

        <Section title="זכויות בנוגע למידע">
          <p>
            ניתן לפנות ל-{BRAND_EDITOR_NAME} בנוגע למידע שמסרתם ולבקש טיפול בו
            בהתאם להוראות הדין החלות.
          </p>
        </Section>

        <Section title="מסמכים שהלקוח מעביר">
          <p>
            אם ניתן להעביר מסמכים, תמונות או מידע נוסף, הפונה אחראי לכך שהוא רשאי
            למסור אותם לצורך הטיפול בפנייה.
          </p>
        </Section>

        <Section title="אין התחייבות לקבלת שירות">
          <p>
            שליחת טופס או מסירת פרטים אינה מהווה כשלעצמה הזמנת עבודה ואינה יוצרת
            אוטומטית התקשרות לקבלת שירות. התקשרות תיעשה בנפרד ובהתאם להצעה, הזמנה,
            הסכם או אישור מתאים.
          </p>
        </Section>

        <Section title="עדכון התנאים">
          <p>
            תנאים אלה עשויים להתעדכן מעת לעת. גרסה מזוהה ({PUBLIC_SALES_LEAD_TERMS_VERSION})
            מוצגת בעמוד זה; המשך שימוש בטפסים לאחר עדכון מהווה הסכמה לגרסה המעודכנת
            במסגרת מסירת פרטים חדשה.
          </p>
        </Section>
      </div>
    </article>
  );
}
