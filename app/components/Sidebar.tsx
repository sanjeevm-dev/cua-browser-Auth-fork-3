"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Home,
  Users,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import Tooltip from "./Tooltip";
import { AnimatePresence, motion } from "framer-motion";

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navigationItems = [
  {
    section: "Dashboard",
    items: [
      { icon: Home, label: "Home", view: "home" },
      { icon: Users, label: "Agents", view: "dashboard" },
      // { icon: Activity, label: "Activity", view: "activity" },
    ],
  },
  // {
  //   section: "Track",
  //   items: [
  //     // { icon: Shield, label: "Audit", view: "audit" },
  //     // { icon: User, label: "User", view: "user" },
  //     // { icon: Heart, label: "Sentiments", view: "sentiments" },
  //     // { icon: Clock, label: "Runtime", view: "runtime" },
  //   ],
  // },
  {
    section: "Support",
    items: [
      // { icon: FileText, label: "Documentation", view: "docs" },
      { icon: Calendar, label: "Schedule Call", view: "schedule" },
      // { icon: Phone, label: "Get Support", view: "support" },
    ],
  },
  {
    section: "Account",
    items: [
      { icon: Settings, label: "Settings", view: "settings" },
    ],
  },
];

export default function Sidebar({ activeView, onNavigate, isMobileOpen = false, onMobileClose }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [credits, setCredits] = useState<{
    percentage: number;
    credits: number;
    maxCredits: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    try {
      const response = await fetch('/api/credits');
      if (response.ok) {
        const data = await response.json();
        setCredits({
          percentage: data.percentage,
          credits: data.credits,
          maxCredits: data.maxCredits,
        });
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
    
    const interval = setInterval(fetchCredits, 30000);
    
    return () => clearInterval(interval);
  }, [fetchCredits]);

  const getCreditColor = (percentage: number) => {
    if (percentage <= 10) return 'text-red-400';
    if (percentage <= 20) return 'text-yellow-400';
    return 'text-white';
  };

  const displayPercentage = credits ? `${credits.percentage}%` : '--';

  const handleNavigation = (view: string) => {
    onNavigate(view);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  const sidebarContent = (
    <>
      {/* Logo Section */}
      <div className="p-6 lg:p-8 border-b border-white/[0.08] flex items-center justify-between">
        <div
          className={`flex items-center gap-3 transition-opacity duration-200 ${
            isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          }`}
        >
          <Image
            src="https://exthalpy-public-bucket.blr1.cdn.digitaloceanspaces.com/Screenshot%202025-10-22%20at%203.33.21%E2%80%AFPM.png"
            alt="Salesman.sh Logo"
            className="h-10 w-auto"
            width={150}
            height={40}
          />
        </div>
        {isCollapsed && (
          <div className="flex items-center justify-center w-full pl-1">
            <Image
              src="https://exthalpy-public-bucket.blr1.cdn.digitaloceanspaces.com/ChatGPT%20Image%20Oct%2022,%202025,%2002_16_41%20PM.png"
              alt="Salesman.sh Logo"
              className="object-contain"
              width={56}
              height={56}
            />
          </div>
        )}
        
        {/* Mobile Close Button */}
        <button
          onClick={onMobileClose}
          className="lg:hidden flex items-center justify-center w-10 h-10 hover:bg-white/[0.05] rounded-lg transition-all duration-200"
          aria-label="Close menu"
        >
          <X size={20} className="text-white" />
        </button>
        
        {/* Desktop Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`hidden lg:block p-2 hover:bg-white/[0.08] rounded-lg transition-all duration-200 ${
            isCollapsed ? "absolute right-3 top-6" : ""
          }`}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight size={18} className="text-gray-400" />
          ) : (
            <ChevronLeft size={18} className="text-gray-400" />
          )}
        </button>
      </div>

      {/* Navigation Section */}
      <nav className="flex-1 overflow-y-auto py-6 hide-scrollbar">
        {navigationItems.map((section, idx) => (
          <div key={idx} className="mb-8">
            {!isCollapsed && (
              <div className="px-6 lg:px-8 mb-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {section.section}
                </h3>
              </div>
            )}
            <div className={`space-y-1 ${isCollapsed ? "px-2" : "px-4"}`}>
              {section.items.map((item, itemIdx) => {
                const Icon = item.icon;
                const isActive = activeView === item.view;

                const button = (
                  <button
                    key={itemIdx}
                    onClick={() => handleNavigation(item.view)}
                    className={`w-full flex items-center ${
                      isCollapsed ? "justify-center" : "gap-3"
                    } px-4 py-3 lg:py-2.5 text-sm transition-all duration-200 rounded-xl group min-h-[48px] lg:min-h-0 ${
                      isActive
                        ? "text-white bg-white/[0.08]"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    <Icon
                      size={18}
                      className={
                        isActive
                          ? "text-white"
                          : "text-gray-500 group-hover:text-gray-300"
                      }
                    />
                    {!isCollapsed && (
                      <span className="font-medium">{item.label}</span>
                    )}
                  </button>
                );

                return isCollapsed ? (
                  <Tooltip key={itemIdx} content={item.label} position="right">
                    {button}
                  </Tooltip>
                ) : (
                  button
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Section */}
      <div
        className={`border-t border-white/[0.08] transition-all duration-300 ${
          isCollapsed ? "p-4" : "p-6 lg:p-8"
        }`}
      >
        {!isCollapsed ? (
          <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/[0.08]">
            <span className="text-sm text-gray-300 font-medium">Credits</span>
            <span className={`text-sm font-semibold ${credits ? getCreditColor(credits.percentage) : 'text-white'}`}>
              {isLoading ? '...' : displayPercentage}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center p-3 bg-white/[0.02] rounded-xl border border-white/[0.08]">
            <span className={`text-xs font-semibold ${credits ? getCreditColor(credits.percentage) : 'text-white'}`}>
              {isLoading ? '...' : displayPercentage}
            </span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onMobileClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <div
        className={`hidden lg:flex bg-black/60 backdrop-blur-xl border-r border-white/[0.08] h-screen flex-col transition-all duration-300 ease-in-out ${
          isCollapsed ? "w-20" : "w-54"
        }`}
      >
        {sidebarContent}
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-[280px] bg-black/95 backdrop-blur-xl border-r border-white/[0.08] flex flex-col z-50 lg:hidden"
          >
            {sidebarContent}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
