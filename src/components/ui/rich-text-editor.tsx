"use client"

import * as React from "react"
import { Bold, Italic, List, ListOrdered, Quote, Undo, Redo } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Add your notes...",
  className,
  disabled = false
}: RichTextEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [history, setHistory] = React.useState<string[]>([value])
  const [historyIndex, setHistoryIndex] = React.useState(0)

  // Save to history when value changes (debounced)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (value !== history[historyIndex]) {
        const newHistory = history.slice(0, historyIndex + 1)
        newHistory.push(value)
        setHistory(newHistory)
        setHistoryIndex(newHistory.length - 1)
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [value, history, historyIndex])

  const insertText = (before: string, after: string = "") => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    
    const newText = 
      value.substring(0, start) + 
      before + selectedText + after + 
      value.substring(end)
    
    onChange(newText)
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + before.length,
        end + before.length
      )
    }, 0)
  }

  const insertAtCursor = (text: string) => {
    if (!textareaRef.current) return

    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    
    const newText = 
      value.substring(0, start) + 
      text + 
      value.substring(end)
    
    onChange(newText)
    
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + text.length, start + text.length)
    }, 0)
  }

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      onChange(history[newIndex])
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      onChange(history[newIndex])
    }
  }

  const formatButtons = [
    {
      icon: Bold,
      label: "Bold",
      action: () => insertText("**", "**"),
      shortcut: "Ctrl+B"
    },
    {
      icon: Italic,
      label: "Italic", 
      action: () => insertText("*", "*"),
      shortcut: "Ctrl+I"
    },
    {
      icon: Quote,
      label: "Quote",
      action: () => insertAtCursor("> "),
      shortcut: "Ctrl+Q"
    },
    {
      icon: List,
      label: "Bullet List",
      action: () => insertAtCursor("- "),
      shortcut: "Ctrl+L"
    },
    {
      icon: ListOrdered,
      label: "Numbered List", 
      action: () => insertAtCursor("1. "),
      shortcut: "Ctrl+Shift+L"
    }
  ]

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault()
          insertText("**", "**")
          break
        case 'i':
          e.preventDefault()
          insertText("*", "*")
          break
        case 'q':
          e.preventDefault()
          insertAtCursor("> ")
          break
        case 'l':
          e.preventDefault()
          if (e.shiftKey) {
            insertAtCursor("1. ")
          } else {
            insertAtCursor("- ")
          }
          break
        case 'z':
          e.preventDefault()
          if (e.shiftKey) {
            redo()
          } else {
            undo()
          }
          break
      }
    }
  }

  return (
    <div className={cn("border rounded-md", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-muted/50">
        {formatButtons.map((button) => (
          <Button
            key={button.label}
            variant="ghost"
            size="sm"
            onClick={button.action}
            disabled={disabled}
            title={`${button.label} (${button.shortcut})`}
            className="h-8 w-8 p-0"
          >
            <button.icon className="h-4 w-4" />
          </Button>
        ))}
        
        <div className="w-px h-6 bg-border mx-1" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={undo}
          disabled={disabled || historyIndex === 0}
          title="Undo (Ctrl+Z)"
          className="h-8 w-8 p-0"
        >
          <Undo className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={redo}
          disabled={disabled || historyIndex === history.length - 1}
          title="Redo (Ctrl+Shift+Z)"
          className="h-8 w-8 p-0"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[200px] border-0 resize-none focus-visible:ring-0"
      />
    </div>
  )
}