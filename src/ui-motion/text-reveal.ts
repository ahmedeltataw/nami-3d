/**
 * Text reveal utilities.
 *
 * CRITICAL RULE: Word-level splitting only.
 * Arabic letters MUST NEVER be split into characters, as that breaks cursive script
 * ligatures and rendering.
 */

export function splitWords(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/);
}
