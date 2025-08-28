'use client'

import { ZoteroManager } from '@/components/zotero'
import { APIKeyManager } from '@/components/ai'

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600 mt-2">
            Configure your integrations and preferences
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <APIKeyManager />
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Integrations</h2>
            <ZoteroManager />
          </section>
        </div>
      </div>
    </div>
  )
}