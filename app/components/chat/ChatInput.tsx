"use client";

import { motion } from "framer-motion";
import { useRef, FormEvent } from "react";
import Tooltip from "../Tooltip";

interface ChatInputProps {
  onSubmit: (input: string) => Promise<void>;
  isAgentFinished: boolean;
  userInput: string;
  setUserInput: (input: string) => void;
  isWaitingForInput: boolean;
}

export default function ChatInput({
  onSubmit,
  isAgentFinished,
  userInput,
  setUserInput,
  isWaitingForInput,
}: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (["quit", "exit", "bye"].includes(userInput.toLowerCase())) {
      return;
    }
    await onSubmit(userInput);
  };

  if (!isWaitingForInput || isAgentFinished) {
    return null;
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onAnimationComplete={() => {
        if (inputRef.current) {
          inputRef.current.focus();
          console.log("Animation complete, focusing input");
        }
      }}
      onSubmit={handleSubmit}
      className="mt-3 md:mt-4 flex gap-2 w-full px-1"
    >
      <input
        ref={inputRef}
        type="text"
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
        placeholder="Type your message..."
        className="flex-1 px-3 md:px-4 py-2.5 bg-black/[0.4] backdrop-blur-xl text-white placeholder:text-white/40 border border-white/[0.08] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent font-ppsupply transition-all text-sm md:text-base rounded-lg min-h-[44px]"
      />
      <Tooltip content="Send message to agent">
        <button
          type="submit"
          disabled={!userInput.trim()}
          className="px-3 md:px-4 py-2.5 bg-blue-600 text-white font-ppsupply disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors text-sm md:text-base whitespace-nowrap rounded-lg min-h-[44px] flex items-center justify-center"
        >
          Send
        </button>
      </Tooltip>
    </motion.form>
  );
}
