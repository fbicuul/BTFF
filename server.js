// server.js - VERCEL VERSION
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Basic CORS
app.use(cors({
    origin: '*',
    credentials: true
}));

// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// ===== PROXY ENDPOINT FOR APPS SCRIPT =====
app.all('/api/proxy', async (req, res) => {
    try {
        const targetUrl = process.env.APPS_SCRIPT_URL;
        
        if (!targetUrl) {
            console.error('❌ APPS_SCRIPT_URL not configured');
            return res.status(500).json({ 
                success: false, 
                error: 'Server configuration error' 
            });
        }
        
        // Build the full URL with query parameters
        const url = new URL(targetUrl);
        Object.keys(req.query).forEach(key => {
            url.searchParams.append(key, req.query[key]);
        });
        
        console.log('🔄 Proxying to:', url.toString());
        
        const fetchOptions = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (req.method === 'POST') {
            fetchOptions.body = JSON.stringify(req.body);
        }
        
        const response = await fetch(url.toString(), fetchOptions);
        const responseText = await response.text();
        
        // Try to parse as JSON
        try {
            const jsonData = JSON.parse(responseText);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.send(jsonData);
        } catch (e) {
            console.error('❌ Invalid JSON response:', responseText.substring(0, 200));
            return res.status(500).json({ 
                success: false, 
                error: 'Invalid JSON response from Apps Script',
                preview: responseText.substring(0, 100)
            });
        }
        
    } catch (error) {
        console.error('❌ Proxy error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ===== AI API ENDPOINTS =====
app.post('/api/ai/sentiment', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }
        
        // Simple rule-based sentiment analysis
        const text_lower = text.toLowerCase();
        let sentiment = 'neutral';
        
        const positiveWords = ['great', 'awesome', 'love', 'excellent', 'perfect', 'happy', 'good', 'best', 'amazing', 'wonderful', 'thank', 'thanks'];
        const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'poor', 'horrible', 'disappointed', 'angry', 'upset', 'frustrated'];
        
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
        
        res.json({ sentiment });
    } catch (error) {
        console.error('Sentiment analysis error:', error);
        res.status(500).json({ error: 'Sentiment analysis failed' });
    }
});

app.post('/api/ai/generate-script', async (req, res) => {
    try {
        const { contactName, contactType, company, reason } = req.body;
        
        const name = contactName || '[Customer Name]';
        const type = contactType || 'lead';
        const comp = company || 'your company';
        const callReason = reason || 'follow-up';
        
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
            
I'm calling regarding <span class="highlight">${callReason}</span>.

<span class="variable">[Pause for response]</span>

I understand. Let me explain how we can help.

<span class="variable">[Listen to response]</span>

Would you be interested in learning more?`;
        }
        
        res.json({ script });
    } catch (error) {
        console.error('Script generation error:', error);
        res.status(500).json({ error: 'Script generation failed' });
    }
});

// Helper function to inject environment variables
function injectEnvVars(html) {
    return html.replace(
        '%%APPS_SCRIPT_URL%%', 
        process.env.APPS_SCRIPT_URL || ''
    );
}

// Route for main page
app.get('/', (req, res) => {
    try {
        const templatePath = path.join(__dirname, 'index.html');
        
        if (!fs.existsSync(templatePath)) {
            console.error('❌ index.html not found at:', templatePath);
            return res.status(500).send('index.html not found');
        }
        
        let html = fs.readFileSync(templatePath, 'utf8');
        html = injectEnvVars(html);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error('Error serving index:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Add this to your server.js - after your existing routes

// Route for call center page
app.get('/callcenter', (req, res) => {
    try {
        const templatePath = path.join(__dirname, 'callcenter.html');
        
        if (!fs.existsSync(templatePath)) {
            console.error('❌ callcenter.html not found');
            return res.status(500).send('callcenter.html not found');
        }
        
        let html = fs.readFileSync(templatePath, 'utf8');
        
        // Inject the call center API URL from environment variables
        const callCenterApiUrl = process.env.CALL_CENTER_API_URL || '';
        console.log('🔗 Call Center API URL:', callCenterApiUrl);
        
        html = html.replace('%%CALL_CENTER_API_URL%%', callCenterApiUrl);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error('Error serving call center:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route for admin page
app.get('/admin', (req, res) => {
    try {
        const templatePath = path.join(__dirname, 'admin.html');
        
        if (!fs.existsSync(templatePath)) {
            console.error('❌ admin.html not found at:', templatePath);
            return res.status(500).send('admin.html not found');
        }
        
        let html = fs.readFileSync(templatePath, 'utf8');
        html = injectEnvVars(html);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error('Error serving admin:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV
    });
});

// 404 handler
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ success: false, error: 'API endpoint not found' });
    } else {
        res.status(404).send('Page not found');
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    res.status(500).json({ 
        success: false,
        error: 'Internal server error'
    });
});

// For local development
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`🔗 Apps Script URL: ${process.env.APPS_SCRIPT_URL}`);
    });
}

// Export for Vercel
module.exports = app;