# Progress Save System - Black Hole Square

A robust progress tracking and save system integrated into Black Hole Square that syncs player progress between backend services and local storage.

## 📋 Overview

This system automatically tracks and persists player progress including:
- Highest level reached
- Total XP earned
- Total play time
- Session counts

The progress data is synchronized between:
- Backend/API payload (via `window.BACKEND_PAYLOAD`)
- Local browser storage (localStorage)
- React Native WebView (via postMessage)

## 🎯 Expected Payload Format

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

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `userId` | String | Unique identifier for the player |
| `gameId` | String | Identifier for the game ("black_hole_square") |
| `highestLevelPlayed` | Number | Index of the highest level the player has reached (0-based) |
| `totalXp` | Number | Total experience points earned across all sessions |
| `totalPlayTime` | Number | Total time played in milliseconds |
| `sessionsCount` | Number | Number of play sessions |

## 🚀 Quick Start

### 1. Basic Integration (Web)

Simply load the game with a backend payload:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Black Hole Square</title>
</head>
<body>
    <!-- Set backend payload BEFORE loading the game -->
    <script>
        window.BACKEND_PAYLOAD = {
            userId: "user_12345",
            gameId: "black_hole_square",
            highestLevelPlayed: 5,
            totalXp: 15800,
            totalPlayTime: 7200,
            sessionsCount: 12
        };
    </script>
    
    <!-- Load the game -->
    <script src="public/index.html"></script>
</body>
</html>
```

### 2. React Native WebView Integration

```javascript
import React, { useRef } from 'react';
import { WebView } from 'react-native-webview';

function GameScreen({ userId, savedProgress }) {
  const webViewRef = useRef(null);
  
  // Inject backend payload into the game
  const injectedJavaScript = `
    window.BACKEND_PAYLOAD = ${JSON.stringify({
      userId: userId,
      gameId: "black_hole_square",
      highestLevelPlayed: savedProgress.highestLevel || 0,
      totalXp: savedProgress.totalXp || 0,
      totalPlayTime: savedProgress.totalPlayTime || 0,
      sessionsCount: savedProgress.sessionsCount || 0
    })};
    true; // Required for iOS
  `;
  
  // Handle progress updates from the game
  const handleMessage = (event) => {
    const data = JSON.parse(event.nativeEvent.data);
    
    if (data.type === 'PROGRESS_UPDATE') {
      const progress = data.payload;
      console.log('Progress update received:', progress);
      
      // Send to your backend API
      saveProgressToBackend(userId, progress);
    }
  };
  
  return (
    <WebView
      ref={webViewRef}
      source={{ uri: 'https://yourapp.com/game/index.html' }}
      injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
      onMessage={handleMessage}
    />
  );
}

async function saveProgressToBackend(userId, progressPayload) {
  await fetch('https://api.yourapp.com/save-progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId,
      progress: progressPayload
    })
  });
}
```

### 3. Guest Mode (No Backend)

If no `window.BACKEND_PAYLOAD` is provided, the game automatically creates a guest profile:

```javascript
// Automatically generated if BACKEND_PAYLOAD is not set
{
  userId: "guest_1234567890123",
  gameId: "black_hole_square",
  highestLevelPlayed: 0,
  totalXp: 0,
  totalPlayTime: 0,
  sessionsCount: 0
}
```

Progress is still saved to localStorage and can be retrieved later.

## 🔄 How It Works

### Initialization Flow

1. **Game loads** and checks for `window.BACKEND_PAYLOAD`
2. **ProgressManager initializes** with the payload (or creates guest profile)
3. **Loads local storage** to check for saved progress
4. **Resolves start level** using the highest value between backend and local storage
5. **Player starts** at the appropriate level

### Level Completion Flow

1. **Player completes a level**
2. **ProgressManager validates** the completed level
3. **Updates highest level** if this is a new record
4. **Saves to localStorage** immediately
5. **Updates session stats** (XP, play time)
6. **Sends progress update** via `postMessage` (if in WebView)

### Progress Sync

Progress is automatically synced:
- ✅ **On level completion** - Immediate save to localStorage
- ✅ **On page unload** - Final progress state sent via postMessage
- ✅ **On initialization** - Merges backend and local storage data

## 📊 Accessing Progress Data

### Get Current Progress

```javascript
// Access the progress manager
const progressManager = window.progressManager;

// Get current progress payload
const progress = progressManager.getProgressPayload();
console.log(progress);
// Output: { userId: "...", gameId: "...", highestLevelPlayed: 5, ... }

// Get manager state
const state = progressManager.getState();
console.log(state);
// Output: { initialized: true, currentLevel: 5, highestLevelPlayed: 5, sessionStats: {...} }
```

### Listen for Progress Updates

In React Native WebView:

```javascript
webViewRef.current.onMessage = (event) => {
  const data = JSON.parse(event.nativeEvent.data);
  
  switch (data.type) {
    case 'PROGRESS_UPDATE':
      handleProgressUpdate(data.payload);
      break;
  }
};
```

## 🏗️ Architecture

### Core Components

```
src/
├── ProgressManager.js      # Main coordinator
├── ProgressBridge.js       # Backend payload handler
├── StorageManager.js       # localStorage management
├── Validator.js            # Data validation
└── index.js               # Integration point
```

### Component Responsibilities

**ProgressManager**
- Coordinates all progress operations
- Manages game state
- Handles level completion
- Generates progress payloads

**ProgressBridge**
- Receives and validates backend payload
- Caches progress data
- Provides fallback mechanisms

**StorageManager**
- Saves/loads from localStorage
- Handles storage errors gracefully
- Validates stored data

**Validator**
- Ensures level values are valid numbers
- Checks level ranges (0-100)
- Prevents invalid data from corrupting state

## 🎮 Level System

Levels are **0-indexed** in the game sequence:

| Index | Level Name | Type |
|-------|------------|------|
| 0 | titlescreen | Menu |
| 1 | startscreen | Tutorial |
| 2 | click | First puzzle |
| 3 | wait | Puzzle |
| 4 | push | Puzzle |
| ... | ... | ... |
| 20 | end | Final screen |

When `highestLevelPlayed: 5`, the player will start at index 5 (the "move" puzzle).

## 🔧 Configuration

The system automatically configures itself with these defaults:

```javascript
{
  // Progress Bridge
  useProvidedPayload: true,
  cacheDuration: 60000, // 1 minute
  
  // Storage Manager
  storageKey: 'blackHoleSquare_progress',
  
  // Validator
  minLevel: 0,
  maxLevel: 100
}
```

## 🧪 Testing

### Test in Browser Console

```javascript
// Check if progress manager is loaded
console.log(window.progressManager);

// Get current progress
console.log(window.progressManager.getProgressPayload());

// Simulate level completion (for testing)
await window.progressManager.handleLevelComplete(5, {
  xp: 150,
  timeTaken: 30000,
  moves: 8,
  successful: true
});

// Check updated progress
console.log(window.progressManager.getProgressPayload());
```

### Check localStorage

Open DevTools → Application → Local Storage → `blackHoleSquare_progress`

```json
{
  "highestLevelPlayed": 5,
  "lastUpdated": 1234567890123,
  "version": 1
}
```

## 📱 Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Web (Chrome, Firefox, Safari) | ✅ Full Support | Uses localStorage |
| React Native WebView (iOS) | ✅ Full Support | Uses postMessage |
| React Native WebView (Android) | ✅ Full Support | Uses postMessage |
| PWA / Offline Mode | ✅ Full Support | Works without backend |

## 🔒 Data Persistence

### Priority Order

When the game loads, it uses this priority:

1. **Higher value wins** between backend and local storage
2. **Backend payload** if only backend data available
3. **Local storage** if only local data available  
4. **Default (level 0)** if no data available

### Example Scenarios

**Scenario 1: Backend higher than local**
```
Backend: highestLevelPlayed = 10
Local:   highestLevelPlayed = 5
Result:  Starts at level 10, saves 10 to local
```

**Scenario 2: Local higher than backend**
```
Backend: highestLevelPlayed = 5
Local:   highestLevelPlayed = 10
Result:  Starts at level 10, uses local data
```

**Scenario 3: First time player**
```
Backend: Not provided
Local:   No data
Result:  Creates guest profile, starts at level 0
```

## 🚨 Error Handling

The system handles errors gracefully:

- **Invalid payload** → Falls back to local storage or default
- **localStorage unavailable** → Progress only tracked in memory
- **Network errors** → Uses cached/local data
- **Invalid level values** → Validates and corrects to valid range

All errors are logged to console with `[ProgressManager]`, `[ProgressBridge]`, `[StorageManager]`, or `[Validator]` prefixes.

## 📝 Events Sent to Backend

### Level Completion Event

```json
{
  "type": "PROGRESS_UPDATE",
  "payload": {
    "userId": "65f04a6a2d9b9d6a3c7a1e21",
    "gameId": "black_hole_square",
    "highestLevelPlayed": 6,
    "totalXp": 15950,
    "totalPlayTime": 37200,
    "sessionsCount": 1
  }
}
```

### Session End Event

Sent when player closes the game:

```json
{
  "type": "PROGRESS_UPDATE",
  "payload": {
    "userId": "65f04a6a2d9b9d6a3c7a1e21",
    "gameId": "black_hole_square",
    "highestLevelPlayed": 8,
    "totalXp": 16500,
    "totalPlayTime": 45000,
    "sessionsCount": 1
  }
}
```

## 🛠️ Development

### Building the Project

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start dev server
npm run start
```

### File Structure

```
black-hole-squarePWedition/
├── src/
│   ├── index.js              # Main entry (integrated)
│   ├── ProgressManager.js    # Progress coordinator
│   ├── ProgressBridge.js     # Backend handler
│   ├── StorageManager.js     # Storage handler
│   ├── Validator.js          # Data validator
│   └── systems/
│       └── updates/
│           └── puzzle.js     # Level completion tracking
├── public/
│   └── index.html           # Built game (includes progress system)
└── progress files/          # Original reference files
```

## 🤝 Contributing

When modifying the progress system:

1. Update source files in `src/`
2. Run `npm run build` to compile
3. Test in browser and React Native WebView
4. Verify localStorage saving/loading
5. Check console for error messages

## 📄 License

Same as Black Hole Square - MIT License

## 🆘 Support

For issues or questions about the progress system:

1. Check browser console for `[ProgressManager]` logs
2. Verify `window.BACKEND_PAYLOAD` is set correctly
3. Check localStorage in DevTools
4. Ensure game is properly built with `npm run build`

---

**Version:** 1.0.0  
**Last Updated:** March 16, 2026  
**Compatible With:** Black Hole Square v0.0.1+
