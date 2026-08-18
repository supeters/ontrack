/**
 * Parse daily checklist from activity description
 * Supports patterns like:
 * - "Day 1:", "Day 2:", etc.
 * - "Monday", "Tuesday", etc.
 */

export interface ChecklistItem {
  label: string;
  tasks: string;
  completed: boolean;
}

export type DailyChecklist = Record<string, ChecklistItem>;

/**
 * Parse description text for daily patterns
 */
export function parseChecklist(description: string): DailyChecklist | null {
  if (!description) return null;

  // Remove HTML tags for parsing
  const plainText = description.replace(/<[^>]*>/g, '\n').trim();

  // Try "Day X:" pattern first
  // Replace line 26 in lib/parseChecklist.ts with this:
  const dayNumberPattern = /Day\s+(\d+)[:\-\s]+((?:(?!Day\s+\d+)[\s\S])+)/gi;
  const dayMatches = [...plainText.matchAll(dayNumberPattern)];

  if (dayMatches.length > 0) {
    const checklist: DailyChecklist = {};
    dayMatches.forEach((match) => {
      const dayNum = match[1];
      const tasks = match[2].trim();
      checklist[`day${dayNum}`] = {
        label: `Day ${dayNum}`,
        tasks,
        completed: false
      };
    });
    return checklist;
  }

  // Try weekday pattern: Monday, Tuesday, etc.
// Replace line 45 with this:
  const weekdayPattern = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[:\-\s]+((?:(?!(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))[\s\S])+)/gi;
  const weekdayMatches = [...plainText.matchAll(weekdayPattern)];

  if (weekdayMatches.length > 0) {
    const checklist: DailyChecklist = {};
    weekdayMatches.forEach((match, index) => {
      const weekday = match[1];
      const tasks = match[2].trim();
      checklist[`day${index + 1}`] = {
        label: weekday,
        tasks,
        completed: false
      };
    });
    return checklist;
  }

  return null;
}

/**
 * Merge existing checklist completion state with newly parsed checklist
 */
export function mergeChecklistState(
  existingChecklist: DailyChecklist | null,
  newlyParsed: DailyChecklist | null
): DailyChecklist | null {
  if (!newlyParsed) return existingChecklist;
  if (!existingChecklist) return newlyParsed;

  // Preserve completion state from existing checklist
  const merged: DailyChecklist = { ...newlyParsed };
  Object.keys(merged).forEach((key) => {
    if (existingChecklist[key]?.completed) {
      merged[key].completed = true;
    }
  });

  return merged;
}
