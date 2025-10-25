"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

// Utility to merge multiple refs
function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  return (value: T) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref != null) {
        (ref as React.MutableRefObject<T>).current = value;
      }
    });
  };
}

export default function Tooltip({ 
  content, 
  children, 
  position = "top",
  delay = 300 
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [describedBy, setDescribedBy] = useState(false); // Separate state for aria-describedby
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tooltipId = useId();

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      let x = 0, y = 0;

      switch (position) {
        case "top":
          x = rect.left + rect.width / 2;
          y = rect.top - 8;
          break;
        case "bottom":
          x = rect.left + rect.width / 2;
          y = rect.bottom + 8;
          break;
        case "left":
          x = rect.left - 8;
          y = rect.top + rect.height / 2;
          break;
        case "right":
          x = rect.right + 8;
          y = rect.top + rect.height / 2;
          break;
      }

      setCoords({ x, y });
    }
  };

  const showTooltip = (immediate = false) => {
    // Set aria-describedby immediately for accessibility
    setDescribedBy(true);
    updatePosition();
    
    if (immediate) {
      setVisible(true);
    } else {
      timeoutRef.current = setTimeout(() => {
        setVisible(true);
      }, delay);
    }
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setVisible(false);
    setDescribedBy(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case "top":
        return "-translate-x-1/2 -translate-y-full";
      case "bottom":
        return "-translate-x-1/2 translate-y-0";
      case "left":
        return "-translate-x-full -translate-y-1/2";
      case "right":
        return "translate-x-0 -translate-y-1/2";
      default:
        return "-translate-x-1/2 -translate-y-full";
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case "top":
        return "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800";
      case "bottom":
        return "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-800";
      case "left":
        return "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-800";
      case "right":
        return "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-800";
      default:
        return "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800";
    }
  };

  // Clone the child element to add accessibility and event handlers
  const child = React.Children.only(children) as React.ReactElement<Record<string, unknown>>;
  
  // Merge existing aria-describedby with tooltip ID
  const existingAriaDescribedBy = child.props?.["aria-describedby"];
  const mergedAriaDescribedBy = describedBy
    ? existingAriaDescribedBy
      ? `${existingAriaDescribedBy} ${tooltipId}`
      : tooltipId
    : existingAriaDescribedBy;
  
  const clonedChild = React.cloneElement(child, {
    ref: mergeRefs(triggerRef, (child as React.ReactElement & { ref?: React.Ref<HTMLDivElement> }).ref),
    onMouseEnter: (e: React.MouseEvent) => {
      showTooltip(false); // Use delay for mouse hover
      const handler = child.props?.onMouseEnter;
      if (typeof handler === 'function') handler(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hideTooltip();
      const handler = child.props?.onMouseLeave;
      if (typeof handler === 'function') handler(e);
    },
    onFocus: (e: React.FocusEvent) => {
      showTooltip(true); // Immediate for keyboard focus (accessibility)
      const handler = child.props?.onFocus;
      if (typeof handler === 'function') handler(e);
    },
    onBlur: (e: React.FocusEvent) => {
      hideTooltip();
      const handler = child.props?.onBlur;
      if (typeof handler === 'function') handler(e);
    },
    "aria-describedby": mergedAriaDescribedBy,
  });

  return (
    <>
      {clonedChild}
      {visible && typeof window !== 'undefined' && createPortal(
        <div
          id={tooltipId}
          role="tooltip"
          className="fixed z-[99999] pointer-events-none"
          style={{ left: `${coords.x}px`, top: `${coords.y}px` }}
        >
          <div
            className={`
              relative px-2 md:px-3 py-1.5 md:py-2 bg-gray-800 text-white text-xs md:text-sm rounded-lg
              shadow-xl border border-gray-700
              whitespace-normal max-w-[200px] md:max-w-[280px] break-words
              ${getPositionClasses()}
            `}
          >
            {content}
            <div
              className={`absolute w-0 h-0 border-4 ${getArrowClasses()}`}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
