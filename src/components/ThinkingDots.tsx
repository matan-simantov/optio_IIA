/**
 * Animated "thinking" indicator component
 * Shows three pulsing dots to indicate the assistant is processing
 */

export function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-2 py-1">
      {/* Three animated dots with staggered animation delays */}
      <span
        className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}

