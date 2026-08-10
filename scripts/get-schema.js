// Script to get actual schema from Supabase database
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://jfdrzjueqfxvozwcsyhm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZHJ6anVlcWZ4dm96d2NzeWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3ODkwODAsImV4cCI6MjA3MDM2NTA4MH0.5ZhzDG5xAc-xH6GsKMeuMkuwRlCeeNcIr6kCGuq-NDE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getSchema() {
  console.log('Fetching schema from Supabase...\n');

  // Query to get all OnTrack-related tables
  const { data: tables, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        table_schema,
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema IN ('public', 'track')
        AND table_name IN (
          'activities', 'courses', 'tasks', 'work_patterns',
          'schools', 'school_calendars', 'work_schedule',
          'student_insights', 'student_school_years', 'school_years',
          'kids', 'kid_relations'
        )
      ORDER BY table_schema, table_name, ordinal_position;
    `
  });

  if (error) {
    console.error('Error fetching schema:', error);

    // Fallback: Just list tables
    console.log('\nTrying alternative method...\n');
    const { data: tableList } = await supabase.rpc('exec_sql', {
      query: `
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema IN ('public', 'track')
        ORDER BY table_schema, table_name;
      `
    });

    if (tableList) {
      console.log('Available tables:');
      console.log(JSON.stringify(tableList, null, 2));
    }
    return;
  }

  // Group by table
  const schemaByTable = {};
  tables.forEach(col => {
    const key = `${col.table_schema}.${col.table_name}`;
    if (!schemaByTable[key]) {
      schemaByTable[key] = [];
    }
    schemaByTable[key].push(col);
  });

  // Output schema
  let output = '-- OnTrack Database Schema (from Supabase)\n\n';

  for (const [tableName, columns] of Object.entries(schemaByTable)) {
    output += `-- Table: ${tableName}\n`;
    output += `CREATE TABLE ${tableName} (\n`;

    columns.forEach((col, idx) => {
      const nullable = col.is_nullable === 'YES' ? '' : ' NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      const comma = idx < columns.length - 1 ? ',' : '';

      output += `  ${col.column_name} ${col.data_type}${nullable}${defaultVal}${comma}\n`;
    });

    output += `);\n\n`;
  }

  // Save to file
  fs.writeFileSync('./ontrack-schema.sql', output);
  console.log('Schema saved to ontrack-schema.sql\n');
  console.log(output);
}

getSchema().catch(console.error);
