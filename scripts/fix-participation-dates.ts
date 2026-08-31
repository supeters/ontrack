#!/usr/bin/env node

/**
 * Force recalculation of Participation Assessment dates
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getServiceRoleClient } from '../lib/supabase/service';

async function fixParticipationDates() {
  const supabase = getServiceRoleClient();

  const courseId = 50; // Precalculus/Trignometry (H)

  console.log(`🔧 Fixing Participation Assessment dates for course ${courseId}...\n`);

  // Set item_needs_processing = true for all Participation Assessment Week N assignments
  const { data, error } = await supabase
    .from('activities')
    .update({ item_needs_processing: true })
    .eq('course_id', courseId)
    .eq('activity_type', 'assignment')
    .ilike('title', 'Participation Assessment Week%')
    .select('id, title, plan_date');

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`✅ Updated ${data?.length || 0} assignments to need processing:\n`);

  if (data) {
    data.forEach((a: any) => {
      console.log(`  • ${a.title} (current: ${a.plan_date})`);
    });
  }

  console.log('\n📅 Now run the calculate-dates to recalculate:');
  console.log('   npx tsx scripts/sync-courses.ts --course-id 50\n');
}

fixParticipationDates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
