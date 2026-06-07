import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'
import { get, set } from '@/lib/storage'

let client: SupabaseClient | null = null

async function getClient(): Promise<SupabaseClient> {
  if (client) return client

  const { supabase_url, supabase_anon_key } = await get(['supabase_url', 'supabase_anon_key'])
  if (!supabase_url || !supabase_anon_key) throw new Error('Supabase not configured')

  client = createClient(supabase_url, supabase_anon_key, {
    auth: { persistSession: false }, // We manage session manually in chrome.storage
  })

  // Restore session if persisted
  const { supabase_session } = await get(['supabase_session'])
  if (supabase_session) {
    await client.auth.setSession(supabase_session as Session)
  }

  return client
}

export async function signIn(email: string, password: string, url?: string, anonKey?: string): Promise<void> {
  let sb: SupabaseClient
  if (url && anonKey) {
    // Use credentials from the form directly — no need to have saved first
    client = null // force fresh client with the provided credentials
    await set({ supabase_url: url, supabase_anon_key: anonKey })
  }
  sb = await getClient()
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Supabase sign-in failed: ${error.message}`)
  if (data.session) {
    await set({ supabase_session: data.session as unknown as object })
  }
}

export async function signOut(): Promise<void> {
  if (!client) return
  await client.auth.signOut()
  await set({ supabase_session: undefined })
  client = null
}

export async function logEvent(table: string, payload: Record<string, unknown>): Promise<void> {
  let sb: SupabaseClient
  try {
    sb = await getClient()
  } catch {
    return // Supabase not configured — silently skip
  }

  // Refresh session if needed
  const { data: sessionData } = await sb.auth.getSession()
  if (!sessionData.session) return // Not authenticated

  const { supabase_session } = await get(['supabase_session'])
  if (supabase_session) {
    const session = supabase_session as Session
    const expiresAt = session.expires_at ?? 0
    if (Date.now() / 1000 > expiresAt - 60) {
      const { data: refreshed } = await sb.auth.refreshSession()
      if (refreshed.session) {
        await set({ supabase_session: refreshed.session as unknown as object })
      }
    }
  }

  const { error } = await sb
    .from(table)
    .insert({ ...payload, ts: new Date().toISOString() })

  if (error) {
    console.warn(`[Supabase] logEvent(${table}) failed:`, error.message)
  }
}

export async function logProposalSent(
  jobId: string,
  jobTitle: string,
  connectsBid?: number
): Promise<void> {
  // Score at send time would need the job post — best effort, log 0 if unavailable
  await logEvent('proposals_sent', {
    job_id_hash: jobId,
    job_title: jobTitle,
    score_at_send: 0,
    connects_bid: connectsBid ?? 0,
  })
}
