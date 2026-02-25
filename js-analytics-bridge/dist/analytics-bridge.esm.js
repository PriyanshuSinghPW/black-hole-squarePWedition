/**
 * AnalyticsManager - Tracks game analytics and submits to React Native WebView
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
    this._sessionId = sessionName; // Use sessionName as sessionId
    
    this._reportData.gameId = gameId;
    this._reportData.sessionId = sessionName;
    this._reportData.name = sessionName;
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
   * @param {string} levelId - Unique level identifier
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
  }
  
  /**
   * Complete a level and update totals
   * @param {string} levelId - Level identifier
   * @param {boolean} successful - Whether level was completed successfully
   * @param {number} timeTakenMs - Time taken in milliseconds
   * @param {number} xp - XP earned for this level
   */
  endLevel(levelId, successful, timeTakenMs, xp) {
    const level = this._getLevelById(levelId);
      this._reportData.xpEarned = this._reportData.xpEarnedTotal;
      this._reportData.xpTotal = this._reportData.xpEarnedTotal;
      this._reportData.bestXp = this._reportData.xpEarnedTotal;
      
      // Update last played level
      this._reportData.lastPlayedLevel = levelId;
      
      // Update highest level played (compare level numbers)
      this._updateHighestLevel(levelId);
      
      // Update per-level analytics
      this._updatePerLevelAnalytics(levelId, successful, timeTakenMs, xp);
    
    if (level) {
      level.successful = successful;
      level.timeTaken = timeTakenMs;
      level.xpEarned = xp;
      
      // Update global session totals
      this._reportData.xpEarnedTotal += xp;
    } else {
      console.warn(`[Analytics] End Level called for unknown level: ${levelId}`);
    }
  }
  
  /**
   * Record a specific user action/task within a level
   * @param {string} levelId - Level identifier
   * @param {string} taskId - Task identifier
   * @param {string} question - Question text
   * @param {string} correctChoice - Correct answer
   * @param {string} choiceMade - User's answer
   * @param {number} timeMs - Time taken in milliseconds
   * @param {number} xp - XP earned for this task
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
    // Build canonical payload
    const payload = JSON.parse(JSON.stringify(this._reportData));
    // Add timestamp
    payload.timestamp = new Date().toISOString();

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
    return JSON.parse(JSON.stringify(this._reportData)); // Deep clone
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
   * @private
   * @param {string} levelId
   * @returns {Object|null}
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
   * @private
   * @param {string} levelId
   * @param {boolean} successful
   * @param {number} timeTakenMs
   * @param {number} xp
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
   * @private
   * @param {string} levelId
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
   * @private
   * @param {string} levelId
   * @returns {number}
   */
  _extractLevelNumber(levelId) {
    if (!levelId) return 0;
    
    // Match patterns like "campaign_level_3" -> 3
    const match = levelId.match(/level_(\d+)$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    
    // For reflex mode or other modes, return 0
    return 0;
  }
}

export { AnalyticsManager as default };
