"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { useMemo } from "react";

interface WorkflowPlanProps {
  executionPrompt: string | null;
  agentName: string;
}

interface WorkflowStep {
  number: number;
  description: string;
}

function parseWorkflowSteps(executionPrompt: string | null): WorkflowStep[] {
  if (!executionPrompt) return [];

  const lines = executionPrompt.split('\n');
  const steps: WorkflowStep[] = [];
  
  // Find the "DETAILED WORKFLOW" section
  let workflowSectionStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^\d+\.\s*DETAILED WORKFLOW/i) || lines[i].match(/^DETAILED WORKFLOW/i)) {
      workflowSectionStart = i;
      break;
    }
  }
  
  if (workflowSectionStart === -1) {
    return [];
  }
  
  // Skip the section header and any separator lines
  let contentStart = workflowSectionStart + 1;
  while (contentStart < lines.length && (lines[contentStart].trim() === '' || lines[contentStart].match(/^[━═\-]+$/))) {
    contentStart++;
  }
  
  // Extract numbered steps until we hit the next section
  for (let i = contentStart; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Stop if we hit the next section (e.g., "4. GUARDRAILS & ERROR HANDLING")
    if (line.match(/^\d+\.\s*[A-Z][A-Z\s&]+(?:SEQUENCE|HANDLING|VALIDATION|CRITERIA|STOPPING)/i)) {
      break;
    }
    
    // Stop if we hit separator lines for next section
    if (line.match(/^[━═\-]{10,}$/)) {
      break;
    }
    
    // Skip empty lines
    if (!line) continue;
    
    // Match numbered steps (1., 2., 3., etc.)
    const stepMatch = line.match(/^(\d+)\.\s*(.+)/);
    if (stepMatch) {
      const stepNumber = parseInt(stepMatch[1]);
      let description = stepMatch[2].trim();
      
      // Collect continuation lines
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        
        // Stop at empty lines followed by next step or section
        if (!nextLine) {
          j++;
          continue;
        }
        
        // Stop if we hit the next numbered step
        if (nextLine.match(/^\d+\./)) {
          break;
        }
        
        // Stop if we hit next section
        if (nextLine.match(/^\d+\.\s*[A-Z][A-Z\s&]+(?:SEQUENCE|HANDLING|VALIDATION|CRITERIA|STOPPING)/i)) {
          break;
        }
        
        // Stop at separator lines
        if (nextLine.match(/^[━═\-]{10,}$/)) {
          break;
        }
        
        // Append continuation line
        description += ' ' + nextLine;
        j++;
      }
      
      i = j - 1;
      
      if (description.length > 0) {
        steps.push({ number: stepNumber, description });
      }
    }
  }

  return steps;
}

export default function WorkflowPlan({ executionPrompt, agentName }: WorkflowPlanProps) {
  const steps = useMemo(() => parseWorkflowSteps(executionPrompt), [executionPrompt]);

  if (!executionPrompt) {
    return (
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-8 md:p-12 text-center">
        <Sparkles size={48} className="mx-auto mb-3 md:mb-4 text-gray-600 md:w-16 md:h-16" />
        <p className="text-gray-400 text-base md:text-lg mb-2">No workflow plan available</p>
        <p className="text-gray-500 text-sm">
          The agent execution plan will appear here after creation
        </p>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-8 md:p-12 text-center">
        <Circle size={48} className="mx-auto mb-3 md:mb-4 text-gray-600 md:w-16 md:h-16" />
        <p className="text-gray-400 text-base md:text-lg mb-2">Workflow plan is being prepared</p>
        <p className="text-gray-500 text-sm">
          The execution steps will be extracted from the agent&apos;s instructions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-xl border border-blue-500/30 rounded-xl md:rounded-2xl p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4">
          <div className="p-2.5 md:p-3 bg-blue-500/20 rounded-lg md:rounded-xl flex-shrink-0">
            <Sparkles size={20} className="text-blue-400 md:w-6 md:h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg md:text-xl font-bold text-white mb-2">{agentName} - Workflow Plan</h3>
            <p className="text-gray-300 text-xs md:text-sm leading-relaxed">
              This is the step-by-step execution plan that the agent will follow when running. 
              These steps were generated during agent creation.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-4 md:p-6">
        <div className="space-y-2 md:space-y-3">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-3 md:gap-4 p-3 md:p-4 rounded-lg md:rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-200 border border-white/[0.05] hover:border-white/[0.1]"
            >
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <span className="text-blue-400 font-semibold text-xs md:text-sm">{step.number}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-200 text-sm md:text-base leading-relaxed break-words">{step.description}</p>
              </div>
              <div className="flex-shrink-0 hidden sm:block">
                <Circle size={18} className="text-gray-600 md:w-5 md:h-5" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl md:rounded-2xl p-3 md:p-4">
        <p className="text-gray-400 text-xs md:text-sm flex flex-wrap items-center gap-2">
          <CheckCircle2 size={14} className="text-blue-400 md:w-4 md:h-4 flex-shrink-0" />
          <span>Total Steps: <strong className="text-white">{steps.length}</strong></span>
          <span className="hidden sm:inline mx-2 text-gray-600">•</span>
          <span className="w-full sm:w-auto">These steps are executed sequentially during agent runs</span>
        </p>
      </div>
    </div>
  );
}
