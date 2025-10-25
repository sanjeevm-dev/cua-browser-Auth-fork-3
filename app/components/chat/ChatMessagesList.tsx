"use client";

import { motion } from "framer-motion";
import { RefObject } from "react";
import { BrowserStep } from "../ChatFeed";
import ChatMessage from "./ChatMessage";

interface ChatMessagesListProps {
  steps: BrowserStep[];
  containerRef: RefObject<HTMLDivElement | null>;
  isMobile: boolean;
}

const messageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export default function ChatMessagesList({
  steps,
  containerRef,
  isMobile,
}: ChatMessagesListProps) {
  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 md:space-y-4 hide-scrollbar px-1"
      style={{
        height: isMobile ? "calc(100vh - 400px)" : "calc(100% - 100px)",
        flex: "1 1 auto",
        position: "relative",
      }}
    >
      {steps.map((step, index) => (
        <ChatMessage key={index} step={step} index={index} steps={steps} />
      ))}

      {steps.length > 0 &&
        (() => {
          const lastStep = steps[steps.length - 1];
          if (lastStep.tool === "MESSAGE" && lastStep.text.includes("?")) {
            const sentences = lastStep.text.match(/[^.!?]+[.!?]+/g) || [
              lastStep.text,
            ];

            const questions = sentences.filter((s) => s.trim().endsWith("?"));
            const questionText = questions.join(" ").trim();

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const isOnlyQuestion = lastStep.text.trim() === questionText;

            if (questionText) {
              return (
                <motion.div
                  variants={messageVariants}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
                  className={`p-3 md:p-4 bg-blue-600/20 backdrop-blur-xl text-white border border-white/[0.08] rounded-lg md:rounded-xl font-ppsupply space-y-2 mt-2`}
                >
                  <div className="flex justify-between items-center"></div>
                  <div className="font-medium text-sm md:text-base">
                    <div className="p-2 border-l-2 border-blue-500/50">
                      <span className="text-white/90 break-words">{questionText}</span>
                    </div>
                  </div>
                </motion.div>
              );
            }
          }
          return null;
        })()}
    </div>
  );
}
