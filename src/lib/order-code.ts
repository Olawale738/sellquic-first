
export function generateOrderCode(businessName: string): string {
    // Take the first 4 characters of the business name, make them uppercase, and remove spaces.
    const prefix = businessName.replace(/\s+/g, '').substring(0, 4).toUpperCase();
    
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 7; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `${prefix}-${randomPart}`;
}
