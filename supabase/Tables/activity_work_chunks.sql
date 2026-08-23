-- activity_work_chunks table for tracking work sessions
-- This allows students to track time in multiple sessions with reflections

CREATE TABLE IF NOT EXISTS public.activity_work_chunks (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  kid_id INTEGER NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
  
  -- Time tracking
  start_time TIMESTAMPTZ,  -- NULL for manual entries
  end_time TIMESTAMPTZ,    -- NULL for manual entries
  minutes_worked INTEGER NOT NULL,
  
  -- Session state
  is_active BOOLEAN DEFAULT false,
  is_manual BOOLEAN DEFAULT false,
  
  -- Session reflection
  mood TEXT,  -- 'struggled', 'okay', 'good', 'great', 'focused'
  notes TEXT, -- Student's reflection notes
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_work_chunks_activity ON public.activity_work_chunks(activity_id);
CREATE INDEX idx_work_chunks_kid ON public.activity_work_chunks(kid_id);
CREATE INDEX idx_work_chunks_active ON public.activity_work_chunks(is_active) WHERE is_active = true;

-- Comments
COMMENT ON TABLE public.activity_work_chunks IS 
  'Tracks individual work sessions on activities with time and student reflections';

COMMENT ON COLUMN public.activity_work_chunks.mood IS 
  'Student mood during session: struggled, okay, good, great, focused';

COMMENT ON COLUMN public.activity_work_chunks.notes IS 
  'Student reflection notes about the session';

COMMENT ON COLUMN public.activity_work_chunks.is_manual IS 
  'True if time was entered manually (not from timer)';

-- RLS Policies
ALTER TABLE public.activity_work_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage work chunks for their kids" ON public.activity_work_chunks
  FOR ALL
  USING (
    kid_id IN (
      SELECT id FROM public.kids WHERE user_id = auth.uid()
    ) OR
    kid_id IN (
      SELECT k.id 
      FROM public.kids k
      JOIN public.family_relationships fr ON k.user_id = fr.child_user_id
      WHERE fr.parent_user_id = auth.uid()
    )
  );
