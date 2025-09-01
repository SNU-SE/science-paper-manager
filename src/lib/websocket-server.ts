import { Server } from 'http'
import { WebSocketNotificationServer } from '@/services/notifications/WebSocketNotificationServer'
import { getNotificationService } from '@/services/notifications/NotificationService'

let wsServer: WebSocketNotificationServer | null = null

export function initializeWebSocketServer(httpServer: Server) {
  if (wsServer) {
    console.log('WebSocket server already initialized')
    return wsServer
  }

  try {
    const notificationService = getNotificationService()
    wsServer = new WebSocketNotificationServer(httpServer, notificationService)
    
    console.log('WebSocket server initialized successfully')
    return wsServer
  } catch (error) {
    console.error('Failed to initialize WebSocket server:', error)
    return null
  }
}

export function getWebSocketServer(): WebSocketNotificationServer | null {
  return wsServer
}

export async function shutdownWebSocketServer() {
  if (wsServer) {
    await wsServer.shutdown()
    wsServer = null
    console.log('WebSocket server shut down')
  }
}