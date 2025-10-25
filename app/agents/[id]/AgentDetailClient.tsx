"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Pause,
  Clock,
  Calendar,
  Globe,
  Brain,
  Activity,
  FileText,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  Monitor,
  Loader2,
  List,
} from "lucide-react";
import type { AgentWithRelations, AgentSession, AgentContext, AgentTask as AgentTaskType } from "../../../lib/types/mongodb";
import SessionViewer from "../../components/SessionViewer";
import MemoryViewer from "../../components/MemoryViewer";
import AuditLogsViewer from "../../components/AuditLogsViewer";
import LivePreviewSplit, { LiveStep } from "../../components/LivePreviewSplit";
import { SessionLog } from "../../utils/stepFormatter";
import { useToast } from "../../contexts/ToastContext";
import { useUserPreferences } from "../../hooks/useUserPreferences";

interface DailyTask {
  id: string;
  agentId: string;
  dayNumber: number;
  taskPrompt: string;
  status: string;
  outcomes?: unknown;
  error?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

type TabType = "overview" | "livepreview" | "tasks" | "sessions" | "memory" | "audit";

interface AgentDetailClientProps {
  agent: AgentWithRelations;
  initialSessions: AgentSession[];
  initialContext: AgentContext[];
  initialTasks: AgentTaskType[];
}

export default function AgentDetailClient({
  agent: initialAgent,
  initialSessions,
  initialContext,
  initialTasks
}: AgentDetailClientProps) {
  const router = useRouter();
  const agentId = initialAgent.id;
  const toast = useToast();
  const { notificationsEnabled } = useUserPreferences();

  const [agent, setAgent] = useState<AgentWithRelations>({
    ...initialAgent,
    sessions: initialSessions,
    context: initialContext,
  });
  const [, setTasks] = useState<AgentTaskType[]>(initialTasks);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [dailyTasksLoading, setDailyTasksLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("tasks");
  const [selectedSession, setSelectedSession] = useState<AgentSession | null>(null);
  const [showLiveExecution, setShowLiveExecution] = useState(false);
  const [runningSession, setRunningSession] = useState<AgentSession | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [liveSteps, setLiveSteps] = useState<LiveStep[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [deploymentStartTime, setDeploymentStartTime] = useState<number | null>(null);
  const [currentDeploySessionId, setCurrentDeploySessionId] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState<number | null>(null);

  useEffect(() => {
    // Check for running session on mount
    const running = initialSessions.find(s => s.status === 'running');
    setRunningSession(running || null);
    
    if (running && running.browserSessionId) {
      fetchLiveViewUrl(running.browserSessionId);
    }
  }, [initialSessions]);

  // Fetch user credits on mount and poll every 30 seconds
  const fetchCredits = useCallback(async () => {
    try {
      const response = await fetch('/api/credits');
      if (response.ok) {
        const data = await response.json();
        setUserCredits(data.credits);
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
    const interval = setInterval(fetchCredits, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [fetchCredits]);

  // Safety timeout: if deployment takes longer than 2 minutes without browser session, clear deploying state
  useEffect(() => {
    if (isDeploying && deploymentStartTime) {
      const timeout = setTimeout(() => {
        // If still deploying after 2 minutes and no browser session, clear the deploying state
        if (isDeploying && !runningSession?.browserSessionId) {
          // Only log error if it's not a credit issue (credits = 0 means expected failure)
          if (userCredits !== 0) {
            console.error('Deployment timeout: Browser session not created after 2 minutes');
          }
          setIsDeploying(false);
          setDeploymentStartTime(null);
        }
      }, 120000); // 2 minutes

      return () => clearTimeout(timeout);
    }
  }, [isDeploying, deploymentStartTime, runningSession?.browserSessionId, userCredits]);

  // Polling mechanism to fetch updates every 3 seconds
  useEffect(() => {
    const pollForUpdates = async () => {
      try {
        // Fetch agent details with sessions
        const response = await fetch(`/api/agents/${agentId}`);
        if (response.ok) {
          const data = await response.json();
          
          // Only update state if we have fresh sessions data
          if (data.sessions) {
            // Update agent state with new data and sessions
            setAgent(prevAgent => ({
              ...prevAgent,
              ...data.agent,
              sessions: data.sessions,
              context: data.context || prevAgent.context
            }));
            
            // Check for running session
            const running = data.sessions.find((s: AgentSession) => s.status === 'running');
            // Check if the CURRENT deployment's session failed
            // If we have a tracked session ID, check that specific session
            // If no session ID (deploy didn't return session), fallback to checking most recent session with timestamp validation
            const failed = isDeploying 
              ? (currentDeploySessionId 
                  ? data.sessions.find((s: AgentSession) => s.id === currentDeploySessionId && s.status === 'failed')
                  : (data.sessions[0]?.status === 'failed' 
                      && !data.agent?.isDeployed 
                      && deploymentStartTime 
                      && new Date(data.sessions[0].createdAt).getTime() >= deploymentStartTime
                      ? data.sessions[0] 
                      : null))
              : null;
            
            if (running) {
              // Only update if session ID or browserSessionId changed
              setRunningSession(prevSession => {
                if (!prevSession || prevSession.id !== running.id || prevSession.browserSessionId !== running.browserSessionId) {
                  // Fetch live view URL when browserSessionId becomes available
                  if (running.browserSessionId) {
                    fetchLiveViewUrl(running.browserSessionId);
                  }
                  return running;
                }
                return prevSession;
              });
              
              // Clear deploying state once we have a browser session
              if (running.browserSessionId) {
                setIsDeploying(false);
                setDeploymentStartTime(null);
                setCurrentDeploySessionId(null); // Clear deployment session tracking
              }

              // Fetch session logs for the running session
              try {
                const logsResponse = await fetch(`/api/sessions/${running.id}`);
                if (logsResponse.ok) {
                  const logsData = await logsResponse.json();
                  if (logsData.session && logsData.session.logs) {
                    // Logs are already formatted in user-friendly language from the backend
                    const formattedSteps: LiveStep[] = logsData.session.logs.map((log: SessionLog) => {
                      // Use pre-formatted data from database
                      return {
                        stepNumber: log.stepNumber,
                        tool: log.tool || 'ACTION',
                        text: log.instruction || 'Performing action',
                        reasoning: log.reasoning || ''
                      };
                    });
                    
                    setLiveSteps(formattedSteps);
                  }
                }
              } catch (logError) {
                console.error('Error fetching session logs:', logError);
              }
            } else if (failed) {
              // Current deployment's session failed - clear deploying state and show error
              setIsDeploying(false);
              setDeploymentStartTime(null);
              setCurrentDeploySessionId(null);
              setRunningSession(null);
              setLiveViewUrl(null);
              setLiveSteps([]);
              // Agent isDeployed should already be false from the API, but ensure it's updated
              setAgent(prev => ({ ...prev, isDeployed: false }));
            } else {
              // No running session - clear running session state and live steps
              setRunningSession(prevSession => {
                if (prevSession) {
                  setLiveViewUrl(null);
                  setLiveSteps([]);
                  return null;
                }
                return prevSession;
              });
              // Don't clear isDeploying here - let it stay true until browser session is ready
              // isDeploying will be cleared when browserSessionId is detected or session fails
              // or when user explicitly pauses the agent
              // Also clear live steps even if there was no previous running session
              setLiveSteps([]);
            }
          } else {
            // No sessions in response - only update agent fields, preserve sessions/context
            setAgent(prevAgent => ({
              ...prevAgent,
              ...data.agent,
              // Explicitly preserve sessions and context from previous state
              sessions: prevAgent.sessions,
              context: prevAgent.context
            }));
          }
          // If data.sessions is null/undefined, all session-related state is preserved
        }
        
        // Fetch tasks
        const tasksResponse = await fetch(`/api/agents/${agentId}/tasks`);
        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          setTasks(tasksData.tasks || []);
        }

        // Fetch daily tasks (multi-day campaign tasks)
        const dailyTasksResponse = await fetch(`/api/agents/${agentId}/daily-tasks`);
        if (dailyTasksResponse.ok) {
          const dailyTasksData = await dailyTasksResponse.json();
          if (dailyTasksData.dailyTasks) {
            setDailyTasks(dailyTasksData.dailyTasks);
          }
        }
        setDailyTasksLoading(false);
      } catch (error) {
        console.error('Error polling for updates:', error);
      }
    };

    // Poll immediately on mount, then every 10 seconds (reduced from 3s to save resources)
    pollForUpdates();
    const interval = setInterval(pollForUpdates, 10000);

    return () => clearInterval(interval);
  }, [agentId, isDeploying, currentDeploySessionId, deploymentStartTime]);

  const fetchLiveViewUrl = async (browserSessionId: string) => {
    try {
      const response = await fetch(`/api/browserbase/live-view/${browserSessionId}`);
      if (response.ok) {
        const data = await response.json();
        setLiveViewUrl(data.liveViewUrl);
      }
    } catch (error) {
      console.error('Error fetching live view URL:', error);
    }
  };

  // CRITICAL: Refresh live view URL periodically to prevent disconnection
  // Browserbase debugger URLs expire after ~60-90 seconds of inactivity
  // This ensures the iframe always has a fresh, valid URL
  useEffect(() => {
    if (!runningSession?.browserSessionId) return;

    // Refresh every 45 seconds (well before typical 60-90s expiration)
    const refreshInterval = setInterval(() => {
      if (runningSession?.browserSessionId) {
        console.log('🔄 Refreshing live view URL to prevent Browserbase disconnection...');
        fetchLiveViewUrl(runningSession.browserSessionId);
      }
    }, 45000);

    return () => clearInterval(refreshInterval);
  }, [runningSession?.browserSessionId]);

  const handleToggleDeployment = async () => {
    try {
      // Stop if there's a browser session running (even if there was an error)
      if (runningSession?.browserSessionId) {
        setIsStopping(true); // Show stopping loader
        const response = await fetch(`/api/agents/${agentId}/pause`, {
          method: 'POST',
        });
        if (response.ok) {
          const data = await response.json();
          
          setAgent({ ...agent, isDeployed: false });
          setRunningSession(null);
          setLiveViewUrl(null);
          setIsDeploying(false);
          setDeploymentStartTime(null);
          setCurrentDeploySessionId(null); // Clear deployment session tracking
          
          // Show immediate credit notification toast if present and notifications are enabled
          if (data.creditNotification && notificationsEnabled) {
            const toastType = data.creditNotification.priority === 'critical' ? 'error' : 'warning';
            toast.showToast(
              `${data.creditNotification.title}: ${data.creditNotification.message}`,
              toastType,
              7000 // Show for 7 seconds
            );
          }
          
          // Show immediate agent notification toast if present and notifications are enabled
          if (data.agentNotification && notificationsEnabled) {
            toast.showToast(
              `${data.agentNotification.title}: ${data.agentNotification.message}`,
              'info',
              5000 // Show for 5 seconds
            );
          }
          
          // Stay on agent details page - no redirect
        }
        setIsStopping(false);
      } else {
        // Check credits before starting agent
        if (userCredits === 0) {
          toast.showToast(
            'The Credits are 0 Please refill to continue',
            'error',
            5000
          );
          return; // Don't proceed with deployment
        }
        
        setIsDeploying(true); // Start loading state
        setDeploymentStartTime(Date.now()); // Track deployment start time for timeout
        setActiveTab('livepreview'); // Automatically switch to Live Preview tab
        const response = await fetch(`/api/agents/${agentId}/deploy`, {
          method: 'POST',
        });
        
        // Don't clear isDeploying based on response - let polling handle it
        // Polling will clear isDeploying when browser session is ready or when agent.isDeployed becomes false
        if (response.ok) {
          const data = await response.json();
          
          // Show immediate agent notification toast if present and notifications are enabled
          if (data.agentNotification && notificationsEnabled) {
            toast.showToast(
              `${data.agentNotification.title}: ${data.agentNotification.message}`,
              'info',
              5000 // Show for 5 seconds
            );
          }
          
          // If we get session with browserSessionId immediately, set it up
          if (data.session) {
            setCurrentDeploySessionId(data.session.id); // Track this deployment's session ID
            setRunningSession(data.session);
            if (data.session.browserSessionId) {
              fetchLiveViewUrl(data.session.browserSessionId);
              // isDeploying will be cleared by polling when it detects the session
            }
          }
          // Otherwise, polling will detect and set up the session when ready
        }
        // Even on error, don't clear isDeploying here - polling will handle it
        // by checking if agent.isDeployed is false
      }
    } catch (error) {
      console.error("Error toggling deployment:", error);
      // Don't clear isDeploying here - let polling handle it
      // If deployment failed, agent.isDeployed will be false and polling will clear isDeploying
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "text-blue-400 bg-blue-500/20";
      case "completed": return "text-green-400 bg-green-500/20";
      case "failed": return "text-red-400 bg-red-500/20";
      case "stopped": return "text-yellow-400 bg-yellow-500/20";
      default: return "text-gray-400 bg-gray-500/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running": return <Activity size={16} className="animate-pulse" />;
      case "completed": return <CheckCircle size={16} />;
      case "failed": return <XCircle size={16} />;
      case "stopped": return <AlertCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  if (selectedSession) {
    return (
      <SessionViewer
        sessionId={selectedSession.id}
        onBack={() => setSelectedSession(null)}
        existingBrowserSessionId={selectedSession.browserSessionId || undefined}
      />
    );
  }

  if (showLiveExecution && runningSession && runningSession.browserSessionId && liveViewUrl) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="px-3 py-3 md:px-4 md:py-4 border-b border-white/[0.08] bg-black/[0.6] backdrop-blur-xl flex items-center gap-3 md:gap-4">
          <button
            onClick={() => setShowLiveExecution(false)}
            className="p-2 hover:bg-white/[0.05] rounded-lg text-gray-400 hover:text-white transition-all min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
            aria-label="Close live view"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
            <h3 className="text-base md:text-lg font-semibold text-white truncate">Live Execution: {agent?.name || 'Agent'}</h3>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <LivePreviewSplit
            browserViewUrl={liveViewUrl}
            sessionId={runningSession.id}
            agentGoal={agent.description || `View execution of ${agent?.name || 'agent'}`}
            steps={liveSteps}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <button
          onClick={() => router.push("/?view=agents")}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4 md:mb-6 min-h-[44px] -ml-2 pl-2"
        >
          <ArrowLeft size={18} className="md:w-5 md:h-5" />
          <span className="text-sm md:text-base">Back to Agents</span>
        </button>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 md:gap-4 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-white truncate">{agent.name}</h1>
              <span className={`px-2.5 md:px-3 py-1 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap ${
                agent.isDeployed ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"
              }`}>
                {agent.isDeployed ? "Deployed" : "Not Deployed"}
              </span>
            </div>
            {agent.description && (
              <p className="text-gray-400 text-sm md:text-lg mb-3 md:mb-4 line-clamp-2">{agent.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 md:gap-6 text-xs md:text-sm text-gray-400">
              <div className="flex items-center gap-1.5 md:gap-2">
                <Clock size={14} className="md:w-4 md:h-4" />
                <span>{agent.runtimePerDay} min/day</span>
              </div>
              {agent.targetWebsite && (
                <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                  <Globe size={14} className="flex-shrink-0 md:w-4 md:h-4" />
                  <span className="truncate">{agent.targetWebsite}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 md:gap-2">
                <Calendar size={14} className="md:w-4 md:h-4" />
                <span className="whitespace-nowrap">Created {new Date(agent.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {runningSession && runningSession.browserSessionId && (
              <button
                onClick={() => setShowLiveExecution(true)}
                className="flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-white transition-all duration-200 font-medium border border-white/[0.08] hover:border-white/[0.12] text-sm md:text-base min-h-[44px]"
              >
                <Activity size={16} className="md:w-[18px] md:h-[18px]" />
                <span>Watch Live</span>
              </button>
            )}
            <button
              onClick={handleToggleDeployment}
              disabled={isDeploying || isStopping}
              className={`flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-xl transition-all duration-200 font-medium text-sm md:text-base min-h-[44px] ${
                isDeploying || isStopping
                  ? "bg-gray-600 cursor-not-allowed text-white"
                  : runningSession?.browserSessionId
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {isStopping ? (
                <>
                  <Loader2 size={16} className="animate-spin md:w-[18px] md:h-[18px]" />
                  <span>Stopping Agent</span>
                </>
              ) : isDeploying ? (
                <>
                  <Loader2 size={16} className="animate-spin md:w-[18px] md:h-[18px]" />
                  <span>Starting Agent</span>
                </>
              ) : runningSession?.browserSessionId ? (
                <>
                  <Pause size={16} className="md:w-[18px] md:h-[18px]" />
                  <span>Stop Agent</span>
                </>
              ) : (
                <>
                  <Play size={16} className="md:w-[18px] md:h-[18px]" />
                  <span>Run Agent</span>
                </>
              )}
            </button>
            <button
              className="p-2.5 md:p-3 bg-white/[0.05] hover:bg-white/[0.08] rounded-xl transition-all duration-200 text-gray-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Settings"
            >
              <Settings size={16} className="md:w-[18px] md:h-[18px]" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/[0.08] mb-6 mt-6 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-4 md:gap-6 overflow-x-auto hide-scrollbar">
            {[
              { id: "overview", label: "Overview", icon: FileText },
              { id: "livepreview", label: "Live Preview", icon: Monitor },
              { id: "tasks", label: "Daily Tasks", icon: List },
              { id: "sessions", label: "Sessions", icon: Activity },
              { id: "memory", label: "Memory", icon: Brain },
              { id: "audit", label: "Audit Logs", icon: Clock },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2.5 md:py-3 border-b-2 transition-all duration-200 whitespace-nowrap text-sm md:text-base min-h-[44px] ${
                  activeTab === tab.id
                    ? "border-blue-400 text-white"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                <tab.icon size={16} className="md:w-[18px] md:h-[18px]" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === "overview" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* System Prompt */}
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6">
                <h3 className="text-base md:text-lg font-semibold text-white mb-2 md:mb-3">System Prompt</h3>
                <p className="text-sm md:text-base text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {agent.systemPrompt}
                </p>
              </div>

              {/* Knowledge Base */}
              {agent.knowledgeBase && (
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold text-white mb-2 md:mb-3">Knowledge Base</h3>
                  <p className="text-sm md:text-base text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {agent.knowledgeBase}
                  </p>
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6">
                  <div className="flex items-center gap-2 md:gap-3 mb-2">
                    <Activity size={18} className="text-blue-400 md:w-5 md:h-5" />
                    <h4 className="text-xs md:text-sm font-medium text-gray-400">Total Sessions</h4>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-white">{agent.sessions?.length || 0}</p>
                </div>

                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6">
                  <div className="flex items-center gap-2 md:gap-3 mb-2">
                    <Brain size={18} className="text-purple-400 md:w-5 md:h-5" />
                    <h4 className="text-xs md:text-sm font-medium text-gray-400">Memory Items</h4>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-white">{agent.context?.length || 0}</p>
                </div>

                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6">
                  <div className="flex items-center gap-2 md:gap-3 mb-2">
                    <CheckCircle size={18} className="text-green-400 md:w-5 md:h-5" />
                    <h4 className="text-xs md:text-sm font-medium text-gray-400">Success Rate</h4>
                  </div>
                  <p className="text-2xl md:text-3xl font-bold text-white">
                    {agent.sessions && agent.sessions.length > 0
                      ? Math.round(
                          (agent.sessions.filter((s) => s.status === "completed").length /
                            agent.sessions.length) *
                            100
                        )
                      : 0}%
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "livepreview" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {runningSession && liveViewUrl ? (
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-white/[0.08] bg-white/[0.02]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <h3 className="text-lg font-semibold text-white">Live Browser Session</h3>
                        <span className="text-sm text-gray-400">Session #{runningSession.id}</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        1024 × 768
                      </div>
                    </div>
                  </div>
                  <div style={{ height: '600px' }}>
                    <LivePreviewSplit
                      browserViewUrl={liveViewUrl}
                      sessionId={runningSession.id}
                      agentGoal={agent.description || undefined}
                      steps={liveSteps}
                    />
                  </div>
                </div>
              ) : agent.isDeployed || isDeploying ? (
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-12 text-center">
                  <div className="flex flex-col items-center justify-center space-y-6">
                    <div className="relative">
                      <Loader2 size={64} className="text-blue-500 animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Monitor size={32} className="text-blue-400" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-white text-xl font-semibold">Starting Agent...</p>
                      <p className="text-gray-400">Initializing browser session and connecting to agent</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span>This usually takes 5-10 seconds</span>
                    </div>
                  </div>
                </div>
              ) : agent.sessions && agent.sessions.length > 0 && agent.sessions[0]?.status === 'failed' ? (
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-12 text-center">
                  <div className="flex flex-col items-center justify-center space-y-6">
                    <div className="relative">
                      <XCircle size={64} className="text-red-500" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-white text-xl font-semibold">Session Failed</p>
                      <p className="text-gray-400">The agent encountered an error during execution</p>
                    </div>
                    <div className="text-sm text-gray-500 max-w-md">
                      Check the Sessions tab for error details and logs
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-12 text-center">
                  <Monitor size={64} className="mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400 text-lg mb-2">AI Agent is not running currently</p>
                  <p className="text-gray-500 text-sm">
                    Deploy the agent to see the live browser automation in action
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "tasks" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {dailyTasksLoading ? (
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-12 text-center">
                  <Loader2 size={64} className="mx-auto mb-4 text-blue-500 animate-spin" />
                  <p className="text-gray-400 text-lg mb-2">Fetching daily tasks...</p>
                  <p className="text-gray-500 text-sm">
                    Loading your campaign execution plan
                  </p>
                </div>
              ) : dailyTasks && dailyTasks.length > 0 ? (
                <div className="space-y-3">
                  {dailyTasks.map((task) => {
                    const isExpanded = expandedTaskId === task.id;
                    // Extract a meaningful one-line summary of the complete task objective
                    const extractObjective = (prompt: string) => {
                      // Try to find OBJECTIVE: section - it may span multiple lines
                      const objectiveMatch = prompt.match(/OBJECTIVE:\s*(.+?)(?=\n\n|CONTEXT:|PLATFORM:|AUTHENTICATION:|$)/is);
                      if (objectiveMatch) {
                        let objective = objectiveMatch[1].trim();
                        
                        // Remove line breaks and extra spaces
                        objective = objective.replace(/\s+/g, ' ').trim();
                        
                        // Remove verbose prefixes like "In this single session," or "In this task,"
                        objective = objective.replace(/^(In this (single )?session,?\s*|In this task,?\s*|Today,?\s*)/i, '');
                        
                        // Capitalize first letter after cleanup
                        objective = objective.charAt(0).toUpperCase() + objective.slice(1);
                        
                        // If too long, smartly truncate while keeping key information
                        // Take up to 120 chars but try to end at a natural break
                        if (objective.length > 120) {
                          let truncated = objective.substring(0, 120);
                          // Try to end at last comma, period, or word boundary
                          const lastComma = truncated.lastIndexOf(',');
                          const lastPeriod = truncated.lastIndexOf('.');
                          const lastSpace = truncated.lastIndexOf(' ');
                          
                          const breakPoint = Math.max(lastComma, lastPeriod, lastSpace);
                          if (breakPoint > 80) { // Only break if we keep at least 80 chars
                            truncated = truncated.substring(0, breakPoint);
                          }
                          return truncated.trim() + '...';
                        }
                        
                        return objective;
                      }
                      
                      // Fallback: take first line and clean it up
                      const firstLine = prompt.split('\n')[0].trim();
                      const cleaned = firstLine.replace(/^(OBJECTIVE:|In this (single )?session,?\s*|In this task,?\s*)/i, '').trim();
                      const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
                      return capitalized.length > 120 ? capitalized.substring(0, 120) + '...' : capitalized;
                    };
                    const taskTitle = extractObjective(task.taskPrompt);
                    
                    return (
                      <div
                        key={task.id}
                        className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden transition-all duration-200 hover:border-white/[0.12]"
                      >
                        {/* Accordion Header */}
                        <button
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          className="w-full px-5 py-4 flex items-center justify-between text-left transition-all duration-200"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="px-4 py-2 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-blue-400 font-bold text-sm">
                                {task.dayNumber === 0 ? 'One-shot Task' : `Day ${task.dayNumber}`}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-white font-bold text-base mb-1 line-clamp-1">{taskTitle}</h3>
                              <p className="text-gray-400 text-xs">
                                Created {new Date(task.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                            <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                              task.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                              task.status === 'running' ? 'bg-blue-500/10 text-blue-400' :
                              task.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                              'bg-gray-500/10 text-gray-400'
                            }`}>
                              {task.status}
                            </span>
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown size={20} className="text-gray-400" />
                            </motion.div>
                          </div>
                        </button>

                        {/* Accordion Content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 pb-6 border-t border-white/[0.08] pt-6">
                                {/* Full Task Description */}
                                <div className="bg-black/30 rounded-xl p-5 mb-4">
                                  <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                                    <FileText size={18} className="text-blue-400" />
                                    Full Task Description
                                  </h4>
                                  <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                                    {String(task.taskPrompt)}
                                  </pre>
                                </div>

                                {/* Task Outcomes */}
                                {task.outcomes != null && (
                                  <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-5 mb-4">
                                    <h4 className="text-green-400 font-medium mb-3 flex items-center gap-2">
                                      <CheckCircle size={18} />
                                      Task Outcomes
                                    </h4>
                                    <pre className="text-green-300/90 text-sm whitespace-pre-wrap font-mono">
                                      {JSON.stringify(task.outcomes, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {/* Completion Info */}
                                {task.completedAt && (
                                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                                    <CheckCircle size={16} className="text-green-400" />
                                    <span>Completed on {new Date(task.completedAt).toLocaleString()}</span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-12 text-center">
                  <List size={64} className="mx-auto mb-4 text-gray-600" />
                  <p className="text-gray-400 text-lg mb-2">No daily tasks yet</p>
                  <p className="text-gray-500 text-sm">
                    Daily tasks will be generated by the Master Agent when you create a sales automation campaign
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "sessions" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {!agent.sessions || agent.sessions.length === 0 ? (
                <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-12 text-center">
                  <p className="text-gray-400 text-lg">No sessions yet</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Sessions will appear here when the agent runs
                  </p>
                </div>
              ) : (
                agent.sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 hover:border-white/[0.12] transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-2 ${getStatusColor(session.status)}`}>
                            {getStatusIcon(session.status)}
                            {session.status}
                          </span>
                          <span className="text-gray-400 text-sm">
                            Session #{session.id}
                          </span>
                        </div>
                        {session.summary && (
                          <p className="text-gray-300 mb-3">{session.summary}</p>
                        )}
                        <div className="flex items-center gap-6 text-sm text-gray-400">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} />
                            {new Date(session.startedAt).toLocaleString()}
                          </div>
                          {session.completedAt && (
                            <div className="flex items-center gap-2">
                              <Clock size={14} />
                              Duration: {Math.round((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000 / 60)}m
                            </div>
                          )}
                          {(session.totalSteps != null && session.totalSteps > 0) && (
                            <div className="flex items-center gap-2">
                              <Activity size={14} />
                              {session.totalSteps} steps
                            </div>
                          )}
                        </div>
                        {session.errorMessage && (
                          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-red-400 text-sm">{session.errorMessage}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === "memory" && (
            <MemoryViewer 
              agentId={agentId} 
              contextItems={agent.context || []} 
              onUpdate={() => router.refresh()}
            />
          )}

          {activeTab === "audit" && (
            <AuditLogsViewer agentId={agentId} />
          )}
        </div>
      </div>
    </div>
  );
}
