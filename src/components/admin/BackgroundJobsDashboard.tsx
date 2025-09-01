'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  Settings, 
  Play, 
  Pause, 
  XCircle, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Eye,
  RefreshCw,
  BarChart3,
  Activity,
  Search
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface BackgroundJob {
  id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority: number
  progress: number
  data: any
  result?: any
  error_message?: string
  attempts: number
  max_attempts: number
  created_at: string
  started_at?: string
  completed_at?: string
  user_id?: string
  user_email?: string
}

interface JobStats {
  total: number
  pending: number
  running: number
  completed: number
  failed: number
  cancelled: number
  avgDuration: number
  successRate: number
}

interface QueueStats {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: boolean
}

export function BackgroundJobsDashboard() {
  const [jobs, setJobs] = useState<BackgroundJob[]>([])
  const [jobStats, setJobStats] = useState<JobStats | null>(null)
  const [queueStats, setQueueStats] = useState<QueueStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedJob, setSelectedJob] = useState<BackgroundJob | null>(null)
  const [showJobDetails, setShowJobDetails] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadJobs(),
        loadJobStats(),
        loadQueueStats()
      ])
    } catch (error) {
      console.error('Failed to load background jobs data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load background jobs data',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const loadJobs = async () => {
    const params = new URLSearchParams({
      limit: '50',
      status: statusFilter === 'all' ? '' : statusFilter
    })

    const response = await fetch(`/api/jobs?${params}`)
    if (response.ok) {
      const data = await response.json()
      setJobs(data.data)
    }
  }

  const loadJobStats = async () => {
    const response = await fetch('/api/jobs/stats')
    if (response.ok) {
      const data = await response.json()
      setJobStats(data.data)
    }
  }

  const loadQueueStats = async () => {
    const response = await fetch('/api/jobs/queues/stats')
    if (response.ok) {
      const data = await response.json()
      setQueueStats(data.data)
    }
  }

  const retryJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST'
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Job queued for retry'
        })
        await loadJobs()
      } else {
        throw new Error('Failed to retry job')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to retry job',
        variant: 'destructive'
      })
    }
  }

  const cancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to cancel this job?')) {
      return
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST'
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Job cancelled successfully'
        })
        await loadJobs()
      } else {
        throw new Error('Failed to cancel job')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel job',
        variant: 'destructive'
      })
    }
  }

  const pauseQueue = async (queueName: string) => {
    try {
      const response = await fetch(`/api/jobs/queues/${queueName}/pause`, {
        method: 'POST'
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Queue ${queueName} paused`
        })
        await loadQueueStats()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to pause queue',
        variant: 'destructive'
      })
    }
  }

  const resumeQueue = async (queueName: string) => {
    try {
      const response = await fetch(`/api/jobs/queues/${queueName}/resume`, {
        method: 'POST'
      })

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Queue ${queueName} resumed`
        })
        await loadQueueStats()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resume queue',
        variant: 'destructive'
      })
    }
  }

  const viewJobDetails = (job: BackgroundJob) => {
    setSelectedJob(job)
    setShowJobDetails(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case 'running':
        return <Badge variant="default" className="bg-blue-100 text-blue-800"><Activity className="w-3 h-3 mr-1" />Running</Badge>
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
      case 'cancelled':
        return <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPriorityBadge = (priority: number) => {
    if (priority >= 10) return <Badge variant="destructive">High</Badge>
    if (priority >= 5) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Medium</Badge>
    return <Badge variant="secondary">Low</Badge>
  }

  const filteredJobs = jobs.filter(job =>
    job.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date()
    const duration = end.getTime() - start.getTime()
    
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  if (loading && jobs.length === 0) {
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
          <h1 className="text-3xl font-bold">Background Jobs</h1>
          <p className="text-muted-foreground">Monitor and manage background processing tasks</p>
        </div>
        <Button onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      {jobStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{jobStats.total}</div>
              <p className="text-xs text-muted-foreground">
                Success rate: {jobStats.successRate}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Running</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{jobStats.running}</div>
              <p className="text-xs text-muted-foreground">
                {jobStats.pending} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{jobStats.completed}</div>
              <p className="text-xs text-muted-foreground">
                {jobStats.failed} failed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(jobStats.avgDuration / 1000)}s</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs">Job History</TabsTrigger>
          <TabsTrigger value="queues">Queue Status</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Background Jobs</CardTitle>
              <CardDescription>
                Monitor and manage background processing tasks
              </CardDescription>
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border rounded-md"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Settings className="w-8 h-8 text-muted-foreground" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{job.type}</span>
                          {getStatusBadge(job.status)}
                          {getPriorityBadge(job.priority)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Created: {new Date(job.created_at).toLocaleString()}
                          {job.user_email && ` • User: ${job.user_email}`}
                        </div>
                        {job.status === 'running' && (
                          <div className="mt-2">
                            <Progress value={job.progress} className="w-48" />
                            <span className="text-xs text-muted-foreground">{job.progress}%</span>
                          </div>
                        )}
                        {job.error_message && (
                          <div className="text-sm text-red-600 mt-1">
                            Error: {job.error_message}
                          </div>
                        )}
                        {job.started_at && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Duration: {formatDuration(job.started_at, job.completed_at)}
                            {job.attempts > 1 && ` • Attempt ${job.attempts}/${job.max_attempts}`}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewJobDetails(job)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                      {job.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryJob(job.id)}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Retry
                        </Button>
                      )}
                      {job.status === 'running' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelJob(job.id)}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queues" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {queueStats.map((queue) => (
              <Card key={queue.name}>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{queue.name}</span>
                    {queue.paused ? (
                      <Badge variant="secondary">Paused</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Active:</span>
                      <span>{queue.active}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Waiting:</span>
                      <span>{queue.waiting}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Completed:</span>
                      <span>{queue.completed}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Failed:</span>
                      <span>{queue.failed}</span>
                    </div>
                    {queue.delayed > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Delayed:</span>
                        <span>{queue.delayed}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex space-x-2">
                    {queue.paused ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resumeQueue(queue.name)}
                        className="flex-1"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Resume
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => pauseQueue(queue.name)}
                        className="flex-1"
                      >
                        <Pause className="w-4 h-4 mr-1" />
                        Pause
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Job Details Dialog */}
      <Dialog open={showJobDetails} onOpenChange={setShowJobDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Job Details</DialogTitle>
            <DialogDescription>
              Detailed information about job {selectedJob?.id}
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Job ID</label>
                  <p className="text-sm text-muted-foreground font-mono">{selectedJob.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <p className="text-sm text-muted-foreground">{selectedJob.type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedJob.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <div className="mt-1">{getPriorityBadge(selectedJob.priority)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Progress</label>
                  <div className="mt-1">
                    <Progress value={selectedJob.progress} className="w-full" />
                    <span className="text-xs text-muted-foreground">{selectedJob.progress}%</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Attempts</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedJob.attempts} / {selectedJob.max_attempts}
                  </p>
                </div>
              </div>
              
              {selectedJob.error_message && (
                <div>
                  <label className="text-sm font-medium">Error Message</label>
                  <Alert variant="destructive" className="mt-1">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{selectedJob.error_message}</AlertDescription>
                  </Alert>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Job Data</label>
                <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-32">
                  {JSON.stringify(selectedJob.data, null, 2)}
                </pre>
              </div>

              {selectedJob.result && (
                <div>
                  <label className="text-sm font-medium">Result</label>
                  <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-32">
                    {JSON.stringify(selectedJob.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}