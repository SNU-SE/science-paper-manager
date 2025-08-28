"use client"

import * as React from "react"
import { X, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
  className?: string
  disabled?: boolean
  maxTags?: number
}

export function TagInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = "Add tags...",
  className,
  disabled = false,
  maxTags
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState("")
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = React.useState(-1)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Filter suggestions based on input and exclude already selected tags
  const filteredSuggestions = React.useMemo(() => {
    if (!inputValue.trim()) return []
    
    return suggestions
      .filter(suggestion => 
        suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
        !tags.includes(suggestion)
      )
      .slice(0, 10) // Limit to 10 suggestions
  }, [inputValue, suggestions, tags])

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim()
    if (
      trimmedTag && 
      !tags.includes(trimmedTag) && 
      (!maxTags || tags.length < maxTags)
    ) {
      onChange([...tags, trimmedTag])
      setInputValue("")
      setShowSuggestions(false)
      setFocusedSuggestionIndex(-1)
    }
  }

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove))
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        if (focusedSuggestionIndex >= 0 && filteredSuggestions[focusedSuggestionIndex]) {
          addTag(filteredSuggestions[focusedSuggestionIndex])
        } else if (inputValue.trim()) {
          addTag(inputValue)
        }
        break
        
      case 'ArrowDown':
        e.preventDefault()
        setFocusedSuggestionIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        )
        break
        
      case 'ArrowUp':
        e.preventDefault()
        setFocusedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
        break
        
      case 'Escape':
        setShowSuggestions(false)
        setFocusedSuggestionIndex(-1)
        break
        
      case 'Backspace':
        if (!inputValue && tags.length > 0) {
          removeTag(tags[tags.length - 1])
        }
        break
        
      case ',':
      case ';':
        e.preventDefault()
        if (inputValue.trim()) {
          addTag(inputValue)
        }
        break
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    setShowSuggestions(value.trim().length > 0)
    setFocusedSuggestionIndex(-1)
  }

  const handleInputFocus = () => {
    if (inputValue.trim()) {
      setShowSuggestions(true)
    }
  }

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => {
      setShowSuggestions(false)
      setFocusedSuggestionIndex(-1)
    }, 200)
  }

  return (
    <div className={cn("relative", className)}>
      {/* Tags and Input Container */}
      <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md min-h-[40px] bg-background">
        {/* Existing Tags */}
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="flex items-center gap-1 px-2 py-1"
          >
            <span>{tag}</span>
            {!disabled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeTag(tag)}
                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Badge>
        ))}

        {/* Input */}
        {(!maxTags || tags.length < maxTags) && (
          <div className="flex items-center gap-2 flex-1 min-w-[120px]">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder={tags.length === 0 ? placeholder : ""}
              disabled={disabled}
              className="border-0 p-0 h-auto focus-visible:ring-0 bg-transparent"
            />
            {inputValue.trim() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addTag(inputValue)}
                disabled={disabled}
                className="h-6 w-6 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              onClick={() => addTag(suggestion)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                index === focusedSuggestionIndex && "bg-accent text-accent-foreground"
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Max tags indicator */}
      {maxTags && (
        <div className="text-xs text-muted-foreground mt-1">
          {tags.length}/{maxTags} tags
        </div>
      )}
    </div>
  )
}