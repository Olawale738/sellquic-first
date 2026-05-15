const VERCEL_API_URL = 'https://api.vercel.com';
const VERCEL_AUTH_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const TEAM_ID = process.env.VERCEL_TEAM_ID; 

/**
 * Adds a domain to the Vercel project.
 */
export async function addDomainToVercel(domain: string): Promise<any> {
  if (!VERCEL_AUTH_TOKEN || !VERCEL_PROJECT_ID) {
    throw new Error('Vercel API credentials are not configured.');
  }

  const url = `${VERCEL_API_URL}/v10/projects/${VERCEL_PROJECT_ID}/domains${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: domain }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Vercel Add Domain Error:", data);
    // If domain is already owned by this project, treat as success
    if (data.error?.code === 'domain_already_in_use') return data;
    
    throw new Error(data.error?.message || 'Failed to add domain to Vercel.');
  }

  return data;
}

/**
 * Removes a domain from the Vercel project.
 */
export async function removeDomainFromVercel(domain: string): Promise<any> {
  if (!VERCEL_AUTH_TOKEN || !VERCEL_PROJECT_ID) {
    throw new Error('Vercel API credentials are not configured.');
  }

  const url = `${VERCEL_API_URL}/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${VERCEL_AUTH_TOKEN}`,
    },
  });

  if (response.status !== 204 && response.status !== 200) {
    const data = await response.json();
    throw new Error(data.error?.message || 'Failed to remove domain from Vercel.');
  }
  
  return { success: true };
}

/**
 * Retrieves the configuration and verification status of a domain.
 */
export async function getDomainConfig(domain: string): Promise<any> {
    if (!VERCEL_AUTH_TOKEN) {
        throw new Error('Vercel API token is not configured.');
    }
    
    const url = `${VERCEL_API_URL}/v6/domains/${domain}/config${TEAM_ID ? `?teamId=${TEAM_ID}` : ''}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${VERCEL_AUTH_TOKEN}`,
        },
    });

    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error?.message || `Failed to get config for domain ${domain}.`);
    }

    return data;
}