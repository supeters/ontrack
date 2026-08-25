/**
 * Parse checklist items from user input
 * Each line beginning with # becomes a separate checklist item
 *
 * Example input:
 * # read xyz
 * book of odyssey
 *
 * # memorize poem
 * write a essay
 *
 * Becomes 2 items: "read xyz book of odyssey" and "memorize poem write a essay"
 */

export interface ChecklistItem {
  text: string;
  order: number;
  is_completed: boolean;
}

/**
 * Parse checklist from user input text
 * Lines starting with # begin new items
 * Subsequent lines without # are appended to the current item
 */
export function parseChecklistInput(input: string): ChecklistItem[] {
  if (!input || !input.trim()) return [];

  const lines = input.split('\n');
  const items: ChecklistItem[] = [];
  let currentItem: string | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) continue; // Skip empty lines

    if (trimmedLine.startsWith('#')) {
      // New checklist item - save previous if exists
      if (currentItem !== null) {
        items.push({
          text: currentItem.trim(),
          order: items.length,
          is_completed: false
        });
      }

      // Start new item (remove leading # and whitespace)
      currentItem = trimmedLine.substring(1).trim();
    } else if (currentItem !== null) {
      // Continuation of current item
      currentItem += ' ' + trimmedLine;
    }
    // If line doesn't start with # and no current item, ignore it
  }

  // Don't forget the last item
  if (currentItem !== null) {
    items.push({
      text: currentItem.trim(),
      order: items.length,
      is_completed: false
    });
  }

  return items;
}
