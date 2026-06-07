import React, { useEffect, useState } from 'react'
import type { Profile as ProfileType } from '@/lib/types'

export function Profile(): React.ReactElement {
  const [profile, setProfile] = useState<ProfileType | null>(null)
  const [lastAnalyzed, setLastAnalyzed] = useState<string | null>(null)
  const [analyzing] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(['profile', 'last_profile_analysis'], (result) => {
      if (result.profile) setProfile(result.profile as ProfileType)
      if (result.last_profile_analysis) setLastAnalyzed(result.last_profile_analysis as string)
    })
  }, [])

  function openProfilePage(): void {
    chrome.tabs.create({ url: 'https://www.upwork.com/freelancers/~' })
  }

  const daysSince = lastAnalyzed
    ? Math.floor((Date.now() - new Date(lastAnalyzed).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Profile</h2>
        <button onClick={openProfilePage}
          className="px-4 py-1.5 bg-upwork-green text-white text-sm font-medium rounded-lg hover:opacity-90">
          Go to Upwork Profile →
        </button>
      </div>

      {lastAnalyzed && (
        <div className={`rounded-lg p-3 text-sm ${daysSince !== null && daysSince > 35 ? 'bg-orange-50 text-orange-800 border border-orange-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
          Last analyzed: {new Date(lastAnalyzed).toLocaleDateString()}
          {daysSince !== null && ` (${daysSince} days ago)`}
          {daysSince !== null && daysSince > 35 && ' — consider re-analyzing'}
        </div>
      )}

      {!profile && !analyzing && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
          <p className="text-sm">No profile analyzed yet.</p>
          <p className="text-xs mt-1">Visit your Upwork profile page and click "Analyze Profile".</p>
        </div>
      )}

      {profile && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Title</label>
            <p className="text-sm text-gray-800">{profile.title}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Rate</label>
            <p className="text-sm text-gray-800">{profile.rate}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Skills ({profile.skills?.length ?? 0})</label>
            <div className="flex flex-wrap gap-1">
              {(profile.skills ?? []).map((skill, i) => (
                <span key={i} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">{skill}</span>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Overview</label>
            <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-6">{profile.overview}</p>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">View raw JSON</summary>
            <pre className="mt-2 bg-gray-50 rounded p-3 overflow-auto text-gray-700 max-h-96">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
