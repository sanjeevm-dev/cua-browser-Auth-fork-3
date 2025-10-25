"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import type { AgentSession } from "../../lib/types/mongodb";
import ChatFeed from "./ChatFeed";
import Loader from "./Loader";

interface SessionViewerProps {
  sessionId: string;
  onBack: () => void;
  existingBrowserSessionId?: string;
}

export default function SessionViewer({ sessionId, onBack, existingBrowserSessionId }: SessionViewerProps) {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) throw new Error("Failed to fetch session");
      const data = await response.json();
      setSession(data.session);
    } catch (error) {
      console.error("Error fetching session:", error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  if (loading) {
    return <Loader />;
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-white text-lg">Session not found</div>
      </div>
    );
  }

  return (
    <div className="relative h-screen">
      {/* Back button overlay - responsive positioning */}
      <div className="absolute top-4 left-4 md:left-20 lg:left-48 z-50">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/[0.08] rounded-lg text-gray-400 hover:text-white transition-colors min-h-[44px] text-sm md:text-base"
        >
          <ArrowLeft size={18} className="md:w-5 md:h-5" />
          <span className="hidden sm:inline">Back to Agent</span>
          <span className="sm:hidden">Back</span>
        </button>
      </div>

      {/* ChatFeed component */}
      <ChatFeed 
        initialMessage={session.summary || `Session #${session.id}`}
        onClose={onBack}
        existingBrowserSessionId={existingBrowserSessionId || session.browserSessionId || undefined}
        existingSessionId={session.id}
      />
    </div>
  );
}
