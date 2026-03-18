// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security middleware - UPDATED CSP
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // Allow all necessary sources
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:", "data:",
                        "https://cdnjs.cloudflare.com", 
                        "https://cdn.jsdelivr.net",
                        "https://www.youtube.com",
                        "https://s.ytimg.com",
                        "https://www.youtube-nocookie.com",
                        "https://*.youtube.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "blob:", "data:",
                      "https://cdnjs.cloudflare.com",
                      "https://www.youtube.com",
                      "https://*.youtube.com"],
            imgSrc: ["'self'", "data:", "blob:", 
                    "https://img.youtube.com", 
                    "https://i.ytimg.com",
                    "https://*.ytimg.com",
                    "https://*.youtube.com"],
            frameSrc: ["'self'", 
                      "https://www.youtube.com", 
                      "https://www.youtube-nocookie.com",
                      "https://*.youtube.com"],
            connectSrc: ["'self'", 
                        "https://cdnjs.cloudflare.com",
                        "https://cdn.jsdelivr.net",
                        process.env.APPS_SCRIPT_URL,
                        "https://script.google.com",
                        "https://www.youtube.com",
                        "https://*.youtube.com"],
            fontSrc: ["'self'", "data:", "https://cdnjs.cloudflare.com"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            // Critical: Allow YouTube iframes
            childSrc: ["'self'", "blob:", "https://www.youtube.com", "https://*.youtube.com"],
            frameAncestors: ["'self'"],
            // Allow media sources
            mediaSrc: ["'self'", "https://www.youtube.com", "https://*.youtube.com"],
            // This is important - allows YouTube to load properly
            workerSrc: ["'self'", "blob:", "https://www.youtube.com"],
            manifestSrc: ["'self'"],
            // Upgrade insecure requests
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://btff.onrender.com'] 
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP'
});
app.use(limiter);

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
        
        // Prepare fetch options
        const fetchOptions = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
            },
            redirect: 'follow',
            follow: 10
        };
        
        // Add body for POST requests
        if (req.method === 'POST' || req.method === 'PUT') {
            fetchOptions.body = JSON.stringify(req.body);
        }
        
        // Make the request to Apps Script
        const response = await fetch(url.toString(), fetchOptions);
        const contentType = response.headers.get('content-type');
        const responseText = await response.text();
        
        // Log first 200 chars for debugging
        console.log('📥 Response preview:', responseText.substring(0, 200));
        
        // Check if response is HTML (error page)
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
            console.error('❌ Received HTML instead of JSON from Apps Script');
            return res.status(500).json({ 
                success: false, 
                error: 'Apps Script returned HTML. Check deployment settings.' 
            });
        }
        
        // Try to parse as JSON
        try {
            const jsonData = JSON.parse(responseText);
            
            // Add CORS headers
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            
            return res.send(jsonData);
        } catch (e) {
            console.error('❌ Invalid JSON response:', responseText.substring(0, 500));
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
            error: 'Proxy error: ' + error.message 
        });
    }
});

// Helper function to inject environment variables
function injectEnvVars(html) {
    return html.replace(
        '%%APPS_SCRIPT_URL%%', 
        process.env.APPS_SCRIPT_URL || ''
    ).replace(
        '%%RENDER_URL%%',
        process.env.RENDER_URL || 'https://btff.onrender.com'
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        appsScriptConfigured: !!process.env.APPS_SCRIPT_URL
    });
});

// API route to get config
app.get('/api/config', (req, res) => {
    res.json({
        appsScriptUrl: process.env.APPS_SCRIPT_URL,
        environment: process.env.NODE_ENV
    });
});

// Test endpoint to verify proxy is working
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Proxy server is running',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    res.status(500).json({ 
        success: false,
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler - return JSON for API routes, HTML for others
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ success: false, error: 'API endpoint not found' });
    } else {
        res.status(404).send('Page not found');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🚀 ==================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Apps Script URL: ${process.env.APPS_SCRIPT_URL || '❌ NOT SET'}`);
    console.log(`🌍 CORS origin: ${process.env.NODE_ENV === 'production' ? 'https://btff.onrender.com' : 'http://localhost:3000'}`);
    console.log('🚀 ==================================');
});