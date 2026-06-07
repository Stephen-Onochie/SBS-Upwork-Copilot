import type { JobPost, ScreeningQuestion, Template } from '@/lib/types'
import { get } from '@/lib/storage'
import { callGenerationModel, callScoringModel } from './gemini'
import { logEvent } from './supabase'
import { hashJobId } from '@/lib/utils'
import { scoreJob } from './scorer'

export async function generateProposal(jobPost: JobPost, templateId?: string): Promise<string> {
  const { profile, projects, templates } = await get(['profile', 'projects', 'templates'])

  if (!profile) throw new Error('Profile not analyzed yet. Please analyze your profile in Options first.')

  const allTemplates: Template[] = templates ?? []
  let template: Template | undefined

  if (templateId) {
    template = allTemplates.find((t) => t.id === templateId)
  }
  if (!template) {
    template = allTemplates.find((t) => t.isDefault) ?? allTemplates[0]
  }
  if (!template) {
    // Build a simple default template if none configured
    return generateDefaultProposal(jobPost, profile, projects ?? [])
  }

  const profileStr = JSON.stringify(profile, null, 2)
  const projectsStr = JSON.stringify(projects ?? [], null, 2)
  const jobStr = formatJobForPrompt(jobPost)

  const parts: string[] = []

  for (const block of template.blocks) {
    if (block.type === 'static') {
      parts.push(block.text ?? '')
    } else if (block.type === 'ai') {
      const prompt = `${block.prompt ?? 'Write a professional cover letter section.'}

Freelancer Profile:
${profileStr}

Projects:
${projectsStr}

Job Post:
${jobStr}

Write only the cover letter section text, no preamble or explanation.`
      const section = await callGenerationModel(prompt, { temperature: 0.75, maxOutputTokens: 1500 })
      parts.push(section.trim())
    } else if (block.type === 'dynamic_projects') {
      const n = block.numProjects ?? 3
      const ranked = await rankProjects(jobPost, projects ?? [], n)
      parts.push(ranked)
    }
  }

  const assembled = parts.filter(Boolean).join('\n\n')

  // Log to Supabase
  let scoreAtGen = 0
  try {
    const result = await scoreJob(jobPost)
    scoreAtGen = result.score
  } catch {
    // scoring failure shouldn't block proposal generation
  }

  const jobIdHash = await hashJobId(jobPost.jobId)
  await logEvent('proposals_generated', {
    job_id_hash: jobIdHash,
    job_title: jobPost.title,
    template_used: template.name,
    score_at_gen: scoreAtGen,
  }).catch(console.warn)

  return assembled
}

async function generateDefaultProposal(
  jobPost: JobPost,
  profile: object,
  projects: object[]
): Promise<string> {
  const prompt = `You are writing a professional Upwork cover letter for a freelancer.

Freelancer Profile:
${JSON.stringify(profile, null, 2)}

Top Projects:
${JSON.stringify(projects.slice(0, 3), null, 2)}

Job Post:
${formatJobForPrompt(jobPost)}

Write a compelling, concise cover letter (3–4 paragraphs).
- Open with a specific hook about the job, not "I am writing to apply..."
- Highlight 2–3 most relevant skills/experiences
- Reference 1 relevant project with a result if possible
- End with a clear CTA
- Do NOT auto-generate a salutation; start with the hook directly.

Write only the cover letter text.`

  return callGenerationModel(prompt, { temperature: 0.75, maxOutputTokens: 1500 })
}

async function rankProjects(jobPost: JobPost, projects: object[], n: number): Promise<string> {
  if (projects.length === 0) return ''

  const prompt = `Given this job post and list of projects, select the ${n} most relevant projects and format them as a short bulleted list with name and one-sentence description.

Job Post Title: ${jobPost.title}
Job Description (first 500 chars): ${jobPost.description.slice(0, 500)}

Projects:
${JSON.stringify(projects, null, 2)}

Return ONLY the formatted bullet list, nothing else. Example format:
• Project Name — Brief relevant description (link if available)`

  return callScoringModel(prompt, { temperature: 0.2, maxOutputTokens: 500 })
}

export async function generateQuestionAnswer(
  question: ScreeningQuestion,
  jobPost: JobPost
): Promise<string> {
  const { profile, projects } = await get(['profile', 'projects'])

  const prompt = `You are helping a freelancer answer a screening question for a job application.

Job Title: ${jobPost.title}
Job Description (first 500 chars): ${jobPost.description.slice(0, 500)}

Freelancer Profile:
${JSON.stringify(profile ?? {}, null, 2)}

Projects:
${JSON.stringify((projects ?? []).slice(0, 3), null, 2)}

Screening Question:
${question.text}

Write a concise, specific answer (2–4 sentences). Be direct and relevant. Do not start with "I" or "As a".`

  return callGenerationModel(prompt, { temperature: 0.65, maxOutputTokens: 400 })
}

function formatJobForPrompt(job: JobPost): string {
  const budgetStr =
    job.budget.type === 'fixed'
      ? `Fixed: $${job.budget.fixed}`
      : job.budget.type === 'hourly'
        ? `Hourly: $${job.budget.hourlyMin}–$${job.budget.hourlyMax}/hr`
        : 'Budget not specified'

  return `Title: ${job.title}
Budget: ${budgetStr}
Skills: ${job.skills.join(', ')}
Client: ${job.client.name} | Payment verified: ${job.client.paymentVerified} | Rating: ${job.client.rating ?? 'N/A'} | Hire rate: ${job.client.hireRate ?? 'N/A'}%
Posted: ${job.postedAt ?? 'Unknown'}

Description:
${job.description}`
}
