"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { Pin } from "lucide-react";
import StepDisplay, { DisplayStep } from "./StepDisplay";

export interface LiveStep {
  stepNumber: number;
  tool: string;
  text: string;
  reasoning: string;
}

interface LivePreviewSplitProps {
  browserViewUrl: string;
  sessionId: string;
  agentGoal?: string;
  steps?: LiveStep[];
}

export default function LivePreviewSplit({
  browserViewUrl,
  sessionId,
  agentGoal,
  steps = [],
}: LivePreviewSplitProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const stepsContainerRef = useRef<HTMLDivElement>(null);

  // Track scroll position to apply conditional styling
  useEffect(() => {
    const handleScroll = () => {
      if (stepsContainerRef.current) {
        setIsScrolled(stepsContainerRef.current.scrollTop > 10);
      }
    };

    const container = stepsContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  // Auto-scroll to bottom when new steps are added
  useEffect(() => {
    if (stepsContainerRef.current) {
      stepsContainerRef.current.scrollTop = stepsContainerRef.current.scrollHeight;
    }
  }, [steps]);

  const messageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden bg-black/[0.2] rounded-xl md:rounded-2xl border border-white/[0.08]">
      {/* Steps/Reasoning Panel - Left Side on Desktop, Bottom on Mobile */}
      <div
        className="w-full md:w-[450px] flex-shrink-0 px-3 pb-3 pt-4 md:p-6 flex flex-col overflow-hidden border-t md:border-t-0 md:border-r border-white/[0.08] order-2 md:order-1"
        style={{
          height: "100%",
          position: "relative",
        }}
      >
        {/* Pinned Goal Message */}
        {agentGoal && (
          <div className="relative mb-4">
            {/* Blur effect behind the goal message */}
            <div
              className="absolute pointer-events-none"
              style={{
                background: "rgba(0, 0, 0, 0.3)",
                filter: "blur(20px)",
                width: "130%",
                height: "130%",
                left: "-15%",
                right: "-15%",
                top: "-15%",
                bottom: "-15%",
                zIndex: 1,
                borderRadius: "12px",
              }}
            ></div>
            <motion.div
              variants={messageVariants}
              className={`p-4 sticky top-0 z-10 w-full ${
                !isScrolled ? "mb-4" : ""
              }`}
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                width: "100%",
                maxWidth: "100%",
                marginLeft: 0,
                marginRight: 0,
                position: "relative",
                zIndex: 2,
                borderRadius: "12px",
              }}
            >
              <div
                className="absolute pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0))",
                  opacity: 0.6,
                  filter: "blur(2px)",
                  width: "150%",
                  height: "32px",
                  left: "-25%",
                  right: "-25%",
                  bottom: "-24px",
                  zIndex: 0,
                }}
              ></div>

              <div className="absolute right-2">
                <Pin
                  color="#ffffff"
                  size={14}
                  strokeWidth={2}
                  style={{ transform: "rotate(30deg)" }}
                  className="md:w-[17px] md:h-[17px]"
                />
              </div>
              <p className="font-semibold pr-6 text-sm md:text-base text-white">Goal:</p>

              <p className="break-words overflow-hidden text-ellipsis max-w-full text-sm md:text-base text-white/90">
                {agentGoal}
              </p>
            </motion.div>
          </div>
        )}

        {/* Steps List */}
        <StepDisplay steps={steps as DisplayStep[]} containerRef={stepsContainerRef} />
      </div>

      {/* Browser Viewport - Right Side on Desktop, Top on Mobile */}
      <div className="flex-1 min-w-0 p-3 md:p-6 flex flex-col items-center justify-center order-1 md:order-2">
        <div className="w-full h-full relative min-h-[400px] md:min-h-0">
          <iframe
            src={browserViewUrl}
            className="w-full h-full border-none rounded-lg"
            sandbox="allow-same-origin allow-scripts"
            allow="clipboard-read; clipboard-write"
            style={{ pointerEvents: 'none' }}
            title={`Browser Session ${sessionId}`}
          />
        </div>
      </div>
    </div>
  );
}
