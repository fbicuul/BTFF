export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { contactName, contactType, company, reason } = req.body;
    
    try {
        // Generate a script based on the input
        const name = contactName || '[Customer Name]';
        const type = contactType || 'lead';
        const comp = company || 'your company';
        
        let script = '';
        
        if (type === 'lead') {
            script = `Hello <span class="variable">${name}</span>, this is <span class="variable">[Your Name]</span> from BTFF.
            
I'm calling because we noticed <span class="highlight">${comp}</span> might benefit from our services.

<span class="variable">[Pause for response]</span>

We've helped similar businesses increase efficiency by 40%. I'd love to share how we could do the same for you.

Would you have 5 minutes for a quick chat?

<span class="variable">[Listen to response]</span>

Great! Let me share some information about our solutions.`;
        } else if (type === 'customer') {
            script = `Hello <span class="variable">${name}</span>, this is <span class="variable">[Your Name]</span> from BTFF.
            
I'm calling to check in and see how things are going with our service.

<span class="variable">[Pause for response]</span>

I'm glad to hear that! We actually have some new features that might interest you.

Would you like to hear about them?

<span class="variable">[Listen to response]</span>

Perfect! Let me walk you through what's new.`;
        } else if (type === 'vip') {
            script = `Hello <span class="variable">${name}</span>, this is <span class="variable">[Your Name]</span> from BTFF.
            
As one of our valued VIP customers, I wanted to personally reach out with an exclusive opportunity.

<span class="variable">[Pause for response]</span>

We're launching a new premium service and wanted to offer you early access.

Would you be interested in learning more?

<span class="variable">[Listen to response]</span>

Excellent! Let me tell you about the special benefits you'll receive.`;
        } else {
            script = `Hello <span class="variable">${name}</span>, this is <span class="variable">[Your Name]</span> from BTFF.
            
I'm calling regarding <span class="highlight">${reason || 'our services'}</span>.

<span class="variable">[Pause for response]</span>

I understand. Let me explain how we can help.

<span class="variable">[Listen to response]</span>

Would you be interested in learning more?`;
        }
        
        res.status(200).json({ script });
    } catch (error) {
        console.error('Script generation error:', error);
        res.status(500).json({ error: 'Script generation failed' });
    }
}