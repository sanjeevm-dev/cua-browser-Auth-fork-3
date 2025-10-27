import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

export class StagehandBrowser {
  private stagehand: Stagehand | null = null;
  private sessionId: string | null = null;
  private projectId: string;
  private apiKey: string;
  private enableCaching: boolean;
  private modelName: string;
  private modelApiKey: string | null;

  constructor(
    sessionId: string | null = null,
    enableCaching: boolean = true,
    modelName: string = "gpt-4o",
    modelApiKey: string | null = null
  ) {
    this.sessionId = sessionId;
    this.projectId = process.env.BROWSERBASE_PROJECT_ID!;
    this.apiKey = process.env.BROWSERBASE_API_KEY!;
    this.enableCaching = enableCaching;
    this.modelName = modelName;
    this.modelApiKey = modelApiKey || process.env.OPENAI_API_KEY || null;
  }

  async init(): Promise<{ sessionId: string; sessionUrl: string; debugUrl: string }> {
    const config: {
      env: "BROWSERBASE";
      apiKey: string;
      projectId: string;
      enableCaching: boolean;
      modelName: string;
      modelClientOptions?: { apiKey: string };
      browserbaseSessionId?: string;
    } = {
      env: "BROWSERBASE" as const,
      apiKey: this.apiKey,
      projectId: this.projectId,
      enableCaching: this.enableCaching,
      modelName: this.modelName,
    };

    if (this.modelApiKey) {
      config.modelClientOptions = {
        apiKey: this.modelApiKey,
      };
    }

    if (this.sessionId) {
      config.browserbaseSessionId = this.sessionId;
    }

    this.stagehand = new Stagehand(config as any);
    
    const result = await this.stagehand.init();
    
    return result;
  }

  async act(action: string | any): Promise<any> {
    if (!this.stagehand?.page) {
      throw new Error("Stagehand not initialized. Call init() first.");
    }

    const actionStr = typeof action === 'string' ? action : action.action || action.description || 'action';
    console.log(`🎬 Stagehand ACT: ${actionStr}`);
    
    if (typeof action === 'string') {
      const result = await this.stagehand.page.act(action);
      console.log(`✅ ACT complete:`, result);
      return result;
    }
    
    const result = await this.stagehand.page.act(action as any);
    console.log(`✅ ACT complete:`, result);
    return result;
  }

  async extract(instructionOrOptions?: string | any): Promise<any> {
    if (!this.stagehand?.page) {
      throw new Error("Stagehand not initialized. Call init() first.");
    }

    if (!instructionOrOptions) {
      console.log(`📊 Stagehand EXTRACT: page text`);
      const result = await this.stagehand.page.extract();
      console.log(`✅ EXTRACT complete`);
      return result;
    }

    if (typeof instructionOrOptions === 'string') {
      console.log(`📊 Stagehand EXTRACT: ${instructionOrOptions}`);
      const result = await this.stagehand.page.extract(instructionOrOptions);
      console.log(`✅ EXTRACT complete:`, result);
      return result;
    }

    console.log(`📊 Stagehand EXTRACT: ${instructionOrOptions.instruction || 'data'}`);
    const result = await this.stagehand.page.extract(instructionOrOptions as any);
    console.log(`✅ EXTRACT complete:`, result);
    return result;
  }

  async observe(instruction?: string): Promise<any> {
    if (!this.stagehand?.page) {
      throw new Error("Stagehand not initialized. Call init() first.");
    }

    console.log(`👀 Stagehand OBSERVE: ${instruction || "page elements"}`);
    
    if (instruction) {
      const result = await this.stagehand.page.observe(instruction);
      console.log(`✅ OBSERVE complete:`, result);
      return result;
    }
    
    const result = await this.stagehand.page.observe();
    console.log(`✅ OBSERVE complete:`, result);
    return result;
  }

  async runAgent(
    instructions: string,
    options?: {
      modelName?: string;
      modelClientOptions?: any;
      domSettleTimeoutMs?: number;
    }
  ): Promise<any> {
    if (!this.stagehand) {
      throw new Error("Stagehand not initialized. Call init() first.");
    }

    console.log(`🤖 Stagehand AGENT: ${instructions}`);
    
    const agent = await this.stagehand.agent({
      instructions,
      ...options,
    });

    const result = await agent.execute(instructions);
    console.log(`✅ AGENT complete:`, result);
    return result;
  }

  async goto(url: string): Promise<void> {
    if (!this.stagehand?.page) {
      throw new Error("Stagehand not initialized. Call init() first.");
    }
    console.log(`🌐 Navigating to: ${url}`);
    await this.stagehand.page.goto(url);
  }

  async screenshot(): Promise<string> {
    if (!this.stagehand?.page) {
      throw new Error("Stagehand not initialized. Call init() first.");
    }
    const buffer = await this.stagehand.page.screenshot({ fullPage: false });
    return buffer.toString('base64');
  }

  async close(): Promise<void> {
    if (this.stagehand) {
      console.log("🔒 Closing Stagehand session");
      await this.stagehand.close();
      this.stagehand = null;
    }
  }

  getSessionId(): string | null {
    return (this.stagehand as any)?.browserbaseSessionId || this.sessionId;
  }

  getPage() {
    return this.stagehand?.page || null;
  }

  getContext() {
    return this.stagehand?.context || null;
  }

  getBrowser() {
    return this.stagehand?.context?.browser() || null;
  }
}
