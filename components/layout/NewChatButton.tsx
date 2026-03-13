"use client";

import { useNewChatTrigger } from "@/lib/hooks/useNewChat";

export function NewChatButton() {
  const trigger = useNewChatTrigger();

  return (
    <button
      onClick={trigger}
      className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
      title="New chat"
      aria-label="New chat"
    >
      <svg
        className="w-4 h-4 text-gray-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 4.5v15m7.5-7.5h-15"
        />
      </svg>
    </button>
  );
}
