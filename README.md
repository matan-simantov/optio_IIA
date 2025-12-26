# XRL (Extended Readiness Levels) - MVP

## Project Overview

XRL is a decision-support platform designed to evaluate emerging technologies using a structured, auditable, and repeatable methodology.

## Current Milestone: Milestone 1

**Focus**: Creating sessions, capturing onboarding input, persisting state, and logging all actions.

### Milestone 1 Goals
- ✅ Create session schema (session_schema_v1.json)
- ⏳ Implement session creation
- ⏳ Implement onboarding capture
- ⏳ Implement state persistence (Google Sheets)
- ⏳ Implement comprehensive logging

## Architecture Principles

1. **Single Source of Truth**: The session JSON object is the only source of truth
2. **Immutable Updates**: Every step receives the session, modifies it, and returns it
3. **Schema Compliance**: All implementations must strictly conform to session_schema_v1.json
4. **Full Traceability**: Every action is logged with timestamp, step name, description, and affected fields
5. **Forward Compatibility**: Future milestones will only ADD fields, never remove or redefine them

## Session Schema

The session schema is defined in `session_schema_v1.json`. All session objects must conform to this schema.

### Key Fields
- `session_id`: Unique identifier
- `status`: Current pipeline stage
- `technology_description`: Free-text input from user
- `onboarding`: Questions and answers
- `logs`: Complete audit trail

## Technology Stack

- **n8n**: Workflow automation
- **Google Sheets**: Data persistence
- **Cursor**: Development environment
- **Render**: (Optional) Deployment

## State Management

- Sessions are persisted in Google Sheets
- Each session update creates a new log entry
- All state changes are traceable through the logs array

## Logging Requirements

Every log entry must include:
- `timestamp`: ISO 8601 format
- `step`: Name of the pipeline step
- `description`: Human-readable description
- `affected_fields`: Array of modified field paths (dot notation)

## Chat UI (Phase 1)

A local web UI for interacting with the XRL system via n8n webhooks.

### Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   
   Create a `.env` file in the project root:
   ```env
   VITE_API_URL=https://optio-xrl.app.n8n.cloud/webhook/xrl/session/create
   ```
   
   **Required for production:** The `VITE_API_URL` environment variable must be set to the n8n webhook endpoint URL. In Render (static site), set the Environment Variable key as `VITE_API_URL` with the value: `https://optio-xrl.app.n8n.cloud/webhook/xrl/session/create`

3. **Run development server:**
   ```bash
   npm run dev
   ```
   The app will open at `http://localhost:3000`

### Features

- ChatGPT-style chat interface
- "Thinking" indicator while processing
- Typewriter animation for responses
- Chat history persistence (localStorage)
- Connection status badge
- Debug panel with raw webhook responses
- Error handling and timeout (20 seconds)

### Project Structure

```
src/
  components/
    Chat.tsx           # Main chat component
    MessageBubble.tsx  # Message display component
    ThinkingDots.tsx   # Animated thinking indicator
  hooks/
    useTypewriter.ts   # Typewriter animation hook
  lib/
    api.ts             # Webhook API integration
    storage.ts         # localStorage utilities
  types.ts             # TypeScript type definitions
  App.tsx              # Root component
  main.tsx             # Entry point
  index.css            # Global styles
```

## Backend Setup

The backend is an Express server that handles PDF ingestion and chat API endpoints.

### Backend Environment Variables

**Important**: Never commit `backend/.env` to Git. It contains sensitive credentials.

1. **Copy the example file:**
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Fill in your values in `backend/.env`:**
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_STORAGE_BUCKET=raw-ingest
   N8N_WEBHOOK_URL=https://optio-xrl.app.n8n.cloud/webhook/xrl/session/create
   X_CALLBACK_SECRET=  # Optional
   PORT=3001
   FRONTEND_ORIGIN=http://localhost:5173
   ENABLE_EMBEDDINGS=false
   ```

3. **For production (Render):**
   - Set all environment variables in Render Dashboard → Environment tab
   - Do NOT commit `backend/.env` to Git
   - The `.env` file is already ignored by `.gitignore`

### Backend Endpoints

- `GET /` - Health check
- `GET /health` - Health check JSON
- `POST /api/chat` - Chat endpoint with document chunk retrieval
- `POST /api/upload` - PDF upload endpoint (stores in Supabase Storage + chunks in Postgres)
- `POST /api/documents/upload` - Alias for `/api/upload`

## Next Steps

1. Define onboarding questions structure
2. Create n8n workflow for session creation
3. Set up Google Sheets integration
4. Implement logging utilities

