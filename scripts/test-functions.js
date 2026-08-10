// Quick test to verify PostgreSQL functions are deployed and accessible
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jfdrzjueqfxvozwcsyhm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmZHJ6anVlcWZ4dm96d2NzeWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3ODkwODAsImV4cCI6MjA3MDM2NTA4MH0.5ZhzDG5xAc-xH6GsKMeuMkuwRlCeeNcIr6kCGuq-NDE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFunctions() {
  console.log('Testing deployed PostgreSQL functions...\n');

  // Test 1: get_agenda_data
  console.log('1. Testing get_agenda_data...');
  try {
    const { data, error } = await supabase.rpc('get_agenda_data', {
      p_kid_id: 1,
      p_date: '2026-05-04'
    });

    if (error) {
      console.error('   ❌ Error:', error.message);
    } else {
      console.log('   ✅ Function works! Got', data?.length || 0, 'rows');
      if (data && data.length > 0) {
        console.log('   Data structure:', Object.keys(data[0]));
      }
    }
  } catch (err) {
    console.error('   ❌ Exception:', err.message);
  }

  // Test 2: get_planner_data
  console.log('\n2. Testing get_planner_data...');
  try {
    const { data, error } = await supabase.rpc('get_planner_data', {
      p_kid_id: 1,
      p_start_date: '2026-05-01',
      p_end_date: '2026-05-31'
    });

    if (error) {
      console.error('   ❌ Error:', error.message);
    } else {
      console.log('   ✅ Function works! Got', data?.length || 0, 'rows');
      if (data && data.length > 0) {
        console.log('   Data structure:', Object.keys(data[0]));
      }
    }
  } catch (err) {
    console.error('   ❌ Exception:', err.message);
  }

  console.log('\n✅ Function tests complete!');
}

testFunctions().catch(console.error);
