# Chat Persistence: How Messages Survive Page Reload

This document explains how the SellBot AI chat interface keeps conversations, messages, and sources in memory across page reloads — without any backend session storage.

---

## The Short Answer

**Redux Persist + localStorage.** Every time Redux state changes, the `chat` slice is automatically serialized to the browser's `localStorage`. On page reload, `PersistGate` reads it back into Redux before the app renders.

---

## The Full Flow

```
User sends a message or uploads a document
       |
       v
Redux dispatch --> addMessage() action             [chatSlice.ts:27]
       |
       v
Redux state updates (conversations array in memory)
       |
       v
redux-persist detects state change                 [store/index.ts:33]
       |
       v
Serializes the 'chat' slice to JSON
       |
       v
Writes JSON to localStorage under key 'persist:root'
       |
       v
============= PAGE RELOAD =============
       |
       v
Browser loads React app
       |
       v
PersistGate blocks rendering                       [main.tsx:12]
       |
       v
redux-persist reads 'persist:root' from localStorage
       |
       v
Dispatches REHYDRATE action with saved state
       |
       v
Redux store populated with saved conversations
       |
       v
PersistGate unblocks --> App renders with all messages intact
```

---

## Key Files

### 1. Store Configuration — `RAG/src/store/index.ts`

```typescript
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';  // <-- this is localStorage

const persistConfig = {
  key: 'root',                                     // localStorage key prefix
  storage,                                         // storage engine (localStorage)
  whitelist: ['auth', 'organization', 'chat'],     // ONLY these slices are persisted
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
```

**Key detail:** The `whitelist` array controls what gets saved. Only `auth`, `organization`, and `chat` survive reload. The `ui` and `profile` slices are NOT whitelisted — they reset to defaults on every reload.

### 2. Chat State Shape — `RAG/src/store/slices/chatSlice.ts`

```typescript
interface ChatState {
  conversations: Conversation[];       // all conversations with their messages
  activeConversationId: string | null; // which conversation is currently shown
  isLoading: boolean;                  // loading spinner state
}
```

The entire `conversations` array — including every message, source citation, similarity score, and timestamp — gets serialized to JSON and saved to localStorage.

**Reducers that modify state (and trigger a persist):**
- `createConversation` — adds a new conversation to the array
- `addMessage` — pushes a message into a conversation's messages array
- `deleteConversation` — removes a conversation
- `setActiveConversation` — changes which conversation is displayed
- `clearAllConversations` — wipes all conversations

### 3. PersistGate — `RAG/src/main.tsx`

```tsx
<Provider store={store}>
  <PersistGate loading={null} persistor={persistor}>
    <App />
  </PersistGate>
</Provider>
```

`PersistGate` is critical — it prevents the app from rendering until localStorage has been read and the Redux store is rehydrated. Without it, users would see an empty chat for a split second before messages appear.

The `loading={null}` prop means "show nothing while rehydrating." You could pass a loading spinner component here instead.

---

## What Gets Stored in localStorage

Open Chrome DevTools → **Application** tab → **Local Storage** → `localhost:3000` → key `persist:root`.

The stored JSON looks like:

```json
{
  "chat": {
    "conversations": [
      {
        "id": "conv_1708412345678",
        "title": "What is the price of a 3BHK apartment...",
        "messages": [
          {
            "id": "msg_1708412345679",
            "role": "user",
            "content": "What is the price of a 3BHK apartment in Sunrise Heights?",
            "timestamp": "2026-02-20T10:30:00.000Z"
          },
          {
            "id": "msg_1708412345680",
            "role": "assistant",
            "content": "Based on the pricing details for Sunrise Heights Premium Apartments...",
            "sources": [
              {
                "text": "Sunrise Heights 3 BHK apartments range from...",
                "filename": "01_Sunrise_Heights_Premium_Apartments.pdf",
                "chunk_index": 4,
                "similarity_score": 0.872
              }
            ],
            "timestamp": "2026-02-20T10:30:02.500Z"
          }
        ],
        "createdAt": "2026-02-20T10:30:00.000Z",
        "updatedAt": "2026-02-20T10:30:02.500Z"
      }
    ],
    "activeConversationId": "conv_1708412345678",
    "isLoading": false
  },
  "auth": { ... },
  "organization": { ... },
  "_persist": { "version": -1, "rehydrated": true }
}
```

---

## How Each Feature Persists

| Feature | Stored Where | Survives Reload? |
|---------|-------------|-----------------|
| Chat messages | localStorage (`chat.conversations[].messages`) | Yes |
| Source citations (% match) | localStorage (inside each assistant message) | Yes |
| Upload success messages | localStorage (as messages in conversation) | Yes |
| Conversation list (sidebar) | localStorage (`chat.conversations`) | Yes |
| Active conversation selection | localStorage (`chat.activeConversationId`) | Yes |
| Loading spinner state | Redux only (not whitelisted separately, but `isLoading` is in chat slice) | Resets to `false` |
| Uploaded documents (vectors) | pgvector database (server-side) | Yes (server) |
| Actual document files | Not stored (parsed in-memory, discarded) | No |

---

## Storage Limits

- **localStorage limit:** ~5-10 MB per origin (varies by browser)
- **Typical conversation size:** ~2-5 KB per conversation (messages + sources as JSON)
- **Practical capacity:** ~1,000-2,000 conversations before hitting limits
- **If limit is exceeded:** `redux-persist` will fail silently — new messages won't persist

---

## How to Clear Persisted Data

### From the app (Redux action):
```typescript
dispatch(clearAllConversations());
```

### From browser console:
```javascript
localStorage.removeItem('persist:root');
location.reload();
```

### From Chrome DevTools:
Application → Local Storage → Right-click → Clear

---

## Why localStorage and Not the Backend?

| Approach | Pros | Cons |
|----------|------|------|
| **localStorage (current)** | Zero backend changes, instant, works offline, no auth needed | Per-browser only, 5-10 MB limit, lost if user clears browser data |
| **Backend sessions** | Accessible from any device, unlimited storage | Requires auth, database table, API endpoints, slower |
| **IndexedDB** | Larger storage (hundreds of MB), structured data | More complex API, still per-browser |

For Phase 1 (single-user, single-browser), localStorage via redux-persist is the simplest and most effective approach. If multi-device sync is needed (Phase 3 CRM), conversation history would move to the backend database.

---

## Related Files

- `RAG/src/store/index.ts` — Redux store with persist configuration
- `RAG/src/store/slices/chatSlice.ts` — Chat state, reducers, and selectors
- `RAG/src/main.tsx` — PersistGate wrapper
- `RAG/src/types/chat.types.ts` — Message and Conversation type definitions
- `RAG/src/components/chat/ChatWindow.tsx` — Reads conversations from Redux and renders messages
