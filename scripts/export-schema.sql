-- Run this in Supabase SQL Editor to get the schema for OnTrack tables

-- Get table definitions
SELECT
  'CREATE TABLE ' || table_schema || '.' || table_name || ' (' || E'\n' ||
  string_agg(
    '  ' || column_name || ' ' || data_type ||
    CASE WHEN character_maximum_length IS NOT NULL
         THEN '(' || character_maximum_length || ')'
         ELSE '' END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN column_default IS NOT NULL
         THEN ' DEFAULT ' || column_default
         ELSE '' END,
    ',' || E'\n'
    ORDER BY ordinal_position
  ) || E'\n' || ');' || E'\n' AS create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'activities', 'courses', 'tasks', 'work_patterns',
    'schools', 'school_calendars', 'work_schedule',
    'student_insights', 'student_school_years', 'school_years'
  )
GROUP BY table_schema, table_name
ORDER BY table_name;
