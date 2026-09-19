import fs from "fs";
import path from "path";

const root = process.cwd();
const src = fs.readFileSync(
  path.join(root, "supabase/migrations/040_sales_lead_notifications.sql"),
  "utf8"
);
const fnStart = src.indexOf("create or replace function public.submit_public_sales_lead_form");
const grantStart = src.indexOf(
  "comment on function public.submit_public_sales_lead_form",
  fnStart
);
let fn = src.slice(fnStart, grantStart);

fn = fn.replace(
  /p_next_action text,\s*\n\s*p_ip_hash text\s*\)/,
  "p_next_action text,\n  p_ip_hash text,\n  p_terms_version text\n)"
);

fn = fn.replace(
  "v_next_action := nullif(trim(coalesce(p_next_action, '')), '');",
  `v_next_action := nullif(trim(coalesce(p_next_action, '')), '');

  if length(trim(coalesce(p_terms_version, ''))) = 0 then
    raise exception 'terms_not_accepted';
  end if;`
);

fn = fn.replace(
  /next_action = coalesce\(v_next_action, next_action\),\s*\n\s*updated_at = v_now\s*\n\s*where id = v_lead_id;/,
  `next_action = coalesce(v_next_action, next_action),
           terms_accepted = true,
           terms_accepted_at = v_now,
           terms_version = trim(p_terms_version),
           updated_at = v_now
     where id = v_lead_id;`
);

fn = fn.replace(
  /next_action,\s*\n\s*created_at,\s*\n\s*updated_at\s*\n\s*\) values \(/,
  `next_action,
      terms_accepted,
      terms_accepted_at,
      terms_version,
      created_at,
      updated_at
    ) values (`
);

fn = fn.replace(
  /coalesce\(v_next_action, ''\),\s*\n\s*v_now,\s*\n\s*v_now\s*\n\s*\)\s*\n\s*returning id into v_lead_id;/,
  `coalesce(v_next_action, ''),
      true,
      v_now,
      trim(p_terms_version),
      v_now,
      v_now
    )
    returning id into v_lead_id;`
);

if (!fn.includes("terms_accepted = true")) {
  console.error("FAIL: generator did not apply terms columns to RPC body");
  process.exit(1);
}

const header = `-- 045: Public form terms consent on sales_leads + submit_public_sales_lead_form(p_terms_version).

alter table public.sales_leads
  add column if not exists terms_accepted boolean,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

comment on column public.sales_leads.terms_accepted is
  'True when lead was created/updated via public form with terms acceptance.';
comment on column public.sales_leads.terms_accepted_at is
  'Server timestamp when terms were accepted on public form submit.';
comment on column public.sales_leads.terms_version is
  'Terms document version id at acceptance (e.g. 2026-09).';

drop function if exists public.submit_public_sales_lead_form(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text
);

`;

const footer = `comment on function public.submit_public_sales_lead_form(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text
) is
  'Atomic public /lead submit with terms version. service_role only.';

revoke all on function public.submit_public_sales_lead_form(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.submit_public_sales_lead_form(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text
) to service_role;
`;

const out = header + fn + footer;
for (const name of [
  "045_sales_lead_terms_consent.sql",
  "045_sales_lead_terms_consent_SQL_EDITOR.sql",
]) {
  fs.writeFileSync(path.join(root, "supabase/migrations", name), out);
}
console.log("Generated 045 migrations");
