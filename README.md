# Salesman.sh - Autonomous Agent Platform

An intelligent platform for building and deploying autonomous sales agents that automate multi-day campaigns including lead generation, prospecting, outreach, and CRM management.

## Overview

Salesman.sh enables users to create Computer-Use-Agent (CUA) ready campaigns through natural language or pre-built templates. The platform features a dynamic split-screen builder interface and provides real-time monitoring of deployed agents. Built to boost sales productivity through AI-driven automation.

## Key Features

- **Natural Language Agent Creation**: Describe sales workflows to automatically configure agents
- **Split-Screen Builder**: Conversational AI on the left, detailed configuration on the right
- **Multi-Platform Support**: Reddit, Google, LinkedIn, Salesforce, Twitter/X, Slack
- **Two Execution Modes**:
  - **One-Shot**: Single-session task completion with no runtime limits
  - **Multi-Step**: Multi-day campaigns with daily task decomposition
- **Real-Time Monitoring**: Agent Dashboard with performance statistics and live session viewer
- **Autonomous Task Planning**: GPT-4o powered task generation and workflow orchestration
- **Persistent Memory**: Agent context management for continuous learning
- **Notification System**: Real-time updates on agent events, credit status, and results
- **Fully Responsive**: Production-ready mobile UX across all devices

## Tech Stack

### Frontend
- Next.js 15 with React 19
- Tailwind CSS for styling
- Framer Motion for animations
- Jotai for state management

### Backend
- Next.js API Routes
- MongoDB with Mongoose ODM
- Clerk for authentication

### AI & Automation
- OpenAI GPT-4o for planning and reasoning
- OpenAI Computer-Use-Preview for browser automation
- Browserbase + Playwright for real browser automation
- Stealth Mode and residential proxies

## Getting Started

### Prerequisites
- Node.js 14.x or later
- MongoDB database
- Required API keys (see Environment Variables)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/salesman-sh.git
cd salesman-sh
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file with the following:
```env
# Database
DATABASE_URL=your_mongodb_connection_string

# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# AI Services
OPENAI_API_KEY=your_openai_api_key
OPENAI_ORG=your_openai_org_id

# Browser Automation
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id

# Security
ENCRYPTION_SECRET=your_32_character_encryption_secret

# Analytics (Optional)
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=your_posthog_host
```

4. Start the development server:
```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

## Architecture

### Multi-User Isolation
All MongoDB collections include a `userId` field for secure data isolation. Clerk handles authentication with automatic session management.

### Agent Execution Flow
1. User creates agent via natural language or template
2. Planner Agent extracts requirements and asks clarifying questions
3. System generates workflow with platform-specific authentication
4. Master Agent decomposes objective into daily tasks
5. Computer-Use-Agent executes tasks in real browser via Browserbase
6. Results are logged and memory is persisted for continuous improvement

### Security Features
- Zod schemas for input validation
- Rate limiting on API routes
- CSRF protection
- AES-256-GCM encryption for credentials
- Structured logging and error boundaries

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   ├── components/       # React components
│   ├── contexts/         # Global context providers
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   └── (pages)/          # Next.js pages
├── server/               # Server-side utilities
├── lib/                  # Shared libraries
└── public/               # Static assets
```

## Available Scripts

- `npm run dev` - Start development server on port 5000
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## API Documentation

### Agents
- `POST /api/agents` - Create a new agent
- `GET /api/agents` - List all user's agents
- `GET /api/agents/[id]` - Get agent details with sessions and context
- `PUT /api/agents/[id]` - Update an agent
- `DELETE /api/agents/[id]` - Delete an agent (cascades to sessions, logs, context)

### Task Planning
- `POST /api/agents/[id]/plan-tasks` - Generate daily tasks for agent

### Deployment
- `POST /api/agents/[id]/deploy` - Deploy an agent
- `POST /api/agents/[id]/pause` - Pause a deployed agent
- `POST /api/agents/[id]/execute` - Execute the next pending task

### Sessions & Context
- `GET /api/agents/[id]/context` - Get agent memory/context
- `POST /api/agents/[id]/context` - Update agent context

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Support

For issues and feature requests, please use the GitHub issue tracker.
