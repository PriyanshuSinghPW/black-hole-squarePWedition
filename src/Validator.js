/**
 * Validator - Validates game data and progress
 */

class Validator {
  constructor(config = {}) {
    this.minLevel = config.minLevel || 0;
    this.maxLevel = config.maxLevel || 100;
  }

  /**
   * Validate highest level played
   * @param {*} level - Level to validate
   * @returns {Object} {valid: boolean, value: number|null, reason: string}
   */
  validateLevel(level) {
    // Check if it exists
    if (level === null || level === undefined) {
      return {
        valid: false,
        value: null,
        reason: 'Level is null or undefined',
      };
    }

    // Check if it's a number
    if (typeof level !== 'number') {
      console.warn('[Validator] Level is not a number:', typeof level);
      
      // Try to convert string to number
      if (typeof level === 'string' && !isNaN(Number(level))) {
        const converted = Number(level);
        console.log(`[Validator] Converted string "${level}" to number ${converted}`);
        level = converted;
      } else {
        return {
          valid: false,
          value: null,
          reason: `Invalid type: ${typeof level}`,
        };
      }
    }

    // Check if it's NaN
    if (isNaN(level)) {
      return {
        valid: false,
        value: null,
        reason: 'Level is NaN',
      };
    }

    // Check if it's an integer
    if (!Number.isInteger(level)) {
      console.warn('[Validator] Level is not an integer:', level);
      level = Math.floor(level);
      console.log(`[Validator] Rounded to ${level}`);
    }

    // Check if it's within valid range
    if (level < this.minLevel || level > this.maxLevel) {
      return {
        valid: false,
        value: level,
        reason: `Level ${level} out of range [${this.minLevel}, ${this.maxLevel}]`,
      };
    }

    return {
      valid: true,
      value: level,
      reason: 'Valid',
    };
  }

  /**
   * Get default level (fallback)
   * @returns {number}
   */
  getDefaultLevel() {
    return this.minLevel;
  }

  /**
   * Update level range
   * @param {number} minLevel
   * @param {number} maxLevel
   */
  setLevelRange(minLevel, maxLevel) {
    this.minLevel = minLevel;
    this.maxLevel = maxLevel;
    console.log(`[Validator] Level range updated to [${minLevel}, ${maxLevel}]`);
  }
}

export default Validator;
