"use client"

import * as React from "react"
import { BookOpen, Eye, CheckCircle, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export type ReadingStatus = 'unread' | 'reading' | 'completed'

interface ReadingStatusProps {
  status: ReadingStatus
  onChange?: (status: ReadingStatus) => void
  showProgress?: boolean
  progress?: number
  readonly?: boolean
  variant?: 'default' | 'compact' | 'detailed'
  className?: string
}

const statusConfig = {
  unread: {
    label: 'Unread',
    icon: Circle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    variant: 'secondary' as const
  },
  reading: {
    label: 'Reading',
    icon: BookOpen,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    variant: 'default' as const
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    variant: 'default' as const
  }
}

export function ReadingStatus({
  status,
  onChange,
  showProgress = false,
  progress = 0,
  readonly = false,
  variant = 'default',
  className
}: ReadingStatusProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  const handleStatusChange = (newStatus: ReadingStatus) => {
    if (!readonly && onChange) {
      onChange(newStatus)
    }
  }

  const getNextStatus = (): ReadingStatus => {
    switch (status) {
      case 'unread':
        return 'reading'
      case 'reading':
        return 'completed'
      case 'completed':
        return 'unread'
      default:
        return 'unread'
    }
  }

  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleStatusChange(getNextStatus())}
          disabled={readonly}
          className={cn("h-6 px-2", config.color)}
        >
          <Icon className="h-4 w-4" />
        </Button>
        {showProgress && status === 'reading' && (
          <div className="flex-1 min-w-[60px]">
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </div>
    )
  }

  if (variant === 'detailed') {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Reading Status</span>
          {!readonly && (
            <div className="flex gap-1">
              {Object.entries(statusConfig).map(([key, conf]) => {
                const StatusIcon = conf.icon
                return (
                  <Button
                    key={key}
                    variant={status === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleStatusChange(key as ReadingStatus)}
                    className="h-8 px-3"
                  >
                    <StatusIcon className="h-4 w-4 mr-1" />
                    {conf.label}
                  </Button>
                )
              })}
            </div>
          )}
        </div>
        
        {readonly && (
          <Badge variant={config.variant} className="w-fit">
            <Icon className="h-4 w-4 mr-1" />
            {config.label}
          </Badge>
        )}

        {showProgress && status === 'reading' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </div>
    )
  }

  // Default variant
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {readonly ? (
        <Badge variant={config.variant} className="w-fit">
          <Icon className="h-4 w-4 mr-1" />
          {config.label}
        </Badge>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleStatusChange(getNextStatus())}
          className={cn("h-8 px-3", config.color)}
        >
          <Icon className="h-4 w-4 mr-1" />
          {config.label}
        </Button>
      )}
      
      {showProgress && status === 'reading' && (
        <div className="flex items-center gap-2 flex-1 min-w-[100px]">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground min-w-[30px]">
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  )
}