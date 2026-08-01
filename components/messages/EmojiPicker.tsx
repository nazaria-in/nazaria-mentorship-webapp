// /components/messages/EmojiPicker.tsx
"use client";

import { cn } from "@/lib/utils";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

// Curated common set — a full unicode-range grid isn't necessary for a
// learning-platform chat; this covers the everyday cases WhatsApp defaults to.
const EMOJIS = [
  "😀", "😂", "😊", "😍", "🥳", "😅", "🙂", "😉",
  "🤔", "😢", "😮", "😴", "🙌", "👏", "👍", "👎",
  "🙏", "💪", "❤️", "🔥", "🎉", "✅", "❌", "⭐",
  "📌", "📚", "💡", "🚀", "😎", "🤝", "👋", "✨",
];

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div
        className={cn(
          "absolute bottom-full left-0 mb-2 z-30 rounded-xl border border-border-strong dark:border-border-strong",
          "bg-card dark:bg-card shadow-lg p-2 grid grid-cols-8 gap-1 w-72"
        )}
      >
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="text-xl rounded-lg p-1.5 hover:bg-card-alt dark:hover:bg-card-alt transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}