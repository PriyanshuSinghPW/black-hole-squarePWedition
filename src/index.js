import gameSystem from './systems/game.js';
import dataSystem from './systems/data.js';
import AnalyticsManager from './AnalyticsManager.js';
import ProgressManager from './ProgressManager.js';

import entities from './entities.json';

// Initialize analytics
const analytics = new AnalyticsManager();
analytics.initialize('black_hole_square', 'session_' + Date.now());

// Make analytics available globally
window.analytics = analytics;

// Initialize progress manager
const progressManager = new ProgressManager();

// Backend payload - Replace with actual backend data when available
// This should be provided by your backend/wrapper application
const BACKEND_PAYLOAD = window.BACKEND_PAYLOAD || {
  userId: "guest_" + Date.now(),
  gameId: "black_hole_square",
  highestLevelPlayed: 0,
  totalXp: 0,
  totalPlayTime: 0,
  sessionsCount: 0
};

// Initialize progress manager with backend payload and start game
(async function initializeGame() {
  try {
    // Initialize progress
    const result = await progressManager.initialize(BACKEND_PAYLOAD);
    console.log('[Game] Progress initialized:', result);
    
    // Load current level from progress or local storage
    let current = result.startLevel;
    const localCurrent = dataSystem.load('current');
    
    // Use the higher of saved progress or local storage
    if (localCurrent !== undefined && localCurrent > current) {
      current = localCurrent;
    }
    
    // Set up game entities with the current level
    if (current !== undefined && current > 0) {
      entities.game.levels.current = current;
      let sequence = (
        dataSystem.load('payed')
      ) ? entities.game.levels.wm : entities.game.levels.sequence;
      
      if (current < sequence.length) {
        let puzzleId = sequence[current];
        entities.level.state.updates = [puzzleId];
      }
    }
    
    // Make progress manager available globally
    window.progressManager = progressManager;
    
    // Start the game
    gameSystem.setup(entities);
    
  } catch (error) {
    console.error('[Game] Failed to initialize:', error);
    
    // Fallback: just start the game normally
    let current = dataSystem.load('current');
    if (current !== undefined) {
      entities.game.levels.current = current;
      let sequence = (
        dataSystem.load('payed')
      ) ? entities.game.levels.wm : entities.game.levels.sequence;
      let puzzleId = sequence[current];
      entities.level.state.updates = [puzzleId];
    }
    
    gameSystem.setup(entities);
  }
})();


if ('serviceWorker' in navigator) {
    window.addEventListener('load', e => {
        navigator.serviceWorker.register('./sw.js').then(registration => {
            //console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, err => {
            //console.log('ServiceWorker registration failed: ', err);
        });
    });
}

// Track incomplete sessions when user leaves
window.addEventListener('beforeunload', () => {
    if (window.currentLevelId && window.levelStartTime > 0) {
        const level = analytics._getLevelById(window.currentLevelId);
        if (level && !level.successful) {
            const timeTaken = Date.now() - window.levelStartTime;
            analytics.endLevel(window.currentLevelId, false, timeTaken, 0);
            analytics.submitReport();
            console.log('[Analytics] Session ended (incomplete)');
        }
    }
    
    // Save final progress state
    if (window.progressManager && window.progressManager.initialized) {
        const progressPayload = window.progressManager.getProgressPayload();
        console.log('[Progress] Final progress state:', progressPayload);
        // This payload can be sent to backend via postMessage or stored
        if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PROGRESS_UPDATE',
                payload: progressPayload
            }));
        }
    }
});
