# XRL Chat UI - Quick Setup Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Installation Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   
   Create a `.env` file in the project root:
   ```env
   VITE_API_URL=https://optio-xrl.app.n8n.cloud/webhook/xrl/session/create
   ```
   
   **Required for production:** The `VITE_API_URL` environment variable must be set to the n8n webhook endpoint URL. 
   
   **For Render deployment:** In Render (static site), set the Environment Variable key as `VITE_API_URL` with the value: `https://optio-xrl.app.n8n.cloud/webhook/xrl/session/create`

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   
   The app will automatically open in your browser at `http://localhost:3000`

## Usage

1. Type a message in the input field at the bottom
2. Press `Enter` to send (or `Shift+Enter` for a newline)
3. The UI will show:
   - A "thinking" indicator while waiting for the webhook
   - A typewriter animation when the response arrives
   - A status message summarizing the result
4. Click "Show Debug" on assistant messages to see raw webhook responses

## Features

- ✅ ChatGPT-style interface
- ✅ Thinking indicator animation
- ✅ Typewriter effect for responses
- ✅ Chat history saved in browser (localStorage)
- ✅ Connection status badge (Idle/Sending/Success/Failed)
- ✅ Debug panel with raw responses
- ✅ 20-second timeout handling
- ✅ Error handling for network issues

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Troubleshooting

- **Webhook not responding**: Check your `.env` file and verify the webhook URL is correct
- **Chat history not persisting**: Check browser console for localStorage errors
- **Styling issues**: Make sure Tailwind CSS is properly configured (should work out of the box)

