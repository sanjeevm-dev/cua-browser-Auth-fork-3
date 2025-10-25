"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, Calendar, Trash2, Plus } from "lucide-react";
import type { AgentContext } from "../../lib/types/mongodb";

interface MemoryViewerProps {
  agentId: string;
  contextItems: AgentContext[];
  onUpdate?: () => void;
}

export default function MemoryViewer({ agentId, contextItems: initialItems, onUpdate }: MemoryViewerProps) {
  const [contextItems, setContextItems] = useState<AgentContext[]>(initialItems);
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    setContextItems(initialItems);
  }, [initialItems]);

  const handleAddContext = async () => {
    if (!newKey.trim() || !newValue.trim()) return;

    try {
      const response = await fetch(`/api/agents/${agentId}/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contextKey: newKey.trim(),
          contextValue: JSON.parse(newValue),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setContextItems([...contextItems, data.context]);
        setIsAdding(false);
        setNewKey("");
        setNewValue("");
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      console.error("Error adding context:", error);
      alert("Invalid JSON format. Please ensure your value is valid JSON (e.g., {\"key\": \"value\"} or \"simple string\")");
    }
  };

  const handleDeleteContext = async (contextId: string) => {
    if (!confirm("Are you sure you want to delete this memory item?")) return;

    try {
      await fetch(`/api/agents/${agentId}/context/${contextId}`, {
        method: "DELETE",
      });
      setContextItems(contextItems.filter((item) => item.id !== contextId));
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error deleting context:", error);
    }
  };

  const formatValue = (value: unknown) => {
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 md:gap-3">
          <Brain size={20} className="text-purple-400 md:w-6 md:h-6" />
          <h3 className="text-lg md:text-xl font-semibold text-white">Agent Memory</h3>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 text-sm md:text-base min-h-[44px] w-full sm:w-auto justify-center"
        >
          <Plus size={16} className="md:w-[18px] md:h-[18px]" />
          <span>Add Memory</span>
        </button>
      </div>

      {/* Add New Context Form */}
      {isAdding && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6"
        >
          <h4 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Add New Memory Item</h4>
          <div className="space-y-3 md:space-y-4">
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-300 mb-2">
                Key
              </label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g., last_processed_lead, email_template"
                className="w-full px-3 md:px-4 py-2.5 md:py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm md:text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium text-gray-300 mb-2">
                Value (JSON)
              </label>
              <textarea
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder='{"name": "John Doe", "email": "john@example.com"}'
                rows={4}
                className="w-full px-3 md:px-4 py-2.5 md:py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm md:text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono resize-none"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3">
              <button
                onClick={handleAddContext}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 text-sm md:text-base min-h-[44px]"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewKey("");
                  setNewValue("");
                }}
                className="px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] text-gray-300 rounded-lg transition-all duration-200 text-sm md:text-base min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Context Items */}
      {contextItems.length === 0 ? (
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-8 md:p-12 text-center">
          <Brain size={40} className="mx-auto text-gray-600 mb-3 md:mb-4 md:w-12 md:h-12" />
          <p className="text-gray-400 text-base md:text-lg mb-2">No memory items yet</p>
          <p className="text-gray-500 text-sm">
            The agent&apos;s memory will be stored here for persistence across sessions
          </p>
        </div>
      ) : (
        <div className="space-y-3 md:space-y-4">
          {contextItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6 hover:border-white/[0.12] transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                    <h4 className="text-base md:text-lg font-semibold text-white truncate">{item.contextKey}</h4>
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs whitespace-nowrap">
                      Memory
                    </span>
                  </div>
                  
                  <div className="bg-black/30 rounded-lg p-3 md:p-4 mb-2 md:mb-3 border border-white/[0.05] overflow-x-auto">
                    <pre className="text-xs md:text-sm text-gray-300 whitespace-pre-wrap font-mono">
                      {formatValue(item.contextValue)}
                    </pre>
                  </div>

                  <div className="flex items-center gap-2 md:gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      <span className="hidden sm:inline">Created {new Date(item.createdAt).toLocaleString()}</span>
                      <span className="sm:hidden">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteContext(item.id)}
                  className="p-2 hover:bg-white/[0.05] rounded-lg transition-all duration-200 text-gray-400 hover:text-red-400 min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
                  title="Delete Memory"
                >
                  <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
