'use client'

import React, { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { NotificationSettings as NotificationSettingsType, NotificationType } from '@/services/notifications/NotificationService'

interface NotificationSettingsProps {
  onClose: () => void
}

const notificationTypeLabels: Record<NotificationType, { label: string; description: string }> = {
  ai_analysis_complete: {
    label: 'AI Analysis Complete',
    description: 'When AI analysis of your papers is finished'
  },
  ai_analysis_failed: {
    label: 'AI Analysis Failed',
    description: 'When AI analysis encounters an error'
  },
  new_paper_added: {
    label: 'New Paper Added',
    description: 'When new papers are added to your library'
  },
  system_update: {
    label: 'System Updates',
    description: 'Important system announcements and updates'
  },
  security_alert: {
    label: 'Security Alerts',
    description: 'Security-related notifications and warnings'
  },
  backup_complete: {
    label: 'Backup Complete',
    description: 'When system backups are completed'
  }
}

export function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const [settings, setSettings] = useState<NotificationSettingsType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('No auth token')
      }

      const response = await fetch('/api/notifications/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load settings')
      }

      const data = await response.json()
      setSettings(data.settings)
    } catch (error) {
      console.error('Failed to load notification settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to load notification settings',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const updateSetting = async (type: NotificationType, enabled: boolean) => {
    setSaving(true)
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        throw new Error('No auth token')
      }

      const response = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type,
          enabled,
          deliveryMethod: 'web'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update setting')
      }

      // Update local state
      setSettings(prev => prev.map(setting => 
        setting.type === type && setting.deliveryMethod === 'web'
          ? { ...setting, enabled }
          : setting
      ))

      toast({
        title: 'Settings Updated',
        description: `${notificationTypeLabels[type].label} notifications ${enabled ? 'enabled' : 'disabled'}`
      })
    } catch (error) {
      console.error('Failed to update notification setting:', error)
      toast({
        title: 'Error',
        description: 'Failed to update notification setting',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const getSettingValue = (type: NotificationType): boolean => {
    const setting = settings.find(s => s.type === type && s.deliveryMethod === 'web')
    return setting?.enabled ?? true
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-32" />
                <div className="h-3 bg-muted rounded w-48" />
              </div>
              <div className="h-6 w-10 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Notification Preferences</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which notifications you want to receive
        </p>
      </div>

      <Separator />

      <div className="space-y-4">
        {Object.entries(notificationTypeLabels).map(([type, { label, description }]) => {
          const isEnabled = getSettingValue(type as NotificationType)
          
          return (
            <Card key={type} className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={type} className="font-medium">
                      {label}
                    </Label>
                    <Badge variant="outline" className="text-xs">
                      Web
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
                
                <Switch
                  id={type}
                  checked={isEnabled}
                  onCheckedChange={(enabled) => updateSetting(type as NotificationType, enabled)}
                  disabled={saving}
                />
              </div>
            </Card>
          )
        })}
      </div>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        <p>
          <strong>Note:</strong> Email and push notifications are not yet available. 
          All notifications will be delivered through the web interface.
        </p>
      </div>
    </div>
  )
}