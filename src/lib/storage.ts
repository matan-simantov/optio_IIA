/**
 * localStorage utilities for persisting chat history
 */

import type { Message } from "../types";

// Key used in localStorage for chat messages
const STORAGE_KEY = "xrl_chat_history";

/**
 * Load chat history from localStorage
 * @returns Array of messages or empty array if none exist
 */
export function loadChatHistory(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    // Validate that it's an array
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return [];
  }
}

/**
 * Save chat history to localStorage
 * @param messages Array of messages to save
 */
export function saveChatHistory(messages: Message[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error("Failed to save chat history:", error);
  }
}

/**
 * Clear chat history from localStorage
 */
export function clearChatHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear chat history:", error);
  }
}

