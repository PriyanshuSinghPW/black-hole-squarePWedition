# Black Hole Square - Analytics Documentation

## Overview

The Black Hole Square game now includes comprehensive analytics tracking that follows the standard payload format specified in `PAYLOAD_FORMAT.md`. The analytics system tracks player performance, level progression, XP earned, and detailed gameplay metrics.

## Payload Format

The analytics payload matches the format from PAYLOAD_FORMAT.md and includes:

### Top-Level Fields

```javascript
{
  "gameId": "black_hole_square",
  "sessionId": "session_1769688502_abc123xyz",
  "timestamp": "2026-02-25T10:30:45.123Z",
  "name": "session_1769688502",
  
  "xpEarnedTotal": 140,
  "xpEarned": 140,
  "xpTotal": 140,
  "bestXp": 140,
  
  "lastPlayedLevel": "level_5_conflict",
  "highestLevelPlayed": "level_5_conflict",
  
  "perLevelAnalytics": { /* see below */ },
  "rawData": [ /* see below */ ],
  "diagnostics": { /* see below */ }
}
```

### Per-Level Analytics

Aggregated statistics for each level played:

```javascript
"perLevelAnalytics": {
  "level_3_push": {
    "attempts": 2,
    "wins": 1,
    "losses": 1,
    "totalTimeMs": 45000,
    "bestTimeMs": 20000,
    "totalXp": 120,
    "averageTimeMs": 22500
  }
}
```

### Raw Data Metrics

Custom metrics tracked during gameplay:

```javascript
"rawData": [
  { "key": "moves_made", "value": "4" },
  { "key": "victory", "value": "true" },
  { "key": "moves_remaining", "value": "2" },
  { "key": "time_seconds", "value": "15.32" }
]
```

### Diagnostics

Detailed level-by-level breakdown with individual tasks:

```javascript
"diagnostics": {
  "levels": [
    {
      "levelId": "level_3_push",
      "successful": true,
      "timeTaken": 15320,
      "timeDirection": false,
      "xpEarned": 120,
      "tasks": [
        {
          "taskId": "move_1",
          "question": "Move #1: arrowup at position 15",
          "options": "[]",
          "correctChoice": "successful",
          "choiceMade": "successful",
          "successful": true,
          "timeTaken": 3500,
          "xpEarned": 5
        }
      ]
    }
  ]
}
```

## XP Calculation

XP is calculated based on performance:

- **Base XP**: 100 points for completing a level
- **Move Bonus**: 10 points for each move saved (max moves - used moves) * 10
- **Time Bonus**: 50 - (time in seconds / 5), capped at 0 minimum

### Example:
```
Max Moves: 6
Moves Used: 4
Time Taken: 15 seconds

Base XP: 100
Move Bonus: (6-4) * 10 = 20
Time Bonus: 50 - (15/5) = 50 - 3 = 47
Total XP: 167
```

## Tracked Events

### Level Start
- Triggered when a new puzzle is initialized
- Creates a new level entry in diagnostics

### Move/Task
- Triggered on each successful click/move
- Tracks move number, type, position, and time

### Level End (Victory)
- Triggered when puzzle is completed successfully
- Calculates and awards XP
- Updates per-level statistics
- Submits report

### Level End (Failure)
- Triggered when player runs out of moves, gets stuck, or leaves puzzle unclean
- Records failure reason in rawData
- Submits report with 0 XP

## Delivery Methods

The payload is automatically sent via multiple channels (best-effort):

1. **React Native WebView**: `window.ReactNativeWebView.postMessage()`
2. **Custom Site Bridge**: `window.myJsAnalytics.trackGameSession()`
3. **Parent Frame**: `window.parent.postMessage()`
4. **Console Fallback**: Logs to console if no bridge available

### Offline Support

- Failed submissions are queued in localStorage
- Automatically retried when online
- Flushed on page load and connection restoration

## Usage

### Accessing Analytics Data

The analytics instance is available globally via `window.analytics`:

```javascript
// Get current report data
const report = window.analytics.getReportData();
console.log('Session ID:', report.sessionId);
console.log('Total XP:', report.xpEarnedTotal);
console.log('Levels:', Object.keys(report.perLevelAnalytics));

// Add custom metrics
window.analytics.addRawMetric('custom_event', 'value');

// Manually submit report (usually automatic)
window.analytics.submitReport();
```

### Testing Analytics

1. Open the game in a browser
2. Open Developer Console (F12)
3. Play through a level
4. Check console for analytics output

Expected console output:
```
[Analytics] Initialized for: black_hole_square
[Analytics] Level started: level_3_push
[Analytics] Level completed: {levelId: "level_3_push", successful: true, ...}
═══════════════════════════════════════════════════════════
[Analytics] REPORT SUBMITTED
═══════════════════════════════════════════════════════════
Game ID: black_hole_square
Session: session_1769688502
Session ID: session_1769688502_abc123xyz
Total XP: 120
Last Played Level: level_3_push
Highest Level Played: level_3_push
...
```

### Viewing Full Payload

To see the complete payload structure:

```javascript
// In browser console
const report = window.analytics.getReportData();
console.log(JSON.stringify(report, null, 2));
```

## Integration Points

Analytics are integrated into the game at these points:

### src/index.js
- Initializes analytics on page load
- Tracks incomplete sessions on page unload

### src/systems/updates/puzzle.js
- Tracks level start
- Records each move as a task
- Tracks level completion (success/failure)
- Submits reports after each level

## Extending Analytics

To add custom tracking:

### Add a new metric
```javascript
window.analytics.addRawMetric('custom_metric_name', value);
```

### Add a custom task
```javascript
window.analytics.recordTask(
  levelId,
  taskId,
  question,
  correctChoice,
  choiceMade,
  timeTakenMs,
  xpEarned
);
```

### Access internal data
```javascript
// View per-level stats
console.log(window.analytics._reportData.perLevelAnalytics);

// View all levels in diagnostics
console.log(window.analytics._reportData.diagnostics.levels);
```

## API Reference

### AnalyticsManager Methods

#### `initialize(gameId, sessionName)`
Initialize the analytics session.

#### `startLevel(levelId)`
Start tracking a new level.

#### `endLevel(levelId, successful, timeTakenMs, xp)`
Complete a level and update totals.

#### `recordTask(levelId, taskId, question, correctChoice, choiceMade, timeMs, xp)`
Record a specific user action within a level.

#### `addRawMetric(key, value)`
Add a generic metric to rawData.

#### `submitReport()`
Submit the final report via available bridges.

#### `getReportData()`
Get current analytics data (for debugging).

#### `reset()`
Reset analytics data for a new session.

## Troubleshooting

### Analytics not working
- Check console for `[Analytics] Initialized` message
- Verify `window.analytics` is defined
- Ensure JavaScript is enabled

### Payload not received
- Check if any receiving bridge is available
- Look for payload in console fallback
- Check localStorage for queued payloads: `ignite_pending_sessions_jsplugin`

### Missing data in payload
- Verify level completion triggers `endLevel()`
- Check that `submitReport()` is called
- Inspect `window.analytics._reportData` for internal state

## Example Complete Payload

```json
{
  "gameId": "black_hole_square",
  "sessionId": "session_1769688502_abc123xyz",
  "timestamp": "2026-02-25T10:30:45.123Z",
  "name": "session_1769688502",
  "xpEarnedTotal": 240,
  "xpEarned": 240,
  "xpTotal": 240,
  "bestXp": 240,
  "lastPlayedLevel": "level_5_conflict",
  "highestLevelPlayed": "level_5_conflict",
  "perLevelAnalytics": {
    "level_3_push": {
      "attempts": 1,
      "wins": 1,
      "losses": 0,
      "totalTimeMs": 15320,
      "bestTimeMs": 15320,
      "totalXp": 120,
      "averageTimeMs": 15320
    },
    "level_5_conflict": {
      "attempts": 1,
      "wins": 1,
      "losses": 0,
      "totalTimeMs": 18500,
      "bestTimeMs": 18500,
      "totalXp": 120,
      "averageTimeMs": 18500
    }
  },
  "rawData": [
    { "key": "moves_made", "value": "4" },
    { "key": "victory", "value": "true" },
    { "key": "moves_remaining", "value": "2" },
    { "key": "time_seconds", "value": "15.32" },
    { "key": "moves_made", "value": "5" },
    { "key": "victory", "value": "true" },
    { "key": "moves_remaining", "value": "1" },
    { "key": "time_seconds", "value": "18.50" }
  ],
  "diagnostics": {
    "levels": [
      {
        "levelId": "level_3_push",
        "successful": true,
        "timeTaken": 15320,
        "timeDirection": false,
        "xpEarned": 120,
        "tasks": [
          {
            "taskId": "move_1",
            "question": "Move #1: arrowup at position 15",
            "options": "[]",
            "correctChoice": "successful",
            "choiceMade": "successful",
            "successful": true,
            "timeTaken": 3500,
            "xpEarned": 5
          },
          {
            "taskId": "move_2",
            "question": "Move #2: arrowright at position 20",
            "options": "[]",
            "correctChoice": "successful",
            "choiceMade": "successful",
            "successful": true,
            "timeTaken": 7200,
            "xpEarned": 5
          }
        ]
      },
      {
        "levelId": "level_5_conflict",
        "successful": true,
        "timeTaken": 18500,
        "timeDirection": false,
        "xpEarned": 120,
        "tasks": [...]
      }
    ]
  }
}
```

## License

This analytics implementation follows the same license as the Black Hole Square game.
