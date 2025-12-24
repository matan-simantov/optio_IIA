# Frontend + Backend Integration Changes Summary

## Overview
Refactored the frontend to call a Node.js backend instead of n8n directly. The backend acts as a proxy to the n8n webhook.

## Files Changed

### Frontend Changes

#### 1. `src/lib/n8n.ts`
**Changes:**
- Updated `callN8nWebhook()` to call `${VITE_API_URL}/api/chat` instead of n8n directly
- Added `sessionId` parameter to pass session_id if available in state
- Updated payload to: `{ message: string, session_id?: string }`
- Improved error handling with detailed console logs
- Updated all error messages to reference "backend" instead of "webhook"

**Key Code:**
```typescript
const backendUrl = `${API_URL}/api/chat`;
const payload: { message: string; session_id?: string } = {
  message: userText,
};
if (sessionId) {
  payload.session_id = sessionId;
}
```

#### 2. `src/components/Chat.tsx`
**Changes:**
- Updated `handleSend()` to pass `_sessionId` to `callN8nWebhook()`
- Updated `formatN8nResponseMessage()` to handle `response.llm.confirmation_question` first, then fallback to `JSON.stringify(response.llm)`
- Improved error display with status codes and response body in console

**Key Code:**
```typescript
const item = await callN8nWebhook(userMessage.content, _sessionId);
```

### Backend Changes

#### 3. `backend/server.js`
**Changes:**
- Updated `/api/chat` endpoint to:
  - Accept `{ message: string, session_id?: string }` in request body
  - Forward to n8n webhook with payload: `{ message, source: "web", session_id? }`
  - Return n8n response as-is (no normalization)
  - Implement optional shared secret verification via `x-callback-secret` header
- Added comprehensive logging:
  - Incoming message (truncated)
  - n8n HTTP status code
  - n8n response (truncated)
- Added proper error handling for invalid JSON responses

**Key Code:**
```javascript
// Optional shared secret check
const expectedSecret = process.env.N8N_CALLBACK_SECRET;
if (expectedSecret) {
  const providedSecret = req.headers["x-callback-secret"];
  if (providedSecret !== expectedSecret) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
}

// Forward to n8n
const n8nPayload = {
  message,
  source: "web",
  ...(session_id && { session_id }),
};
const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(n8nPayload),
});

// Return n8n response as-is
res.status(n8nResponse.status).json(parsedData);
```

## Environment Variables for Render

### Frontend (Static Site)
- **VITE_API_URL**: Backend API URL (e.g., `https://your-backend.onrender.com`)

### Backend (Web Service)
- **PORT**: Server port (defaults to 10000 if not set)
- **N8N_WEBHOOK_URL**: n8n webhook URL (defaults to `https://optio-xrl.app.n8n.cloud/webhook/xrl/session/create`)
- **FRONTEND_ORIGIN**: CORS origin for frontend (e.g., `https://your-frontend.onrender.com` or `*` for all)
- **N8N_CALLBACK_SECRET** (optional): Shared secret for authentication. If set, requires `x-callback-secret` header in requests.

## Request/Response Flow

1. **Frontend** → `POST ${VITE_API_URL}/api/chat`
   ```json
   {
     "message": "user text",
     "session_id": "optional-session-id"
   }
   ```

2. **Backend** → `POST https://optio-xrl.app.n8n.cloud/webhook/xrl/session/create`
   ```json
   {
     "message": "user text",
     "source": "web",
     "session_id": "optional-session-id"
   }
   ```

3. **n8n** → Returns response (e.g., `{ technology_guess, confidence, why, confirmation_question }`)

4. **Backend** → Returns n8n response as-is to frontend

5. **Frontend** → Displays `response.llm.confirmation_question` or `JSON.stringify(response.llm)`

## Testing

### Local Development
1. Start backend: `cd backend && npm start`
2. Start frontend: `npm run dev`
3. Set `.env` in frontend: `VITE_API_URL=http://localhost:10000`

### Render Deployment
1. Deploy backend as Web Service
2. Deploy frontend as Static Site
3. Set environment variables as listed above

## Error Handling

- **Frontend**: Shows "FAILED" status, logs error details to console
- **Backend**: Returns appropriate HTTP status codes (400, 401, 500, 502)
- **Logging**: All requests/responses logged with truncated data for debugging

