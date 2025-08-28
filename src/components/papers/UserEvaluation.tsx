"use client"

import * as React from "react"
import { Save, Edit, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StarRating } from "@/components/ui/star-rating"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { TagInput } from "@/components/ui/tag-input"
import { ReadingStatus } from "@/components/ui/reading-status"
import { useToast } from "@/hooks/use-toast"
import { UserEvaluation as UserEvaluationType, Paper } from "@/types"
import { cn } from "@/lib/utils"

interface UserEvaluationProps {
  paper: Paper
  evaluation?: UserEvaluationType
  onSave: (evaluation: Partial<UserEvaluationType>) => Promise<void>
  tagSuggestions?: string[]
  className?: string
}

export function UserEvaluation({
  paper,
  evaluation,
  onSave,
  tagSuggestions = [],
  className
}: UserEvaluationProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = React.useState(!evaluation)
  const [isSaving, setIsSaving] = React.useState(false)
  
  // Form state
  const [rating, setRating] = React.useState(evaluation?.rating || 0)
  const [notes, setNotes] = React.useState(evaluation?.notes || "")
  const [tags, setTags] = React.useState<string[]>(evaluation?.tags || [])
  const [readingStatus, setReadingStatus] = React.useState<'unread' | 'reading' | 'completed'>(
    paper.readingStatus
  )

  // Reset form when evaluation changes
  React.useEffect(() => {
    if (evaluation) {
      setRating(evaluation.rating || 0)
      setNotes(evaluation.notes || "")
      setTags(evaluation.tags || [])
      setIsEditing(false)
    }
  }, [evaluation])

  React.useEffect(() => {
    setReadingStatus(paper.readingStatus)
  }, [paper.readingStatus])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const evaluationData: Partial<UserEvaluationType> = {
        paperId: paper.id,
        rating: rating > 0 ? rating : undefined,
        notes: notes.trim() || undefined,
        tags,
        updatedAt: new Date()
      }

      if (!evaluation) {
        evaluationData.id = crypto.randomUUID()
        evaluationData.createdAt = new Date()
      }

      await onSave(evaluationData)
      setIsEditing(false)
      
      toast({
        title: "Evaluation saved",
        description: "Your evaluation has been saved successfully."
      })
    } catch (error) {
      console.error('Failed to save evaluation:', error)
      toast({
        title: "Error",
        description: "Failed to save evaluation. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (evaluation) {
      setRating(evaluation.rating || 0)
      setNotes(evaluation.notes || "")
      setTags(evaluation.tags || [])
    } else {
      setRating(0)
      setNotes("")
      setTags([])
    }
    setIsEditing(false)
  }

  const hasChanges = React.useMemo(() => {
    if (!evaluation) {
      return rating > 0 || notes.trim() || tags.length > 0
    }
    
    return (
      rating !== (evaluation.rating || 0) ||
      notes !== (evaluation.notes || "") ||
      JSON.stringify(tags.sort()) !== JSON.stringify((evaluation.tags || []).sort())
    )
  }, [rating, notes, tags, evaluation])

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">My Evaluation</CardTitle>
        <div className="flex items-center gap-2">
          <ReadingStatus
            status={readingStatus}
            onChange={setReadingStatus}
            variant="compact"
          />
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
              >
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Rating */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Rating</label>
          <StarRating
            value={rating}
            onChange={setRating}
            readonly={!isEditing}
            size="lg"
          />
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Tags</label>
          <TagInput
            tags={tags}
            onChange={setTags}
            suggestions={tagSuggestions}
            disabled={!isEditing}
            placeholder="Add tags to categorize this paper..."
            maxTags={10}
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Notes</label>
          {isEditing ? (
            <RichTextEditor
              value={notes}
              onChange={setNotes}
              placeholder="Add your thoughts, insights, or questions about this paper..."
              disabled={isSaving}
            />
          ) : (
            <div className="min-h-[100px] p-3 border rounded-md bg-muted/50">
              {notes ? (
                <div className="prose prose-sm max-w-none">
                  {notes.split('\n').map((line, index) => (
                    <p key={index} className="mb-2 last:mb-0">
                      {line || '\u00A0'}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic">
                  No notes added yet.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Metadata */}
        {evaluation && (
          <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
            <p>Created: {evaluation.createdAt.toLocaleDateString()}</p>
            {evaluation.updatedAt && evaluation.updatedAt !== evaluation.createdAt && (
              <p>Updated: {evaluation.updatedAt.toLocaleDateString()}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}