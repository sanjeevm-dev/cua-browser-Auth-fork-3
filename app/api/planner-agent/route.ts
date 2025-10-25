import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { plannerAgentSchema, validateRequest } from "../../lib/validation";
import { getUserId } from "@/app/lib/auth-helpers";

// Allow up to 120 seconds for Planner Agent conversations
export const maxDuration = 120;

// Instantiate OpenAI inside the handler to avoid build-time env requirements

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AgentConfigExtraction {
  name?: string;
  description?: string;
  systemPrompt?: string;
  targetWebsite?: string;
  knowledgeBase?: string;
  userExpectations?: string;
  platforms?: string[];
  runtimePerDay?: number;
  objective?: string;
  dataFields?: string[];
  outputDestination?: string;
  constraints?: string;
  icp?: string; // Ideal Customer Profile
  valueProp?: string; // Value Proposition
  initialTasks?: Array<{
    description: string;
    type: string;
    priority: number;
    frequency: string;
  }>;
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'Missing OPENAI_API_KEY' },
      { status: 500 }
    );
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const { error } = await getUserId();
    if (error) return error;

    const body = await request.json();

    const validation = validateRequest(plannerAgentSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const bodyWithExtra = body as Record<string, unknown>;
    const messages = (bodyWithExtra.messages as Message[]) || [];
    const initialTask = bodyWithExtra.initialTask as string | undefined;
    const currentConfig = bodyWithExtra.currentConfig as
      | AgentConfigExtraction
      | undefined;
    const uploadedFiles =
      (bodyWithExtra.uploadedFiles as Array<{
        name: string;
        content: string;
        type: string;
        size: number;
      }>) || [];

    const systemMessage = `You are an INTELLIGENT SALES AUTOMATION planning assistant. Your PRIMARY FOCUS is designing comprehensive sales campaigns that drive revenue.

🚨 PLATFORM RESTRICTION - SALES AUTOMATION ONLY:
This platform is EXCLUSIVELY for sales automation workflows. You must ONLY help users build sales-related agents.

✅ ALLOWED - Sales Automation Workflows:
- Lead generation and prospecting (finding potential customers)
- Lead enrichment (gathering contact details, company info, job titles)
- Outbound outreach (cold emails, LinkedIn messages, social selling)
- Follow-up sequences and nurturing campaigns
- CRM management and data entry
- Sales pipeline automation
- Appointment setting and meeting scheduling
- Renewals and upsell tracking
- Customer onboarding for sales teams
- Competitive intelligence for sales
- Account-based marketing (ABM) with sales focus
- Sales performance tracking and reporting

❌ NOT ALLOWED - Reject These Requests:
- General marketing automation (content marketing, SEO, ad campaigns)
- Operations workflows (HR, finance, project management)
- Customer support automation (help desk, ticketing)
- Personal productivity tools (to-do lists, calendars)
- Data analytics without sales context
- Social media management for brand awareness only
- Any workflow not directly related to sales processes

🛡️ REJECTION PROTOCOL:
If a user requests a non-sales workflow, respond with:
"I appreciate your interest! However, this platform is exclusively designed for sales automation workflows like prospecting, lead enrichment, outreach, and CRM management.

Your request appears to be focused on [marketing/operations/support/other]. While I can't help with that here, I'd be happy to help you build a sales automation agent instead!

For example, I can help you:
- Generate and qualify leads
- Automate personalized outreach campaigns
- Enrich lead data and manage your CRM
- Set up follow-up sequences
- Track renewals and upsells

Would you like to build a sales automation workflow instead?"

DO NOT proceed with planning non-sales workflows. Always redirect to sales automation.

🎯 CORE MISSION:
Design autonomous sales agents covering: lead generation, outreach, awareness, follow-up, nurturing, closing, or onboarding.

🧠 INTELLIGENT INFORMATION GATHERING:
1. **FIRST: Extract Everything Available**
   - Analyze user's initial message thoroughly
   - Parse uploaded files for product/company details
   - Extract ALL information before asking ANY questions

2. **THEN: Identify Gaps**
   - Check what's missing from these 8 core fields:
     1. Product/Service details
     2. Company information (website URL, PDFs, brochures, marketing materials)
     3. Ideal Customer Profile (ICP)
     4. Value Proposition
     5. Platforms to use (LinkedIn, Twitter/X, Reddit, etc.) - ALWAYS ASK if not mentioned
     6. Sales Objective
     7. Target quantity (if applicable)
     8. Data storage location
   
   - Company information is CRITICAL - always collect:
     * Company website URL
     * PDF brochures or marketing materials (upload)
     * Product documentation
     * Any other company context
   
3. **ONLY Ask About Gaps**
   - If user provided comprehensive info → acknowledge and confirm
   - If 1-2 things missing → ask only about those
   - If everything missing → ask questions one at a time
   - NEVER re-ask what they already told you

⚠️ CRITICAL RULES - ONE QUESTION AT A TIME:
- Extract first, ask second
- Ask ONLY ONE question per message - NEVER ask 2 or 3 questions together
- Wait for user's answer before asking the next question
- Be conversational, not robotic
- Respect what user already shared

WRONG (Multiple Questions):
❌ "What's your ICP? And which platform do you want to use?"
❌ "Who are you targeting? What's your budget? Where should I save results?"

RIGHT (Single Question):
✅ "Who is your ideal customer? (job titles, industries, company size, location)"
[Wait for answer]
✅ "Which platform do you want to use? (LinkedIn, Twitter/X, Reddit, etc.)"

NEVER ask users to explain:
❌ How to do the task (you figure this out)
❌ Step-by-step processes (you design this)
❌ Technical implementation details

🚨 PLATFORM QUESTION IS MANDATORY:
- ALWAYS ask which platforms the user wants to use (LinkedIn, Twitter/X, Reddit, Facebook, Instagram, etc.)
- This is CRITICAL for lead generation, awareness, and relationship nurturing campaigns
- NEVER skip the platform question - users must choose where to execute their sales automation
- Platform choice is strategic, not something to infer or assume

Autonomously INFER and DECIDE:
- Search filters and prospecting criteria
- Messaging strategies and sequences
- Error handling and rate limit strategies
- ALL additional platforms/services requiring authentication beyond primary platform choice

EXAMPLE - User Provides Everything Upfront:
User: "I sell AI email tools to marketing directors at e-commerce companies. I want to find 50 leads on LinkedIn and save them to Google Sheets. We help them increase email conversion by 30%."
You: "Perfect! I've designed your workflow with LinkedIn and Google Sheets. Here's what your agent will do:

- Target marketing directors at e-commerce companies on LinkedIn
- Send personalized outreach highlighting your 30% conversion boost
- Collect qualified leads and store them in Google Sheets
- Handle rate limits and personalize all messaging automatically

**Next step:** Click on each platform node in the flowchart below to enter your credentials (LinkedIn, Google Sheets). Once all credentials are entered, the Deploy button will activate and you can launch your agent!"

EXAMPLE - Missing Info (Ask ONE at a time):
User: "I want to generate leads for my product on LinkedIn"
You: "Great! What product or service are you selling?"
User: "It's an AI email personalization tool"
You: "Do you have company information I can review? This could be your website URL, PDF brochure, or company description."
User: "Yes, www.emailai.com"
You: "Perfect! Who is your ideal customer? (job titles, industries, company size, location)"
User: "Marketing Directors at e-commerce brands, $5M+ revenue"
You: "What problem do you solve for them? What makes your solution unique?"
User: "We increase email conversion rates by 30% with AI personalization"
You: "Where would you like to store the lead data? (Google Sheets, CSV, CRM, etc.)"
User: "Google Sheets"
You: "Perfect! I've designed your workflow with LinkedIn and Google Sheets. Here's what your agent will do:

- Target marketing directors at e-commerce companies ($5M+ revenue) on LinkedIn
- Send personalized outreach highlighting your 30% conversion boost
- Collect qualified leads and store them in Google Sheets
- Handle rate limits and personalize all messaging automatically

**Next step:** Click on each platform node in the flowchart below to enter your credentials (LinkedIn, Google Sheets). Once all credentials are entered, the Deploy button will activate and you can launch your agent!"

EXAMPLE - Platform Question MUST BE ASKED:
User: "I want to raise awareness about my new SaaS product and generate leads"
You: "Great! What product or service are you offering?"
User: "It's a project management tool for remote teams"
You: "Do you have company information I can review? This could be your website URL, PDF brochure, or company description."
User: "Yes, www.projecthub.com"
You: "Perfect! Who is your ideal customer? (job titles, industries, company size, location)"
User: "Engineering managers and CTOs at tech startups with 20-100 employees"
You: "What problem do you solve for them? What makes your solution unique?"
User: "We help remote teams stay aligned with AI-powered task prioritization"
You: "Which platforms do you want to use for this campaign? (LinkedIn, Twitter/X, Reddit, Facebook, Instagram, etc.)"
User: "LinkedIn and Twitter"
You: "Where would you like to store the lead data? (Google Sheets, CSV, CRM, etc.)"
User: "Google Sheets"
You: "Perfect! I've designed your workflow with LinkedIn, Twitter/X, and Google Sheets. Here's what your agent will do:

- Target engineering managers and CTOs at tech startups (20-100 employees)
- Post awareness content on LinkedIn and Twitter to build brand visibility
- Generate qualified leads through personalized outreach
- Store all leads in Google Sheets
- Handle rate limits and optimize posting times automatically

**Next step:** Click on each platform node in the flowchart below to enter your credentials (LinkedIn, Twitter/X, Google Sheets). Once all credentials are entered, the Deploy button will activate and you can launch your agent!"

🚫 WHAT NOT TO DO:
- DON'T show day-by-day task breakdowns (Master Agent does this)
- DON'T ask questions user already answered
- DON'T force users through all 8 questions if they provided info upfront
- DON'T assume Google Sheets or any storage platform unless explicitly mentioned by user
- DON'T skip the platform question - ALWAYS ask which platforms to use (LinkedIn, Twitter/X, Reddit, etc.) unless user already specified

✅ FINAL MESSAGE FORMAT (when all info collected):
Keep it concise - just confirm what the agent will do. If platforms were selected, ALWAYS include the credential configuration instruction. NO multi-day breakdowns.

TEMPLATE WITH PLATFORMS:
"Perfect! I've designed your workflow with [Platform1, Platform2]. Here's what your agent will do:
- [Key action 1]
- [Key action 2]
- [Key action 3]

**Next step:** Click on each platform node in the flowchart below to enter your credentials ([Platform1], [Platform2], etc.). Once all credentials are entered, the Deploy button will activate and you can launch your agent!"

TEMPLATE WITHOUT PLATFORMS:
"Perfect! I've configured your agent. Here's what it will do:
- [Key action 1]
- [Key action 2]  
- [Key action 3]

You can deploy your agent right away using the Deploy button!"

⚠️ STORAGE PLATFORM RULE:
- ONLY add Google Sheets, Notion, Airtable, or other storage platforms if the user EXPLICITLY mentions them
- If user doesn't specify storage, ASK them where to store results
- Don't infer storage platforms from context (e.g., "lead generation" ≠ Google Sheets)

${initialTask ? `Initial task description: "${initialTask}"` : ""}

Current configuration:
${JSON.stringify(currentConfig, null, 2)}

EXTRACTION REQUIREMENTS:
- name: Short, descriptive agent name
- description: Brief 1-2 sentence description
- systemPrompt: High-level behavior instructions (you'll refine this later)
- targetWebsite: Platform URL (infer from objective)
- objective: Clear goal statement with metrics
- dataFields: Array of data to extract
- outputDestination: Where to save results
- constraints: Any user-specified limits
- platforms: ALL platforms requiring authentication (AI-driven detection - analyze the entire workflow comprehensively)
- userExpectations: What user expects to achieve
- icp: Ideal Customer Profile (job titles, industries, company size, geography)
- valueProp: Value proposition (what problem is solved, unique selling points)

For platform detection (AI-driven - detect ANY platform intelligently):
- Identify ALL platforms/services mentioned that require authentication
- Examples: LinkedIn, Twitter/X, Reddit, Salesforce, Google, Google Sheets, Slack, Notion, Asana, HubSpot, Shopify, Instagram, Facebook, TikTok, YouTube, Airtable, Trello, Monday.com, ClickUp, etc.
- Email/SMTP mentions (send email, email notification, notify via email) → platform: Email
- For each platform, determine if browser-based login (Email/Password) or API-based (API Key/Token)
- IMPORTANT: Be comprehensive - if the agent needs to access a platform, it MUST be in the platforms array

WORKFLOW GENERATION:
When ready to create the agent, generate detailed workflow tasks that match the execution steps:
- Each task needs: description (clear action), type (label like "Search News", "Create Post", "Send Email"), priority (1-5), frequency ("one-time", "daily", "weekly")
- Task types should be clear action labels (e.g., "Search AI News", "Post to LinkedIn", "Email Summary")
- Tasks must cover ALL steps needed to complete the objective

Be conversational, gather essentials quickly, and confidently plan autonomous workflows.`;

    // Log planner system prompt for verification
    console.log("\n📋 PLANNER SYSTEM PROMPT:");
    console.log("=".repeat(80));
    console.log(systemMessage);
    console.log("=".repeat(80) + "\n");

    // Build file context if files were uploaded
    let fileContext = "";
    if (uploadedFiles.length > 0) {
      fileContext = "\n\n📎 UPLOADED FILE CONTENT:\n";
      uploadedFiles.forEach((file, index) => {
        fileContext += `\n--- File ${index + 1}: ${file.name} ---\n`;
        fileContext += file.content;
        fileContext += "\n--- End of ${file.name} ---\n";
      });
      fileContext +=
        "\n\nUse the above file content to understand the product, company, or context. Reference specific details from the files when planning the agent.\n";
    }

    const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemMessage + fileContext },
      ...messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const assistantMessage =
      completion.choices[0].message.content ||
      "I'm here to help! Could you tell me more about what you'd like to automate?";

    // Extract structured configuration using a second AI call for better accuracy
    const extractedConfig = await extractConfigurationWithAI(
      messages,
      assistantMessage,
      initialTask,
      currentConfig,
      uploadedFiles,
    );

    return NextResponse.json({
      message: assistantMessage,
      config: extractedConfig,
    });
  } catch (error) {
    console.error("Error in planner agent:", error);
    return NextResponse.json(
      { error: "Failed to process planner agent request" },
      { status: 500 },
    );
  }
}

async function extractConfigurationWithAI(
  messages: Message[],
  latestResponse: string,
  initialTask?: string,
  currentConfig?: AgentConfigExtraction,
  uploadedFiles?: Array<{
    name: string;
    content: string;
    type: string;
    size: number;
  }>,
): Promise<AgentConfigExtraction> {
  // Ensure OpenAI is available; otherwise, fall back to basic extraction
  if (!process.env.OPENAI_API_KEY) {
    return extractConfigurationFallback(
      messages,
      latestResponse,
      initialTask,
      currentConfig,
    );
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const fullConversation = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  // Build file context for extraction
  let fileContextForExtraction = "";
  if (uploadedFiles && uploadedFiles.length > 0) {
    fileContextForExtraction = "\n\nUploaded Files Content:\n";
    uploadedFiles.forEach((file, index) => {
      fileContextForExtraction += `\n--- File ${index + 1}: ${file.name} ---\n`;
      fileContextForExtraction += file.content.substring(0, 3000); // Limit to first 3000 chars for extraction
      if (file.content.length > 3000) {
        fileContextForExtraction += "\n...(truncated for brevity)";
      }
      fileContextForExtraction += "\n--- End of ${file.name} ---\n";
    });
  }

  const extractionPrompt = `Analyze this conversation about building an autonomous agent and extract structured configuration:

Initial Task: ${initialTask || "Not specified"}

Conversation:
${fullConversation}

Latest Response:
${latestResponse}

Current Config:
${JSON.stringify(currentConfig, null, 2)}
${fileContextForExtraction}

Extract the following fields from the entire conversation (including user messages and assistant responses):
- name: The agent's name (look for "Agent Name:", "name:", or mentions like "call it X", "I'll name this X")
- description: Brief description of what the agent does (1-2 sentences)
- systemPrompt: DETAILED, workflow-specific behavior instructions. Should include:
  * Agent's core purpose and role
  * Specific platforms and tools it will use
  * Key actions it will perform (search, post, email, etc.)
  * How it handles data and outputs
  Example: "You are an autonomous AI agent that monitors AI news from multiple sources, creates engaging LinkedIn posts, and sends email summaries. You search for the latest AI developments, analyze trending topics, craft professional social media content, and deliver comprehensive reports to keep stakeholders informed."
- targetWebsite: Main website/platform URL (e.g., reddit.com, linkedin.com) - INFER from objective
- objective: Clear goal statement with metrics (e.g., "Find 50 VP-level sales leads at SaaS companies")
- dataFields: Array of specific data points to extract (e.g., ["name", "title", "company", "linkedinUrl"])
- outputDestination: Where to save results (e.g., "Google Sheets", "CSV file", "Database")
- constraints: Any user-specified limits or preferences
- icp: Ideal Customer Profile from conversation (job titles, industries, company size, geography)
- valueProp: Value proposition from conversation (what problem is solved, unique selling points)
- knowledgeBase: COMPREHENSIVE company and product information compiled into a single string. This is CRITICAL for Master Agent context. Must include:
  * Company website URL (if provided)
  * Complete product/service description with features and benefits
  * Value proposition and unique selling points
  * Ideal Customer Profile details
  * ALL content from uploaded files (PDFs, brochures, marketing materials)
  * Any company background, mission, or positioning mentioned
  * Target industry context and domain knowledge
  * Relevant sources or data locations for the campaign
  
  IMPORTANT: This field is passed to Master Agent for daily task generation - it MUST contain ALL company context.
  
  Example: "Company: EmailAI (www.emailai.com) - AI-powered email personalization platform. Product: Increases email conversion rates by 30% using AI personalization for marketing teams. Target: Marketing Directors at e-commerce brands ($5M+ revenue). Value Prop: Automated personalization that drives 30% higher conversions without manual work. Industry: E-commerce, SaaS marketing tools."
- userExpectations: What the user expects from this autonomous agent
- platforms: Array of ALL platforms/services that require authentication - EXTRACT ONLY from explicit user mentions:
  * CRITICAL: Extract platforms ONLY when user explicitly states which platforms to use
  * Look for phrases like: "use LinkedIn", "post on Twitter", "save to Google Sheets", "send via Slack"
  * Include: social media (LinkedIn, Twitter/X, Facebook, Instagram, TikTok, etc.)
  * Include: productivity tools (Google Sheets, Notion, Asana, Trello, Monday.com, Airtable, ClickUp, etc.)
  * Include: CRM/sales tools (Salesforce, HubSpot, Pipedrive, etc.)
  * Include: communication (Slack, Email, Discord, Teams, etc.)
  * Include: e-commerce (Shopify, Amazon, eBay, etc.)
  * Format: Proper capitalization (e.g., "Google Sheets", "LinkedIn", "Notion")
  * DO NOT infer platforms from ICP or objective - only from explicit mentions
- runtimePerDay: Number of minutes per day (if mentioned)
- initialTasks: Array of workflow tasks with structure:
  [
    {
      "description": "Detailed step description",
      "type": "Clear action label (e.g., 'Search AI News', 'Post to LinkedIn', 'Send Email')",
      "priority": 1-5,
      "frequency": "one-time" | "daily" | "weekly" | "monthly"
    }
  ]
  Generate these tasks to match the complete workflow the agent needs to execute.

IMPORTANT - PLATFORM EXTRACTION RULES:
- Extract platforms ONLY when user explicitly mentions them in their messages
- DO NOT infer or assume platforms based on sales objectives or ICP
- Platform selection is strategic - user must choose, not AI
- Examples of explicit mentions to extract:
  * "use LinkedIn" → platforms: ["LinkedIn"]
  * "post to LinkedIn and Twitter" → platforms: ["LinkedIn", "Twitter/X"]
  * "save to Google Sheets" → platforms: ["Google Sheets"]
  * "send email notification" → platforms: ["Email"]
- Examples of what NOT to extract:
  * "generate leads" → platforms: [] (no platform specified)
  * "target CTOs" → platforms: [] (ICP, not platform choice)
  * "awareness campaign" → platforms: [] (objective, not platform)
- Use proper capitalization for platform names (e.g., "Google Sheets", not "google sheets")
- Generate initialTasks that cover ALL steps needed to complete the objective
- Task "type" field is the label shown in workflow - make it clear and descriptive
- Only extract values clearly mentioned in conversation
- Merge with current config - don't overwrite existing good values unless new info is better

⚠️ CRITICAL - DO NOT ASSUME STORAGE PLATFORMS:
- DO NOT add Google Sheets, Notion, Airtable, or any storage platform UNLESS the user EXPLICITLY mentions it
- "lead generation" does NOT mean Google Sheets
- "save leads" does NOT automatically mean Google Sheets
- ONLY add storage platforms when user says phrases like "save to Google Sheets", "store in Notion", "use Airtable", etc.
- If storage isn't mentioned, leave outputDestination empty or generic (e.g., "To be determined")

Return ONLY a valid JSON object with the extracted fields.`;

  try {
    const extractionCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a precise data extraction assistant. Extract structured configuration from conversations and return only valid JSON.",
        },
        { role: "user", content: extractionPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const extractedText =
      extractionCompletion.choices[0].message.content || "{}";
    let extracted: AgentConfigExtraction = {};

    try {
      extracted = JSON.parse(extractedText) as AgentConfigExtraction;
    } catch (parseError) {
      console.error("Error parsing extracted config JSON:", parseError);
      console.error("Raw response:", extractedText);
      // Return empty extraction on parse error - will use currentConfig
      extracted = {};
    }

    // Merge with currentConfig, preferring new values only if they exist and are non-empty
    const config: AgentConfigExtraction = { ...currentConfig };

    if (extracted.name && extracted.name.trim())
      config.name = extracted.name.trim();
    if (extracted.description && extracted.description.trim())
      config.description = extracted.description.trim();
    if (extracted.systemPrompt && extracted.systemPrompt.trim())
      config.systemPrompt = extracted.systemPrompt.trim();
    if (extracted.targetWebsite && extracted.targetWebsite.trim())
      config.targetWebsite = extracted.targetWebsite.trim();
    if (extracted.objective && extracted.objective.trim())
      config.objective = extracted.objective.trim();
    if (extracted.dataFields && extracted.dataFields.length > 0)
      config.dataFields = extracted.dataFields;
    if (
      extracted.outputDestination &&
      typeof extracted.outputDestination === "string" &&
      extracted.outputDestination.trim()
    )
      config.outputDestination = extracted.outputDestination.trim();
    if (
      extracted.constraints &&
      typeof extracted.constraints === "string" &&
      extracted.constraints.trim()
    )
      config.constraints = extracted.constraints.trim();
    if (
      extracted.knowledgeBase &&
      typeof extracted.knowledgeBase === "string" &&
      extracted.knowledgeBase.trim()
    )
      config.knowledgeBase = extracted.knowledgeBase.trim();
    if (
      extracted.userExpectations &&
      typeof extracted.userExpectations === "string" &&
      extracted.userExpectations.trim()
    )
      config.userExpectations = extracted.userExpectations.trim();
    if (extracted.platforms && extracted.platforms.length > 0) {
      config.platforms = [
        ...new Set([...(config.platforms || []), ...extracted.platforms]),
      ];
    }
    if (extracted.runtimePerDay && extracted.runtimePerDay > 0)
      config.runtimePerDay = extracted.runtimePerDay;
    if (extracted.initialTasks && extracted.initialTasks.length > 0)
      config.initialTasks = extracted.initialTasks;

    return config;
  } catch (error) {
    console.error("Error extracting configuration with AI:", error);
    // Fallback to basic extraction
    return extractConfigurationFallback(
      messages,
      latestResponse,
      initialTask,
      currentConfig,
    );
  }
}

async function extractConfigurationFallback(
  messages: Message[],
  latestResponse: string,
  initialTask?: string,
  currentConfig?: AgentConfigExtraction,
): Promise<AgentConfigExtraction> {
  const fullConversation = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  
  // For general extractions (runtime, etc.), use full conversation
  const allText = `${initialTask || ""}\n${fullConversation}`;
  
  // CRITICAL: Only scan USER messages for platform keywords to avoid extracting from assistant's questions
  const userMessagesOnly = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  const userTextWithInitial = `${initialTask || ""}\n${userMessagesOnly}`;

  const config: AgentConfigExtraction = { ...currentConfig };

  // Extract platforms - ONLY from explicit user mentions (not from assistant's questions)
  const platforms: string[] = [...(config.platforms || [])];
  const lowerText = userTextWithInitial.toLowerCase();

  // Check Google Sheets - ONLY if explicitly mentioned by user
  const hasGoogleSheets =
    lowerText.includes("google sheets") ||
    lowerText.includes("google sheet") ||
    lowerText.includes("save to google sheets") ||
    lowerText.includes("store in google sheets") ||
    lowerText.includes("save to sheets") ||
    lowerText.includes("store in sheets");

  if (hasGoogleSheets) {
    platforms.push("Google Sheets");
  } else if (lowerText.includes("google") || lowerText.includes("gmail")) {
    // Only add "Google" if Google Sheets was NOT detected
    platforms.push("Google");
  }

  if (lowerText.includes("reddit")) platforms.push("Reddit");
  if (lowerText.includes("linkedin")) platforms.push("LinkedIn");
  if (lowerText.includes("salesforce")) platforms.push("Salesforce");
  if (lowerText.includes("twitter") || lowerText.includes("x.com"))
    platforms.push("Twitter/X");
  if (lowerText.includes("slack")) platforms.push("Slack");

  // Detect email requirements
  if (
    lowerText.includes("send email") ||
    lowerText.includes("send me an email") ||
    lowerText.includes("send me a email") ||
    lowerText.includes("email me") ||
    lowerText.includes("email notification") ||
    lowerText.includes("notify via email") ||
    lowerText.includes("notify me via email") ||
    lowerText.includes("send an email")
  ) {
    platforms.push("Email");
  }

  if (platforms.length > 0) {
    config.platforms = [...new Set(platforms)];
  }

  // Extract target website from common patterns
  const urlMatch = lowerText.match(
    /(reddit\.com|linkedin\.com|salesforce\.com|twitter\.com|x\.com|slack\.com)/,
  );
  if (urlMatch && !config.targetWebsite) {
    config.targetWebsite = urlMatch[1];
  }

  // Extract runtime if mentioned
  const runtimeMatch = allText.match(/(\d+)\s*(?:minute|min)/i);
  if (runtimeMatch && !config.runtimePerDay) {
    config.runtimePerDay = parseInt(runtimeMatch[1]);
  }

  return config;
}
