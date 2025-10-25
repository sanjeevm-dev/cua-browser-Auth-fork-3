"use client";

import { motion } from "framer-motion";
import { Pin } from "lucide-react";

interface GoalMessageProps {
  message: string;
  isScrolled: boolean;
}

const messageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export default function GoalMessage({ message, isScrolled }: GoalMessageProps) {
  if (!message) return null;

  return (
    <div className="relative">
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
        className={`p-3 md:p-4 font-ppsupply sticky top-0 z-10 w-full ${
          !isScrolled ? "mb-3 md:mb-4" : ""
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
            size={15}
            strokeWidth={2}
            style={{ transform: "rotate(30deg)" }}
            className="md:w-[17px] md:h-[17px]"
          />
        </div>
        <p className="font-semibold pr-6 text-white text-sm md:text-base">Goal:</p>

        <p className="break-words overflow-hidden text-ellipsis max-w-full text-white/90 text-sm md:text-base">
          {message}
        </p>
      </motion.div>
    </div>
  );
}
