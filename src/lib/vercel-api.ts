
// src/lib/vercel-api.ts

const VERCEL_API_URL = 'https://api.vercel.com';
const VERCEL_AUTH_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const TEAM_ID = process.env.VERCEL_TEAM_ID;

const API_HEADERS = {
    'Authorization': `Bearer ${VERCEL_AUTH_TOKEN}`,
    'Content-Type': 'application/json'
};

interface DomainConfigResponse {
    configuredBy: 'CNAME' | 'A';
    cname: string;
    a: string;
    conflicts: any[];
    misconfigured: boolean;
}

interface DomainVerificationResponse {
    verified: boolean;
    verification: {
        type: 'cname' | 'txt';
        domain: string;
        value: string;
        reason: string;
    }[];
}

/**
 * Adds a domain to the Vercel project.
 */
export async function addDomainToVercel(domain: string): Promise<{ success: boolean; error?: string }> {
    if (!VERCEL_AUTH_TOKEN || !VERCEL_PROJECT_ID) {
        throw new Error('Vercel environment variables are not configured.');
    }
    const url = `${VERCEL_API_URL}/v10/projects/${VERCEL_PROJECT_ID}/domains${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: API_HEADERS,
            body: JSON.stringify({ name: domain })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Vercel API Error (addDomain):', data.error);
            return { success: false, error: data.error?.message || 'Failed to add domain.' };
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error in addDomainToVercel:', error);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

/**
 * Removes a domain from the Vercel project.
 */
export async function removeDomainFromVercel(domain: string): Promise<{ success: boolean; error?: string }> {
    if (!VERCEL_AUTH_TOKEN || !VERCEL_PROJECT_ID) {
        throw new Error('Vercel environment variables are not configured.');
    }
     const url = `${VERCEL_API_URL}/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`;
    
    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: API_HEADERS
        });

        if (!response.ok) {
            const data = await response.json();
            console.error('Vercel API Error (removeDomain):', data.error);
            return { success: false, error: data.error?.message || 'Failed to remove domain.' };
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error in removeDomainFromVercel:', error);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

/**
 * Gets the required DNS configuration for a domain.
 */
export async function getDomainConfig(domain: string): Promise<{ data: DomainConfigResponse | null; error?: string }> {
    if (!VERCEL_AUTH_TOKEN) {
        throw new Error('Vercel environment variables are not configured.');
    }
    const url = `${VERCEL_API_URL}/v6/domains/${domain}/config${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: API_HEADERS
        });
        
        const data = await response.json();

        if (!response.ok) {
            console.error('Vercel API Error (getDomainConfig):', data.error);
            return { data: null, error: data.error?.message || 'Failed to get domain configuration.' };
        }
        
        return { data: data };
    } catch (error) {
        console.error('Error in getDomainConfig:', error);
        return { data: null, error: 'An unexpected error occurred.' };
    }
}

/**
 * Verifies a domain's DNS configuration on Vercel.
 */
export async function verifyDomain(domain: string): Promise<{ data: DomainVerificationResponse | null; error?: string }> {
    if (!VERCEL_AUTH_TOKEN || !VERCEL_PROJECT_ID) {
        throw new Error('Vercel environment variables are not configured.');
    }
    const url = `${VERCEL_API_URL}/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}/verify${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: API_HEADERS
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Vercel API Error (verifyDomain):', data.error);
            return { data: null, error: data.error?.message || 'Failed to verify domain.' };
        }
        
        return { data: data.domain };
    } catch (error) {
        console.error('Error in verifyDomain:', error);
        return { data: null, error: 'An unexpected error occurred.' };
    }
}
