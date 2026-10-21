import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null when the build has no Supabase settings: the app then offers the demo only. */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export interface Membership {
  businessId: string;
  name: string;
  role: 'owner' | 'operator';
}

export async function listMemberships(db: SupabaseClient): Promise<Membership[]> {
  const { data, error } = await db.from('members').select('business_id, role, businesses(name)');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const biz = r.businesses as unknown as { name: string } | { name: string }[] | null;
    const name = Array.isArray(biz) ? biz[0]?.name : biz?.name;
    return { businessId: r.business_id as string, name: name ?? 'Business', role: r.role as 'owner' | 'operator' };
  });
}

export async function createBusiness(
  db: SupabaseClient,
  input: { name: string; ownerName?: string; ownerPhone?: string; udyam: string }
): Promise<string> {
  const { data, error } = await db.rpc('create_business', {
    p_name: input.name,
    p_owner_name: input.ownerName ?? null,
    p_owner_phone: input.ownerPhone ?? null,
    p_udyam: input.udyam
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function addMemberByEmail(
  db: SupabaseClient,
  businessId: string,
  email: string,
  role: 'owner' | 'operator'
) {
  const { error } = await db.rpc('add_member_by_email', { p_business: businessId, p_email: email, p_role: role });
  if (error) throw new Error(error.message);
}
