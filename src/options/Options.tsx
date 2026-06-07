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
    <div className="min-h-screen flex font-sans bg-sbs-offwhite">
      {/* Sidebar — Navy */}
      <nav className="w-52 bg-sbs-navy flex flex-col">
        {/* Brand header */}
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <div className="text-sbs-gold font-mono text-xs font-bold tracking-widest uppercase mb-1">SBS Digital</div>
          <h1 className="text-white font-display text-base font-bold leading-tight">Upwork Co-Pilot</h1>
          <p className="text-sbs-cream/60 text-xs mt-0.5">Settings</p>
        </div>
        <ul className="space-y-0.5 px-3 pt-4 flex-1">
          {TABS.map((tab) => (
            <li key={tab.id}>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-sbs-gold text-sbs-navy font-semibold'
                    : 'text-sbs-cream/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="px-5 py-4 border-t border-white/10">
          <a href="https://sitesbystephen.com" target="_blank" rel="noopener noreferrer"
            className="text-sbs-cream/30 hover:text-sbs-gold text-xs transition-colors">
            sitesbystephen.com
          </a>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 p-8 max-w-3xl bg-white min-h-screen border-l border-sbs-border">
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
