'use client'

import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'

interface ProgressIndicatorProps {
  value: number
  max?: number
  className?: string
  showPercentage?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function ProgressIndicator({ 
  value, 
  max = 100, 
  className, 
  showPercentage = true,
  size = 'md' 
}: ProgressIndicatorProps) {
  const percentage = Math.round((value / max) * 100)
  
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Progress 
        value={percentage} 
        className={cn('w-full', sizeClasses[size])}
      />
      {showPercentage && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{value} / {max}</span>
          <span>{percentage}%</span>
        </div>
      )}
    </div>
  )
}

interface StepProgressProps {
  steps: Array<{
    id: string
    label: string
    status: 'pending' | 'in-progress' | 'completed' | 'error'
    description?: string
  }>
  currentStep?: string
  className?: string
}

export function StepProgress({ steps, currentStep, className }: StepProgressProps) {
  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'in-progress':
        return <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />
    }
  }

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 border-green-600'
      case 'error':
        return 'text-red-600 border-red-600'
      case 'in-progress':
        return 'text-blue-600 border-blue-600'
      default:
        return 'text-gray-400 border-gray-300'
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-start space-x-3">
          <div className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full border-2',
            getStepColor(step.status)
          )}>
            {getStepIcon(step.status)}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm font-medium',
              step.status === 'completed' ? 'text-green-600' :
              step.status === 'error' ? 'text-red-600' :
              step.status === 'in-progress' ? 'text-blue-600' :
              'text-gray-500'
            )}>
              {step.label}
            </p>
            {step.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {step.description}
              </p>
            )}
          </div>
          {index < steps.length - 1 && (
            <div className="absolute left-4 mt-8 w-0.5 h-6 bg-gray-300" />
          )}
        </div>
      ))}
    </div>
  )
}

interface CircularProgressProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  className?: string
  showValue?: boolean
}

export function CircularProgress({ 
  value, 
  max = 100, 
  size = 120, 
  strokeWidth = 8,
  className,
  showValue = true 
}: CircularProgressProps) {
  const percentage = (value / max) * 100
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-primary transition-all duration-300 ease-in-out"
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  )
}