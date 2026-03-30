-- Migration: Create user-memory storage bucket with RLS policies
-- Description: Storage for user-specific agent memory (contexts, workflows, SOUL.md)
-- Date: 2026-03-27

-- ============================================================================
-- Create user-memory bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-memory',
  'user-memory',
  false, -- Private bucket (authenticated users only)
  5242880, -- 5MB limit per file
  ARRAY['text/markdown', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Enable Row Level Security on storage.objects
-- ============================================================================

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies: Users can only access their own memory files
-- ============================================================================

-- Policy: Users can read their own memory files
CREATE POLICY "Users read own memory"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'user-memory' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can write their own memory files
CREATE POLICY "Users write own memory"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-memory'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can update their own memory files
CREATE POLICY "Users update own memory"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'user-memory'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can delete their own memory files
CREATE POLICY "Users delete own memory"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-memory'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- Verification queries (run manually to verify)
-- ============================================================================

-- Verify bucket created
-- SELECT * FROM storage.buckets WHERE id = 'user-memory';

-- Verify RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects';

-- List policies
-- SELECT policyname, cmd, qual FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%memory%';
