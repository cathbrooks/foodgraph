interface ChatBubbleProps {
  role: "user" | "assistant";
  children: React.ReactNode;
}

export function ChatBubble({ role, children }: ChatBubbleProps) {
  return (
    <div
      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        role === "user"
          ? "ml-auto bg-black text-white rounded-br-sm"
          : "bg-gray-100 text-gray-900 rounded-bl-sm"
      }`}
    >
      {children}
    </div>
  );
}
