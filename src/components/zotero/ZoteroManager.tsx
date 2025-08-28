'use client'

import { useState } from 'react'
import { ZoteroConfig } from './ZoteroConfig'
import { ZoteroSyncStatus } from './ZoteroSyncStatus'
import { ZoteroSettingsInfo } from '@/services/settings/UserZoteroService'

export function ZoteroManager() {
  const [settings, setSettings] = useState<ZoteroSettingsInfo | null>(null)

  const handleConfigured = (zoteroSettings: ZoteroSettingsInfo) => {
    setSettings(zoteroSettings)
  }

  return (
    <div className="space-y-6">
      <ZoteroConfig onConfigured={handleConfigured} />
      {settings && <ZoteroSyncStatus settings={settings} />}
    </div>
  )
}