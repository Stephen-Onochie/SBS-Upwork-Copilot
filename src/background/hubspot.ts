import type { SyncHubSpotMessage } from '@/lib/types'
import { get } from '@/lib/storage'
import { callScoringModel } from './gemini'
import { logEvent } from './supabase'

const BASE = 'https://api.hubapi.com'

async function getToken(): Promise<string> {
  const { hubspot_token } = await get(['hubspot_token'])
  if (!hubspot_token) throw new Error('HubSpot token not configured')
  return hubspot_token
}

async function hsRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken()
  const resp = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })
  return resp
}

async function searchContact(name: string, company?: string): Promise<string | null> {
  const filters: object[] = [
    { propertyName: 'firstname', operator: 'CONTAINS_TOKEN', value: name.split(' ')[0] },
  ]
  if (company) {
    filters.push({ propertyName: 'company', operator: 'EQ', value: company })
  }

  const resp = await hsRequest('/crm/v3/objects/contacts/search', {
    method: 'POST',
    body: JSON.stringify({ filterGroups: [{ filters }], limit: 1 }),
  })
  if (!resp.ok) return null

  const data = await resp.json() as { results?: Array<{ id: string }> }
  return data.results?.[0]?.id ?? null
}

async function createOrUpdateContact(
  name: string,
  company?: string,
  jobTitle?: string,
  notes?: string
): Promise<string> {
  const nameParts = name.trim().split(' ')
  const firstname = nameParts[0]
  const lastname = nameParts.slice(1).join(' ') || '(Upwork)'

  const existingId = await searchContact(name, company)

  const properties = {
    firstname,
    lastname,
    company: company ?? '',
    jobtitle: jobTitle ?? '',
    hs_content_membership_notes: notes ?? '',
  }

  if (existingId) {
    await hsRequest(`/crm/v3/objects/contacts/${existingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    })
    return existingId
  }

  const resp = await hsRequest('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({ properties }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`HubSpot create contact failed: ${resp.status} ${text.slice(0, 200)}`)
  }

  const data = await resp.json() as { id: string }
  return data.id
}

async function getPipelineStages(): Promise<Array<{ id: string; label: string }>> {
  const resp = await hsRequest('/crm/v3/pipelines/deals')
  if (!resp.ok) return []

  const data = await resp.json() as { results?: Array<{ stages?: Array<{ id: string; label: string }> }> }
  return data.results?.[0]?.stages ?? []
}

async function pickStage(stages: Array<{ id: string; label: string }>, context: string): Promise<string> {
  if (stages.length === 0) return ''

  const stageList = stages.map((s) => `- ${s.id}: ${s.label}`).join('\n')
  const prompt = `You are helping assign a HubSpot deal stage based on context.

Available pipeline stages:
${stageList}

Context about this prospect:
${context}

Return ONLY the stage ID (not the label) that best fits this situation. No explanation.`

  const result = await callScoringModel(prompt, { temperature: 0.1, maxOutputTokens: 50 })
  const stageId = result.trim()
  // Validate returned ID exists
  const valid = stages.find((s) => s.id === stageId)
  return valid ? stageId : (stages[0]?.id ?? '')
}

async function createOrUpdateDeal(
  dealName: string,
  stageId: string,
  contactId: string,
  notes?: string
): Promise<string> {
  // Search for existing deal by name
  const searchResp = await hsRequest('/crm/v3/objects/deals/search', {
    method: 'POST',
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'dealname', operator: 'EQ', value: dealName }] }],
      limit: 1,
    }),
  })

  const searchData = await searchResp.json() as { results?: Array<{ id: string }> }
  const existingDealId = searchData.results?.[0]?.id

  const properties = {
    dealname: dealName,
    dealstage: stageId,
    description: notes ?? '',
    pipeline: 'default',
  }

  let dealId: string

  if (existingDealId) {
    await hsRequest(`/crm/v3/objects/deals/${existingDealId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    })
    dealId = existingDealId
  } else {
    const resp = await hsRequest('/crm/v3/objects/deals', {
      method: 'POST',
      body: JSON.stringify({ properties }),
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`HubSpot create deal failed: ${resp.status} ${text.slice(0, 200)}`)
    }
    const data = await resp.json() as { id: string }
    dealId = data.id
  }

  // Associate deal with contact
  await hsRequest(`/crm/v3/associations/deals/contacts/batch/create`, {
    method: 'POST',
    body: JSON.stringify({
      inputs: [{ from: { id: dealId }, to: { id: contactId }, type: 'deal_to_contact' }],
    }),
  })

  return dealId
}

export async function syncHubSpot(message: SyncHubSpotMessage): Promise<{ contactId: string; dealId: string; stage: string; action: 'created' | 'updated' }> {
  const stages = await getPipelineStages()

  const context = [
    `Client: ${message.clientName}`,
    message.company ? `Company: ${message.company}` : '',
    message.jobTitle ? `Job: ${message.jobTitle}` : '',
    message.jobContext ? `Context: ${message.jobContext}` : '',
  ].filter(Boolean).join('\n')

  const stageId = await pickStage(stages, context)

  const notes = [
    message.jobTitle ? `Job: ${message.jobTitle}` : '',
    message.jobContext ? `\n${message.jobContext}` : '',
    message.proposalText ? `\nProposal:\n${message.proposalText}` : '',
  ].filter(Boolean).join('')

  const contactId = await createOrUpdateContact(
    message.clientName,
    message.company,
    message.jobTitle,
    notes
  )

  const dealName = `${message.clientName}${message.jobTitle ? ' — ' + message.jobTitle : ''} (Upwork)`
  const dealId = await createOrUpdateDeal(dealName, stageId, contactId, notes)

  const stageLabel = stages.find((s) => s.id === stageId)?.label ?? stageId

  await logEvent('hubspot_syncs', {
    contact_id: contactId,
    deal_id: dealId,
    stage: stageLabel,
  }).catch(console.warn)

  return { contactId, dealId, stage: stageLabel, action: 'created' }
}
