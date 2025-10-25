import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { apiRateLimiter, applyRateLimit } from "../../lib/rate-limiter";

// Instantiate OpenAI within the handler to avoid build-time failures

interface PlanningRequirements {
  name: string;
  description?: string;
  targetWebsite?: string;
  objective?: string;
  successMetrics?: string;
  dataFields?: string[];
  outputDestination?: string;
  constraints?: string;
  systemPrompt?: string;
  knowledgeBase?: string;
  credentials?: Record<string, string>;
}

// Validate that the generated prompt has all required sections
function validatePromptQuality(prompt: string): { valid: boolean; missing: string[] } {
  const requiredSections = [
    'STRATEGIC OBJECTIVE',
    'AUTHENTICATION',
    'WORKFLOW',
    'GUARDRAILS',
    'SUCCESS VALIDATION',
    'STOPPING CRITERIA'
  ];
  
  const missing: string[] = [];
  const promptUpper = prompt.toUpperCase();
  
  for (const section of requiredSections) {
    if (!promptUpper.includes(section)) {
      missing.push(section);
    }
  }
  
  // Check minimum word count (should be at least 200 words for detailed instructions)
  const wordCount = prompt.split(/\s+/).length;
  if (wordCount < 200) {
    missing.push(`WORD_COUNT (${wordCount}/200 minimum)`);
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

export async function POST(request: NextRequest) {
  const rateLimit = await applyRateLimit(request, apiRateLimiter);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: rateLimit.headers
      }
    );
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY' },
        { status: 500, headers: rateLimit.headers }
      );
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const body = await request.json() as PlanningRequirements;

    // Build detailed credential mapping with platform-specific instructions
    let credentialsText = 'No specific credentials provided';
    let authenticationPlaybook = 'No authentication required';
    
    if (body.credentials && Object.keys(body.credentials).length > 0) {
      const credentialEntries = Object.entries(body.credentials);
      credentialsText = credentialEntries
        .map(([key, value]) => `  - ${key}: ${value}`)
        .join('\n');
      
      // Group credentials by platform for authentication playbook
      const platformGroups: Record<string, Record<string, string>> = {};
      credentialEntries.forEach(([key, value]) => {
        const match = key.match(/^auth-(.+?)_(.+)$/);
        if (match) {
          const [, platform, field] = match;
          if (!platformGroups[platform]) platformGroups[platform] = {};
          platformGroups[platform][field] = value;
        }
      });
      
      if (Object.keys(platformGroups).length > 0) {
        authenticationPlaybook = Object.entries(platformGroups)
          .map(([platform, creds]) => {
            const credList = Object.entries(creds)
              .map(([field, val]) => `    - ${field}: ${val}`)
              .join('\n');
            return `  ${platform}:\n${credList}`;
          })
          .join('\n\n');
      }
    }

    // Create the STRATEGIC meta-prompt for foolproof autonomous execution
    const strategicMetaPrompt = `You are a STRATEGIC TASK PLANNING AGENT specialized in creating foolproof browser automation execution plans for AI agents using OpenAI's Computer Use API.

Your mission: Transform the user's automation goal into a COMPREHENSIVE, AUTONOMOUS-READY execution plan that requires ZERO human intervention.

═══════════════════════════════════════════════════════════════
📋 AUTOMATION REQUIREMENTS
═══════════════════════════════════════════════════════════════

AGENT NAME: ${body.name}
OBJECTIVE: ${body.objective || 'Execute automation task'}
TARGET PLATFORM: ${body.targetWebsite || 'Web platform'}
DATA TO EXTRACT: ${body.dataFields?.join(', ') || 'As needed'}
OUTPUT DESTINATION: ${body.outputDestination || 'Store results appropriately'}
CONSTRAINTS: ${body.constraints || 'None specified'}
SYSTEM CONTEXT: ${body.systemPrompt || 'General purpose automation'}
KNOWLEDGE BASE: ${body.knowledgeBase || 'None'}

AVAILABLE CREDENTIALS:
${credentialsText}

AUTHENTICATION PLAYBOOK:
${authenticationPlaybook}

═══════════════════════════════════════════════════════════════
🎯 YOUR TASK: CREATE A FOOLPROOF EXECUTION PLAN
═══════════════════════════════════════════════════════════════

Generate a DETAILED execution prompt (300-500 words) with these MANDATORY sections:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. STRATEGIC OBJECTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Clear goal with EXACT metrics (e.g., "Extract 50 leads", "Post 10 items")
- Target platforms explicitly listed
- Expected deliverables (formats, quantities)
- Overall success definition

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. AUTHENTICATION SEQUENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For EACH platform requiring login:
- Step 1: Navigate to login URL (specific URL)
- Step 2: Locate email/username field (exact selector/description)
- Step 3: Enter credential (reference specific credential variable)
- Step 4: Locate password field (exact selector/description)
- Step 5: Enter password (reference specific credential variable)
- Step 6: Click login button (exact selector/description)
- Step 7: Verify successful login (what to check - e.g., dashboard appears, username visible)
- Step 8: Handle 2FA/captcha if needed (skip or manual intervention note)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. DETAILED WORKFLOW (10-20 GRANULAR STEPS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Break down the COMPLETE task into 10-20 atomic steps:
- Navigation: "Go to [exact URL]"
- Interaction: "Click [specific button/link described by text or position]"
- Data Entry: "Type [specific text] into [field description]"
- Extraction: "Locate [element] and extract [specific fields]"
- Validation: "Verify [expected result] appears"
- Storage: "Save data to [specific location/format]"

CRITICAL: Each step must be EXECUTABLE by an AI with NO human clarification.

Examples:
✅ GOOD: "Navigate to linkedin.com/feed, wait for page load, click the 'Start a post' button (blue button in top feed section)"
❌ BAD: "Go to LinkedIn and post"

✅ GOOD: "Extract product name (h1 tag), launch date (text below name), and description (first paragraph) from each product card"
❌ BAD: "Get product info"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. GUARDRAILS & ERROR HANDLING (10+ EDGE CASES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cover AT LEAST 10 potential failures with specific recovery:

Login Failures:
- If login fails → Retry up to 3 times with 5-second waits
- If credentials invalid → Log error and abort
- If 2FA required → Skip automation and log for manual review

Navigation Failures:
- If page doesn't load → Wait 10 seconds, refresh, retry once
- If element not found → Wait 5 seconds for dynamic content, retry 3 times
- If unexpected popup appears → Close popup, return to main flow

Data Extraction Failures:
- If data field missing → Skip that item, log warning, continue to next
- If format unexpected → Attempt to extract anyway, flag for review
- If extraction times out → Skip item after 30 seconds

Rate Limiting:
- If rate limited → Wait 60 seconds, resume
- If IP blocked → Abort and notify

Partial Success:
- If 80% data extracted successfully → Consider success
- If <80% success rate → Mark as partial failure
- Always log successful and failed items

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. SUCCESS VALIDATION & OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Minimum completion rate: 80% (adjust based on task)
- Required data fields: ${body.dataFields?.join(', ') || 'All specified fields must be present'}
- Output format: ${body.outputDestination ? `Export to ${body.outputDestination}` : 'Structured JSON or CSV'}
- Verification steps:
  • Count total items processed
  • Verify all required fields populated
  • Check data quality (no empty values in critical fields)
  • Confirm export/save successful

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. STOPPING CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Task complete when: [Define exact completion condition - e.g., "50 items extracted and saved"]
- Maximum runtime: 15 minutes (abort if exceeded)
- Maximum retries per step: 3 attempts
- Abort conditions:
  • Critical authentication failure (invalid credentials)
  • Platform structure changed (major selectors missing)
  • Network failure for >2 minutes
  • Success rate falls below 50% after 10 items

═══════════════════════════════════════════════════════════════
📝 OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════

Return a COMPLETE execution prompt that:
✅ Is 300-500 words (comprehensive but focused)
✅ Includes ALL 6 sections above
✅ Has 10-20 granular workflow steps
✅ Covers 10+ specific error scenarios
✅ Provides exact selectors/descriptions (not vague references)
✅ Enables 100% autonomous execution
✅ Requires ZERO human intervention once started

Make every instruction CRYSTAL CLEAR so an AI agent can execute this blindfolded.

Return ONLY the execution prompt text, formatted clearly with the 6 sections.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are an expert strategic task planning agent. You create foolproof, comprehensive browser automation execution plans that enable 100% autonomous operation. Your instructions are crystal clear, cover all edge cases, and require zero human intervention."
        },
        { role: "user", content: strategicMetaPrompt }
      ],
      temperature: 0.3, // Lower temperature for consistent, reliable instructions
      max_tokens: 3500, // Increased for comprehensive detailed prompts
    });

    const detailedExecutionPrompt = completion.choices[0].message.content || "";

    // Log the generated prompt on the server side
    console.log('\n' + '='.repeat(100));
    console.log('🤖 CUA EXECUTION PROMPT GENERATED ON SERVER');
    console.log('='.repeat(100));
    console.log('Agent:', body.name);
    console.log('Target Website:', body.targetWebsite);
    console.log('Objective:', body.objective);
    console.log('='.repeat(100));
    console.log('FULL PROMPT:');
    console.log(detailedExecutionPrompt);
    console.log('='.repeat(100));
    console.log('Word Count:', detailedExecutionPrompt.split(/\s+/).length);
    console.log('Character Count:', detailedExecutionPrompt.length);
    console.log('='.repeat(100) + '\n');

    // Validate the generated prompt quality
    const validation = validatePromptQuality(detailedExecutionPrompt);
    
    if (!validation.valid) {
      console.warn('⚠️ Generated prompt missing sections:', validation.missing);
      // Still return the prompt but log the warning
      // In production, you might want to retry or enhance the prompt
    } else {
      console.log('✅ Prompt validation PASSED - All sections present');
    }

    return NextResponse.json(
      { 
        detailedExecutionPrompt,
        success: true,
        validation: validation.valid ? 'passed' : 'warning',
        missingSections: validation.missing
      },
      { headers: rateLimit.headers }
    );

  } catch (error) {
    console.error("Error generating CUA prompt:", error);
    return NextResponse.json(
      { error: "Failed to generate execution prompt" },
      { 
        status: 500,
        headers: rateLimit.headers
      }
    );
  }
}
