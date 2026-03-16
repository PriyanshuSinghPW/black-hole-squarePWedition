/**
 * Progress Manager - Coordinates game progress, storage, and analytics
 * Simplified version for Black Hole Square game
 */

import ProgressBridge from './ProgressBridge.js';
import StorageManager from './StorageManager.js';
import Validator from './Validator.js';

class ProgressManager {
  constructor(options = {}) {
    // Initialize components
    this.progressBridge = new ProgressBridge({
      useProvidedPayload: true,
      cacheDuration: 60000,
    });
    
    this.storageManager = new StorageManager({
      storageKey: 'blackHoleSquare_progress',
    });
    
    this.validator = new Validator({
      minLevel: 0,
      maxLevel: 100,
    });
    
    // State
    this.currentLevel = null;
    this.highestLevelPlayed = null;
    this.initialized = false;
    this.backendPayload = null;
    
    // Session tracking for payload
    this.sessionStats = {
      totalXp: 0,
      totalPlayTime: 0,
      sessionsCount: 1,
    };
  }

  /**
   * Initialize with backend payload
   * @param {Object} backendPayload - Payload from backend
   * @returns {Promise<Object>}
   */
  async initialize(backendPayload = null) {
    if (this.initialized) {
      console.log('[ProgressManager] Already initialized');
      return {
        success: true,
        startLevel: this.highestLevelPlayed,
        source: 'cache',
      };
    }

    console.log('[ProgressManager] Initializing...');

    try {
      // Store backend payload
      if (backendPayload) {
        this.backendPayload = backendPayload;
        await this.progressBridge.initialize(backendPayload);
        
        // Extract session stats from payload
        this.sessionStats.totalXp = backendPayload.totalXp || 0;
        this.sessionStats.totalPlayTime = backendPayload.totalPlayTime || 0;
        this.sessionStats.sessionsCount = (backendPayload.sessionsCount || 0) + 1;
      }

      // Get level from backend payload
      let payloadLevel = null;
      if (this.progressBridge.isInitialized()) {
        payloadLevel = await this.progressBridge.getHighestLevelPlayed();
        console.log('[ProgressManager] Backend level:', payloadLevel);
      }

      // Load level from local storage
      let localLevel = await this.storageManager.loadHighestLevel();
      console.log('[ProgressManager] Local level:', localLevel);

      // Determine which level to use
      const result = this._resolveStartLevel(payloadLevel, localLevel);
      
      this.highestLevelPlayed = result.startLevel;
      this.currentLevel = result.startLevel;
      this.initialized = true;

      console.log(`[ProgressManager] Initialized - Starting at level ${result.startLevel} (source: ${result.source})`);
      
      return result;
    } catch (error) {
      console.error('[ProgressManager] Initialization error:', error.message);
      
      // Fallback to default level
      const defaultLevel = this.validator.getDefaultLevel();
      this.highestLevelPlayed = defaultLevel;
      this.currentLevel = defaultLevel;
      this.initialized = true;

      return {
        success: false,
        startLevel: defaultLevel,
        source: 'default',
        error: error.message,
      };
    }
  }

  /**
   * Handle level completion
   * @param {number} completedLevel - Level index that was completed
   * @param {Object} levelData - Additional level data (xp, time, etc.)
   * @returns {Promise<boolean>}
   */
  async handleLevelComplete(completedLevel, levelData = {}) {
    console.log(`[ProgressManager] Level ${completedLevel} completed`);

    // Validate the completed level
    const validation = this.validator.validateLevel(completedLevel);
    if (!validation || !validation.valid) {
      console.error('[ProgressManager] Invalid completed level:', validation?.reason);
      return false;
    }

    const validLevel = validation.value;
    const nextLevel = validLevel + 1;

    try {
      // Check if this is a new highest level
      const isNewHighest = this.highestLevelPlayed === null || validLevel >= this.highestLevelPlayed;

      if (isNewHighest) {
        console.log(`[ProgressManager] New highest level: ${nextLevel}`);
        this.highestLevelPlayed = nextLevel;
        
        // Update local storage
        await this.storageManager.saveHighestLevel(nextLevel);
        console.log('[ProgressManager] Saved to local storage');
      }

      // Update session stats
      if (levelData.xp) {
        this.sessionStats.totalXp += levelData.xp;
      }
      if (levelData.timeTaken) {
        this.sessionStats.totalPlayTime += levelData.timeTaken;
      }

      // Update current level
      this.currentLevel = nextLevel;

      return true;
    } catch (error) {
      console.error('[ProgressManager] Error handling level completion:', error.message);
      return false;
    }
  }

  /**
   * Get the current progress payload in the expected format
   * @returns {Object} Progress payload
   */
  getProgressPayload() {
    return {
      userId: this.backendPayload?.userId || 'unknown',
      gameId: this.backendPayload?.gameId || 'black_hole_square',
      highestLevelPlayed: this.highestLevelPlayed || 0,
      totalXp: this.sessionStats.totalXp,
      totalPlayTime: this.sessionStats.totalPlayTime,
      sessionsCount: this.sessionStats.sessionsCount,
    };
  }

  /**
   * Get current game state
   * @returns {Object}
   */
  getState() {
    return {
      initialized: this.initialized,
      currentLevel: this.currentLevel,
      highestLevelPlayed: this.highestLevelPlayed,
      sessionStats: { ...this.sessionStats },
    };
  }

  /**
   * Resolve which level to use when starting the game
   * @private
   */
  _resolveStartLevel(payloadLevel, localLevel) {
    const defaultLevel = this.validator.getDefaultLevel();

    // Validate payload level
    let validPayloadLevel = null;
    if (payloadLevel !== null) {
      const validation = this.validator.validateLevel(payloadLevel);
      if (validation && validation.valid) {
        validPayloadLevel = validation.value;
      } else {
        console.warn('[ProgressManager] Payload level invalid:', validation?.reason);
      }
    }

    // Validate local level
    let validLocalLevel = null;
    if (localLevel !== null) {
      const validation = this.validator.validateLevel(localLevel);
      if (validation && validation.valid) {
        validLocalLevel = validation.value;
      } else {
        console.warn('[ProgressManager] Local level invalid:', validation?.reason);
      }
    }

    // Decision logic: use the higher of payload or local
    let startLevel = defaultLevel;
    let source = 'default';

    if (validPayloadLevel !== null && validLocalLevel !== null) {
      // Both available - use the higher one
      startLevel = Math.max(validPayloadLevel, validLocalLevel);
      source = startLevel === validPayloadLevel ? 'backend' : 'local';
      
      // Save to local storage if using payload data
      if (source === 'backend') {
        this.storageManager.saveHighestLevel(validPayloadLevel);
        console.log('[ProgressManager] Synced backend level to local storage');
      }
    } else if (validPayloadLevel !== null) {
      // Only payload available
      startLevel = validPayloadLevel;
      source = 'backend';
      this.storageManager.saveHighestLevel(validPayloadLevel);
    } else if (validLocalLevel !== null) {
      // Only local available
      startLevel = validLocalLevel;
      source = 'local';
    }

    return {
      success: true,
      startLevel,
      source,
    };
  }
}

export default ProgressManager;
