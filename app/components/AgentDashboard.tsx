"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Settings,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
} from "lucide-react";
import type { AgentWithSessions } from "../../lib/types/mongodb";
import Loader from "./Loader";

interface AgentDashboardProps {
  onCreateAgent: () => void;
  onViewAgent: (agentId: string) => void;
}

export default function AgentDashboard({
  onCreateAgent,
  onViewAgent,
}: AgentDashboardProps) {
  const [agents, setAgents] = useState<AgentWithSessions[]>([]);
  const [loading, setLoading] = useState(true);
  const [navigatingToAgent, setNavigatingToAgent] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await fetch("/api/agents");
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error("Error fetching agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this agent? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
      });
      fetchAgents();
    } catch (error) {
      console.error("Error deleting agent:", error);
    }
  };

  const handleToggleDeployment = async (agent: AgentWithSessions) => {
    try {
      await fetch(`/api/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isDeployed: !agent.isDeployed,
        }),
      });
      fetchAgents();
    } catch (error) {
      console.error("Error toggling deployment:", error);
    }
  };

  const getStatusColor = (agent: AgentWithSessions) => {
    if (!agent.isDeployed) return "text-gray-400";
    if (agent.runningStatus === "running") return "text-green-400";
    if (agent.runningStatus === "paused") return "text-yellow-400";
    return "text-blue-400";
  };

  const getStatusText = (agent: AgentWithSessions) => {
    if (!agent.isDeployed) return "Not Deployed";
    if (agent.runningStatus === "running") return "Running";
    if (agent.runningStatus === "paused") return "Paused";
    return "Active";
  };

  const handleViewAgent = (agentId: string) => {
    setNavigatingToAgent(true);
    onViewAgent(agentId);
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2">
            Your Autonomous Agents
          </h1>
          <p className="text-sm md:text-base text-gray-400">
            Manage and monitor your deployed agents
          </p>
        </div>
        <button
          onClick={onCreateAgent}
          className="flex items-center justify-center gap-2 px-4 md:px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-200 font-medium text-sm md:text-base min-h-[48px] whitespace-nowrap"
        >
          <Play size={16} className="md:w-[18px] md:h-[18px]" />
          <span>Create New Agent</span>
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs md:text-sm mb-1">Total Agents</p>
              <p className="text-2xl md:text-3xl font-bold text-white">{agents.length}</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500/20 rounded-lg md:rounded-xl flex items-center justify-center">
              <Play size={18} className="text-blue-400 md:w-6 md:h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs md:text-sm mb-1">Deployed</p>
              <p className="text-2xl md:text-3xl font-bold text-white">
                {agents.filter((a) => a.isDeployed).length}
              </p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-green-500/20 rounded-lg md:rounded-xl flex items-center justify-center">
              <CheckCircle size={18} className="text-green-400 md:w-6 md:h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs md:text-sm mb-1">Running</p>
              <p className="text-2xl md:text-3xl font-bold text-white">
                {agents.filter((a) => a.runningStatus === "running").length}
              </p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-500/20 rounded-lg md:rounded-xl flex items-center justify-center">
              <Clock size={18} className="text-purple-400 md:w-6 md:h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs md:text-sm mb-1">Issues</p>
              <p className="text-2xl md:text-3xl font-bold text-white">0</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-red-500/20 rounded-lg md:rounded-xl flex items-center justify-center">
              <AlertCircle size={18} className="text-red-400 md:w-6 md:h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Agents List */}
      {agents.length === 0 ? (
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-8 md:p-12 text-center">
          <p className="text-gray-400 text-base md:text-lg mb-4">No agents created yet</p>
          <button
            onClick={onCreateAgent}
            className="text-blue-400 hover:text-blue-300 transition-colors text-sm md:text-base"
          >
            Create your first agent →
          </button>
        </div>
      ) : (
        <div className="space-y-3 md:space-y-4">
          {agents.map((agent) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => handleViewAgent(agent.id)}
              className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6 hover:border-white/[0.12] transition-all duration-200 cursor-pointer"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                    <h3 className="text-lg md:text-xl font-semibold text-white truncate">
                      {agent.name}
                    </h3>
                    <span
                      className={`text-xs md:text-sm font-medium ${getStatusColor(agent)} whitespace-nowrap`}
                    >
                      {getStatusText(agent)}
                    </span>
                  </div>
                  {agent.description && (
                    <p className="text-sm md:text-base text-gray-400 mb-3 line-clamp-2">{agent.description}</p>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-xs md:text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="md:w-4 md:h-4" />
                      {agent.runtimePerDay} min/day
                    </div>
                    {agent.targetWebsite && (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0">Target:</span>
                        <span className="text-blue-400 truncate">
                          {agent.targetWebsite}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span>Created:</span>
                      <span className="whitespace-nowrap">
                        {new Date(agent.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewAgent(agent.id);
                    }}
                    className="p-2.5 md:p-2 hover:bg-white/[0.05] rounded-lg transition-all duration-200 text-gray-400 hover:text-white min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                    title="View Details"
                  >
                    <Eye size={16} className="md:w-[18px] md:h-[18px]" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleDeployment(agent);
                    }}
                    className={`p-2.5 md:p-2 hover:bg-white/[0.05] rounded-lg transition-all duration-200 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center ${
                      agent.isDeployed ? "text-yellow-400" : "text-green-400"
                    }`}
                    title={agent.isDeployed ? "Stop Agent" : "Run Agent"}
                  >
                    {agent.isDeployed ? (
                      <Pause size={16} className="md:w-[18px] md:h-[18px]" />
                    ) : (
                      <Play size={16} className="md:w-[18px] md:h-[18px]" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewAgent(agent.id);
                    }}
                    className="p-2.5 md:p-2 hover:bg-white/[0.05] rounded-lg transition-all duration-200 text-gray-400 hover:text-white min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                    title="Settings"
                  >
                    <Settings size={16} className="md:w-[18px] md:h-[18px]" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteAgent(agent.id);
                    }}
                    className="p-2.5 md:p-2 hover:bg-white/[0.05] rounded-lg transition-all duration-200 text-gray-400 hover:text-red-400 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
                    title="Delete Agent"
                  >
                    <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Loading overlay when navigating to agent details */}
      {navigatingToAgent && <Loader />}
    </div>
  );
}
