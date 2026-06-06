-- פורטה בקרה — רשימת בנייני פיילוט (מקור: lib/buildings.ts)
-- להרצה עתידית כאשר תתווסף טבלת buildings מלאה ב-Supabase.
-- כרגע: מזהי בניין משמשים בשדה building_id ב-pilot_faults / pilot_feedback.

-- בניינים רשומים:
-- md25  MD25  מגדל דוד 25, מודיעין
-- md23  MD23  מגדל דוד 23, מודיעין
-- or02  OR02  אורן 2, ראשון לציון
-- mn64  MN64  מבצע נחשון 64, באר שבע
-- yk20  YK20  יערות הכרמל 20, לוד
-- ys34  YS34  ישורון 34, הוד השרון  (חדש)

-- דוגמה ל-seed עתידי (לא פעיל — טבלת buildings טרם קיימת):
/*
insert into public.buildings (id, building_code, name, address, city, elevator_count, elevator_company, management_company, contact_person)
values
  ('ys34', 'YS34', 'ישורון 34', 'ישורון 34, הוד השרון', 'הוד השרון', 1, 'אלקטרה', 'ועד בית', 'אלונה באום')
on conflict (id) do nothing;

insert into public.elevators (id, building_id, name, stations)
values
  ('ys34-main', 'ys34', 'מעלית ראשית', 5)
on conflict (id) do nothing;
*/
