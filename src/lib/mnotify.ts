export interface MNotifyResponse {
    status: string;
    code: string;
    message: string;
}

export async function sendSms(recipient: string, message: string): Promise<MNotifyResponse> {
    const apiKey = process.env.MNOTIFY_API_KEY;
    const senderId = process.env.MNOTIFY_SENDER_ID;
    
    if (!apiKey || !senderId) {
        console.error("MNotify credentials missing");
        throw new Error("SMS service not configured");
    }
    
    try {
        const response = await fetch(`https://api.mnotify.com/api/sms/quick?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipient: [recipient],
                sender: senderId,
                message: message,
                is_schedule: false,
                schedule_date: '',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`MNotify API Error ${response.status}: ${errorText}`);
        }

        const data: MNotifyResponse = await response.json();
        console.log(`✅ SMS Sent to ${recipient}:`, data);
        return data;

    } catch (error) {
        console.error(`❌ SMS Failed to ${recipient}:`, error);
        throw error;
    }
}