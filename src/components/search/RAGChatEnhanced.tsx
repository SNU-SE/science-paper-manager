'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSearchStore } from '../../stores'
import { MessageCircle, Send, Loader2, User, Bot, FileText, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

export function RAGChatEnhanced() {
  const [input, setInput] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    ragMessages,
    isRagLoading,
    error,
    askRAG,
    clearRagMessages,
    clearError
  } = useSearchStore()

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [ragMessages])

  const handleSend = async () => {
    if (!input.trim() || isRagLoading) return
    
    const question = input.trim()
    setInput('')
    await askRAG(question)
    
    // Focus back on input
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClearChat = () => {
    clearRagMessages()
    clearError()
  }

  return (
    <div className="space-y-6">
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              RAG Chat
            </CardTitle>
            <div className="flex items-center gap-2">
              {ragMessages.length > 0 && (
                <Badge variant="outline">
                  {ragMessages.length} messages
                </Badge>
              )}
              {ragMessages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearChat}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Ask questions about your research papers. I'll search through your collection and provide contextual answers.
          </p>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col min-h-0">
          {/* Messages */}
          <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {ragMessages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <div className="text-gray-500 mb-2">
                    Start a conversation
                  </div>
                  <p className="text-sm text-gray-400 max-w-md mx-auto">
                    Ask questions like "What papers discuss machine learning applications in healthcare?" 
                    or "Summarize the key findings from my recent papers."
                  </p>
                </div>
              ) : (
                ragMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`flex gap-3 max-w-[80%] ${
                        message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {message.role === 'user' ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>

                      {/* Message Content */}
                      <div
                        className={`rounded-lg px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <div className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </div>
                        
                        {/* Sources */}
                        {message.sources && message.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-300">
                            <div className="text-xs font-medium mb-2 text-gray-600">
                              Sources:
                            </div>
                            <div className="space-y-1">
                              {message.sources.map((source, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 text-xs bg-white bg-opacity-20 rounded px-2 py-1"
                                >
                                  <FileText className="w-3 h-3" />
                                  <span className="truncate">
                                    {source.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Timestamp */}
                        <div
                          className={`text-xs mt-2 ${
                            message.role === 'user'
                              ? 'text-blue-100'
                              : 'text-gray-500'
                          }`}
                        >
                          {format(new Date(message.timestamp), 'HH:mm')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Loading indicator */}
              {isRagLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-gray-100 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-800">
                <strong>Error:</strong> {error}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="mt-4 flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Ask a question about your papers..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isRagLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isRagLoading}
              size="sm"
            >
              {isRagLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Quick suggestions */}
          {ragMessages.length === 0 && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 mb-2">Try asking:</div>
              <div className="flex flex-wrap gap-2">
                {[
                  "What are the main themes in my papers?",
                  "Which papers discuss methodology?",
                  "Summarize my recent research",
                  "What gaps exist in my collection?"
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    onClick={() => setInput(suggestion)}
                    className="text-xs h-7"
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}