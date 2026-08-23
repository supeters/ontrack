-- Fix minutes_worked to allow NULL values
-- This is needed because chunks are created when timer starts (no minutes yet)
-- and minutes are calculated when timer is paused/stopped

ALTER TABLE public.activity_work_chunks
ALTER COLUMN minutes_worked DROP NOT NULL;
