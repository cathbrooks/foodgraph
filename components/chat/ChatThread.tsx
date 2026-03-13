"use client";

import type { ChatMessage } from "@/types/chat";

interface ChatThreadProps {
  messages: ChatMessage[];
}

export function ChatThread({ messages }: ChatThreadProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        Ask for a recommendation to get started.
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto py-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`max-w-[80%] rounded-xl px-4 py-3 ${
            msg.role === "user"
              ? "ml-auto bg-black text-white"
              : "bg-gray-100 text-gray-900"
          }`}
        >
          {msg.content}
        </div>
      ))}
    </div>
  );
}
