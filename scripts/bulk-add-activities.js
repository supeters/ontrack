// Run this script in the browser console while logged into OnTrack
// It will bulk-create activities for a specific module

const activities = [
  { title: "Presentation: Kinematics with Calculus", planDate: "2026-08-24", dueDate: null, type: "page" },
  { title: "Overview: Course Information", planDate: "2026-08-24", dueDate: null, type: "page" },
  { title: "Video Lab: Measurement*", planDate: "2026-08-24", dueDate: "2026-08-26", type: "video" },
  { title: "Presentation: Calculus for Physics", planDate: "2026-08-24", dueDate: null, type: "page" },
  { title: "Practice Problems: Calculus for Physics", planDate: "2026-08-24", dueDate: null, type: "assignment" },
  { title: "Presentation: Vectors and Scalars", planDate: "2026-08-24", dueDate: null, type: "page" },
  { title: "Virtual Activity: Working with Vectors", planDate: "2026-08-24", dueDate: null, type: "assignment" },
  { title: "Presentation: Unit Vectors and Vector Math", planDate: "2026-08-24", dueDate: null, type: "page" },
  { title: "Practice Problems: Vectors", planDate: "2026-08-24", dueDate: null, type: "assignment" },
  { title: "Live Session #1", planDate: "2026-08-24", dueDate: null, type: "discussion" },
  { title: "Presentation: Motion Studies", planDate: "2026-08-24", dueDate: null, type: "page" },
  { title: "Video Lab: Motion Studies", planDate: "2026-08-25", dueDate: null, type: "video" },
  { title: "Practice Problems: Motion Studies", planDate: "2026-08-25", dueDate: null, type: "assignment" },
  { title: "Presentation: Graphical Analysis of Motion", planDate: "2026-08-26", dueDate: null, type: "page" },
  { title: "Virtual Activity: Motion Graphs", planDate: "2026-08-26", dueDate: null, type: "assignment" },
  { title: "Practice Problems: Motion Graphs", planDate: "2026-08-26", dueDate: null, type: "assignment" },
  { title: "Presentation: Extremes and Inflections", planDate: "2026-08-27", dueDate: null, type: "page" },
  { title: "Practice Problems: Extremes and Inflections", planDate: "2026-08-27", dueDate: null, type: "assignment" },
  { title: "Quiz: #1", planDate: "2026-08-28", dueDate: "2026-08-31", type: "quiz" },
  { title: "Presentation: Constant Acceleration Kinematics", planDate: "2026-08-31", dueDate: null, type: "page" },
  { title: "Demonstration: Kinematics on the Moon", planDate: "2026-08-31", dueDate: null, type: "video" },
  { title: "Practice Problems: Kinematics", planDate: "2026-08-31", dueDate: null, type: "assignment" },
  { title: "Challenge Problems: Kinematics", planDate: "2026-08-31", dueDate: null, type: "assignment" },
  { title: "Presentation: Error Analysis", planDate: "2026-09-01", dueDate: null, type: "page" },
  { title: "Lab Activity: Kinematics *", planDate: "2026-09-01", dueDate: "2026-09-01", type: "assignment" },
  { title: "Presentation: Projectiles", planDate: "2026-09-02", dueDate: null, type: "page" },
  { title: "Virtual Activity: Projectiles", planDate: "2026-09-02", dueDate: null, type: "assignment" },
  { title: "Practice Problems: Projectiles", planDate: "2026-09-02", dueDate: null, type: "assignment" },
  { title: "Quiz: #2", planDate: "2026-09-03", dueDate: "2026-09-08", type: "quiz" },
  { title: "Presentation: Uniform Circular Motion", planDate: "2026-09-04", dueDate: null, type: "page" },
  { title: "Practice Problems: Uniform Circular Motion", planDate: "2026-09-04", dueDate: null, type: "assignment" },
  { title: "Labor Day Holiday", planDate: "2026-09-07", dueDate: null, type: "page" },
  { title: "Live Session #2", planDate: "2026-09-08", dueDate: null, type: "discussion" },
  { title: "Review: Unit 1C Mechanics", planDate: "2026-09-08", dueDate: null, type: "page" },
  { title: "Test: Unit 1C Mechanics", planDate: "2026-09-09", dueDate: "2026-09-11", type: "quiz" }
];

async function bulkAddActivities(moduleId, courseId, kidId) {
  console.log(`Starting bulk add of ${activities.length} activities...`);
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];

    const payload = {
      kidId,
      courseId,
      title: activity.title,
      activityType: activity.type,
      parentActivityId: moduleId,
      moduleId,
      position: i,
      planDate: activity.planDate,
      isActionable: true
    };

    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        successCount++;
        console.log(`✅ ${i + 1}/${activities.length}: ${activity.title}`);

        // If there's a due date, update it
        if (activity.dueDate) {
          const updateResponse = await fetch('/api/activities', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              activityId: result.id,
              updates: { end_time: activity.dueDate + 'T23:59:59' }
            })
          });

          if (updateResponse.ok) {
            console.log(`   📅 Due date set: ${activity.dueDate}`);
          }
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        failCount++;
        console.error(`❌ ${i + 1}/${activities.length}: ${activity.title}`, result.error);
      }
    } catch (error) {
      failCount++;
      console.error(`❌ ${i + 1}/${activities.length}: ${activity.title}`, error.message);
    }
  }

  console.log(`\n✅ Complete! Success: ${successCount}, Failed: ${failCount}`);
  return { successCount, failCount };
}

// Usage:
// bulkAddActivities(26686, 74, 1)
console.log('Bulk add script loaded. Run: bulkAddActivities(moduleId, courseId, kidId)');
console.log('Example: bulkAddActivities(26686, 74, 1)');
