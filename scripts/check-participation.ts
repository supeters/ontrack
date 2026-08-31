#!/usr/bin/env node

/**
 * Debug script to check Participation Assessment assignments
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getServiceRoleClient } from '../lib/supabase/service';

async function checkParticipationAssignments() {
  const supabase = getServiceRoleClient();

  const courseId = 50; // Precalculus/Trignometry (H)

  console.log(`🔍 Checking Participation Assessments for course ${courseId}...\n`);

  // Get all activities that match the pattern
  const { data: activities, error } = await supabase
    .from('activities')
    .select('*')
    .eq('course_id', courseId)
    .ilike('title', '%Participation%Assessment%Week%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${activities?.length || 0} activities\n`);

  if (activities && activities.length > 0) {
    activities.forEach((a: any) => {
      const match = a.title.match(/^Participation (Assessment|Assignment)\s+Week\s+(\d+)/i);
      const matchesPattern = match ? '✅ MATCHES' : '❌ NO MATCH';

      console.log(`${matchesPattern}: "${a.title}"`);
      console.log(`  ID: ${a.id}`);
      console.log(`  activity_type: ${a.activity_type}`);
      console.log(`  is_action: ${a.is_action}`);
      console.log(`  is_pinned: ${a.is_pinned}`);
      console.log(`  item_needs_processing: ${a.item_needs_processing}`);
      console.log(`  plan_date: ${a.plan_date}`);
      console.log(`  parent_activity_id: ${a.parent_activity_id}`);
      console.log();
    });
  }

  // Also check the parent module
  console.log('\n📦 Checking parent module...\n');
  const { data: module } = await supabase
    .from('activities')
    .select('*')
    .eq('course_id', courseId)
    .ilike('title', '%Participation%')
    .eq('activity_type', 'module')
    .single();

  if (module) {
    console.log(`Module: "${module.title}"`);
    console.log(`  ID: ${module.id}`);
    console.log(`  activity_type: ${module.activity_type}`);
    console.log(`  position: ${module.position}`);
  }
}

checkParticipationAssignments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
