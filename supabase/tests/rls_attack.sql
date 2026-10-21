-- Cross-tenant attack test. Run in the Supabase SQL editor (or via the MCP execute_sql tool).
-- Creates two users and two businesses, tries to break isolation, then ROLLS BACK by raising the report as an error.
-- Every line of the report must say PASS.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); uo uuid := gen_random_uuid();
  ba uuid; bb uuid; ca uuid; cb uuid; ia uuid;
  r text[] := '{}'; n int;
begin
  insert into auth.users (id, email, aud, role, email_confirmed_at) values
    (ua, 'a-' || ua || '@test.invalid', 'authenticated', 'authenticated', now()),
    (ub, 'b-' || ub || '@test.invalid', 'authenticated', 'authenticated', now()),
    (uo, 'op-' || uo || '@test.invalid', 'authenticated', 'authenticated', now());

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ba := public.create_business('Biz A', 'A', null, 'unknown');
  insert into public.customers (business_id, name, kind, tone, language) values (ba, 'A cust', 'business', 'formal', 'en') returning id into ca;
  insert into public.invoices (business_id, customer_id, number, issue_date, agreed_days, amount) values (ba, ca, 'A1', current_date, 30, 1000) returning id into ia;

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;
  bb := public.create_business('Biz B', 'B', null, 'unknown');
  insert into public.customers (business_id, name, kind, tone, language) values (bb, 'B cust', 'business', 'formal', 'en') returning id into cb;

  select count(*) into n from public.customers where business_id = ba;
  r := r || (case when n = 0 then 'PASS' else 'FAIL' end) || ' B cannot read A customers (saw ' || n || ')';
  select count(*) into n from public.invoices;
  r := r || (case when n = 0 then 'PASS' else 'FAIL' end) || ' B sees no invoices at all (saw ' || n || ')';

  begin
    insert into public.customers (business_id, name, kind, tone, language) values (ba, 'intruder', 'business', 'formal', 'en');
    r := r || 'FAIL B inserted a customer into A';
  exception when others then r := r || 'PASS B cannot insert into A';
  end;

  begin
    insert into public.invoices (business_id, customer_id, number, issue_date, agreed_days, amount) values (bb, ca, 'X', current_date, 30, 1);
    r := r || 'FAIL B created an invoice in B pointing at A customer';
  exception when others then r := r || 'PASS cross-tenant customer reference rejected';
  end;

  update public.businesses set name = 'hacked' where id = ba; get diagnostics n = row_count;
  r := r || (case when n = 0 then 'PASS' else 'FAIL' end) || ' B cannot rename A (rows ' || n || ')';
  delete from public.customers where id = ca; get diagnostics n = row_count;
  r := r || (case when n = 0 then 'PASS' else 'FAIL' end) || ' B cannot delete A customer (rows ' || n || ')';

  begin
    perform public.invite_member(ba, 'b-' || ub || '@test.invalid', 'owner');
    r := r || 'FAIL B added itself to A';
  exception when others then r := r || 'PASS B cannot add itself to A';
  end;
  begin
    insert into public.members (business_id, user_id, role) values (ba, ub, 'owner');
    r := r || 'FAIL direct insert into members worked';
  exception when others then r := r || 'PASS members table not writable directly';
  end;

  -- anonymous
  reset role;
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  begin
    select count(*) into n from public.customers;
    r := r || (case when n = 0 then 'PASS' else 'FAIL' end) || ' anon sees no customers (saw ' || n || ')';
  exception when others then r := r || 'PASS anon blocked from customers';
  end;
  begin
    perform public.create_business('anon biz', null, null, 'unknown');
    r := r || 'FAIL anon created a business';
  exception when others then r := r || 'PASS anon cannot create business';
  end;

  -- operator: can add, cannot delete or change settings
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.invite_member(ba, 'op-' || uo || '@test.invalid', 'operator');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uo, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.customers (business_id, name, kind, tone, language) values (ba, 'by operator', 'business', 'formal', 'en');
  r := r || 'PASS operator can add a customer';
  update public.businesses set name = 'op rename' where id = ba; get diagnostics n = row_count;
  r := r || (case when n = 0 then 'PASS' else 'FAIL' end) || ' operator cannot change business settings (rows ' || n || ')';
  delete from public.invoices where id = ia; get diagnostics n = row_count;
  r := r || (case when n = 0 then 'PASS' else 'FAIL' end) || ' operator cannot delete invoices (rows ' || n || ')';


  -- invites: same answer for unknown emails; old lookup function is closed
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.invite_member(ba, 'nobody-' || ua || '@test.invalid', 'operator');
    r := r || 'PASS inviting an unknown email gives no error (no account lookup)';
  exception when others then r := r || 'FAIL inviting unknown email raised: ' || sqlerrm;
  end;
  begin
    perform public.add_member_by_email(ba, 'x@test.invalid', 'operator');
    r := r || 'FAIL old add_member_by_email still executable';
  exception when others then r := r || 'PASS old add_member_by_email is closed';
  end;
  begin
    select count(*) into n from public.invites;
    r := r || (case when n = 0 then 'PASS' else 'FAIL' end) || ' invites table not readable by users (saw ' || n || ')';
  exception when others then r := r || 'PASS invites table not readable';
  end;

  reset role;
  raise exception E'RLS REPORT\n%', array_to_string(r, E'\n');
end $$;
