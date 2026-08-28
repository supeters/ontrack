export interface ChecklistItem {
  text: string;
  order: number;
  is_completed: boolean;
  planDate?: string;
}

/**
 * Helper to extract @YYYY-MM-DD or @YYYY/MM/DD dates from text
 */
function extractAndCleanDate(input: string): { cleanText: string; planDate?: string } {
  // Matches @YYYY-MM-DD, @YYYY/MM/DD, @MM-DD-YYYY, or @MM/DD/YYYY
  const dateRegex = /@(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/;
  const match = input.match(dateRegex);

  if (!match) {
    return { cleanText: input.trim() };
  }

  // Normalize slashes to hyphens (e.g., 2026/09/20 -> 2026-09-20)
  const planDate = match[1].replace(/\//g, '-');
  // Remove the @date string from the item text
  const cleanText = input.replace(dateRegex, '').replace(/\s+/g, ' ').trim();

  return { cleanText, planDate };
}

/**
 * Parse checklist from user input text
 * Lines starting with # begin new items
 * Subsequent lines without # are appended to the current item
 */
export function parseChecklistInput(input: string): ChecklistItem[] {
  if (!input || !input.trim()) return [];

  const lines = input.split('\n');
  const rawItems: string[] = [];
  let currentItem: string | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) continue; // Skip empty lines

    if (trimmedLine.startsWith('#')) {
      // New checklist item - save previous if exists
      if (currentItem !== null) {
        rawItems.push(currentItem.trim());
      }

      // Start new item (remove leading # and whitespace)
      currentItem = trimmedLine.substring(1).trim();
    } else if (currentItem !== null) {
      // Continuation of current item
      currentItem += ' ' + trimmedLine;
    }
  }

  // Save the last item
  if (currentItem !== null) {
    rawItems.push(currentItem.trim());
  }

  // Process each raw item to extract @date annotations
  return rawItems.map((rawText, index) => {
    const { cleanText, planDate } = extractAndCleanDate(rawText);

    return {
      text: cleanText,
      order: index,
      is_completed: false,
      planDate,
    };
  });
}