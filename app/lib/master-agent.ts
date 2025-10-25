import OpenAI from 'openai';

export interface MasterAgentRequest {
  agentId?: string;
  agentName: string;
  objective: string;
  targetWebsite: string;
  dataFields: string[];
  outputDestination: string;
  constraints: string;
  systemPrompt: string;
  knowledgeBase: string;
  authCredentials: unknown;
  planningData?: Record<string, unknown> | null;
  icp?: string;
  valueProp?: string;
  platforms?: string[];
  uploadedFiles?: Array<{name: string; content: string; type: string; size: number}>;
}

export interface DailyTask {
  dayNumber: number;
  taskPrompt: string;
}

export interface MasterAgentResponse {
  success: boolean;
  dailyTasks: DailyTask[];
  campaignDuration: number;
  message?: string;
  error?: string;
}

/**
 * Generate platform-specific goto() examples for browser navigation
 */
function generatePlatformExamples(platforms?: string[], targetWebsite?: string): string {
  const examples: string[] = [];
  
  const platformMap: Record<string, string> = {
    'linkedin': 'goto("https://www.linkedin.com/")',
    'twitter': 'goto("https://twitter.com/")',
    'x': 'goto("https://x.com/")',
    'facebook': 'goto("https://www.facebook.com/")',
    'instagram': 'goto("https://www.instagram.com/")',
    'github': 'goto("https://github.com/")',
    'youtube': 'goto("https://www.youtube.com/")',
    'tiktok': 'goto("https://www.tiktok.com/")',
    'reddit': 'goto("https://www.reddit.com/")',
    'producthunt': 'goto("https://www.producthunt.com/")',
  };
  
  if (platforms && platforms.length > 0) {
    platforms.forEach(platform => {
      const normalizedPlatform = platform.toLowerCase().trim();
      if (platformMap[normalizedPlatform]) {
        examples.push(platformMap[normalizedPlatform]);
      } else {
        const cleanUrl = normalizedPlatform.startsWith('http') 
          ? normalizedPlatform 
          : `https://${normalizedPlatform}`;
        examples.push(`goto("${cleanUrl}")`);
      }
    });
  }
  
  if (targetWebsite) {
    const cleanUrl = targetWebsite.startsWith('http') 
      ? targetWebsite 
      : `https://${targetWebsite}`;
    if (!examples.some(ex => ex.includes(cleanUrl))) {
      examples.push(`goto("${cleanUrl}")`);
    }
  }
  
  if (examples.length === 0) {
    examples.push('goto("https://www.google.com/search?q=OpenAI+latest+news")');
    examples.push('goto("https://www.linkedin.com/")');
  }
  
  return examples.length > 0 ? examples.slice(0, 3).join(', ') : 'goto("https://example.com/")';
}

/**
 * Generate complete browser capabilities header for CUA prompts
 * This is used as a programmatic failsafe if GPT-4o doesn't include capabilities
 */
export function generateBrowserCapabilitiesHeader(platforms?: string[], targetWebsite?: string): string {
  const platformExamples = generatePlatformExamples(platforms, targetWebsite);
  
  return `BROWSER CAPABILITIES: You control a Browserbase Chromium browser with these capabilities: click, double_click, scroll, type, move, keypress, drag, wait, goto(url), back(). Navigate to platforms using ${platformExamples}. For searches, use direct URLs like goto("https://www.google.com/search?q=your+query").`;
}

/**
 * Generate daily tasks for an agent campaign using GPT-4
 * This is the core Master Agent logic extracted for direct use
 */
export async function generateDailyTasks(
  params: MasterAgentRequest
): Promise<MasterAgentResponse> {
  try {
    console.log('🧠 Master Agent: Decomposing sales plan into daily tasks...');
    console.log('\n📦 MASTER AGENT REQUEST PAYLOAD:');
    console.log('='.repeat(80));
    console.log('agentName:', params.agentName);
    console.log('objective:', params.objective);
    console.log('targetWebsite:', params.targetWebsite);
    console.log('dataFields:', params.dataFields);
    console.log('outputDestination:', params.outputDestination);
    console.log('constraints:', params.constraints);
    console.log('systemPrompt:', params.systemPrompt);
    console.log('knowledgeBase:', params.knowledgeBase);
    console.log('authCredentials:', params.authCredentials);
    console.log('planningData:', params.planningData);
    console.log('icp:', params.icp);
    console.log('valueProp:', params.valueProp);
    console.log('platforms:', params.platforms);
    console.log('uploadedFiles:', params.uploadedFiles?.map(f => ({ name: f.name, type: f.type, size: f.size })));
    console.log('='.repeat(80) + '\n');

    // Build comprehensive context about available credentials
    const credentialsText = params.authCredentials && typeof params.authCredentials === 'object' && params.authCredentials !== null && Object.keys(params.authCredentials).length > 0
      ? Object.entries(params.authCredentials as Record<string, Record<string, unknown>>)
          .map(([platform, creds]) => {
            const fields = Object.entries(creds)
              .map(([key, value]) => `  - ${key}: ${value ? '[PROVIDED]' : '[NOT SET]'}`)
              .join('\n');
            return `${platform}:\n${fields}`;
          })
          .join('\n\n')
      : 'No authentication credentials configured.';

    // Log the Master Agent prompt for verification
    console.log('\n🧠 MASTER AGENT META-PROMPT:');
    console.log('='.repeat(80));
    
    // Build the Master Agent meta-prompt - REFACTORED for CUA autonomy
    const masterAgentPrompt = `You are the MASTER AGENT - strategic orchestrator of autonomous sales automation campaigns.

══════════════════════════════════════════════════════════
📋 CAMPAIGN REQUIREMENTS
══════════════════════════════════════════════════════════

AGENT: ${params.agentName}
OBJECTIVE: ${params.objective}
PLATFORMS: ${params.platforms?.join(', ') || params.targetWebsite || 'Various platforms'}
ICP: ${params.icp || 'Not specified'}
VALUE PROP: ${params.valueProp || 'Not specified'}
DATA: ${params.dataFields?.join(', ') || 'As needed'}
OUTPUT: ${params.outputDestination || 'Store appropriately'}
CONSTRAINTS: ${params.constraints || 'None'}
CONTEXT: ${params.systemPrompt || 'General sales automation'}
KNOWLEDGE: ${params.knowledgeBase || 'None'}

CREDENTIALS AVAILABLE:
${credentialsText}

PLANNING DATA:
${params.planningData ? JSON.stringify(params.planningData, null, 2) : 'Not yet collected from planner agent'}

${params.uploadedFiles && params.uploadedFiles.length > 0 ? `
UPLOADED FILES:
${params.uploadedFiles.map((file, idx) => `
File ${idx + 1}: ${file.name}
${file.content.substring(0, 3000)}${file.content.length > 3000 ? '...(truncated)' : ''}
`).join('\n')}
` : ''}

══════════════════════════════════════════════════════════
🎯 YOUR MISSION
══════════════════════════════════════════════════════════

Break down the objective into 1-7 daily tasks based on:

CAMPAIGN DURATION:
- Simple tasks (scraping, research): 1-2 days
- Outreach campaigns: 3-5 days  
- Multi-touch nurture: 5-7 days
- Consider platform rate limits and engagement patterns

TASK SEQUENCING:
- Day 1: Auth + research/lead generation
- Days 2-5: Core execution (outreach, content, engagement)
- Final day: Analysis and consolidation
- Each day builds on previous outcomes

PLATFORM STRATEGIES:
- LinkedIn: Slow warm-up (connections → engagement → DMs)
- Twitter/X: Follow → engage → DM (respect limits)
- Email: List → personalize → send → follow-up

══════════════════════════════════════════════════════════
🤖 CUA AGENT GUIDANCE (CRITICAL)
══════════════════════════════════════════════════════════

⚠️ The CUA is an AUTONOMOUS AGENT using OpenAI's computer-use model.
It can SEE screens, DECIDE actions, and EXECUTE intelligently.

DO NOT WRITE STEP-BY-STEP INSTRUCTIONS!

✅ GOOD (High-level objective):
"Authenticate to LinkedIn using provided credentials. Search for and connect with 30 VP-level decision makers at B2B SaaS companies."

❌ BAD (Micro-steps):
"Step 1: Navigate to linkedin.com/login
Step 2: Wait 2 seconds
Step 3: Click email field
[... 17 more steps ...]"

AUTHENTICATION:
- Simply state: "Authenticate to [Platform] using provided credentials"
- The CUA handles login flows, CAPTCHAs, and verification autonomously
- Credentials are auto-injected (no {placeholder} syntax needed)

BROWSER CAPABILITIES:
⚠️ The CUA controls a remote Browserbase Chromium browser with these capabilities:
- High-level actions: click, double_click, scroll, type, move, keypress, drag, wait
- Navigation functions: goto(url), back()

When tasks require visiting specific platforms, specify navigation clearly:
- Example: ${generatePlatformExamples(params.platforms, params.targetWebsite)}

For search queries, use direct URLs:
- Example: goto("https://www.google.com/search?q=your+search+terms")

The CUA will adapt these examples to the actual task requirements autonomously.

══════════════════════════════════════════════════════════
📝 OUTPUT FORMAT (200-300 words per task)
══════════════════════════════════════════════════════════

🚨 CRITICAL: Each daily task MUST include PRODUCT CONTEXT and BROWSER CAPABILITIES so the CUA understands what it's selling and how to navigate.

Structure each daily task with these 7 sections (ALL MANDATORY):

1. PRODUCT CONTEXT (3-5 sentences) - MANDATORY
   ⚠️ The CUA is autonomous and needs to understand the full picture
   - What is the product/service? (features, benefits, how it works)
   - What problems does it solve for customers?
   - Who is the ideal customer? (specific roles, industries, company sizes)
   - What makes it unique? (value proposition, differentiators)
   - Use KNOWLEDGE, ICP, and VALUE PROP from campaign requirements above

2. OBJECTIVE (2-3 sentences)
   What to accomplish + expected outcomes

3. AUTHENTICATION (if needed, 1 sentence)
   "Authenticate to [Platform] using provided credentials"

4. BROWSER CAPABILITIES (2-4 sentences) - MANDATORY
   ⚠️ MUST be included in EVERY task prompt you generate
   Start with: "You control a Browserbase Chromium browser with these capabilities: click, double_click, scroll, type, move, keypress, drag, wait, goto(url), back()."
   Add platform-specific navigation examples based on the platforms in this task
   Examples: "Navigate to platforms using goto('https://www.linkedin.com/')" or "goto('https://x.com/')" or "goto('https://www.google.com/search?q=search+terms')"

5. WORKFLOW (4-6 high-level goals - ALL MUST BE COMPLETED)
   ⚠️ The CUA will execute these sequentially - it must finish ALL items
   - What to search/find (reference ICP for targeting)
   - Actions to take
   - Data to collect
   - How to organize

6. GUARDRAILS (3-5 rules)
   - Rate limits
   - Content to avoid
   - Error conditions
   - Stop conditions

7. SUCCESS CRITERIA (2-3 metrics)
   - Measurable outcomes
   - Quality thresholds

EXAMPLE:
{
  "dailyTasks": [
    {
      "dayNumber": 1,
      "taskPrompt": "PRODUCT CONTEXT: You are promoting SalesFlow, an AI-powered sales automation platform that helps B2B SaaS companies increase outbound response rates by 3x through intelligent personalization and multi-channel sequencing. The ideal customers are VPs of Sales and Revenue Operations at mid-market B2B SaaS companies (50-500 employees, $5M-50M ARR) who struggle with low email response rates and manual outreach processes. SalesFlow's unique value is AI-driven personalization at scale - it analyzes LinkedIn activity, company news, and tech stack to craft hyper-relevant outreach messages automatically.

OBJECTIVE: Authenticate to LinkedIn and identify 30 VP-level prospects at B2B SaaS companies for outreach.

AUTHENTICATION: Authenticate to LinkedIn using provided credentials.

BROWSER CAPABILITIES: You control a Browserbase Chromium browser with these capabilities: click, double_click, scroll, type, move, keypress, drag, wait, goto(url), back(). Navigate to LinkedIn using goto('https://www.linkedin.com/'). For searches, use direct URLs like goto('https://www.google.com/search?q=your+query').

WORKFLOW (complete ALL items below):
1. Use Sales Navigator or Advanced Search to find VPs of Sales/Revenue Ops at B2B SaaS companies
2. Filter: VP/C-level titles, B2B SaaS industry, 50-500 employees, $5M-50M revenue, USA
3. Review profiles for ICP relevance (check if they mention low response rates, manual outreach challenges)
4. Save 30 qualified prospects with company, role, recent activity, pain point indicators
5. Note specific personalization angles (recent posts about sales challenges, tech stack mentions)

GUARDRAILS:
- Max 100 profile views/day (LinkedIn limit)
- No connection requests yet (Day 2)
- If CAPTCHA appears, wait for auto-solve
- Stop after 30 prospects or 2 hours

SUCCESS CRITERIA (must achieve ALL):
- 30 qualified prospects with complete data
- Each matches ICP criteria (VP-level, B2B SaaS, right company size)
- Personalization notes captured for each lead"
    }
  ]
}

══════════════════════════════════════════════════════════
✨ KEY PRINCIPLES
══════════════════════════════════════════════════════════

✅ MANDATORY: Every task MUST start with PRODUCT CONTEXT section
✅ MANDATORY: Every task MUST include BROWSER CAPABILITIES section after AUTHENTICATION
✅ Use KNOWLEDGE, ICP, VALUE PROP from campaign requirements to build context
✅ Context should explain product, problems it solves, ideal customers, and value proposition
✅ Make context specific and actionable - CUA needs to know WHO to target and WHY
✅ Browser capabilities must list: click, double_click, scroll, type, move, keypress, drag, wait, goto(url), back()
✅ Include platform-specific goto() examples based on the platforms in the task
✅ Trust CUA autonomy - provide WHAT, not HOW
✅ Keep prompts concise (200-300 words total)
✅ Natural language, not pseudo-code
✅ Focus on outcomes, not procedures
✅ Reference previous days' results for context
✅ CRITICAL: Emphasize that ALL workflow items must be completed
✅ Use phrases like "complete ALL items" or "must achieve ALL" to prevent premature stopping

Now create the optimal daily task breakdown.

Return ONLY valid JSON:
{
  "dailyTasks": [
    { "dayNumber": 1, "taskPrompt": "..." }
  ]
}`;

    console.log(masterAgentPrompt);
    console.log('='.repeat(80) + '\n');

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Missing OPENAI_API_KEY');
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are the Master Agent - expert at decomposing sales campaigns into intelligent multi-day execution plans. Return ONLY valid JSON with "dailyTasks" array.',
        },
        {
          role: 'user',
          content: masterAgentPrompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    console.log('📦 Master Agent raw response:', responseText.substring(0, 200) + '...');

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse Master Agent response:', parseError);
      throw new Error('Master Agent returned invalid JSON');
    }

    let dailyTasks: DailyTask[] = [];
    if (Array.isArray(parsedResponse)) {
      dailyTasks = parsedResponse;
    } else if (parsedResponse.dailyTasks && Array.isArray(parsedResponse.dailyTasks)) {
      dailyTasks = parsedResponse.dailyTasks;
    } else if (parsedResponse.tasks && Array.isArray(parsedResponse.tasks)) {
      dailyTasks = parsedResponse.tasks;
    } else {
      throw new Error('Master Agent response missing dailyTasks array');
    }

    if (dailyTasks.length === 0) {
      console.warn('⚠️ Master Agent returned 0 tasks - fallback to legacy execution');
      return {
        success: true,
        dailyTasks: [],
        campaignDuration: 0,
        message: 'No daily tasks generated - using legacy execution mode'
      };
    }
    
    if (dailyTasks.length > 7) {
      console.warn(`⚠️ Master Agent returned ${dailyTasks.length} tasks, truncating to 7`);
      dailyTasks = dailyTasks.slice(0, 7);
    }

    const recommendedSections = [
      'OBJECTIVE',
      'WORKFLOW',
      'GUARDRAILS',
      'SUCCESS'
    ];

    dailyTasks.forEach((task, index) => {
      if (!task.dayNumber || !task.taskPrompt) {
        console.error(`❌ Task at index ${index} missing dayNumber or taskPrompt, skipping`);
        return;
      }
      
      const wordCount = task.taskPrompt.split(/\s+/).length;
      if (wordCount < 100) {
        console.warn(`⚠️ Task ${task.dayNumber} too short (${wordCount} words). Recommended: 150-250.`);
      } else if (wordCount > 300) {
        console.warn(`⚠️ Task ${task.dayNumber} too long (${wordCount} words). Recommended: 150-250.`);
      }
      
      const missingSections = recommendedSections.filter(section => 
        !task.taskPrompt.toUpperCase().includes(section)
      );
      
      if (missingSections.length > 0) {
        console.warn(`⚠️ Task ${task.dayNumber} missing recommended sections:`, missingSections);
      }
      
      if (task.dayNumber !== index + 1) {
        console.warn(`⚠️ Auto-fixing dayNumber from ${task.dayNumber} to ${index + 1}`);
        task.dayNumber = index + 1;
      }
    });
    
    dailyTasks = dailyTasks.filter(task => task.dayNumber && task.taskPrompt);

    console.log(`✅ Generated ${dailyTasks.length}-day campaign`);
    console.log('\n🎯 DAILY TASKS:');
    console.log('='.repeat(80));
    dailyTasks.forEach((task) => {
      const wordCount = task.taskPrompt.split(/\s+/).length;
      console.log(`\n📅 DAY ${task.dayNumber} (${wordCount} words):`);
      console.log('-'.repeat(80));
      console.log(task.taskPrompt.substring(0, 400) + (task.taskPrompt.length > 400 ? '...' : ''));
      console.log('-'.repeat(80));
    });
    console.log('='.repeat(80) + '\n');

    return {
      success: true,
      dailyTasks,
      campaignDuration: dailyTasks.length,
    };

  } catch (error) {
    console.error('❌ Master Agent error:', error);
    return {
      success: false,
      dailyTasks: [],
      campaignDuration: 0,
      error: (error as Error).message || 'Failed to generate daily tasks'
    };
  }
}

/**
 * Generate a single comprehensive task for one-shot execution
 * This creates a single browser session that completes the entire objective
 */
export async function generateOneShotTask(
  params: MasterAgentRequest
): Promise<MasterAgentResponse> {
  try {
    console.log('🎯 One-Shot Master Agent: Creating single comprehensive task...');
    console.log('\n📦 ONE-SHOT MASTER AGENT REQUEST PAYLOAD:');
    console.log('='.repeat(80));
    console.log('agentName:', params.agentName);
    console.log('objective:', params.objective);
    console.log('targetWebsite:', params.targetWebsite);
    console.log('platforms:', params.platforms);
    console.log('='.repeat(80) + '\n');

    // Build comprehensive context about available credentials
    const credentialsText = params.authCredentials && typeof params.authCredentials === 'object' && params.authCredentials !== null && Object.keys(params.authCredentials).length > 0
      ? Object.entries(params.authCredentials as Record<string, Record<string, unknown>>)
          .map(([platform, creds]) => {
            const fields = Object.entries(creds)
              .map(([key, value]) => `  - ${key}: ${value ? '[PROVIDED]' : '[NOT SET]'}`)
              .join('\n');
            return `${platform}:\n${fields}`;
          })
          .join('\n\n')
      : 'No authentication credentials configured.';

    // Build the One-Shot Master Agent meta-prompt
    const oneShotPrompt = `You are the ONE-SHOT MASTER AGENT - expert at creating comprehensive single-session automation tasks.

══════════════════════════════════════════════════════════
📋 TASK REQUIREMENTS
══════════════════════════════════════════════════════════

AGENT: ${params.agentName}
OBJECTIVE: ${params.objective}
PLATFORMS: ${params.platforms?.join(', ') || params.targetWebsite || 'Various platforms'}
ICP: ${params.icp || 'Not specified'}
VALUE PROP: ${params.valueProp || 'Not specified'}
DATA: ${params.dataFields?.join(', ') || 'As needed'}
OUTPUT: ${params.outputDestination || 'Store appropriately'}
CONSTRAINTS: ${params.constraints || 'None'}
CONTEXT: ${params.systemPrompt || 'General sales automation'}
KNOWLEDGE: ${params.knowledgeBase || 'None'}

CREDENTIALS AVAILABLE:
${credentialsText}

PLANNING DATA:
${params.planningData ? JSON.stringify(params.planningData, null, 2) : 'Not yet collected from planner agent'}

${params.uploadedFiles && params.uploadedFiles.length > 0 ? `
UPLOADED FILES:
${params.uploadedFiles.map((file, idx) => `
File ${idx + 1}: ${file.name}
${file.content.substring(0, 3000)}${file.content.length > 3000 ? '...(truncated)' : ''}
`).join('\n')}
` : ''}

══════════════════════════════════════════════════════════
🎯 YOUR MISSION
══════════════════════════════════════════════════════════

Create a SINGLE comprehensive task that will complete the entire objective in ONE browser session.

This is NOT a multi-day campaign - everything must be accomplished in a single run.

SCOPE CONSIDERATIONS:
- Keep it achievable in one session (typically 30-60 minutes)
- If the objective is complex, focus on the core value-generating actions
- Combine related steps into a cohesive workflow
- The CUA will execute this end-to-end without breaks

══════════════════════════════════════════════════════════
🤖 CUA AGENT GUIDANCE (CRITICAL)
══════════════════════════════════════════════════════════

⚠️ The CUA is an AUTONOMOUS AGENT using OpenAI's computer-use model.
It can SEE screens, DECIDE actions, and EXECUTE intelligently.

DO NOT WRITE STEP-BY-STEP INSTRUCTIONS!

✅ GOOD (High-level objective):
"Authenticate to LinkedIn, search for 50 VP-level decision makers at B2B SaaS companies, and export their contact data to a CSV file."

❌ BAD (Micro-steps):
"Step 1: Navigate to linkedin.com/login
Step 2: Wait 2 seconds
Step 3: Click email field
[... 17 more steps ...]"

AUTHENTICATION:
- Simply state: "Authenticate to [Platform] using provided credentials"
- The CUA handles login flows, CAPTCHAs, and verification autonomously
- Credentials are auto-injected (no {placeholder} syntax needed)

BROWSER CAPABILITIES:
⚠️ The CUA controls a remote Browserbase Chromium browser with these capabilities:
- High-level actions: click, double_click, scroll, type, move, keypress, drag, wait
- Navigation functions: goto(url), back()

When tasks require visiting specific platforms, specify navigation clearly:
- Example: ${generatePlatformExamples(params.platforms, params.targetWebsite)}

For search queries, use direct URLs:
- Example: goto("https://www.google.com/search?q=your+search+terms")

The CUA will adapt these examples to the actual task requirements autonomously.

══════════════════════════════════════════════════════════
📝 OUTPUT FORMAT (300-500 words)
══════════════════════════════════════════════════════════

🚨 CRITICAL: The task MUST include PRODUCT CONTEXT and BROWSER CAPABILITIES so the CUA understands what it's selling and how to navigate.

Structure the task with these 7 sections (ALL MANDATORY):

1. PRODUCT CONTEXT (3-5 sentences) - MANDATORY
   ⚠️ The CUA is autonomous and needs to understand the full picture
   - What is the product/service? (features, benefits, how it works)
   - What problems does it solve for customers?
   - Who is the ideal customer? (specific roles, industries, company sizes)
   - What makes it unique? (value proposition, differentiators)
   - Use KNOWLEDGE, ICP, and VALUE PROP from task requirements above

2. OBJECTIVE (2-3 sentences)
   What to accomplish in this single session + expected outcomes

3. AUTHENTICATION (if needed, 1 sentence)
   "Authenticate to [Platform] using provided credentials"

4. BROWSER CAPABILITIES (2-4 sentences) - MANDATORY
   ⚠️ MUST be included in the task prompt you generate
   Start with: "You control a Browserbase Chromium browser with these capabilities: click, double_click, scroll, type, move, keypress, drag, wait, goto(url), back()."
   Add platform-specific navigation examples based on the platforms in this task
   Examples: "Navigate to platforms using goto('https://www.linkedin.com/')" or "goto('https://x.com/')" or "goto('https://www.google.com/search?q=search+terms')"

5. WORKFLOW (6-10 high-level goals - ALL MUST BE COMPLETED)
   ⚠️ The CUA will execute these sequentially in a single session
   - What to search/find (reference ICP for targeting)
   - Actions to take
   - Data to collect
   - How to organize and export
   - Final deliverable

6. GUARDRAILS (3-5 rules)
   - Rate limits
   - Content to avoid
   - Error conditions
   - Stop conditions

7. SUCCESS CRITERIA (2-3 metrics)
   - Measurable outcomes
   - Quality thresholds
   - Final deliverable format

EXAMPLE:
{
  "oneShotTask": {
    "dayNumber": 0,
    "taskPrompt": "PRODUCT CONTEXT: You are promoting SalesFlow, an AI-powered sales automation platform that helps B2B SaaS companies increase outbound response rates by 3x through intelligent personalization and multi-channel sequencing. The ideal customers are VPs of Sales and Revenue Operations at mid-market B2B SaaS companies (50-500 employees, $5M-50M ARR) who struggle with low email response rates and manual outreach processes. SalesFlow's unique value is AI-driven personalization at scale.

OBJECTIVE: In this single session, authenticate to LinkedIn, identify 50 qualified VP-level prospects at B2B SaaS companies, and export their contact information to a CSV file for immediate outreach.

AUTHENTICATION: Authenticate to LinkedIn using provided credentials.

BROWSER CAPABILITIES: You control a Browserbase Chromium browser with these capabilities: click, double_click, scroll, type, move, keypress, drag, wait, goto(url), back(). Navigate to LinkedIn using goto('https://www.linkedin.com/'). For searches, use direct URLs like goto('https://www.google.com/search?q=your+query').

WORKFLOW (complete ALL items below in a single session):
1. Use Sales Navigator or Advanced Search to find VPs of Sales/Revenue Ops at B2B SaaS companies
2. Filter: VP/C-level titles, B2B SaaS industry, 50-500 employees, $5M-50M revenue, USA
3. Review profiles for ICP relevance (check if they mention sales challenges)
4. Collect data for 50 prospects: name, company, title, LinkedIn URL, recent activity, pain point indicators
5. Note specific personalization angles for each (recent posts, tech stack mentions)
6. Export all data to a CSV file with columns: Name, Company, Title, LinkedIn URL, Personalization Notes
7. Verify CSV has all 50 prospects with complete data
8. Save the CSV file

GUARDRAILS:
- Max 150 profile views/session (LinkedIn limit)
- If CAPTCHA appears, wait for auto-solve
- Stop at 50 prospects or 90 minutes
- Skip prospects without clear B2B SaaS affiliation

SUCCESS CRITERIA (must achieve ALL):
- CSV file with exactly 50 qualified prospects
- Each prospect matches ICP criteria
- Personalization notes captured for each lead
- File saved and ready for upload"
  }
}

══════════════════════════════════════════════════════════
✨ KEY PRINCIPLES
══════════════════════════════════════════════════════════

✅ MANDATORY: Task MUST start with PRODUCT CONTEXT section
✅ MANDATORY: Task MUST include BROWSER CAPABILITIES section after AUTHENTICATION
✅ Use KNOWLEDGE, ICP, VALUE PROP from task requirements to build context
✅ Make it achievable in ONE session (30-60 minutes typical)
✅ Browser capabilities must list: click, double_click, scroll, type, move, keypress, drag, wait, goto(url), back()
✅ Include platform-specific goto() examples based on the platforms in the task
✅ Trust CUA autonomy - provide WHAT, not HOW
✅ Natural language, not pseudo-code
✅ Focus on outcomes and final deliverable
✅ CRITICAL: Emphasize that ALL workflow items must be completed
✅ Include clear export/save step for deliverables

Now create the optimal one-shot task.

Return ONLY valid JSON:
{
  "oneShotTask": {
    "dayNumber": 0,
    "taskPrompt": "..."
  }
}`;

    console.log(oneShotPrompt);
    console.log('='.repeat(80) + '\n');

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('Missing OPENAI_API_KEY');
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are the One-Shot Master Agent - expert at creating comprehensive single-session automation tasks. Return ONLY valid JSON with "oneShotTask" object.',
        },
        {
          role: 'user',
          content: oneShotPrompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    console.log('📦 One-Shot Master Agent raw response:', responseText.substring(0, 200) + '...');

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse One-Shot Master Agent response:', parseError);
      throw new Error('One-Shot Master Agent returned invalid JSON');
    }

    let oneShotTask: DailyTask;
    if (parsedResponse.oneShotTask) {
      oneShotTask = parsedResponse.oneShotTask;
    } else if (parsedResponse.task) {
      oneShotTask = parsedResponse.task;
    } else if (parsedResponse.taskPrompt) {
      oneShotTask = {
        dayNumber: 0,
        taskPrompt: parsedResponse.taskPrompt
      };
    } else {
      throw new Error('One-Shot Master Agent response missing task');
    }

    if (!oneShotTask.taskPrompt) {
      throw new Error('One-Shot Master Agent response missing taskPrompt');
    }

    // Ensure dayNumber is 0 for one-shot tasks
    oneShotTask.dayNumber = 0;

    const wordCount = oneShotTask.taskPrompt.split(/\s+/).length;
    console.log(`\n✅ Generated one-shot task (${wordCount} words)`);
    console.log('='.repeat(80));
    console.log(oneShotTask.taskPrompt);
    console.log('='.repeat(80) + '\n');

    return {
      success: true,
      dailyTasks: [oneShotTask],
      campaignDuration: 1,
    };

  } catch (error) {
    console.error('❌ One-Shot Master Agent error:', error);
    return {
      success: false,
      dailyTasks: [],
      campaignDuration: 0,
      error: (error as Error).message || 'Failed to generate one-shot task'
    };
  }
}
