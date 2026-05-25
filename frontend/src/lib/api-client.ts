export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID || '';
export const USER_ID = 'local-admin-123'; // Mock user UUID for the session

/**
 * Core fetch wrapper that automatically injects the required headers
 * according to the integration guide (specifically X-Org-Id).
 */
export async function fetchWithOrg(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  
  // The integration guide mandate: HTTP header X-Org-Id takes precedence
  headers.set('X-Org-Id', ORG_ID);

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
