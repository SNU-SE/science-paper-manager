'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Users, 
  Search, 
  Eye, 
  Ban, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Activity,
  Shield,
  Settings,
  RefreshCw
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface User {
  id: string
  email: string
  created_at: string
  last_sign_in_at?: string
  email_confirmed_at?: string
  is_active: boolean
  role: string
  metadata?: {
    full_name?: string
    avatar_url?: string
  }
}

interface UserActivity {
  userId: string
  email: string
  lastActivity: string
  sessionDuration: number
  actionsCount: number
  ipAddress: string
  userAgent: string
  apiUsage: {
    daily: number
    monthly: number
    limit: number
  }
  backgroundJobs: {
    total: number
    running: number
    failed: number
  }
}

interface UserStats {
  totalUsers: number
  activeUsers: number
  newUsersToday: number
  suspendedUsers: number
  topUsers: Array<{
    userId: string
    email: string
    activityScore: number
  }>
}

export function UserManagementDashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [userActivity, setUserActivity] = useState<UserActivity[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showUserDetails, setShowUserDetails] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadUsers(),
        loadUserActivity(),
        loadStats()
      ])
    } catch (error) {
      console.error('Failed to load user management data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load user management data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    const response = await fetch('/api/admin/users')
    if (response.ok) {
      const data = await response.json()
      setUsers(data.data)
    }
  }

  const loadUserActivity = async () => {
    const response = await fetch('/api/admin/users/activity')
    if (response.ok) {
      const data = await response.json()
      setUserActivity(data.data)
    }
  }

  const loadStats = async () => {
    const response = await fetch('/api/admin/users/stats')
    if (response.ok) {
      const data = await response.json()
      setStats(data.data)
    }
  }

  const suspendUser = async (userId: string) => {
    if (!confirm('Are you sure you want to suspend this user?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'POST'
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'User suspended successfully'
        })
        await loadUsers()
      } else {
        throw new Error('Failed to suspend user')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to suspend user',
        variant: 'destructive'
      })
    }
  }

  const activateUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/activate`, {
        method: 'POST'
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'User activated successfully'
        })
        await loadUsers()
      } else {
        throw new Error('Failed to activate user')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to activate user',
        variant: 'destructive'
      })
    }
  }

  const viewUserDetails = async (user: User) => {
    setSelectedUser(user)
    setShowUserDetails(true)
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.metadata?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (user: User) => {
    if (!user.is_active) {
      return <Badge variant="destructive">Suspended</Badge>
    }
    if (!user.email_confirmed_at) {
      return <Badge variant="secondary">Unverified</Badge>
    }
    return <Badge variant="default">Active</Badge>
  }

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      moderator: 'bg-blue-100 text-blue-800',
      user: 'bg-green-100 text-green-800'
    }
    return <Badge className={colors[role as keyof typeof colors] || ''}>{role}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage users, monitor activity, and handle security</p>
        </div>
        <Button onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeUsers}</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.newUsersToday}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Suspended</CardTitle>
              <Ban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.suspendedUsers}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">All Users</TabsTrigger>
          <TabsTrigger value="activity">User Activity</TabsTrigger>
          <TabsTrigger value="top">Top Users</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                View and manage all registered users
              </CardDescription>
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Users className="w-8 h-8 text-muted-foreground" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{user.email}</span>
                          {getStatusBadge(user)}
                          {getRoleBadge(user.role)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Joined: {new Date(user.created_at).toLocaleDateString()}
                        </div>
                        {user.last_sign_in_at && (
                          <div className="text-sm text-muted-foreground">
                            Last login: {new Date(user.last_sign_in_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewUserDetails(user)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                      {user.is_active ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => suspendUser(user.id)}
                        >
                          <Ban className="w-4 h-4 mr-1" />
                          Suspend
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => activateUser(user.id)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Activate
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Activity</CardTitle>
              <CardDescription>
                Monitor user activity and resource usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userActivity.map((activity) => (
                  <div key={activity.userId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Activity className="w-8 h-8 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{activity.email}</div>
                        <div className="text-sm text-muted-foreground">
                          Last activity: {new Date(activity.lastActivity).toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Session: {Math.floor(activity.sessionDuration / 60)}m • {activity.actionsCount} actions
                        </div>
                        <div className="flex items-center space-x-4 mt-2">
                          <div className="text-xs">
                            API: {activity.apiUsage.daily}/{activity.apiUsage.limit} daily
                          </div>
                          <div className="text-xs">
                            Jobs: {activity.backgroundJobs.running} running, {activity.backgroundJobs.failed} failed
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline">
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Users</CardTitle>
              <CardDescription>
                Most active users by activity score
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.topUsers.map((user, index) => (
                  <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                      </div>
                      <div>
                        <div className="font-medium">{user.email}</div>
                        <div className="text-sm text-muted-foreground">
                          Activity Score: {user.activityScore}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary">Top User</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Details Dialog */}
      <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Detailed information about {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedUser)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Role</label>
                  <div className="mt-1">{getRoleBadge(selectedUser.role)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Joined</label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedUser.created_at).toLocaleString()}
                  </p>
                </div>
                {selectedUser.last_sign_in_at && (
                  <div>
                    <label className="text-sm font-medium">Last Login</label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(selectedUser.last_sign_in_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}