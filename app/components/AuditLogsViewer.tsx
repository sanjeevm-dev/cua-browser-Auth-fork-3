"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Terminal, Image as ImageIcon } from "lucide-react";
import type { AgentSession, SessionLog } from "../../lib/types/mongodb";
import Loader from "./Loader";

interface AuditLogsViewerProps {
  agentId: string;
}

interface SessionWithLogs extends AgentSession {
  logs?: SessionLog[];
}

export default function AuditLogsViewer({ agentId }: AuditLogsViewerProps) {
  const [sessions, setSessions] = useState<SessionWithLogs[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SessionWithLogs | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch(`/api/agents/${agentId}`);
      if (!response.ok) throw new Error("Failed to fetch agent");
      const data = await response.json();
      
      const sessionsWithLogs: SessionWithLogs[] = [];
      for (const session of (data.sessions || [])) {
        const sessionRes = await fetch(`/api/sessions/${session.id}`);
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          sessionsWithLogs.push(sessionData.session);
        }
      }
      
      setSessions(prevSessions => {
        // Auto-select the most recent running or recent session only on first load
        if (prevSessions.length === 0 && sessionsWithLogs.length > 0) {
          const runningSession = sessionsWithLogs.find(s => s.status === "running");
          setSelectedSession(runningSession || sessionsWithLogs[0]);
        }
        return sessionsWithLogs;
      });
      
      // Update the selected session data if it exists in the new sessions
      setSelectedSession(prev => {
        if (!prev) return null;
        const updated = sessionsWithLogs.find(s => s.id === prev.id);
        return updated || prev;
      });
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 3000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  useEffect(() => {
    if (selectedSession && selectedSession.status === "running") {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedSession]);

  if (loading) {
    return <Loader />;
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-8 md:p-12 text-center">
        <p className="text-gray-400 text-base md:text-lg">No audit logs yet</p>
        <p className="text-gray-500 text-sm mt-2">
          Logs will appear here when the agent performs actions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Session Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => setSelectedSession(session)}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg whitespace-nowrap transition-all duration-200 text-sm md:text-base min-h-[44px] ${
              selectedSession?.id === session.id
                ? "bg-blue-600 text-white"
                : "bg-white/[0.05] text-gray-400 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            <span className="text-sm font-medium">Session #{session.id}</span>
            {session.status === "running" && (
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Live Session Logs */}
      {selectedSession && (
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl overflow-hidden">
          <div className="p-3 md:p-4 border-b border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Terminal size={16} className="text-gray-400 md:w-[18px] md:h-[18px] flex-shrink-0" />
              <h3 className="text-base md:text-lg font-semibold text-white">Live Session Logs</h3>
              <span className="text-xs md:text-sm text-gray-500 truncate">Session #{selectedSession.id}</span>
            </div>
            {selectedSession.status === "running" && (
              <div className="flex items-center gap-2 text-blue-400 text-xs md:text-sm whitespace-nowrap">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                Live
              </div>
            )}
          </div>

          <div className="p-4 md:p-6 max-h-[600px] overflow-y-auto">
            {!selectedSession.logs || selectedSession.logs.length === 0 ? (
              <div className="text-center py-8 md:py-12">
                <p className="text-gray-400 text-sm md:text-base">No logs yet</p>
                <p className="text-gray-500 text-xs md:text-sm mt-2">
                  Logs will appear here as the agent performs actions
                </p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {selectedSession.logs.map((log) => {
                  const isMessageTool = log.tool === "MESSAGE";
                  
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`p-3 md:p-4 rounded-xl border transition-all duration-200 ${
                        isMessageTool
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-white/[0.03] border-white/[0.08] hover:border-white/[0.12]'
                      }`}
                    >
                      <div className="flex items-start gap-2 md:gap-3">
                        <div className="flex-shrink-0">
                          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                            <span className="text-xs md:text-sm font-semibold text-white/70">
                              #{log.stepNumber}
                            </span>
                            <span className={`px-2 py-1 ${
                              isMessageTool 
                                ? 'bg-blue-500/20 text-blue-300' 
                                : 'bg-purple-500/20 text-purple-300'
                            } border border-white/[0.08] text-xs rounded-md font-medium uppercase tracking-wide whitespace-nowrap`}>
                              {log.tool}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 md:mt-3 space-y-2">
                        <div className="font-medium text-sm md:text-base text-white/90 leading-relaxed break-words">
                          {log.instruction}
                        </div>
                        
                        {log.reasoning && (
                          <div className="text-xs md:text-sm text-white/70 break-words">
                            <span className="font-semibold text-white/80">Reasoning: </span>
                            {log.reasoning}
                          </div>
                        )}

                        {log.screenshotUrl && (
                          <div className="mt-2 md:mt-3">
                            <a
                              href={log.screenshotUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-xs md:text-sm"
                            >
                              <ImageIcon size={12} className="md:w-[14px] md:h-[14px]" />
                              <span>View Screenshot</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
