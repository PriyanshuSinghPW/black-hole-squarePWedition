import gameSystem from './systems/game.js';
import dataSystem from './systems/data.js';
import AnalyticsManager from './AnalyticsManager.js';

import entities from './entities.json';

// Initialize analytics
const analytics = new AnalyticsManager();
analytics.initialize('black_hole_square', 'session_' + Date.now());

// Make analytics available globally
window.analytics = analytics;

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
});
