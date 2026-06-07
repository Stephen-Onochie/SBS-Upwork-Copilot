import type { ExtensionMessage, MessageResponse } from '@/lib/types'
import { analyzeProfile } from './profile'
import { generateProposal, generateQuestionAnswer } from './proposal'
import { scoreJob } from './scorer'
import { syncHubSpot } from './hubspot'
import { logProposalSent, signIn } from './supabase'
import { callGemini } from './gemini'
import { get, set } from '@/lib/storage'

export function handleMessage(
  message: ExtensionMessage,
  sendResponse: (response: MessageResponse) => void
): void {
  dispatch(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err: Error) => sendResponse({ ok: false, error: err.message }))
}

async function dispatch(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case 'ANALYZE_PROFILE':
      return analyzeProfile(message.rawText)

    case 'GENERATE_PROPOSAL':
      return generateProposal(message.jobPost, message.templateId)

    case 'GENERATE_QUESTION_ANSWER':
      return generateQuestionAnswer(message.question, message.jobPost)

    case 'SCORE_JOB':
      return scoreJob(message.jobPost)

    case 'SYNC_HUBSPOT':
      return syncHubSpot(message)

    case 'LOG_PROPOSAL_SENT':
      return logProposalSent(message.jobId, message.jobTitle, message.connectsBid)

    case 'DISCOVER_SAVED_SEARCHES': {
      const { saved_searches } = await get(['saved_searches'])
      const existing = saved_searches ?? []
      const merged = message.searches.map((s) => {
        const found = existing.find((e) => e.id === s.id)
        return found ?? { ...s, monitorEnabled: false }
      })
      await set({ saved_searches: merged })
      return merged
    }

    case 'TEST_GEMINI_KEY': {
      const { gemini_model_scoring } = await get(['gemini_model_scoring'])
      const model = gemini_model_scoring ?? 'gemini-2.0-flash-lite'
      const result = await callGemini(model, 'Say "OK" and nothing else.', { apiKey: message.apiKey })
      return { response: result }
    }

    case 'SUPABASE_LOGIN':
      await signIn(message.email, message.password)
      return { ok: true }

    case 'TEST_HUBSPOT_TOKEN': {
      const resp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: { Authorization: `Bearer ${message.token}` },
      })
      if (!resp.ok) throw new Error(`HubSpot API error: ${resp.status}`)
      return { ok: true }
    }

    default:
      throw new Error(`Unknown message type`)
  }
}
