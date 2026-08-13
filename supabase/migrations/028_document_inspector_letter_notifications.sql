-- פורטה בקרה — הרחבת document_inspector_notifications לשלבי מכתב LETTER_1/2/3
-- הרצה: Supabase SQL Editor → New query → הדבק והרץ
-- additive בלבד — שומר היסטוריית day_35 / day_40 / day_45_plus

alter table public.document_inspector_notifications
  drop constraint if exists document_inspector_notifications_notification_type_check;

alter table public.document_inspector_notifications
  add constraint document_inspector_notifications_notification_type_check
  check (
    notification_type in (
      'day_35',
      'day_40',
      'day_45_plus',
      'letter_1',
      'letter_2',
      'letter_3'
    )
  );
