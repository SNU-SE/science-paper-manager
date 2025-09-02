-- Migration 014: Papers RLS for multi-user ownership
-- Description: Add created_by column and RLS policies so users only see/manage their own papers

-- 1) Add owner column with default to current auth user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'papers' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE papers ADD COLUMN created_by UUID;
  END IF;
END $$;

-- Set default owner to current user on insert (when authenticated)
ALTER TABLE papers ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Backfill existing rows to a neutral value if needed (optional)
-- UPDATE papers SET created_by = created_by WHERE created_by IS NULL;

-- Ensure NOT NULL going forward
ALTER TABLE papers ALTER COLUMN created_by SET NOT NULL;

-- 2) Enable RLS on papers
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;

-- 3) Drop any previous conflicting policies
DROP POLICY IF EXISTS "papers_select_own" ON papers;
DROP POLICY IF EXISTS "papers_insert_own" ON papers;
DROP POLICY IF EXISTS "papers_update_own" ON papers;
DROP POLICY IF EXISTS "papers_delete_own" ON papers;
DROP POLICY IF EXISTS "Users can view own papers" ON papers;

-- 4) Create ownership-based policies
-- SELECT: only rows created by the authenticated user
CREATE POLICY "papers_select_own"
  ON papers FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- INSERT: allow insert only if created_by matches current user
CREATE POLICY "papers_insert_own"
  ON papers FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: only update own rows
CREATE POLICY "papers_update_own"
  ON papers FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE: only delete own rows
CREATE POLICY "papers_delete_own"
  ON papers FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Note: If you have an admin role table and want admin bypass, add OR conditions accordingly.

