# XRL Chat UI - Quick Setup Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Installation Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure webhook URL (optional):**
   
   Create a `.env` file in the project root:
   ```env
   VITE_N8N_WEBHOOK_URL=https://your-n8n-webhook-url.com/webhook
   ```
   
   If you don't create a `.env` file, it will use the default:
   `https://optio-xrl.app.n8n.cloud/webhook-test/xrl/session/create`

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

