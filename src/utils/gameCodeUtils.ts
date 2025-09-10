/**
 * Normalize game code to standard format with pattern matching variations
 * Used for fuzzy matching in Find Game, URL routing, and game lookups
 */
export const normalizeGameCode = (code: string): string[] => {
  if (!code) return [];
  
  const cleaned = code.toUpperCase().trim();
  const variations = [cleaned];
  
  // If has dash, try without it
  if (cleaned.includes('-')) {
    variations.push(cleaned.replace('-', ''));
  }
  
  // If no dash but has letters and numbers, try adding dash
  if (!cleaned.includes('-') && /^[A-Z0-9]+$/.test(cleaned) && cleaned.length > 3) {
    // Try common dash positions for game codes like ABC123 -> ABC-123
    for (let i = 2; i <= Math.min(4, cleaned.length - 2); i++) {
      const withDash = cleaned.substring(0, i) + '-' + cleaned.substring(i);
      variations.push(withDash);
    }
  }
  
  return variations;
};

/**
 * Check if a string looks like a valid game code pattern
 */
export const isValidGameCodePattern = (code: string): boolean => {
  if (!code || code.length < 3 || code.length > 10) return false;
  
  const cleaned = code.toUpperCase().trim();
  
  // Allow alphanumeric with optional dash
  return /^[A-Z0-9]+(-[A-Z0-9]+)?$/.test(cleaned);
};

/**
 * Extract game code from URL or user input
 */
export const extractGameCode = (input: string): string | null => {
  if (!input) return null;
  
  const cleaned = input.trim();
  
  // If it looks like a URL, extract the game code part
  if (cleaned.includes('/game/')) {
    const match = cleaned.match(/\/game\/([^/?]+)/);
    if (match) {
      return match[1];
    }
  }
  
  // Otherwise assume it's a direct game code
  return isValidGameCodePattern(cleaned) ? cleaned.toUpperCase() : null;
};