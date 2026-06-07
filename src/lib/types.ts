// ─── Profile & Projects ──────────────────────────────────────────────────────

export interface WorkHistoryItem {
  title: string
  description: string
  skills: string[]
  startDate?: string
  endDate?: string
}

export interface EmploymentItem {
  company: string
  title: string
  startDate?: string
  endDate?: string
}

export interface EducationItem {
  school: string
  degree?: string
  field?: string
}

export interface Profile {
  title: string
  headline: string
  overview: string
  rate: string
  skills: string[]
  workHistory: WorkHistoryItem[]
  employment: EmploymentItem[]
  education: EducationItem[]
}

export interface ProfileVersion {
  timestamp: string
  profile: Profile
}

export interface Project {
  id: string
  name: string
  description: string
  tools: string[]
  url: string
  relevanceTags: string[]
}

// ─── Templates ───────────────────────────────────────────────────────────────

export type TemplateBlockType = 'ai' | 'static' | 'dynamic_projects'

export interface TemplateBlock {
  id: string
  type: TemplateBlockType
  prompt?: string   // for 'ai' blocks
  text?: string     // for 'static' blocks
  numProjects?: number  // for 'dynamic_projects' blocks
}

export interface Template {
  id: string
  name: string
  blocks: TemplateBlock[]
  isDefault: boolean
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

export interface ScoringWeights {
  fitToProfile: number
  clientTrust: number
  hireRate: number
  budgetStrength: number
  competition: number
  freshness: number
}

export interface ScoringGates {
  fixedFloor: number
  hourlyFloor: number
  requirePaymentVerified: boolean
}

export interface ScoreResult {
  score: number
  oneLineReason: string
  factorBreakdown: Record<string, number>
}

// ─── Monitor ─────────────────────────────────────────────────────────────────

export interface SavedSearch {
  id: string
  label: string
  url: string
  monitorEnabled: boolean
}

// ─── Job Data ────────────────────────────────────────────────────────────────

export type BudgetType = 'fixed' | 'hourly' | 'unknown'

export interface JobBudget {
  type: BudgetType
  fixed?: number
  hourlyMin?: number
  hourlyMax?: number
}

export interface ClientInfo {
  name: string
  rating?: number
  hireRate?: number
  totalSpent?: string
  paymentVerified: boolean
  proposalCount?: number
  inviteCount?: number
  accountAge?: string
}

export interface ScreeningQuestion {
  id: string
  text: string
}

export interface JobPost {
  jobId: string
  url: string
  title: string
  description: string
  skills: string[]
  budget: JobBudget
  client: ClientInfo
  postedAt?: string
  questions: ScreeningQuestion[]
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface NotificationConfig {
  threshold: number
  sound: string
  volume: number
  quietHoursStart: string
  quietHoursEnd: string
  batchingEnabled: boolean
}

// ─── Chrome Storage Schema ───────────────────────────────────────────────────

export interface StorageSchema {
  // API keys
  gemini_api_key?: string
  gemini_model_generation?: string
  gemini_model_scoring?: string
  gemini_rpm_cap?: number
  hubspot_token?: string
  supabase_url?: string
  supabase_anon_key?: string
  supabase_email?: string
  supabase_session?: object

  // Profile
  profile?: Profile
  profile_versions?: ProfileVersion[]
  last_profile_analysis?: string
  projects?: Project[]

  // Templates
  templates?: Template[]

  // Scoring
  scoring_weights?: ScoringWeights
  scoring_gates?: ScoringGates

  // Monitor
  saved_searches?: SavedSearch[]
  seen_job_ids?: string[]
  monitor_interval_minutes?: number
  monitor_snoozed_until?: number

  // Notifications
  notification_config?: NotificationConfig

  // Bidding
  connects_target?: number
  connects_normalizer_enabled?: boolean

  // Misc
  privacy_notice_acknowledged?: boolean
}

// ─── Message Protocol ────────────────────────────────────────────────────────

export type MessageType =
  | 'ANALYZE_PROFILE'
  | 'GENERATE_PROPOSAL'
  | 'GENERATE_QUESTION_ANSWER'
  | 'SCORE_JOB'
  | 'SYNC_HUBSPOT'
  | 'LOG_PROPOSAL_SENT'
  | 'DISCOVER_SAVED_SEARCHES'
  | 'TEST_GEMINI_KEY'
  | 'TEST_HUBSPOT_TOKEN'
  | 'SUPABASE_LOGIN'

export interface MessageBase {
  type: MessageType
}

export interface AnalyzeProfileMessage extends MessageBase {
  type: 'ANALYZE_PROFILE'
  rawText: string
}

export interface GenerateProposalMessage extends MessageBase {
  type: 'GENERATE_PROPOSAL'
  jobPost: JobPost
  templateId?: string
}

export interface GenerateQuestionAnswerMessage extends MessageBase {
  type: 'GENERATE_QUESTION_ANSWER'
  question: ScreeningQuestion
  jobPost: JobPost
}

export interface ScoreJobMessage extends MessageBase {
  type: 'SCORE_JOB'
  jobPost: JobPost
}

export interface SyncHubSpotMessage extends MessageBase {
  type: 'SYNC_HUBSPOT'
  clientName: string
  company?: string
  jobTitle?: string
  jobContext?: string
  proposalText?: string
}

export interface LogProposalSentMessage extends MessageBase {
  type: 'LOG_PROPOSAL_SENT'
  jobId: string
  jobTitle: string
  connectsBid?: number
}

export interface DiscoverSavedSearchesMessage extends MessageBase {
  type: 'DISCOVER_SAVED_SEARCHES'
  searches: Array<{ id: string; label: string; url: string }>
}

export interface TestGeminiKeyMessage extends MessageBase {
  type: 'TEST_GEMINI_KEY'
  apiKey: string
}

export interface TestHubSpotTokenMessage extends MessageBase {
  type: 'TEST_HUBSPOT_TOKEN'
  token: string
}

export interface SupabaseLoginMessage extends MessageBase {
  type: 'SUPABASE_LOGIN'
  email: string
  password: string
}

export type ExtensionMessage =
  | AnalyzeProfileMessage
  | GenerateProposalMessage
  | GenerateQuestionAnswerMessage
  | ScoreJobMessage
  | SyncHubSpotMessage
  | LogProposalSentMessage
  | DiscoverSavedSearchesMessage
  | TestGeminiKeyMessage
  | TestHubSpotTokenMessage
  | SupabaseLoginMessage

export interface MessageResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}
