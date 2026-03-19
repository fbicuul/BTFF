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
    
    const { text } = req.body;
    
    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }
    
    try {
        // Simple rule-based sentiment analysis (since we don't have OpenAI key)
        // In production, replace with actual AI API
        const text_lower = text.toLowerCase();
        let sentiment = 'neutral';
        
        const positiveWords = ['great', 'awesome', 'love', 'excellent', 'perfect', 'happy', 'good', 'best', 'amazing', 'wonderful'];
        const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'poor', 'horrible', 'disappointed', 'angry', 'upset'];
        
        let positiveCount = 0;
        let negativeCount = 0;
        
        positiveWords.forEach(word => {
            if (text_lower.includes(word)) positiveCount++;
        });
        
        negativeWords.forEach(word => {
            if (text_lower.includes(word)) negativeCount++;
        });
        
        if (positiveCount > negativeCount) {
            sentiment = 'positive';
        } else if (negativeCount > positiveCount) {
            sentiment = 'negative';
        }
        
        res.status(200).json({ sentiment });
    } catch (error) {
        console.error('Sentiment analysis error:', error);
        res.status(500).json({ error: 'Sentiment analysis failed' });
    }
}