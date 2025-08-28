'use client'

import { useState, useEffect } from 'react'
import { ZoteroConfig } from './ZoteroConfig'
import { ZoteroSyncStatus } from './ZoteroSyncStatus'

export function ZoteroManager() {
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkConfiguration()
  }, [])

  const checkConfiguration = async () => {
    try {
      const response = await fetch('/api/zotero/config')
      const result = await response.json()
      
      if (result.success) {
        setIsConfigured(result.data.isConfigured)
      }
    } catch (error) {
      console.error('Error checking Zotero configuration:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfigured = () => {
    setIsConfigured(true)
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <ZoteroConfig onConfigured={handleConfigured} />
      {isConfigured && <ZoteroSyncStatus />}
    </div>
  )
}