/**
 * AnalyticsManager - Tracks game analytics and submits to React Native WebView
 * 
 * LEVEL TRACKING FOR BLACK HOLE SQUARE:
 * ====================================
 * 
 * Level ID Format:
 * ---------------
 * Level IDs follow the pattern: "level_{index}_{puzzleName}"
 * 
 * Examples:
 *   - "level_0_titlescreen"   - Title/intro screen
 *   - "level_1_startscreen"   - Instructions screen
 *   - "level_2_click"         - First puzzle (index 2 in sequence)
 *   - "level_3_push"          - Second puzzle
 *   - "level_10_conflict"     - More advanced puzzle
 * 
 * The index represents the position in the game's level sequence array,
 * and the puzzle name is the unique identifier from entities.json.
 * 
 * Puzzle Names in Black Hole Square:
 *   - titlescreen, startscreen (non-playable intro levels)
 *   - click, wait, push, move (beginner puzzles)
 *   - tango, substitute, wander, double (intermediate)
 *   - conflict, extract, grab, twin (advanced)
 *   - snare, sink, support, snatch (expert)
 *   - swivel, turmoil (very hard)
 *   - end (completion screen)
 * 
 * Level Tracking:
 * --------------
 * - Each puzzle attempt creates a new entry in diagnostics.levels[]
 * - Multiple attempts of the same puzzle create separate entries
 * - perLevelAnalytics{} aggregates stats across all attempts per level
 * - lastPlayedLevel tracks the most recent level ID
 * - highestLevelPlayed tracks the furthest progression (by numeric index)
 * 
 * Example Session:
 * ---------------
 * Player attempts level_3_push twice (fails first, succeeds second):
 * 
 * diagnostics.levels = [
 *   { levelId: "level_3_push", successful: false, ... },  // First attempt
 *   { levelId: "level_3_push", successful: true, ... }    // Second attempt
 * ]
 * 
 * perLevelAnalytics["level_3_push"] = {
 *   attempts: 2,
 *   wins: 1,
 *   losses: 1,
 *   totalTimeMs: 45000,
 *   bestTimeMs: 20000,  // Time from successful attempt
 *   totalXp: 120,
 *   averageTimeMs: 22500
 * }
 */
class AnalyticsManager {
  constructor() {
    if (AnalyticsManager.instance) {
      return AnalyticsManager.instance;
    }

    this._isInitialized = false;
    this._gameId = '';
    this._sessionName = '';
    this._sessionId = '';
    
    this._reportData = {
      gameId: '',
      sessionId: '',
      timestamp: '',
      name: '',
      xpEarnedTotal: 0,
      xpEarned: 0,
      xpTotal: 0,
      bestXp: 0,
      lastPlayedLevel: '',
      highestLevelPlayed: '',
      perLevelAnalytics: {},
      rawData: [],
      diagnostics: {
        levels: []
      }
    };

    AnalyticsManager.instance = this;
  }
  
  static getInstance() {
    if (!AnalyticsManager.instance) {
      AnalyticsManager.instance = new AnalyticsManager();
    }
    return AnalyticsManager.instance;
  }
  
  /**
   * Initialize the analytics session
   * @param {string} gameId - Unique game identifier
   * @param {string} sessionName - Session/player identifier
   */
  initialize(gameId, sessionName) {
    this._gameId = gameId;
    this._sessionName = sessionName;
    // Generate sessionId with timestamp and random component (format: session_TIMESTAMP_RANDOM)
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    this._sessionId = `session_${timestamp}_${random}`;
    
    this._reportData.gameId = gameId;
    this._reportData.name = sessionName;
    this._reportData.sessionId = this._sessionId;
    this._reportData.diagnostics.levels = [];
    this._reportData.rawData = [];
    this._reportData.perLevelAnalytics = {};
    this._reportData.xpEarnedTotal = 0;
    this._reportData.xpEarned = 0;
    this._reportData.xpTotal = 0;
    this._reportData.bestXp = 0;
    this._reportData.lastPlayedLevel = '';
    this._reportData.highestLevelPlayed = '';
    
    this._isInitialized = true;
    console.log(`[Analytics] Initialized for: ${gameId}`);
  }
  
  /**
   * Add a generic metric (FPS, Latency, etc)
   * @param {string} key - Metric name
   * @param {string|number} value - Metric value
   */
  addRawMetric(key, value) {
    if (!this._isInitialized) {
      console.warn('[Analytics] Not initialized');
      return;
    }
    
    this._reportData.rawData.push({ key, value: String(value) });
  }
  
  /**
   * Start tracking a new level
   * 
   * Creates a new level entry in diagnostics.levels[] to track this specific attempt.
   * Each call creates a separate entry, allowing multiple attempts of the same level.
   * 
   * @param {string} levelId - Unique level identifier
   *                          Format: "level_{index}_{puzzleName}"
   *                          Examples: "level_3_push", "level_10_conflict"
   * 
   * @example
   * // Called from puzzle.js when a puzzle is initialized
   * window.currentLevelId = 'level_3_push';
   * window.levelStartTime = Date.now();
   * window.analytics.startLevel(window.currentLevelId);
   */
  startLevel(levelId) {
    if (!this._isInitialized) {
      console.warn('[Analytics] Not initialized');
      return;
    }
    
    const levelEntry = {
      levelId,
      successful: false,
      timeTaken: 0,
      timeDirection: false,
      xpEarned: 0,
      tasks: []
    };
    
    this._reportData.diagnostics.levels.push(levelEntry);
    console.log('[Analytics] Level started:', levelId);
  }
  
  /**
   * Complete a level and update totals
   * 
   * Marks the most recent level entry as complete and updates all tracking metrics:
   * - Sets level.successful, level.timeTaken, level.xpEarned
   * - Updates session totals (xpEarnedTotal, xpEarned, xpTotal, bestXp)
   * - Updates lastPlayedLevel and highestLevelPlayed
   * - Aggregates statistics in perLevelAnalytics{}
   * 
   * @param {string} levelId - Level identifier (must match the most recent startLevel call)
   * @param {boolean} successful - Whether level was completed successfully
   *                              true = puzzle solved, false = failed/stuck/out of moves
   * @param {number} timeTakenMs - Time taken in milliseconds (from level start to completion)
   * @param {number} xp - XP earned for this level
   *                     Usually 0 for failures, calculated based on performance for wins
   *                     Formula in Black Hole Square:
   *                       Base: 100 XP
   *                       Move Bonus: (maxMoves - usedMoves) * 10
   *                       Time Bonus: max(0, 50 - timeTaken/5000)
   * 
   * @example
   * // Victory example
   * const timeTaken = Date.now() - window.levelStartTime;
   * const xp = 120; // Calculated based on moves and time
   * window.analytics.endLevel('level_3_push', true, timeTaken, xp);
   * 
   * // Failure example
   * const timeTaken = Date.now() - window.levelStartTime;
   * window.analytics.endLevel('level_3_push', false, timeTaken, 0);
   */
  endLevel(levelId, successful, timeTakenMs, xp) {
    const level = this._getLevelById(levelId);
    
    if (level) {
      level.successful = successful;
      level.timeTaken = timeTakenMs;
      level.xpEarned = xp;
      
      // Update global session totals
      this._reportData.xpEarnedTotal += xp;
      this._reportData.xpEarned = this._reportData.xpEarnedTotal;
      this._reportData.xpTotal = this._reportData.xpEarnedTotal;
      this._reportData.bestXp = this._reportData.xpEarnedTotal;
      
      // Update last played level
      this._reportData.lastPlayedLevel = levelId;
      
      // Update highest level played (compare level numbers)
      this._updateHighestLevel(levelId);
      
      // Update per-level analytics
      this._updatePerLevelAnalytics(levelId, successful, timeTakenMs, xp);
      
      console.log('[Analytics] Level completed:', {
        levelId,
        successful,
        timeTaken: (timeTakenMs / 1000).toFixed(2) + 's',
        xp
      });
    } else {
      console.warn(`[Analytics] End Level called for unknown level: ${levelId}`);
    }
  }
  
  /**
   * Record a specific user action/task within a level
   * 
   * Tracks individual moves/actions within a puzzle. Each click on a game piece
   * is recorded as a task, allowing detailed replay and analysis.
   * 
   * @param {string} levelId - Level identifier (must match current level)
   * @param {string} taskId - Task identifier
   *                         Format: "move_{number}" (e.g., "move_1", "move_2")
   * @param {string} question - Description of the action
   *                           Format: "Move #{number}: {pieceType} at position {gridIndex}"
   *                           Example: "Move #1: arrowup at position 15"
   * @param {string} correctChoice - Expected outcome (always "successful" for moves)
   * @param {string} choiceMade - Actual outcome ("successful" for valid moves)
   * @param {number} timeMs - Time since level start when this move was made
   * @param {number} xp - XP earned for this specific task (usually 5 per move)
   * 
   * @example
   * // Recording a move in Black Hole Square
   * const moveTime = Date.now() - window.levelStartTime;
   * window.analytics.recordTask(
   *   'level_3_push',
   *   'move_1',
   *   'Move #1: arrowup at position 15',
   *   'successful',
   *   'successful',
   *   moveTime,
   *   5
   * );
   */
  recordTask(levelId, taskId, question, correctChoice, choiceMade, timeMs, xp) {
    const level = this._getLevelById(levelId);
    
    if (level) {
      const isSuccessful = (correctChoice === choiceMade);
      const taskData = {
        taskId,
        question,
        options: '[]',
        correctChoice,
        choiceMade,
        successful: isSuccessful,
        timeTaken: timeMs,
        xpEarned: xp
      };
      
      level.tasks.push(taskData);
    } else {
      console.warn(`[Analytics] Record Task called for unknown level: ${levelId}`);
    }
  }
  
  /**
   * Submit the final report to React Native WebView
   */
  submitReport() {
    if (!this._isInitialized) {
      console.error('[Analytics] Attempted to submit without initialization.');
      return;
    }
    
    // Build canonical payload with all required fields matching PAYLOAD_FORMAT.md
    const payload = {
      gameId: this._reportData.gameId,
      sessionId: this._reportData.sessionId,
      timestamp: new Date().toISOString(),
      name: this._reportData.name,
      xpEarnedTotal: this._reportData.xpEarnedTotal,
      xpEarned: this._reportData.xpEarned,
      xpTotal: this._reportData.xpTotal,
      bestXp: this._reportData.bestXp,
      lastPlayedLevel: this._reportData.lastPlayedLevel,
      highestLevelPlayed: this._reportData.highestLevelPlayed,
      perLevelAnalytics: this._reportData.perLevelAnalytics,
      rawData: this._reportData.rawData,
      diagnostics: {
        levels: this._reportData.diagnostics.levels
      }
    };

    // Log full report before submission
    console.log('[Analytics] Full Report:', payload);
    console.log('═══════════════════════════════════════════════════════');
    console.log('[Analytics] REPORT SUBMITTED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Game ID:', payload.gameId);
    console.log('Session:', payload.name);
    console.log('Session ID:', payload.sessionId);
    console.log('Total XP:', payload.xpEarnedTotal);
    console.log('Last Played Level:', payload.lastPlayedLevel);
    console.log('Highest Level Played:', payload.highestLevelPlayed);
    console.log('Levels Completed:', payload.diagnostics.levels.length);
    console.log('Per-Level Analytics:', payload.perLevelAnalytics);
    console.log('Raw Metrics:', payload.rawData);
    console.log('Full Payload:', payload);
    console.log('═══════════════════════════════════════════════════════');

    // Try delivery via several bridges, best-effort. If window is not present (test/node), just return payload
    if (typeof window === 'undefined') {
      return payload;
    }

    // helpers for persistence/queueing
    const LS_KEY = 'ignite_pending_sessions_jsplugin';
    function savePending(p) {
      try {
        const list = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
        list.push(p);
        localStorage.setItem(LS_KEY, JSON.stringify(list));
      } catch (e) { /* ignore */ }
    }

    function trySend(p) {
      let sent = false;
      // site-local bridge
      try {
        if (window.myJsAnalytics && typeof window.myJsAnalytics.trackGameSession === 'function') {
          window.myJsAnalytics.trackGameSession(p);
          sent = true;
        }
      } catch (e) { /* continue */ }

      // React Native WebView
      try {
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
          window.ReactNativeWebView.postMessage(JSON.stringify(p));
          sent = true;
        }
      } catch (e) { /* continue */ }

      // parent/frame
      try {
        const target = window.__GodotAnalyticsParentOrigin || '*';
        window.parent.postMessage(p, target);
        sent = true;
      } catch (e) { /* continue */ }

      // debug fallback - console
      if (!sent) {
        try { console.log('Payload:' + JSON.stringify(p)); } catch (e) { /* swallow */ }
      }

      return sent;
    }

    function flushPending() {
      try {
        const list = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
        if (!list || !list.length) return;
        list.forEach(function (p) { trySend(p); });
        localStorage.removeItem(LS_KEY);
      } catch (e) { /* ignore */ }
    }

    // attempt send
    const ok = trySend(payload);
    if (!ok) savePending(payload);

    // ensure pending flush is registered once
    try {
      if (typeof window !== 'undefined') {
        window.addEventListener && window.addEventListener('online', flushPending);
        window.addEventListener && window.addEventListener('load', flushPending);
        // listen for handshake message to set parent origin
        window.addEventListener && window.addEventListener('message', function (ev) {
          try {
            const msg = (typeof ev.data === 'string') ? JSON.parse(ev.data) : ev.data;
            if (msg && msg.type === 'ANALYTICS_CONFIG' && msg.parentOrigin) {
              window.__GodotAnalyticsParentOrigin = msg.parentOrigin;
            }
          } catch (e) { /* ignore */ }
        });
        // try flushing shortly after submit to catch same-page parent
        setTimeout(flushPending, 2000);
      }
    } catch (e) { /* ignore */ }
  }
  
  /**
   * Get current report data (for debugging)
   * @returns {Object} Current analytics data
   */
  getReportData() {
    // Return same format as submitReport - matching PAYLOAD_FORMAT.md
    return {
      gameId: this._reportData.gameId,
      sessionId: this._reportData.sessionId,
      timestamp: new Date().toISOString(),
      name: this._reportData.name,
      xpEarnedTotal: this._reportData.xpEarnedTotal,
      xpEarned: this._reportData.xpEarned,
      xpTotal: this._reportData.xpTotal,
      bestXp: this._reportData.bestXp,
      lastPlayedLevel: this._reportData.lastPlayedLevel,
      highestLevelPlayed: this._reportData.highestLevelPlayed,
      perLevelAnalytics: JSON.parse(JSON.stringify(this._reportData.perLevelAnalytics)),
      rawData: JSON.parse(JSON.stringify(this._reportData.rawData)),
      diagnostics: {
        levels: JSON.parse(JSON.stringify(this._reportData.diagnostics.levels))
      }
    };
  }
  
  /**
   * Reset analytics data (useful for new sessions)
   */
  reset() {
    this._reportData.xpEarnedTotal = 0;
    this._reportData.xpEarned = 0;
    this._reportData.xpTotal = 0;
    this._reportData.bestXp = 0;
    this._reportData.rawData = [];
    this._reportData.diagnostics.levels = [];
    this._reportData.perLevelAnalytics = {};
    this._reportData.lastPlayedLevel = '';
    this._reportData.highestLevelPlayed = '';
    console.log('[Analytics] Data reset');
  }
  
  // --- Internal Helpers ---
  
  /**
   * Find level by ID (searches backwards for most recent)
   * 
   * Searches through diagnostics.levels[] from end to start to find the most
   * recent entry matching the given levelId. This is important because the same
   * level can be attempted multiple times, creating multiple entries.
   * 
   * @private
   * @param {string} levelId - Level identifier to search for
   * @returns {Object|null} The most recent level entry object, or null if not found
   * 
   * @example
   * // After two attempts at level_3_push:
   * // diagnostics.levels = [
   * //   { levelId: "level_3_push", successful: false, ... },
   * //   { levelId: "level_3_push", successful: true, ... }
   * // ]
   * 
   * const level = _getLevelById('level_3_push');
   * // Returns: { levelId: "level_3_push", successful: true, ... } (second entry)
   * 
   * Why search backwards?
   * endLevel() needs to update the CURRENT attempt, not a previous one.
   */
  _getLevelById(levelId) {
    const levels = this._reportData.diagnostics.levels;
    for (let i = levels.length - 1; i >= 0; i--) {
      if (levels[i].levelId === levelId) {
        return levels[i];
      }
    }
    return null;
  }
  
  /**
   * Update per-level analytics aggregates
   * 
   * Maintains aggregated statistics across all attempts of a specific level.
   * This provides summary data showing overall performance on each puzzle.
   * 
   * Creates a new entry if this is the first attempt at this level, otherwise
   * updates the existing aggregate statistics.
   * 
   * @private
   * @param {string} levelId - Level identifier
   * @param {boolean} successful - Whether this attempt succeeded
   * @param {number} timeTakenMs - Time taken for this attempt (milliseconds)
   * @param {number} xp - XP earned for this attempt
   * 
   * Tracked Statistics:
   * - attempts: Total number of times this level was attempted (success + failure)
   * - wins: Number of successful completions
   * - losses: Number of failed attempts
   * - totalTimeMs: Sum of time from all attempts (used to calc average)
   * - bestTimeMs: Fastest successful completion time (Infinity if no wins yet)
   * - totalXp: Sum of XP earned from all attempts (only successful attempts award XP)
   * - averageTimeMs: Mean time per attempt (totalTimeMs / attempts)
   * 
   * @example
   * // First attempt (failure):
   * _updatePerLevelAnalytics('level_3_push', false, 25000, 0);
   * // Result: { attempts: 1, wins: 0, losses: 1, totalTimeMs: 25000,
   * //          bestTimeMs: 0, totalXp: 0, averageTimeMs: 25000 }
   * 
   * // Second attempt (success in 20 seconds):
   * _updatePerLevelAnalytics('level_3_push', true, 20000, 120);
   * // Result: { attempts: 2, wins: 1, losses: 1, totalTimeMs: 45000,
   * //          bestTimeMs: 20000, totalXp: 120, averageTimeMs: 22500 }
   */
  _updatePerLevelAnalytics(levelId, successful, timeTakenMs, xp) {
    if (!this._reportData.perLevelAnalytics[levelId]) {
      this._reportData.perLevelAnalytics[levelId] = {
        attempts: 0,
        wins: 0,
        losses: 0,
        totalTimeMs: 0,
        bestTimeMs: Infinity,
        totalXp: 0,
        averageTimeMs: 0
      };
    }
    
    const stats = this._reportData.perLevelAnalytics[levelId];
    stats.attempts += 1;
    
    if (successful) {
      stats.wins += 1;
      stats.totalXp += xp;
      // Track best time only for successful attempts
      if (timeTakenMs < stats.bestTimeMs) {
        stats.bestTimeMs = timeTakenMs;
      }
    } else {
      stats.losses += 1;
    }
    
    stats.totalTimeMs += timeTakenMs;
    stats.averageTimeMs = Math.round(stats.totalTimeMs / stats.attempts);
    
    // If no successful attempts yet, set bestTimeMs to 0
    if (stats.bestTimeMs === Infinity) {
      stats.bestTimeMs = 0;
    }
  }
  
  /**
   * Update the highest level played based on level ID
   * 
   * Determines if the current level represents greater progression than any
   * previous level. Uses numeric comparison of level indices extracted from
   * the level ID.
   * 
   * This tracks the furthest point reached in the game, regardless of the
   * order in which levels were played. If a player skips ahead and then goes
   * back, the highest level remains the furthest point reached.
   * 
   * @private
   * @param {string} levelId - Level identifier to check
   * 
   * @example
   * // Player progression:
   * _updateHighestLevel('level_0_titlescreen');   // highestLevelPlayed = 'level_0_titlescreen'
   * _updateHighestLevel('level_2_click');         // highestLevelPlayed = 'level_2_click' (2 > 0)
   * _updateHighestLevel('level_5_conflict');      // highestLevelPlayed = 'level_5_conflict' (5 > 2)
   * _updateHighestLevel('level_3_push');          // highestLevelPlayed = 'level_5_conflict' (3 < 5, no change)
   * _updateHighestLevel('level_10_turmoil');      // highestLevelPlayed = 'level_10_turmoil' (10 > 5)
   * 
   * Use Case:
   * This helps determine player progression in campaign/level-based games.
   * The parent app can unlock rewards or track achievements based on
   * reaching certain levels.
   */
  _updateHighestLevel(levelId) {
    // Extract level number from levelId (e.g., "campaign_level_3" -> 3)
    const currentLevelNum = this._extractLevelNumber(levelId);
    const highestLevelNum = this._extractLevelNumber(this._reportData.highestLevelPlayed);
    
    if (currentLevelNum > highestLevelNum) {
      this._reportData.highestLevelPlayed = levelId;
    }
  }
  
  /**
   * Extract numeric level from levelId
   * 
   * Extracts the numerical index from a level ID to determine progression.
   * In Black Hole Square, this is the position in the level sequence.
   * 
   * @private
   * @param {string} levelId - Level identifier
   * @returns {number} The numeric index, or 0 if no number found
   * 
   * @example
   * _extractLevelNumber('level_3_push')      // Returns: 3
   * _extractLevelNumber('level_10_conflict') // Returns: 10
   * _extractLevelNumber('level_0_titlescreen') // Returns: 0
   * _extractLevelNumber('titlescreen')       // Returns: 0 (no number)
   * 
   * Usage:
   * The extracted number is used to determine highestLevelPlayed by comparing
   * numeric indices. Level 10 is considered "higher" than level 3, even if
   * the player completed level 3 after level 10.
   */
  _extractLevelNumber(levelId) {
    if (!levelId) return 0;
    
    // Match patterns like "level_3" -> 3 or "level_10_conflict" -> 10
    // The first sequence of digits in the string is extracted
    const match = levelId.match(/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    
    // For non-numeric level IDs (e.g., pure text names), return 0
    return 0;
  }
}

export default AnalyticsManager;
