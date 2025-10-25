"use client";

import { motion } from "framer-motion";
import React from "react";

export interface DisplayStep {
  stepNumber: number;
  tool: string;
  text: string;
  reasoning: string;
  instruction?: string;
}

interface StepDisplayProps {
  steps: DisplayStep[];
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export default function StepDisplay({ steps, containerRef }: StepDisplayProps) {
  const messageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const renderStepContent = (step: DisplayStep) => {
    const isSystemMessage = step.tool === "MESSAGE";

    // For MESSAGE tool, check if it contains a question
    if (isSystemMessage && step.text.includes("?")) {
      const sentences = step.text.match(/[^.!?]+[.!?]+/g) || [step.text];
      const questions = sentences.filter((s) => s.trim().endsWith("?"));
      const nonQuestions = sentences.filter((s) => !s.trim().endsWith("?"));

      const answerText = nonQuestions.join(" ").trim();
      const questionText = questions.join(" ").trim();

      if (answerText && questionText) {
        return (
          <div className="space-y-2 md:space-y-3">
            <div>
              <div className="text-xs text-white/60 mb-1 font-medium uppercase tracking-wide">Answer</div>
              <div className="text-white/90 text-sm md:text-base leading-relaxed break-words">{answerText}</div>
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1 font-medium uppercase tracking-wide">Follow-up Question</div>
              <div className="text-white/80 text-xs md:text-sm italic break-words">{questionText}</div>
            </div>
          </div>
        );
      } else if (questionText) {
        return (
          <div>
            <div className="text-xs text-white/60 mb-1 font-medium uppercase tracking-wide">Question</div>
            <div className="text-white/80 text-xs md:text-sm italic break-words">{questionText}</div>
          </div>
        );
      }
    }

    // Default display for other steps
    return (
      <div className="space-y-2">
        <div className="font-medium text-sm md:text-base text-white/90 leading-relaxed break-words">{step.text}</div>
        {step.reasoning && (
          <div className="text-xs md:text-sm text-white/70 break-words">
            <span className="font-semibold text-white/80">Reasoning: </span>
            {step.reasoning}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 md:space-y-4 hide-scrollbar px-1"
      style={{
        flex: "1 1 auto",
        position: "relative",
      }}
    >
      {steps.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 text-xs md:text-sm">Waiting for agent actions...</p>
        </div>
      ) : (
        steps.map((step, index) => {
          const isSystemMessage = step.tool === "MESSAGE";
          const isUserInput = step.tool === "MESSAGE" && step.reasoning === "User input";

          return (
            <motion.div
              key={index}
              variants={messageVariants}
              initial="hidden"
              animate="visible"
              className={`p-3 md:p-4 rounded-lg md:rounded-xl ${
                isUserInput
                  ? "bg-black/[0.5] backdrop-blur-xl border-blue-500/20"
                  : isSystemMessage
                  ? "bg-blue-600/20 backdrop-blur-xl text-white"
                  : "bg-black/[0.3] backdrop-blur-xl"
              } border border-white/[0.08] space-y-2 md:space-y-3 transition-all duration-200 hover:border-white/[0.12]`}
            >
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span
                  className={`text-xs md:text-sm font-medium ${
                    isSystemMessage ? "text-white/90" : "text-white/80"
                  }`}
                >
                  Step {step.stepNumber}
                </span>
                <span
                  className={`px-2 md:px-2.5 py-1 ${
                    isSystemMessage ? "text-white/90 bg-blue-500/10" : "text-white/80 bg-white/[0.05]"
                  } border border-white/[0.08] text-xs rounded-md font-medium uppercase tracking-wide whitespace-nowrap`}
                >
                  {step.tool}
                </span>
              </div>
              {renderStepContent(step)}
            </motion.div>
          );
        })
      )}
    </div>
  );
}
