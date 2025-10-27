# Salesman.sh - Autonomous Agent Platform

## Overview
Salesman.sh is a platform designed for building and deploying intelligent autonomous agents focused on sales automation. It enables users to create multi-day, Computer-Use-Agent (CUA) ready campaigns for tasks such as lead generation, prospecting, outreach, and CRM management. The platform aims to boost sales productivity through natural language agent creation, pre-built templates, and a dynamic split-screen builder interface, ultimately streamlining sales operations and enhancing efficiency using AI-driven automation.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.

## System Architecture

### UI/UX Decisions
The platform features a dark theme with a pure black background, glassmorphism effects, and blue accents. Key UI components include a home screen with natural language input, a split-screen Agent Builder, and an interactive node panel. It utilizes a universal authentication system, a Dashboard for managing agents, subtle toast notifications, visual validation indicators, and a collapsible sidebar. The "Workflow" tab visually displays the agent's execution plan, and daily tasks are presented in an accordion interface. The design is fully responsive across mobile, tablet, and desktop, adhering to industry standards for touch targets and layout scaling. UX enhancements in the Agent Builder include dynamic tooltips for the Deploy button and visual indicators for platform credential nodes (pulsing borders, warning badges for incomplete credentials; green checkmarks for completed).

### Technical Implementations
Clerk handles secure multi-user authentication with data isolation via `userId` fields in MongoDB. The platform supports multi-day autonomous agent campaigns, where a Master Agent API decomposes objectives into daily tasks with CUA-ready execution prompts.

**Dual-Mode Browser Automation**: The system integrates both Playwright-based coordinate-driven automation (`BrowserbaseBrowser`) and Stagehand (`StagehandBrowser`) for AI-powered natural language browser control. Stagehand offers `act()`, `extract()`, `observe()`, and `agent()` primitives. Both modes leverage Browserbase for session management. A dual-layer approach ensures CUA browser capability guidance, with Master Agent meta-prompts requiring a BROWSER CAPABILITIES section and a programmatic failsafe prepending it if missing. CUA authentication is optimized with granular sequences and platform-specific templates. Agent execution uses OpenAI's `computer-use-preview` model via Browserbase, incorporating intelligent error handling, session cleanup, Stealth Mode, and residential proxies. Browserbase session reliability is enhanced with `keepAlive`, increased CDP timeouts, automatic CDP reconnection, heartbeat monitoring, and action-level error boundaries. Comprehensive session resilience protects against various mid-execution failures. All new CUA sessions start with Brave Search.

Persistent memory is managed via an `agent_context` table, and `session_logs` provide real-time insights. An intelligent Planner Agent uses AI to extract information and enforce platform selection. File uploads (PDF, TXT, XLSX) are integrated for conversational context. Performance is enhanced with screenshot caching and production timeout configurations. Security features include Zod schemas, rate limiting, CSRF protection, structured logging, and error boundaries. The system supports both 'one-shot' and 'multi-step' execution modes. A comprehensive and throttled notification system provides real-time updates on agent events and credit status. Pre-execution credit validation prevents agent deployment when the balance is zero, with real-time credit polling.

### Feature Specifications
- **Natural Language Agent Creation**: Users describe sales workflows to configure agents.
- **Split-Screen Builder**: Left panel for conversational AI, right for detailed configuration.
- **Agent Dashboard**: Real-time monitoring and deployment controls.
- **Autonomous Task Planning API**: `/api/agents/[id]/plan-tasks` for GPT-4o powered task generation.
- **Agent Detail View**: Comprehensive view with tabs for Overview, Workflow, Sessions, Memory, and Audit Logs.
- **Live Session Viewer**: Auto-refreshing view for active sessions with step-by-step logs.
- **Notification System**: Real-time notifications for agent events, credit alerts, and system updates, with user-configurable preferences.
- **Execution Modes**: One-Shot for single-session tasks and Multi-Step for multi-day campaigns.
- **Credits Overview**: Dedicated section for credit usage, balance, and status.
- **User Preferences**: Configurable notification settings.

### System Design Choices
- **Frontend**: Next.js 15, React 19, Tailwind CSS, Framer Motion.
- **Backend**: Next.js API Routes.
- **Database**: MongoDB with Mongoose ODM.
- **Browser Automation**: Browserbase + Playwright integrated with OpenAI's Computer Use API, Stagehand.
- **AI**: OpenAI's GPT-4o for planning and reasoning, `computer-use-preview` for browser automation.
- **State Management**: Jotai.
- **Database Architecture (MongoDB)**: All core collections include a `userId` for multi-user isolation, using ObjectId for primary keys, application-level cascade deletes, singleton connection pattern, indexing, and Mongoose virtuals. Dates are stored as Date objects.

## External Dependencies

- **Database**: MongoDB
- **ODM**: Mongoose
- **Authentication**: Clerk
- **Browser Automation**: Browserbase, Playwright, Stagehand
- **AI Services**: OpenAI
- **Analytics**: PostHog, Vercel Analytics
- **Platform Integrations**: Reddit API, Google API, LinkedIn API, Salesforce API, Twitter/X API, Slack API