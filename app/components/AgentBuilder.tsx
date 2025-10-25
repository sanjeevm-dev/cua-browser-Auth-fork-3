"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import Tooltip from "./Tooltip";
import { useToast } from "../contexts/ToastContext";
import pdfToText from 'react-pdftotext';
import { 
  ArrowLeft, 
  Play, 
  Settings as SettingsIcon, 
  Eye, 
  Globe, 
  BookOpen, 
  Lock, 
  Clock,
  Zap,
  Send,
  Sparkles,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  File,
  X,
  Pencil
} from "lucide-react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  Handle,
  useNodesState,
  useEdgesState,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface AgentBuilderProps {
  initialTask?: string;
  executionMode?: 'one-shot' | 'multi-step';
  onBack: () => void;
  onDeploy: (agentConfig: AgentConfig) => void;
}

export interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  executionPrompt?: string;
  targetWebsite: string;
  knowledgeBase: string;
  userExpectations?: string;
  authCredentials: {
    username?: string;
    password?: string;
    apiKey?: string;
    customFields?: Record<string, string>;
  };
  runtimePerDay: number;
  executionMode?: 'one-shot' | 'multi-step';
  initialTasks?: Array<{
    description: string;
    type: string;
    priority: number;
    frequency: string;
  }>;
  icp?: string; // Ideal Customer Profile
  valueProp?: string; // Value Proposition
  platforms?: string[]; // Target platforms
  planningData?: Record<string, unknown> | null; // Planning insights
}

type TabType = "flow" | "settings" | "preview";

type MobileTabType = "chat" | "flow" | "config";

type UploadedFile = {
  name: string;
  content: string;
  type: string;
  size: number;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  files?: UploadedFile[];
};

// Default Email/Password authentication for ALL platforms
const DEFAULT_AUTH_FIELDS = ["Email", "Password"];

// Validation functions
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

const isValidPassword = (password: string): boolean => {
  return password.trim().length >= 6;
};

const CustomNode = ({ data }: { data: { label: string; description?: string; icon?: React.ComponentType<{ size: number; className: string }>; hasCredentials?: boolean; selected?: boolean } }) => {
  const needsCredentials = data.hasCredentials === false;
  const hasCompletedCredentials = data.hasCredentials === true;
  
  return (
    <div className={`px-5 py-4 rounded-xl border ${
      data.selected 
        ? 'bg-white border-blue-500 shadow-lg' 
        : needsCredentials
          ? 'bg-white border-orange-400 hover:border-orange-500 shadow-orange-200 animate-pulse-subtle'
          : 'bg-white border-gray-200 hover:border-gray-300'
    } transition-all cursor-pointer relative min-w-[280px]`}>
      {/* Warning Badge for incomplete credentials */}
      {needsCredentials && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-lg animate-bounce-subtle z-10">
          <span className="text-white text-xs font-bold">!</span>
        </div>
      )}
      
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !border-gray-300 !w-2 !h-2" />
      <div className="flex items-center gap-3">
        {data.icon && (
          <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
            needsCredentials ? 'bg-orange-50' : 'bg-gray-100'
          }`}>
            <data.icon size={20} className={needsCredentials ? 'text-orange-600' : 'text-gray-700'} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">{data.label}</div>
          {data.description && (
            <div className="text-xs text-gray-500 mt-0.5">{data.description}</div>
          )}
          {needsCredentials && (
            <div className="text-xs text-orange-600 mt-1 font-medium">Click to configure</div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasCompletedCredentials && (
            <CheckCircle size={16} className="text-green-500" />
          )}
          {needsCredentials && (
            <AlertCircle size={16} className="text-orange-500" />
          )}
          <ChevronRight size={16} className="text-gray-400" />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !border-gray-300 !w-2 !h-2" />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

export default function AgentBuilder({ initialTask = "", executionMode = 'multi-step', onBack, onDeploy }: AgentBuilderProps) {
  const [activeTab, setActiveTab] = useState<TabType>("flow");
  const [mobileTab, setMobileTab] = useState<MobileTabType>("chat");
  const [agentName, setAgentName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [targetWebsite, setTargetWebsite] = useState("");
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [userExpectations, setUserExpectations] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [platformCredentials, setPlatformCredentials] = useState<Record<string, Record<string, string>>>({});
  const [customAuthFields, setCustomAuthFields] = useState<Record<string, string[]>>({});
  const [newFieldName, setNewFieldName] = useState("");
  const [runtimePerDay, setRuntimePerDay] = useState(15);
  const [icp, setIcp] = useState(""); // Ideal Customer Profile
  const [valueProp, setValueProp] = useState(""); // Value Proposition
  const [planningData, setPlanningData] = useState<Record<string, unknown> | null>(null); // Planning insights
  const [initialTasks, setInitialTasks] = useState<Array<{
    description: string;
    type: string;
    priority: number;
    frequency: string;
  }>>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const rightPanelWidth = 30; // 30% width for config panel
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const reactFlowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isLoading) {
      setCurrentStep(0);
      const stepInterval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev < 3) return prev + 1;
          return prev;
        });
      }, 2000);

      return () => clearInterval(stepInterval);
    } else {
      setCurrentStep(0);
    }
  }, [isLoading]);

  const isPlatformCredentialsComplete = useCallback((platform: string) => {
    const nodeId = `auth-${platform}`;
    
    // Get ALL fields (default Email/Password + any custom) for this auth node
    const predefinedFields = DEFAULT_AUTH_FIELDS;
    const customFields = customAuthFields[nodeId] || [];
    const allFields = [...predefinedFields, ...customFields];
    
    // Credentials are stored with nodeId (auth-${platform}) as key
    const credentials = platformCredentials[nodeId];
    if (!credentials) return false;
    
    // Validate each field with proper validation
    return allFields.every(field => {
      const value = credentials[field]?.trim();
      if (!value) return false;
      
      // Apply specific validation based on field type
      if (field === "Email") {
        return isValidEmail(value);
      } else if (field === "Password") {
        return isValidPassword(value);
      }
      
      // For custom fields, just check if not empty
      return value.length > 0;
    });
  }, [platformCredentials, customAuthFields]);

  const generateFlowchart = useCallback(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    let yOffset = 80;
    const xCenter = isRightPanelOpen ? -180 : 50;

    newNodes.push({
      id: 'start',
      type: 'custom',
      position: { x: xCenter, y: yOffset },
      data: { 
        label: 'Start Agent', 
        icon: Zap,
        description: 'Trigger',
        selected: selectedNodeId === 'start'
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });

    yOffset += 140;

    if (targetWebsite || selectedPlatforms.length > 0) {
      const platformLabel = targetWebsite || selectedPlatforms[0] || 'Platform';
      newNodes.push({
        id: 'platform',
        type: 'custom',
        position: { x: xCenter, y: yOffset },
        data: { 
          label: platformLabel, 
          icon: Globe,
          description: 'Access platform',
          selected: selectedNodeId === 'platform'
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });

      newEdges.push({
        id: 'e-start-platform',
        source: 'start',
        target: 'platform',
        animated: false,
        style: { stroke: '#d1d5db', strokeWidth: 1.5 }
      });

      yOffset += 180;
    }

    if (selectedPlatforms.length > 0) {
      selectedPlatforms.forEach((platform, idx) => {
        const hasCredentials = isPlatformCredentialsComplete(platform);
        
        newNodes.push({
          id: `auth-${platform}`,
          type: 'custom',
          position: { x: xCenter, y: yOffset },
          data: { 
            label: `${platform} Auth`, 
            icon: Lock,
            description: 'Authenticate',
            selected: selectedNodeId === `auth-${platform}`,
            hasCredentials: hasCredentials
          },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        });

        const sourceNode = idx === 0 ? 'platform' : `auth-${selectedPlatforms[idx - 1]}`;
        newEdges.push({
          id: `e-${sourceNode}-auth-${platform}`,
          source: sourceNode,
          target: `auth-${platform}`,
          animated: false,
          style: { stroke: '#d1d5db', strokeWidth: 1.5 }
        });

        yOffset += 180;
      });
    }

    if (initialTasks.length > 0) {
      initialTasks.forEach((task, idx) => {
        newNodes.push({
          id: `task-${idx}`,
          type: 'custom',
          position: { x: xCenter, y: yOffset },
          data: { 
            label: task.type || `Task ${idx + 1}`, 
            icon: Play,
            description: task.description?.substring(0, 30) + '...',
            selected: selectedNodeId === `task-${idx}`
          },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        });

        const sourceId = idx === 0 
          ? (selectedPlatforms.length > 0 
              ? `auth-${selectedPlatforms[selectedPlatforms.length - 1]}` 
              : (targetWebsite ? 'platform' : 'start'))
          : `task-${idx - 1}`;
        
        newEdges.push({
          id: `e-${sourceId}-task-${idx}`,
          source: sourceId,
          target: `task-${idx}`,
          animated: false,
          style: { stroke: '#d1d5db', strokeWidth: 1.5 }
        });

        yOffset += 180;
      });
    } else {
      newNodes.push({
        id: 'action',
        type: 'custom',
        position: { x: xCenter, y: yOffset },
        data: { 
          label: 'Execute Action', 
          icon: Play,
          description: 'Perform automated task',
          selected: selectedNodeId === 'action'
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });

      const sourceId = selectedPlatforms.length > 0 
        ? `auth-${selectedPlatforms[selectedPlatforms.length - 1]}` 
        : (targetWebsite ? 'platform' : 'start');
      
      newEdges.push({
        id: `e-${sourceId}-action`,
        source: sourceId,
        target: 'action',
        animated: false,
        style: { stroke: '#d1d5db', strokeWidth: 1.5 }
      });

      yOffset += 180;
    }

    if (knowledgeBase) {
      newNodes.push({
        id: 'knowledge',
        type: 'custom',
        position: { x: isRightPanelOpen ? -430 : -250, y: yOffset - 140 },
        data: { 
          label: 'Knowledge Base', 
          icon: BookOpen,
          description: 'Context & Memory',
          selected: selectedNodeId === 'knowledge'
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });

      newEdges.push({
        id: 'e-knowledge-action',
        source: 'knowledge',
        target: initialTasks.length > 0 ? 'task-0' : 'action',
        animated: false,
        style: { stroke: '#d1d5db', strokeDasharray: '5,5', strokeWidth: 1.5 }
      });
    }

    newNodes.push({
      id: 'end',
      type: 'custom',
      position: { x: xCenter, y: yOffset },
      data: { 
        label: 'Complete', 
        icon: Sparkles,
        description: 'Task finished',
        selected: selectedNodeId === 'end'
      },
      targetPosition: Position.Top,
    });

    const lastTaskId = initialTasks.length > 0 ? `task-${initialTasks.length - 1}` : 'action';
    newEdges.push({
      id: `e-${lastTaskId}-end`,
      source: lastTaskId,
      target: 'end',
      animated: false,
      style: { stroke: '#d1d5db', strokeWidth: 1.5 }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [targetWebsite, selectedPlatforms, initialTasks, knowledgeBase, selectedNodeId, isPlatformCredentialsComplete, isRightPanelOpen, setNodes, setEdges]);

  useEffect(() => {
    generateFlowchart();
  }, [generateFlowchart]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setIsRightPanelOpen(true);
    setActiveTab("flow");
  }, []);

  // Click outside detection to close panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking inside the right panel
      if (rightPanelRef.current?.contains(target)) {
        return;
      }
      
      // Don't close if clicking on a node
      if (target.closest('.react-flow__node')) {
        return;
      }
      
      // Close panel if clicking on the ReactFlow pane
      if (reactFlowRef.current?.contains(target) && isRightPanelOpen) {
        setIsRightPanelOpen(false);
        setSelectedNodeId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRightPanelOpen]);

  const initializePlannerAgent = useCallback(async () => {
    setIsLoading(true);
    setMessages([{
      role: "user",
      content: initialTask
    }]);
    
    try {
      const response = await fetch("/api/planner-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: initialTask
          }],
          initialTask,
          currentConfig: {
            name: agentName,
            description,
            systemPrompt,
            targetWebsite,
            knowledgeBase,
            userExpectations,
            platforms: selectedPlatforms,
            runtimePerDay,
            initialTasks,
          }
        }),
      });

      const data = await response.json();
      
      setMessages([
        {
          role: "user",
          content: initialTask
        },
        {
          role: "assistant",
          content: data.message
        }
      ]);

      applyConfigUpdates(data.config);
    } catch (error) {
      console.error("Error initializing planner agent:", error);
      setMessages([
        {
          role: "assistant",
          content: `I'll help you build this autonomous agent. Let me gather some information to configure it properly.\n\nWhat would you like to name this agent?`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTask, agentName, description, systemPrompt, targetWebsite, knowledgeBase, userExpectations, selectedPlatforms, runtimePerDay, initialTasks, uploadedFiles]);

  const applyConfigUpdates = (config: Record<string, unknown>) => {
    if (config.name) setAgentName(config.name as string);
    if (config.description) setDescription(config.description as string);
    if (config.systemPrompt) setSystemPrompt(config.systemPrompt as string);
    if (config.targetWebsite) setTargetWebsite(config.targetWebsite as string);
    if (config.knowledgeBase) setKnowledgeBase(config.knowledgeBase as string);
    if (config.userExpectations) setUserExpectations(config.userExpectations as string);
    if (config.platforms && Array.isArray(config.platforms) && config.platforms.length > 0) {
      setSelectedPlatforms(config.platforms as string[]);
    }
    if (config.runtimePerDay) setRuntimePerDay(config.runtimePerDay as number);
    if (config.initialTasks && Array.isArray(config.initialTasks) && config.initialTasks.length > 0) setInitialTasks(config.initialTasks as AgentConfig['initialTasks'] || []);
    if (config.icp) setIcp(config.icp as string);
    if (config.valueProp) setValueProp(config.valueProp as string);
    // Store entire planning data for Master Agent
    setPlanningData({
      objective: (config.objective as string) || (config.userExpectations as string) || userExpectations,
      dataFields: (config.dataFields as string[]) || [],
      outputDestination: (config.outputDestination as string) || '',
      constraints: (config.constraints as string) || '',
    });
  };

  useEffect(() => {
    if (initialTask && !hasInitialized.current) {
      hasInitialized.current = true;
      initializePlannerAgent();
    }
  }, [initialTask, initializePlannerAgent]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Extract text from PDF using react-pdftotext
        pdfToText(file)
          .then(text => {
            newFiles.push({
              name: file.name,
              content: text,
              type: file.type,
              size: file.size,
            });
            
            setUploadedFiles([...uploadedFiles, ...newFiles]);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            setIsUploading(false);
          })
          .catch(error => {
            console.error("Failed to extract text from pdf:", error);
            toast.error('Failed to extract text from PDF');
            setIsUploading(false);
          });
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast.error('Failed to upload file');
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMessage.trim() && uploadedFiles.length === 0) || isLoading) return;

    const userMessage = inputMessage.trim();
    const filesForMessage = [...uploadedFiles];
    const updatedMessages = [...messages, { 
      role: "user" as const, 
      content: userMessage || "I've uploaded files for you to review.",
      files: filesForMessage.length > 0 ? filesForMessage : undefined
    }];
    setMessages(updatedMessages);
    setInputMessage("");
    setUploadedFiles([]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/planner-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          initialTask,
          uploadedFiles: filesForMessage,
          currentConfig: {
            name: agentName,
            description,
            systemPrompt,
            targetWebsite,
            knowledgeBase,
            userExpectations,
            platforms: selectedPlatforms,
            runtimePerDay,
            initialTasks,
          }
        }),
      });

      const data = await response.json();
      
      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
      
      applyConfigUpdates(data.config);
    } catch (error) {
      console.error("Error calling planner agent:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "I apologize, but I encountered an error. Could you please try again?" 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePlatformCredential = (platform: string, field: string, value: string) => {
    setPlatformCredentials(prev => ({
      ...prev,
      [platform]: {
        ...(prev[platform] || {}),
        [field]: value
      }
    }));
  };

  const addCustomAuthField = (nodeId: string) => {
    if (!newFieldName.trim()) return;
    
    setCustomAuthFields(prev => ({
      ...prev,
      [nodeId]: [...(prev[nodeId] || []), newFieldName.trim()]
    }));
    setNewFieldName("");
  };

  const removeCustomAuthField = (nodeId: string, fieldName: string) => {
    setCustomAuthFields(prev => ({
      ...prev,
      [nodeId]: (prev[nodeId] || []).filter(f => f !== fieldName)
    }));
    
    // Also remove the credential value
    setPlatformCredentials(prev => {
      const updated = { ...prev };
      if (updated[nodeId]) {
        delete updated[nodeId][fieldName];
      }
      return updated;
    });
  };

  const getAuthFieldsForNode = (nodeId: string) => {
    // For auth nodes, always show Email/Password + any custom fields
    if (nodeId.startsWith('auth-')) {
      const predefinedFields = DEFAULT_AUTH_FIELDS;
      const customFields = customAuthFields[nodeId] || [];
      return [...predefinedFields, ...customFields];
    }
    
    // For any other node, only show custom fields
    return customAuthFields[nodeId] || [];
  };

  const areAllCredentialsComplete = () => {
    if (selectedPlatforms.length === 0) return true;
    return selectedPlatforms.every(platform => isPlatformCredentialsComplete(platform));
  };

  const getDeployButtonTooltip = () => {
    // State 1: Planner is actively working
    if (isLoading && messages.length > 0) {
      return "Finish planning your workflow with the Planner Agent";
    }
    
    // State 2: No platforms selected yet
    if (selectedPlatforms.length === 0) {
      return "Complete your workflow design with the Planner Agent first";
    }
    
    // State 3: Platforms selected but credentials incomplete
    if (!areAllCredentialsComplete()) {
      const incompletePlatforms = selectedPlatforms.filter(p => !isPlatformCredentialsComplete(p));
      const platformNames = incompletePlatforms.map(p => p.charAt(0).toUpperCase() + p.slice(1));
      const nodeWord = incompletePlatforms.length === 1 ? 'node' : 'nodes';
      
      // Format with commas and "and" for proper grammar
      let platformList = '';
      if (platformNames.length === 1) {
        platformList = platformNames[0];
      } else if (platformNames.length === 2) {
        platformList = platformNames.join(' and ');
      } else {
        platformList = platformNames.slice(0, -1).join(', ') + ', and ' + platformNames[platformNames.length - 1];
      }
      
      return `Missing credentials: Click the ${platformList} ${nodeWord} to configure`;
    }
    
    // State 4: Everything complete
    return "Launch your agent to start automating tasks";
  };

  const generateDefaultAgentName = (): string => {
    const platforms = selectedPlatforms.join(", ");
    
    if (selectedPlatforms.length > 0 && userExpectations) {
      if (userExpectations.toLowerCase().includes("lead")) {
        return `${platforms} Lead Generation Agent`;
      } else if (userExpectations.toLowerCase().includes("outreach") || userExpectations.toLowerCase().includes("outbound")) {
        return `${platforms} Outreach Agent`;
      } else if (userExpectations.toLowerCase().includes("enrich")) {
        return `${platforms} Lead Enrichment Agent`;
      } else if (userExpectations.toLowerCase().includes("follow")) {
        return `${platforms} Follow-up Agent`;
      } else if (userExpectations.toLowerCase().includes("crm")) {
        return `${platforms} CRM Agent`;
      } else if (userExpectations.toLowerCase().includes("awareness")) {
        return `${platforms} Awareness Campaign`;
      }
    }
    
    if (selectedPlatforms.length > 0) {
      return `${platforms} Sales Agent`;
    }
    
    return "Sales Automation Agent";
  };

  useEffect(() => {
    if (!agentName && (userExpectations || selectedPlatforms.length > 0)) {
      setAgentName(generateDefaultAgentName());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userExpectations, selectedPlatforms, icp, agentName]);

  const toast = useToast();

  const handleDeploy = async () => {
    const finalAgentName = agentName || generateDefaultAgentName();

    if (!areAllCredentialsComplete()) {
      toast.error("Please complete all credential fields before deploying");
      return;
    }

    const flattenedCreds: Record<string, string> = {};
    Object.entries(platformCredentials).forEach(([platform, fields]) => {
      Object.entries(fields).forEach(([field, value]) => {
        flattenedCreds[`${platform}_${field}`] = value;
      });
    });

    // Show full-screen loading overlay
    setIsCreatingAgent(true);

    try {
      // Create agent with sales data - Master Agent will generate multi-day tasks on backend
      const config: AgentConfig = {
        name: finalAgentName,
        description,
        systemPrompt,
        executionPrompt: undefined, // No longer used - Master Agent creates daily tasks instead
        targetWebsite,
        knowledgeBase,
        userExpectations,
        authCredentials: {
          customFields: flattenedCreds
        },
        runtimePerDay,
        executionMode, // One-shot or multi-step execution mode
        initialTasks,
        icp, // Ideal Customer Profile
        valueProp, // Value Proposition
        platforms: selectedPlatforms, // Target platforms
        planningData, // Planning insights for Master Agent
      };
      
      const toastMessage = executionMode === 'one-shot' 
        ? "✅ Creating one-shot automation..." 
        : "✅ Creating multi-day sales campaign...";
      toast.success(toastMessage);
      onDeploy(config);
    } catch (error) {
      console.error('Error creating agent:', error);
      toast.error("Failed to create agent. Please try again.");
      setIsCreatingAgent(false); // Hide loading overlay on error
    }
  };


  return (
    <div className="flex flex-col md:flex-row h-screen bg-black text-white relative">
      {/* Full-Screen Loading Overlay */}
      <AnimatePresence>
        {isCreatingAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="text-center space-y-6 max-w-md px-6">
              {/* Animated spinner */}
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                <motion.div
                  className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </div>
              
              {/* Loading text */}
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-white">
                  🤖 Creating Your Autonomous Agent
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  This may take 10-20 seconds. We&apos;re generating a comprehensive execution plan with foolproof instructions for maximum reliability.
                </p>
                <div className="flex items-center justify-center gap-1.5 pt-2">
                  <motion.div
                    className="w-2 h-2 bg-blue-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-blue-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-blue-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Tab Navigation */}
      <div className="md:hidden border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between px-4 h-14 flex-shrink-0">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/[0.05] rounded-lg transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
          aria-label="Go back"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-200 whitespace-nowrap text-sm min-h-[44px] ${
              mobileTab === "chat"
                ? "bg-blue-600 text-white"
                : "bg-white/[0.05] text-gray-400 hover:text-white"
            }`}
          >
            <Sparkles size={14} />
            <span>Chat</span>
          </button>
          <button
            onClick={() => setMobileTab("flow")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-200 whitespace-nowrap text-sm min-h-[44px] ${
              mobileTab === "flow"
                ? "bg-blue-600 text-white"
                : "bg-white/[0.05] text-gray-400 hover:text-white"
            }`}
          >
            <Eye size={14} />
            <span>Flow</span>
          </button>
          <button
            onClick={() => setMobileTab("config")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-200 whitespace-nowrap text-sm min-h-[44px] ${
              mobileTab === "config"
                ? "bg-blue-600 text-white"
                : "bg-white/[0.05] text-gray-400 hover:text-white"
            }`}
          >
            <SettingsIcon size={14} />
            <span>Config</span>
          </button>
        </div>
        <div className="w-10"></div>
      </div>

      {/* Left Panel - Chat Interface */}
      <div 
        className={`
          ${mobileTab === "chat" ? "flex" : "hidden"} md:flex
          md:border-r border-white/[0.08] flex-col transition-all duration-300
          w-full md:w-[35%]
          h-full
        `}
      >
        <div className="h-12 md:h-16 border-b border-white/[0.08] flex items-center justify-between px-3 md:px-6 bg-white/[0.02]">
          <div className="flex items-center gap-2 md:gap-3">
            <Tooltip content="Return to home page">
              <button
                onClick={onBack}
                className="p-2 hover:bg-white/[0.05] rounded-lg transition-all duration-200 hidden md:block min-h-[44px] min-w-[44px]"
                aria-label="Go back"
              >
                <ArrowLeft size={20} className="text-white" />
              </button>
            </Tooltip>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="md:w-5 md:h-5 text-blue-400" />
              <span className="font-medium text-sm md:text-base">Planner Agent</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4 min-h-0">
          {messages.map((message, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[80%] rounded-2xl px-3 py-2 md:px-4 md:py-3 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white/[0.05] text-gray-200 border border-white/[0.08]"
                }`}
              >
                {message.role === "assistant" ? (
                  <div className="text-xs md:text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-strong:text-white prose-em:text-gray-300">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <>
                    <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    {message.files && message.files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.files.map((file, fileIdx) => (
                          <div key={fileIdx} className="flex items-center gap-2 text-xs bg-white/10 rounded px-2 py-1">
                            <File size={12} />
                            <span className="truncate">{file.name}</span>
                            <span className="text-gray-400">({(file.size / 1024).toFixed(1)}KB)</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 md:p-6 border-t border-white/[0.08] bg-white/[0.02] flex-shrink-0">
          {uploadedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              {uploadedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 min-h-[44px]">
                  <File size={14} className="text-blue-400 flex-shrink-0" />
                  <span className="flex-1 text-xs md:text-sm text-gray-300 truncate">{file.name}</span>
                  <span className="text-xs text-gray-500 flex-shrink-0">({(file.size / 1024).toFixed(1)}KB)</span>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="p-1 hover:bg-white/[0.1] rounded transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <X size={14} className="text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 md:gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Tooltip content="Upload PDF files">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isLoading}
                className="p-3 bg-white/[0.05] hover:bg-white/[0.1] disabled:bg-gray-700 disabled:cursor-not-allowed border border-white/[0.08] rounded-xl transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Upload file"
              >
                <Paperclip size={16} className={`md:w-[18px] md:h-[18px] ${isUploading ? "animate-pulse text-blue-400" : "text-gray-400"}`} />
              </button>
            </Tooltip>
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e as unknown as React.FormEvent);
                }
              }}
              placeholder="Ask for changes, features or anything..."
              rows={1}
              className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 md:px-4 py-3 text-xs md:text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-all resize-none overflow-y-auto min-h-[44px] max-h-[120px]"
              style={{
                height: 'auto',
                overflowY: inputMessage.split('\n').length > 3 ? 'auto' : 'hidden'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
            <Tooltip content="Send message to Planner Agent">
              <button
                type="submit"
                disabled={(!inputMessage.trim() && uploadedFiles.length === 0) || isLoading}
                className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Send message"
              >
                <Send size={16} className="md:w-[18px] md:h-[18px]" />
              </button>
            </Tooltip>
          </form>
        </div>
      </div>

      {/* Center Panel - Workflow Flowchart */}
      <div 
        className={`
          ${mobileTab === "flow" ? "flex" : "hidden"} md:flex
          md:border-r border-white/[0.08] flex-col bg-zinc-950 transition-all duration-300
          w-full ${isRightPanelOpen ? 'md:w-[35%]' : 'md:w-[65%]'}
          h-full
        `}
      >
        <div className="h-12 md:h-16 border-b border-white/[0.08] flex items-center justify-between px-3 md:px-6 bg-white/[0.02]">
          <div className="flex items-center gap-2 md:gap-3">
            <h3 className="text-xs md:text-sm font-medium text-gray-300">Agent Workflow</h3>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Tooltip 
              content={getDeployButtonTooltip()}
              position="bottom"
            >
              <span className="inline-block">
                <button
                  onClick={handleDeploy}
                  disabled={isLoading || selectedPlatforms.length === 0 || !areAllCredentialsComplete()}
                  className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2.5 md:py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 text-xs md:text-sm font-medium min-h-[44px]"
                >
                  <Zap size={14} className="md:w-4 md:h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Deploy Agent</span>
                  <span className="sm:hidden">Deploy</span>
                </button>
              </span>
            </Tooltip>
            <Tooltip content={isRightPanelOpen ? "Close configuration panel" : "Open configuration panel"}>
              <button
                onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                className="p-2 hover:bg-white/[0.05] rounded-lg transition-all duration-200 hidden md:block min-h-[44px] min-w-[44px]"
                aria-label="Toggle configuration panel"
              >
                {isRightPanelOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden min-h-0">
          {isLoading && messages.length > 0 ? (
            <div className="flex items-center justify-center h-full bg-zinc-950 px-4">
              <div className="space-y-4 md:space-y-6 max-w-md">
                <div className="flex items-center gap-3 text-gray-300">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Sparkles size={16} className="md:w-5 md:h-5 text-blue-400 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-xs md:text-sm font-medium">Setting up your workflow…</div>
                    <div className="text-xs text-gray-500">Planning agent is thinking</div>
                  </div>
                </div>
                
                <div className="space-y-3 md:space-y-4 pl-4 md:pl-5 border-l-2 border-white/[0.08]">
                  {[
                    { label: "Analyzing your request", index: 0 },
                    { label: "Designing workflow steps", index: 1 },
                    { label: "Configuring automation", index: 2 },
                    { label: "Building your agent...", index: 3 }
                  ].map((step) => {
                    const isActive = currentStep === step.index;
                    const isCompleted = currentStep > step.index;
                    const isVisible = currentStep >= step.index;

                    return isVisible ? (
                      <motion.div
                        key={step.index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4 }}
                        className="flex items-center gap-2 md:gap-3 pl-3 md:pl-4"
                      >
                        <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                          <div 
                            className={`w-2 h-2 rounded-full ${
                              isActive 
                                ? 'bg-green-500 animate-pulse' 
                                : isCompleted 
                                  ? 'bg-gray-500' 
                                  : 'bg-gray-600'
                            }`} 
                          />
                        </div>
                        <span className={`text-xs md:text-sm ${
                          isActive ? 'text-gray-200' : 'text-gray-400'
                        }`}>
                          {step.label}
                        </span>
                      </motion.div>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div ref={reactFlowRef} className="w-full h-full min-h-[400px] md:min-h-0">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{
                  padding: 0.5,
                  includeHiddenNodes: true,
                  duration: 200,
                }}
                minZoom={0.2}
                maxZoom={1.5}
                className="bg-zinc-950"
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#333" gap={16} />
                <Controls className="!bg-black/90 !border-white/[0.15]" />
              </ReactFlow>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Agent Configuration (Collapsible on desktop, tab on mobile) */}
      <AnimatePresence>
        {(isRightPanelOpen || mobileTab === "config") && (
          <motion.div
            ref={rightPanelRef}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: mobileTab === "config" ? '100%' : `${rightPanelWidth}%`, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={`
              ${mobileTab === "config" ? "flex" : "hidden"} md:flex
              flex-col md:border-l border-white/[0.08] overflow-hidden
              w-full md:w-[30%]
            `}
          >
            <div className="h-12 md:h-16 border-b border-white/[0.08] flex items-center justify-between px-3 md:px-6 bg-white/[0.02]">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Tooltip content="Click to edit agent name" position="bottom">
                  <div className="flex items-center gap-2 flex-1 min-w-0 group">
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Agent Name"
                      className="text-sm md:text-base lg:text-lg font-semibold bg-transparent text-white placeholder-gray-500 outline-none border-b-2 border-transparent hover:border-white/[0.12] focus:border-blue-500 transition-all px-1 md:px-2 py-1 min-w-0 flex-1 min-h-[44px]"
                    />
                    <Pencil size={12} className="md:w-[14px] md:h-[14px] text-gray-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                  </div>
                </Tooltip>
                {agentName && <CheckCircle size={14} className="md:w-4 md:h-4 text-green-400 flex-shrink-0" />}
              </div>
              <Tooltip content="Close panel">
                <button
                  onClick={() => setIsRightPanelOpen(false)}
                  className="p-2 hover:bg-white/[0.05] rounded-lg transition-all duration-200 flex-shrink-0 min-h-[44px] min-w-[44px]"
                  aria-label="Close panel"
                >
                  <ChevronRight size={18} className="md:w-5 md:h-5" />
                </button>
              </Tooltip>
            </div>

            <div className="border-b border-white/[0.08] bg-white/[0.02]">
              <div className="flex gap-3 md:gap-6 px-3 md:px-6 overflow-x-auto hide-scrollbar">
                <Tooltip content="View and configure agent workflow">
                  <button
                    onClick={() => setActiveTab("flow")}
                    className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-3 border-b-2 transition-all duration-200 text-xs md:text-sm whitespace-nowrap min-h-[44px] ${
                      activeTab === "flow"
                        ? "border-blue-500 text-white"
                        : "border-transparent text-gray-400 hover:text-white"
                    }`}
                  >
                    <Play size={14} className="md:w-4 md:h-4" />
                    <span className="hidden sm:inline">Agent Flow</span>
                    <span className="sm:hidden">Flow</span>
                  </button>
                </Tooltip>
                <Tooltip content="Configure agent parameters and credentials">
                  <button
                    onClick={() => setActiveTab("settings")}
                    className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-3 border-b-2 transition-all duration-200 text-xs md:text-sm whitespace-nowrap min-h-[44px] ${
                      activeTab === "settings"
                        ? "border-blue-500 text-white"
                        : "border-transparent text-gray-400 hover:text-white"
                    }`}
                  >
                    <SettingsIcon size={14} className="md:w-4 md:h-4" />
                    Settings
                  </button>
                </Tooltip>
                <Tooltip content="Preview agent configuration and workflow">
                  <button
                    onClick={() => setActiveTab("preview")}
                    className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-3 border-b-2 transition-all duration-200 text-xs md:text-sm whitespace-nowrap min-h-[44px] ${
                      activeTab === "preview"
                        ? "border-blue-500 text-white"
                        : "border-transparent text-gray-400 hover:text-white"
                    }`}
                  >
                    <Eye size={14} className="md:w-4 md:h-4" />
                    Preview
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-6">
              <AnimatePresence mode="wait">
                {activeTab === "flow" && (
                  <motion.div
                    key="flow"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4 md:space-y-6"
                  >
                    <div className="space-y-2 md:space-y-3">
                      <label className="block text-xs md:text-sm font-medium text-gray-300 flex items-center justify-between">
                        <span>System Prompt</span>
                        {systemPrompt && systemPrompt.length > 20 && (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle size={12} />
                            Valid
                          </span>
                        )}
                      </label>
                      <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="Describe how your agent should behave..."
                        className="w-full h-28 md:h-32 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-all resize-none"
                      />
                    </div>

                    <div className="space-y-2 md:space-y-3">
                      <label className="block text-xs md:text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Globe size={14} className="md:w-4 md:h-4" />
                        Computer-Use Capabilities
                      </label>
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs md:text-sm text-gray-400">
                          <span className="flex-shrink-0">Browser</span>
                          <div className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 min-h-[44px] flex items-center">
                            {selectedPlatforms.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {selectedPlatforms.map((platform) => (
                                  <span key={platform} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                                    {platform}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500">No platforms detected yet</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 md:space-y-3">
                      <label className="block text-xs md:text-sm font-medium text-gray-300 flex items-center gap-2">
                        <BookOpen size={14} className="md:w-4 md:h-4" />
                        Knowledge Base
                      </label>
                      <textarea
                        value={knowledgeBase}
                        onChange={(e) => setKnowledgeBase(e.target.value)}
                        placeholder="Add context, company info, product details, or any information the agent should remember..."
                        className="w-full h-24 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-all resize-none"
                      />
                    </div>

                    {selectedNodeId && selectedNodeId.startsWith('auth-') && (
                      <div className="space-y-2 md:space-y-3">
                        <label className="block text-xs md:text-sm font-medium text-gray-300 flex items-center gap-2">
                          <Lock size={14} className="md:w-4 md:h-4" />
                          Auth & Credentials
                        </label>
                        {(() => {
                          const nodeId = selectedNodeId;
                          const fields = getAuthFieldsForNode(nodeId);
                          const platform = selectedNodeId.replace('auth-', '');
                          const hasCredentials = fields.some(field => platformCredentials[nodeId]?.[field]?.trim());

                          return (
                            <div className={`p-3 md:p-4 border rounded-xl space-y-3 ${
                              hasCredentials 
                                ? 'bg-green-600/10 border-green-500/30' 
                                : 'bg-blue-600/10 border-blue-500/30'
                            }`}>
                              <div className="flex items-center justify-between">
                                <h4 className={`text-xs md:text-sm font-medium ${hasCredentials ? 'text-green-300' : 'text-blue-300'}`}>
                                  {platform} credentials
                                </h4>
                                {hasCredentials && (
                                  <div className="flex items-center gap-1 text-green-400">
                                    <CheckCircle size={12} className="md:w-[14px] md:h-[14px]" />
                                    <span className="text-xs">Added</span>
                                  </div>
                                )}
                              </div>
                              
                              {fields.length === 0 && (
                                <p className="text-xs text-gray-400">No credentials added yet. Add custom fields below.</p>
                              )}
                              
                              {fields.map((field) => {
                                const fieldValue = platformCredentials[nodeId]?.[field] || '';
                                let isFieldValid = false;
                                let validationError = '';
                                
                                // Validate based on field type
                                if (fieldValue.trim()) {
                                  if (field === "Email") {
                                    isFieldValid = isValidEmail(fieldValue);
                                    if (!isFieldValid) validationError = 'Invalid email format';
                                  } else if (field === "Password") {
                                    isFieldValid = isValidPassword(fieldValue);
                                    if (!isFieldValid) validationError = 'Min 6 characters required';
                                  } else {
                                    isFieldValid = fieldValue.length > 0;
                                  }
                                }
                                
                                const isCustomField = !DEFAULT_AUTH_FIELDS.includes(field);
                                
                                return (
                                  <div key={field} className="relative space-y-1">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type={field.toLowerCase().includes('password') || field.toLowerCase().includes('secret') || field.toLowerCase().includes('token') || field.toLowerCase().includes('key') ? 'password' : 'text'}
                                        placeholder={field}
                                        value={fieldValue}
                                        onChange={(e) => updatePlatformCredential(nodeId, field, e.target.value)}
                                        className={`flex-1 bg-white/[0.05] border rounded-lg px-3 py-2.5 md:py-2 pr-8 text-white placeholder-gray-400 outline-none focus:border-blue-500 transition-all text-xs md:text-sm min-h-[44px] ${
                                          fieldValue && !isFieldValid ? 'border-red-500/50' : 'border-white/[0.12]'
                                        }`}
                                      />
                                      {isFieldValid && (
                                        <CheckCircle size={14} className="absolute right-10 top-1/2 -translate-y-1/2 text-green-400 pointer-events-none" />
                                      )}
                                      {isCustomField && (
                                        <button
                                          onClick={() => removeCustomAuthField(nodeId, field)}
                                          className="text-red-400 hover:text-red-300 text-xs p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                          title="Remove field"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                    {fieldValue && validationError && (
                                      <p className="text-xs text-red-400 pl-3">{validationError}</p>
                                    )}
                                  </div>
                                );
                              })}
                              
                              <div className="pt-2 border-t border-white/[0.08]">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Add custom field (e.g., API Key, Token)"
                                    value={newFieldName}
                                    onChange={(e) => setNewFieldName(e.target.value)}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        addCustomAuthField(nodeId);
                                      }
                                    }}
                                    className="flex-1 bg-white/[0.05] border border-white/[0.12] rounded-lg px-3 py-2.5 md:py-2 text-white placeholder-gray-400 outline-none focus:border-blue-500 transition-all text-xs md:text-sm min-h-[44px]"
                                  />
                                  <button
                                    onClick={() => addCustomAuthField(nodeId)}
                                    className="px-3 md:px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs md:text-sm font-medium transition-colors min-h-[44px]"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "settings" && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4 md:space-y-6"
                  >
                    <div className="space-y-2 md:space-y-3">
                      <label className="block text-xs md:text-sm font-medium text-gray-300">
                        System Prompt
                      </label>
                      <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="Describe how your agent should behave..."
                        className="w-full h-28 md:h-32 bg-white/[0.05] border border-white/[0.12] rounded-xl px-3 md:px-4 py-2 md:py-3 text-white placeholder-gray-400 outline-none focus:border-blue-500 transition-all text-xs md:text-sm resize-none"
                      />
                    </div>

                    <div className="space-y-2 md:space-y-3">
                      <label className="block text-xs md:text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Globe size={14} className="md:w-4 md:h-4" />
                        Computer-Use Capabilities
                      </label>
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Browser</label>
                        <input
                          type="text"
                          value={targetWebsite}
                          onChange={(e) => setTargetWebsite(e.target.value)}
                          placeholder="e.g., twitter.com"
                          className="w-full bg-white/[0.05] border border-white/[0.12] rounded-lg px-3 md:px-4 py-2.5 md:py-2 text-white placeholder-gray-400 outline-none focus:border-blue-500 transition-all text-xs md:text-sm min-h-[44px]"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 md:space-y-3">
                      <label className="block text-xs md:text-sm font-medium text-gray-300 flex items-center gap-2">
                        <BookOpen size={14} className="md:w-4 md:h-4" />
                        Knowledge Base
                      </label>
                      <textarea
                        value={knowledgeBase}
                        onChange={(e) => setKnowledgeBase(e.target.value)}
                        placeholder="Add context, company info, product details, or any information the agent should remember..."
                        className="w-full h-28 md:h-32 bg-white/[0.05] border border-white/[0.12] rounded-xl px-3 md:px-4 py-2 md:py-3 text-white placeholder-gray-400 outline-none focus:border-blue-500 transition-all text-xs md:text-sm resize-none"
                      />
                    </div>

                    <div className="space-y-2 md:space-y-3">
                      <label className="block text-xs md:text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Clock size={14} className="md:w-4 md:h-4" />
                        Daily Runtime Limit
                      </label>
                      <div className="space-y-2">
                        <input
                          type="range"
                          min="5"
                          max="60"
                          value={runtimePerDay}
                          onChange={(e) => setRuntimePerDay(parseInt(e.target.value))}
                          className="w-full min-h-[44px]"
                        />
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>5 min</span>
                          <span className="text-white font-medium">{runtimePerDay} minutes/day</span>
                          <span>60 min</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 md:p-4 bg-blue-600/10 border border-blue-500/20 rounded-xl">
                      <p className="text-xs md:text-sm text-blue-300">
                        This agent will run autonomously for up to {runtimePerDay} minutes per day. Sessions are distributed throughout the day and maintain context across runs.
                      </p>
                    </div>
                  </motion.div>
                )}

                {activeTab === "preview" && (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3 md:space-y-4"
                  >
                    <div className="p-3 md:p-4 bg-white/[0.02] border border-white/[0.08] rounded-xl">
                      <h3 className="text-xs md:text-sm font-medium text-white mb-2">Agent Configuration</h3>
                      <div className="space-y-1.5 md:space-y-2 text-xs">
                        <div><span className="text-gray-400">Name:</span> <span className="text-white">{agentName || "Not set"}</span></div>
                        <div><span className="text-gray-400">Description:</span> <span className="text-white">{description || "Not set"}</span></div>
                        <div><span className="text-gray-400">Platforms:</span> <span className="text-white">{selectedPlatforms.join(", ") || "None"}</span></div>
                        <div><span className="text-gray-400">Runtime:</span> <span className="text-white">{runtimePerDay} min/day</span></div>
                      </div>
                    </div>

                    {systemPrompt && (
                      <div className="p-3 md:p-4 bg-white/[0.02] border border-white/[0.08] rounded-xl">
                        <h3 className="text-xs md:text-sm font-medium text-white mb-2">System Prompt</h3>
                        <p className="text-xs text-gray-300 whitespace-pre-wrap">{systemPrompt}</p>
                      </div>
                    )}

                    {knowledgeBase && (
                      <div className="p-3 md:p-4 bg-white/[0.02] border border-white/[0.08] rounded-xl">
                        <h3 className="text-xs md:text-sm font-medium text-white mb-2">Knowledge Base</h3>
                        <p className="text-xs text-gray-300 whitespace-pre-wrap">{knowledgeBase}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
