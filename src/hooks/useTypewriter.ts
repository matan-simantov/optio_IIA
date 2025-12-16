/**
 * Custom hook for typewriter/typing animation effect
 * Reveals text character by character at a configurable speed
 */

import { useState, useEffect, useRef } from "react";

interface UseTypewriterOptions {
  text: string; // Full text to type out
  speed?: number; // Milliseconds per character (default: 30ms)
  onComplete?: () => void; // Callback when typing completes
  enabled?: boolean; // Whether typing should start immediately
}

/**
 * Hook that returns the current displayed text and typing state
 * @param options Configuration options
 * @returns Object with displayedText and isTyping boolean
 */
export function useTypewriter({
  text,
  speed = 30,
  onComplete,
  enabled = true,
}: UseTypewriterOptions) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    // Reset when text changes or when disabled
    if (!enabled || !text) {
      setDisplayedText("");
      setIsTyping(false);
      indexRef.current = 0;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    // Start typing animation
    setIsTyping(true);
    indexRef.current = 0;
    setDisplayedText("");

    // Type out characters one by one
    const typeNextChar = () => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1));
        indexRef.current += 1;
        timeoutRef.current = window.setTimeout(typeNextChar, speed);
      } else {
        // Typing complete
        setIsTyping(false);
        if (onComplete) {
          onComplete();
        }
      }
    };

    // Start typing after a small delay
    timeoutRef.current = window.setTimeout(typeNextChar, 100);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, speed, enabled, onComplete]);

  return { displayedText, isTyping };
}

