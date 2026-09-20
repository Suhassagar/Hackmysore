/**
 * CivicFlow — Phase 3B: Deterministic Abusive Text Moderation Filter
 * 
 * Objectives:
 * 1. Catch direct profanity, obscenity, slurs, and violent threats.
 * 2. Handle leetspeak substitutions, punctuated obfuscation, and repeated character spam (e.g. f.u.c.k, f u c k, shiiiit, a$$hole).
 * 3. CRITICAL FALSE-POSITIVE GUARD: Legitimate citizen frustration and criticism of authorities
 *    (e.g., "corrupt officials", "incompetent department", "negligent workers", "useless administration",
 *     "worst road in Mysuru", "MCC ignored this pothole for months") MUST be accepted.
 * 4. Return polite guidance without accusing the citizen of criminal behavior.
 */

// Normalized map for character substitutions
const LEET_MAP = {
  '@': 'a',
  '4': 'a',
  '8': 'b',
  '(': 'c',
  '3': 'e',
  '€': 'e',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '0': 'o',
  '$': 's',
  '5': 's',
  '7': 't',
  '+': 't',
  'v': 'u',
};

// Profane/abusive word stems (English & regional Indian slurs)
const ABUSIVE_STEMS = [
  'fuck',
  'fuk',
  'fck',
  'motherfucker',
  'mfcker',
  'cunt',
  'bitch',
  'bastard',
  'asshole',
  'arsehole',
  'dickhead',
  'pussy',
  'madarchod',
  'bhenchod',
  'chutiya',
  'chutiye',
  'gandu',
  'bhosadi',
  'bhosdike',
  'bolimaga',
  'sulemaga',
  'bewarsi',
  'kamina',
  'harami',
];

// Violent threats directed at persons or public buildings
const THREAT_PATTERNS = [
  /\bkill\s+(you|them|all|everyone|officials?|workers?|engineers?)\b/i,
  /\bmurder\s+(you|them|all|everyone|officials?|workers?)\b/i,
  /\bbomb\s+(the|your|mcc|office|city|building)\b/i,
  /\bshoot\s+(you|them|officials?)\b/i,
  /\bburn\s+(down\s+)?(the|your|office|building)\b/i,
  /\bi\s+will\s+(destroy|attack|beat|hang)\s+(you|them)\b/i,
  /\bdie\s+(in\s+hell|bitch|bastard)\b/i,
];

// Innocent words that contain substrings like "ass"
const SAFE_SUBSTRING_WORDS = [
  'assist',
  'assistant',
  'assistance',
  'assess',
  'assessment',
  'asset',
  'assets',
  'class',
  'classic',
  'classify',
  'pass',
  'passage',
  'passenger',
  'grass',
  'glass',
  'mass',
  'brass',
  'compass',
];

class ContentModerationService {
  /**
   * Normalize input text:
   * - Lowercase
   * - De-leetspeak
   * - Collapse 3+ repeating chars into 1 (e.g. fuuuuuck -> fuck, shiiiiit -> shit)
   */
  normalize(text) {
    if (!text || typeof text !== 'string') return '';

    let normalized = text.toLowerCase();

    // Substitute leetspeak
    let deLeeted = '';
    for (const char of normalized) {
      deLeeted += LEET_MAP[char] || char;
    }

    // Collapse repeated letters (e.g., "fuuuuck" -> "fuck", "shiiiit" -> "shit")
    const collapsed = deLeeted.replace(/(.)\1{2,}/g, '$1$1');

    return collapsed;
  }

  /**
   * Evaluates text for profanity or abusive threats.
   * 
   * @param {string} text - The input text to moderate (e.g. description)
   * @returns {Object} { isAcceptable: boolean, reason: string|null, politePrompt: string|null }
   */
  moderateContent(text) {
    if (!text || typeof text !== 'string') {
      return {
        isAcceptable: true,
        reason: null,
        politePrompt: null,
      };
    }

    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return {
        isAcceptable: true,
        reason: null,
        politePrompt: null,
      };
    }

    // 1. Check for violent threats first
    for (const pattern of THREAT_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          isAcceptable: false,
          reason: 'VIOLENT_THREAT_DETECTED',
          politePrompt: 'Please rewrite your report using respectful language.',
        };
      }
    }

    // 2. Normalize text for word check
    const normalized = this.normalize(trimmed);

    // Extract standard tokens
    const words = normalized
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    // 3. Scan words against abusive stems with word boundaries (allowing suffixes like -ing, -ed, -er, -s)
    for (const stem of ABUSIVE_STEMS) {
      // Check exact word token or derived token
      if (words.some((w) => w === stem || w.startsWith(stem + 'ing') || w.startsWith(stem + 'ed') || w.startsWith(stem + 'er') || w.startsWith(stem + 's'))) {
        return {
          isAcceptable: false,
          reason: 'PROFANITY_DETECTED',
          politePrompt: 'Please rewrite your report using respectful language.',
        };
      }

      // Check regex word boundary in normalized text
      const wordRegex = new RegExp(`\\b${stem}(ing|ed|er|s)?\\b`, 'i');
      if (wordRegex.test(normalized)) {
        return {
          isAcceptable: false,
          reason: 'PROFANITY_DETECTED',
          politePrompt: 'Please rewrite your report using respectful language.',
        };
      }

      // Build obfuscation regex: letters separated by optional punctuation/spaces
      // e.g. "f[\s._-]*u[\s._-]*c[\s._-]*k"
      const chars = stem.split('');
      const obfuscatedPattern = chars.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s._-]*');
      const obfuscatedRegex = new RegExp(`(^|[^a-z])${obfuscatedPattern}([^a-z]|$)`, 'i');

      if (obfuscatedRegex.test(normalized)) {
        // Check if this might be an innocent safe word
        const matchesSafeWord = SAFE_SUBSTRING_WORDS.some((safe) => words.includes(safe));
        if (!matchesSafeWord) {
          return {
            isAcceptable: false,
            reason: 'PROFANITY_DETECTED',
            politePrompt: 'Please rewrite your report using respectful language.',
          };
        }
      }
    }

    // 4. All checks passed
    return {
      isAcceptable: true,
      reason: null,
      politePrompt: null,
    };
  }
}

const contentModerationService = new ContentModerationService();
module.exports = contentModerationService;
