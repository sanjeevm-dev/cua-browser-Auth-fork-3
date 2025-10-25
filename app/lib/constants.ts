// Platform-wide constants and configuration

export const CREDITS_CONFIG = {
  // Free credits allocated to new users on signup
  FREE_SIGNUP_CREDITS: parseInt(process.env.FREE_CREDITS || '100'),
  
  // Credits deducted per minute of browser automation session
  CREDITS_PER_MINUTE: 1,
  
  // Warning threshold - show warning when below this percentage
  WARNING_THRESHOLD: 20,
  
  // Critical threshold - show critical alert when below this percentage
  CRITICAL_THRESHOLD: 10,
  
  // Minimum credits required to start an agent
  MINIMUM_CREDITS_TO_RUN: 1,
};

export const CREDITS_REASONS = {
  SIGNUP_BONUS: 'signup_bonus',
  AGENT_RUN: 'agent_run',
  ADMIN_ADJUSTMENT: 'admin_adjustment',
  REFUND: 'refund',
  PURCHASE: 'purchase',
} as const;
