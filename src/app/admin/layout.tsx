'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  LayoutDashboard,
  Activity,
  Database,
  Shield,
  Users,
  BarChart3,
  Settings,
  HardDrive,
  Zap,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdminLayoutProps {
  children: React.ReactNode
}

const adminNavItems = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'System overview'
  },
  {
    title: 'Performance',
    href: '/admin/performance',
    icon: Activity,
    description: 'Performance monitoring'
  },
  {
    title: 'Health',
    href: '/admin/health',
    icon: CheckCircle,
    description: 'System health'
  },
  {
    title: 'Security',
    href: '/admin/security',
    icon: Shield,
    description: 'Security monitoring'
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: Users,
    description: 'User management'
  },
  {
    title: 'Jobs',
    href: '/admin/jobs',
    icon: Settings,
    description: 'Background jobs'
  },
  {
    title: 'Backup',
    href: '/admin/backup',
    icon: Database,
    description: 'Backup management'
  },
  {
    title: 'Cache',
    href: '/admin/cache',
    icon: Zap,
    description: 'Cache management'
  }
]

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-sm border-r min-h-screen">
          <div className="p-6">
            <div className="flex items-center space-x-2">
              <Settings className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              System Administration
            </p>
          </div>
          
          <Separator />
          
          <nav className="p-4 space-y-2">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              
              return (
                <Button
                  key={item.href}
                  variant={isActive ? 'default' : 'ghost'}
                  className={cn(
                    'w-full justify-start h-auto p-3',
                    isActive && 'bg-blue-50 text-blue-700 border-blue-200'
                  )}
                  onClick={() => router.push(item.href)}
                >
                  <Icon className="h-4 w-4 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                </Button>
              )
            })}
          </nav>
          
          <Separator className="my-4" />
          
          {/* Quick Status */}
          <div className="p-4">
            <h3 className="text-sm font-medium mb-3">Quick Status</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>System Status</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Healthy
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Active Users</span>
                <Badge variant="secondary">24</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Background Jobs</span>
                <Badge variant="secondary">3 running</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}