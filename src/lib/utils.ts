// Stable hash for job IDs (stored in Supabase, not raw Upwork IDs)
export async function hashJobId(jobId: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode('upwork-job-' + jobId)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

// Random jitter in milliseconds (±30–60 seconds)
export function randomJitterMs(): number {
  const minMs = 30_000
  const maxMs = 60_000
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

// Check if current time is within quiet hours (HH:MM strings)
export function isInQuietHours(start: string, end: string): boolean {
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMinutes = sh * 60 + sm
  const endMinutes = eh * 60 + em

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }
  // Wraps midnight
  return currentMinutes >= startMinutes || currentMinutes < endMinutes
}

// Truncate text for notifications
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '…'
}

// Generate a random ID for templates/blocks/projects
export function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}
