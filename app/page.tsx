"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, UserProfile } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import AgentBuilder, { type AgentConfig } from "./components/AgentBuilder";
import AgentDashboard from "./components/AgentDashboard";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import CreditsOverviewCard from "./components/CreditsOverviewCard";
import { ArrowUp, Briefcase, TrendingUp, Users, Settings, Compass } from "lucide-react";
import posthog from "posthog-js";
import Tooltip from "./components/Tooltip";
import { useToast } from "./contexts/ToastContext";
import { useUserPreferences } from "./hooks/useUserPreferences";

const categories = [
  { icon: Briefcase, label: "Sales" },
  { icon: TrendingUp, label: "Marketing" },
  { icon: Users, label: "People" },
  { icon: Settings, label: "Ops" },
  { icon: Compass, label: "Explore" },
];

const agentTemplates = [
  {
    title: "Lead Enrichment",
    description: "Agent auto-fills missing CRM data (emails, roles), by scraping LinkedIn, Crunchbase, and public databases.",
  },
  {
    title: "Outbound Prospecting",
    description: "Agent personalizes and sends cold emails/LinkedIn messages, schedules follow-ups, logs everything in Salesforce.",
  },
  {
    title: "Outbound Prospecting",
    description: "Agent personalizes and sends cold emails/LinkedIn messages, schedules follow-ups, logs everything in your CRM.",
  },
  {
    title: "Renewals & Upsell Tracking",
    description: "Agent monitors contracts, alerts reps before expiry, drafts renewal offers, and updates CRM renewal schedules.",
  },
];

type ViewMode = "home" | "dashboard" | "builder" | "settings";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();
  const toast = useToast();
  const { notificationsEnabled } = useUserPreferences();
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [initialTask, setInitialTask] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [executionMode, setExecutionMode] = useState<'one-shot' | 'multi-step'>('one-shot');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const startBuilding = useCallback(
    (taskDescription: string) => {
      if (!isLoaded) {
        sessionStorage.setItem("pendingAgentPrompt", taskDescription);
        return;
      }

      if (!isSignedIn) {
        sessionStorage.setItem("pendingAgentPrompt", taskDescription);
        router.push("/sign-in");
        return;
      }

      setInitialTask(taskDescription);
      setViewMode("builder");

      try {
        posthog.capture("start_agent_builder", {
          task: taskDescription,
        });
      } catch (e) {
        console.error(e);
      }
    },
    [isSignedIn, isLoaded, router]
  );

  const handleDeployAgent = async (config: AgentConfig) => {
    try {
      console.log('💾 Saving agent to database with executionPrompt:', {
        hasExecutionPrompt: !!config.executionPrompt,
        executionPromptLength: config.executionPrompt?.length || 0,
        executionPromptPreview: config.executionPrompt?.substring(0, 200) + '...'
      });
      
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: config.name,
          description: config.description,
          systemPrompt: config.systemPrompt,
          executionPrompt: config.executionPrompt,
          targetWebsite: config.targetWebsite,
          authCredentials: config.authCredentials,
          knowledgeBase: config.knowledgeBase,
          userExpectations: config.userExpectations,
          runtimePerDay: config.runtimePerDay,
          executionMode: config.executionMode,
          initialTasks: config.initialTasks,
          icp: config.icp,
          valueProp: config.valueProp,
          platforms: config.platforms,
          planningData: config.planningData,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Agent created:", data);
        
        // Show immediate agent notification toast if present and notifications are enabled
        if (data.agentNotification && notificationsEnabled) {
          toast.showToast(
            `${data.agentNotification.title}: ${data.agentNotification.message}`,
            'info',
            5000 // Show for 5 seconds
          );
        }
        
        setViewMode("dashboard");
        
        try {
          posthog.capture("agent_deployed", {
            agentId: data.agent.id,
            agentName: config.name,
          });
        } catch (e) {
          console.error(e);
        }
      }
    } catch (error) {
      console.error("Error creating agent:", error);
    }
  };

  useEffect(() => {
    try {
      const view = searchParams?.get("view");
      if (view === "agents") {
        setViewMode("dashboard");
      } else if (!view || view === "home") {
        setViewMode("home");
      }
    } catch {
      // Ignore search params errors
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isLoaded) return;
    
    const pendingPrompt = sessionStorage.getItem("pendingAgentPrompt");
    if (pendingPrompt) {
      if (isSignedIn) {
        sessionStorage.removeItem("pendingAgentPrompt");
        setInitialTask(pendingPrompt);
        setViewMode("builder");
        setInputValue("");
      } else {
        router.push("/sign-in");
      }
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode === "home" && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (inputValue.trim()) {
          const trimmedInput = inputValue.trim();
          startBuilding(trimmedInput);
          if (isLoaded && isSignedIn) {
            setInputValue("");
          }
        }
      }

      if (viewMode === "builder" && e.key === "Escape") {
        e.preventDefault();
        setViewMode("home");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, inputValue, startBuilding, isLoaded, isSignedIn]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      const trimmedInput = inputValue.trim();
      startBuilding(trimmedInput);
      if (isLoaded && isSignedIn) {
        setInputValue("");
      }
    }
  };

  return (
    <AnimatePresence mode="wait">
      {viewMode === "builder" ? (
        <AgentBuilder
          initialTask={initialTask}
          executionMode={executionMode}
          onBack={() => setViewMode("home")}
          onDeploy={handleDeployAgent}
        />
      ) : (
        <div className="flex h-screen bg-black text-white overflow-hidden">
          {isSignedIn && (
            <Sidebar 
              activeView={viewMode} 
              onNavigate={(view) => {
                setViewMode(view as ViewMode);
                setIsMobileSidebarOpen(false);
              }}
              isMobileOpen={isMobileSidebarOpen}
              onMobileClose={() => setIsMobileSidebarOpen(false)}
            />
          )}
          
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar 
              showMenuButton={isSignedIn}
              onMenuClick={() => setIsMobileSidebarOpen(true)}
            />
            
            {viewMode === "dashboard" ? (
              <main className="flex-1 overflow-y-auto">
                <AgentDashboard 
                  onCreateAgent={() => setViewMode("home")} 
                  onViewAgent={(id) => router.push(`/agents/${id}`)}
                />
              </main>
            ) : viewMode === "settings" ? (
              <main className="flex-1 flex flex-col items-center px-4 md:px-8 py-6 md:py-8 overflow-y-auto">
                <div className="w-full max-w-4xl">
                  <div className="max-h-[500px] overflow-y-auto rounded-2xl">
                    <UserProfile routing="hash" />
                  </div>
                  <CreditsOverviewCard />
                </div>
              </main>
            ) : (
              <main className="flex-1 flex flex-col items-center px-4 md:px-8 overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="w-full max-w-3xl py-8 md:py-12 lg:py-16"
                >
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-center mb-8 md:mb-12 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent px-4">
                    What sales Flow would<br />you Like to build?
                  </h1>

                  <form onSubmit={handleSubmit} className="mb-10 md:mb-16">
                    <div className="relative bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-2xl p-4 md:p-6 hover:border-white/[0.12] transition-all duration-200">
                      <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Describe your sales workflow - prospecting, outreach, lead enrichment, follow-ups, CRM management..."
                        className="w-full bg-transparent text-white placeholder-gray-500 resize-none outline-none min-h-[100px] md:min-h-[120px] text-sm md:text-base leading-relaxed"
                        rows={4}
                        aria-label="Describe your sales workflow"
                      />
                      
                      {/* Mode selector and input controls */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4">
                        {/* Left side: Mode buttons */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs md:text-sm text-gray-400 whitespace-nowrap">Mode:</span>
                          <div className="flex gap-2">
                            <Tooltip content="Complete the entire task in a single browser session - ideal for quick, straightforward workflows">
                              <button
                                type="button"
                                onClick={() => setExecutionMode('one-shot')}
                                className={`px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 min-h-[44px] sm:min-h-[36px] whitespace-nowrap ${
                                  executionMode === 'one-shot'
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-white/[0.02] text-gray-400 border border-white/[0.08] hover:bg-white/[0.05] hover:border-white/[0.12]'
                                }`}
                              >
                                One-Shot
                              </button>
                            </Tooltip>
                            <Tooltip content="Break down complex workflows into multiple daily tasks - ideal for long-running campaigns">
                              <button
                                type="button"
                                onClick={() => setExecutionMode('multi-step')}
                                className={`px-3 md:px-4 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 min-h-[44px] sm:min-h-[36px] whitespace-nowrap flex items-center gap-1.5 ${
                                  executionMode === 'multi-step'
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-white/[0.02] text-gray-400 border border-white/[0.08] hover:bg-white/[0.05] hover:border-white/[0.12]'
                                }`}
                              >
                                Multi-Step
                                <span className="px-1.5 py-0.5 bg-blue-500/30 text-blue-300 text-[10px] font-bold rounded uppercase">Beta</span>
                              </button>
                            </Tooltip>
                          </div>
                        </div>

                        {/* Right side: Action buttons */}
                        <div className="flex items-center gap-1 md:gap-2 justify-end">
                          {/* Commented out for future use */}
                          {/* <Tooltip content="Add attachment to your request">
                            <button
                              type="button"
                              className="p-2.5 md:p-2 hover:bg-white/5 rounded-lg transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                              aria-label="Add attachment"
                            >
                              <Plus size={18} className="text-gray-400 md:w-5 md:h-5" />
                            </button>
                          </Tooltip>
                          <Tooltip content="Upload image reference">
                            <button
                              type="button"
                              className="p-2.5 md:p-2 hover:bg-white/5 rounded-lg transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                              aria-label="Upload image"
                            >
                              <ImageIcon size={18} className="text-gray-400 md:w-5 md:h-5" />
                            </button>
                          </Tooltip> */}
                          <Tooltip content="Submit your automation request">
                            <button
                              type="submit"
                              disabled={!inputValue.trim()}
                              className="p-3 md:p-2.5 bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed rounded-full transition-all duration-200 min-w-[48px] min-h-[48px] flex items-center justify-center"
                              aria-label="Submit automation request"
                            >
                              <ArrowUp size={18} className="text-white" />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </form>

                  <div className="flex items-center gap-2 md:gap-4 mb-8 md:mb-12 justify-center flex-wrap">
                    {categories.map((category, idx) => {
                      const Icon = category.icon;
                      return (
                        <Tooltip key={idx} content={`Create ${category.label.toLowerCase()} automation agent`}>
                          <button
                            onClick={() => startBuilding(`An agent for ${category.label.toLowerCase()} automation`)}
                            className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-2 bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-full hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 min-h-[44px]"
                          >
                            <Icon size={14} className="text-gray-400 md:w-4 md:h-4" />
                            <span className="text-xs md:text-sm text-gray-300">{category.label}</span>
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    {agentTemplates.map((template, idx) => (
                      <motion.button
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: idx * 0.1 }}
                        onClick={() => startBuilding(template.description)}
                        className="group p-4 md:p-6 bg-white/[0.02] backdrop-blur-sm border border-white/[0.08] rounded-xl hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300 text-left min-h-[44px]"
                      >
                        <h3 className="text-white font-medium mb-1.5 md:mb-2 text-sm md:text-base group-hover:text-gray-100 transition-colors">{template.title}</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          {template.description}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              </main>
            )}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
