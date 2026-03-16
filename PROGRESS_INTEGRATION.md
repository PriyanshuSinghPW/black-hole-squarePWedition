# Progress Save System Integration

The progress save system has been successfully integrated into Black Hole Square. This system tracks player progress and syncs it with the backend using the expected payload format.

## Expected Payload Format

The system expects and produces progress data in the following format:

```json
{
  "userId": "65f04a6a2d9b9d6a3c7a1e21",
  "gameId": "65f04b1c2d9b9d6a3c7a1e45",
  "highestLevelPlayed": 5,
  "totalXp": 15800,
  "totalPlayTime": 7200,
  "sessionsCount": 12
}
```

## Files Created

The following files have been added to the `src/` directory:

1. **ProgressBridge.js** - Handles fetching progress from backend/API
2. **StorageManager.js** - Manages local storage (localStorage)
3. **Validator.js** - Validates level data and ensures type safety
4. **ProgressManager.js** - Main coordinator that ties everything together

## How It Works

### 1. Initialization (index.js)

When the game starts:

```javascript
// Backend provides the initial payload
const BACKEND_PAYLOAD = window.BACKEND_PAYLOAD || {
  userId: "guest_" + Date.now(),
  gameId: "black_hole_square",
  highestLevelPlayed: 0,
  totalXp: 0,
  totalPlayTime: 0,
  sessionsCount: 0
};

// Progress manager initializes with this payload
const progressManager = new ProgressManager();
await progressManager.initialize(BACKEND_PAYLOAD);
```

The progress manager will:
- Load the backend payload
- Check local storage for any saved progress
- Use the higher value between backend and local storage
- Set the starting level for the player

### 2. Level Completion (puzzle.js)

When a player completes a level:

```javascript
window.progressManager.handleLevelComplete(currentLevelIndex, {
  xp: totalXP,
  timeTaken: timeTaken,
  moves: movesUsed,
  successful: true
});
```

This will:
- Validate the completed level
- Update `highestLevelPlayed` if this is a new highest level
- Save progress to local storage
- Update session statistics (totalXp, totalPlayTime)
- Make the updated payload available

### 3. Getting Progress Data

At any time, you can get the current progress payload:

```javascript
const progressPayload = window.progressManager.getProgressPayload();
console.log(progressPayload);
// Output:
// {
//   userId: "65f04a6a2d9b9d6a3c7a1e21",
//   gameId: "black_hole_square",
//   highestLevelPlayed: 5,
//   totalXp: 15800,
//   totalPlayTime: 7200,
//   sessionsCount: 1
// }
```

### 4. Sending Progress to Backend

The system automatically sends progress updates in two scenarios:

#### On Level Completion
After each successful level, the progress payload is sent:

```javascript
if (window.ReactNativeWebView) {
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'PROGRESS_UPDATE',
    payload: progressPayload
  }));
}
```

#### On Page Unload
When the player closes the game:

```javascript
window.addEventListener('beforeunload', () => {
  const progressPayload = window.progressManager.getProgressPayload();
  // Send to backend
});
```

## Integration with React Native

If your game is running inside a React Native WebView, it will automatically send progress updates via `postMessage`:

```javascript
// In React Native app
webViewRef.current.onMessage = (event) => {
  const data = JSON.parse(event.nativeEvent.data);
  
  if (data.type === 'PROGRESS_UPDATE') {
    const progressPayload = data.payload;
    // Send to your backend API
    updatePlayerProgress(progressPayload);
  }
};
```

## Providing Backend Payload

To provide the initial backend payload, set it on the window object before the game loads:

```html
<script>
  // Set this before loading the game
  window.BACKEND_PAYLOAD = {
    userId: "65f04a6a2d9b9d6a3c7a1e21",
    gameId: "black_hole_square",
    highestLevelPlayed: 5,
    totalXp: 15800,
    totalPlayTime: 7200,
    sessionsCount: 12
  };
</script>
<script src="index.js" type="module"></script>
```

## Features

✅ **Automatic Progress Saving** - Saves after each level completion  
✅ **Local Storage Fallback** - Works offline, syncs when online  
✅ **Type Safety** - All level values are validated  
✅ **Session Tracking** - Tracks XP, play time, and sessions  
✅ **Backend Sync** - Sends updates via postMessage for React Native  
✅ **Flexible Payload** - Accepts backend payload or starts from scratch  

## API Reference

### ProgressManager

#### `initialize(backendPayload)`
Initialize the progress manager with backend data.
- **Parameters**: `backendPayload` (Object) - Initial progress data from backend
- **Returns**: Promise<{success, startLevel, source}>

#### `handleLevelComplete(levelIndex, levelData)`
Record level completion and update progress.
- **Parameters**: 
  - `levelIndex` (Number) - Index of completed level
  - `levelData` (Object) - {xp, timeTaken, moves, successful}
- **Returns**: Promise<boolean>

#### `getProgressPayload()`
Get current progress in expected payload format.
- **Returns**: Object - Progress payload

#### `getState()`
Get current state of the progress manager.
- **Returns**: Object - {initialized, currentLevel, highestLevelPlayed, sessionStats}

## Testing

To test the integration:

1. **Start a new game**:
   - Open browser console
   - Check for: `[ProgressManager] Initialized - Starting at level X`

2. **Complete a level**:
   - Play and complete a puzzle
   - Check for: `[Progress] Level completion saved`
   - Check console for progress payload

3. **Reload the page**:
   - Your progress should be restored
   - You should start at your highest level

4. **Check local storage**:
   - Open DevTools > Application > Local Storage
   - Look for `blackHoleSquare_progress`
   - Verify the saved data

## Troubleshooting

**Progress not saving?**
- Check browser console for error messages
- Verify localStorage is enabled
- Check that `window.progressManager` is defined

**Starting at wrong level?**
- Check the backend payload is being provided correctly
- Verify `window.BACKEND_PAYLOAD` before game loads
- Check console for level source (backend/local/default)

**Backend not receiving updates?**
- Verify `window.ReactNativeWebView` is defined (for React Native)
- Check postMessage is being sent (look in console)
- Verify backend API is accepting the payload format

## Notes

- Level indices are 0-based (first playable level is typically index 2 after titlescreen and startscreen)
- The system automatically uses the highest value between backend and local storage
- All progress is validated for type safety before saving
- Session statistics accumulate during gameplay and reset on page reload (unless backend provides them)
