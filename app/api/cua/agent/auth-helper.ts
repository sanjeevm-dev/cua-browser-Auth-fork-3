/**
 * Authentication Helper for Browserbase Sessions
 * 
 * This module provides utilities for implementing robust authentication
 * with Browserbase, including:
 * - Context persistence for maintaining login state across sessions
 * - Cookie management for faster authentication
 * - 2FA support via session live view
 * - Fingerprinting and stealth mode for better bot detection avoidance
 * 
 * Based on Browserbase documentation:
 * https://docs.browserbase.com/guides/authentication
 */

import { BrowserbaseBrowser } from './browserbase';

export interface AuthConfig {
  agentId: number;
  platform: string;
  width?: number;
  height?: number;
  region?: string;
  enableFingerprinting?: boolean;
}

/**
 * Create a Browserbase session with authentication persistence.
 * 
 * This function automatically:
 * - Retrieves existing context if available
 * - Applies fingerprinting for stealth mode
 * - Saves context for future sessions
 * 
 * @param config - Authentication configuration
 * @returns Configured BrowserbaseBrowser instance
 */
export async function createAuthenticatedSession(config: AuthConfig): Promise<BrowserbaseBrowser> {
  const {
    agentId,
    platform,
    width = 1024,
    height = 768,
    region = 'us-east-1',
    enableFingerprinting = true,
  } = config;

  const browser = new BrowserbaseBrowser(
    width,
    height,
    region,
    true, // Enable proxies
    null, // No existing session ID
    agentId,
    platform,
    null, // Will auto-fetch context ID if available
    enableFingerprinting
  );

  await browser.connect();
  
  // Load any saved cookies
  await browser.loadCookies();
  
  return browser;
}

/**
 * Handle authentication flow with optional 2FA support.
 * 
 * This function:
 * 1. Attempts to load existing authentication state
 * 2. If not authenticated, returns live view URL for manual login
 * 3. Waits for user to complete authentication (including 2FA if needed)
 * 4. Saves authentication state for future sessions
 * 
 * @param browser - BrowserbaseBrowser instance
 * @param targetUrl - URL to navigate to for authentication check
 * @param checkAuthCallback - Function to verify if user is authenticated
 * @returns Live view URL if manual auth needed, null if already authenticated
 */
export async function handleAuthenticationFlow(
  browser: BrowserbaseBrowser,
  targetUrl: string,
  checkAuthCallback: () => Promise<boolean>
): Promise<string | null> {
  // Navigate to protected page to check authentication
  await browser.goto(targetUrl);
  await browser.wait(2000);

  // Check if already authenticated
  const isAuthenticated = await checkAuthCallback();

  if (isAuthenticated) {
    console.log('✅ Already authenticated, skipping login flow');
    return null;
  }

  // Not authenticated, return live view URL for manual login
  const liveViewUrl = browser.getSessionLiveUrl();
  console.log(`🔐 Authentication required. Please complete login (including 2FA if needed) at: ${liveViewUrl}`);
  
  return liveViewUrl;
}

/**
 * Save authentication state after successful login.
 * 
 * Call this after the user has successfully logged in (including 2FA)
 * to save the authentication state for future sessions.
 * 
 * @param browser - BrowserbaseBrowser instance
 */
export async function saveAuthenticationState(browser: BrowserbaseBrowser): Promise<void> {
  await browser.saveCookies();
  console.log('✅ Authentication state saved successfully');
}

/**
 * Example usage:
 * 
 * ```typescript
 * // Create authenticated session
 * const browser = await createAuthenticatedSession({
 *   agentId: 1,
 *   platform: 'linkedin',
 * });
 * 
 * // Handle authentication
 * const liveViewUrl = await handleAuthenticationFlow(
 *   browser,
 *   'https://www.linkedin.com/feed/',
 *   async () => {
 *     // Check if user is logged in (custom logic for your platform)
 *     // For example, check if profile element exists
 *     return true; // Replace with actual check
 *   }
 * );
 * 
 * if (liveViewUrl) {
 *   // Send live view URL to user for manual login
 *   console.log('Please login at:', liveViewUrl);
 *   
 *   // Wait for user to complete login
 *   await browser.wait(30000); // Wait 30 seconds for user to login
 *   
 *   // Save authentication state
 *   await saveAuthenticationState(browser);
 * }
 * 
 * // Continue with authenticated actions
 * await browser.goto('https://www.linkedin.com/mynetwork/');
 * ```
 */
