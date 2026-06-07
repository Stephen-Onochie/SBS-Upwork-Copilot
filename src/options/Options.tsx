import React, { useState } from 'react'
import { ApiKeys } from './sections/ApiKeys'
import { Profile } from './sections/Profile'
import { Projects } from './sections/Projects'
import { Templates } from './sections/Templates'
import { Scoring } from './sections/Scoring'
import { Monitor } from './sections/Monitor'
import { Notifications } from './sections/Notifications'
import { Bidding } from './sections/Bidding'

type Tab = 'keys' | 'profile' | 'projects' | 'templates' | 'scoring' | 'monitor' | 'notifications' | 'bidding'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'keys', label: 'API Keys' },
  { id: 'profile', label: 'Profile' },
  { id: 'projects', label: 'Projects' },
  { id: 'templates', label: 'Templates' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'monitor', label: 'Monitor' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'bidding', label: 'Bidding' },
]

export function Options(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('keys')

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <nav className="w-48 bg-white border-r border-gray-200 pt-8 px-3">
        <div className="mb-6">
          <h1 className="text-base font-bold text-gray-900 px-2">⚙️ Co-Pilot Settings</h1>
        </div>
        <ul className="space-y-1">
          {TABS.map((tab) => (
            <li key={tab.id}>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <main className="flex-1 p-8 max-w-3xl">
        {activeTab === 'keys' && <ApiKeys />}
        {activeTab === 'profile' && <Profile />}
        {activeTab === 'projects' && <Projects />}
        {activeTab === 'templates' && <Templates />}
        {activeTab === 'scoring' && <Scoring />}
        {activeTab === 'monitor' && <Monitor />}
        {activeTab === 'notifications' && <Notifications />}
        {activeTab === 'bidding' && <Bidding />}
      </main>
    </div>
  )
}
