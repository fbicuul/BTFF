// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 
                        "https://cdnjs.cloudflare.com", 
                        "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", 
                      "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https://img.youtube.com"],
            frameSrc: ["'self'", "https://www.youtube.com"],
            connectSrc: ["'self'", process.env.APPS_SCRIPT_URL]
        }
    }
}));

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://btff.onrender.com']  // Fixed: removed trailing slash
        : ['http://localhost:3000'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Parse JSON bodies
app.use(express.json());

// Serve static files from public directory (if you have any)
app.use('/public', express.static(path.join(__dirname, 'public')));

// ===== PROXY ENDPOINT FOR APPS SCRIPT =====
// This handles all API calls to Apps Script and avoids CORS issues
app.all('/api/proxy', async (req, res) => {
    try {
        const targetUrl = process.env.APPS_SCRIPT_URL;
        
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
            }
        };
        
        // Add body for POST requests
        if (req.method === 'POST' || req.method === 'PUT') {
            fetchOptions.body = JSON.stringify(req.body);
        }
        
        // Make the request to Apps Script
        const response = await fetch(url.toString(), fetchOptions);
        const data = await response.text();
        
        // Forward the response
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
        
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
        process.env.APPS_SCRIPT_URL
    );
}

// Route for main page
app.get('/', (req, res) => {
    try {
        // Look for index.html in the same directory as server.js
        const templatePath = path.join(__dirname, 'index.html');
        let html = fs.readFileSync(templatePath, 'utf8');
        
        // Inject the environment variable
        html = html.replace(
            '%%APPS_SCRIPT_URL%%', 
            process.env.APPS_SCRIPT_URL || ''
        );
        
        res.send(html);
    } catch (error) {
        console.error('Error serving index:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route for admin page
app.get('/admin', (req, res) => {
    try {
        // Look for admin.html in the same directory as server.js
        const templatePath = path.join(__dirname, 'admin.html');
        let html = fs.readFileSync(templatePath, 'utf8');
        
        // Inject the environment variable
        html = html.replace(
            '%%APPS_SCRIPT_URL%%', 
            process.env.APPS_SCRIPT_URL || ''
        );
        
        res.send(html);
    } catch (error) {
        console.error('Error serving admin:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Health check endpoint (Render uses this)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// API route to get config (if needed)
app.get('/api/config', (req, res) => {
    // Only send public config, never secrets
    res.json({
        appsScriptUrl: process.env.APPS_SCRIPT_URL,
        environment: process.env.NODE_ENV
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

// 404 handler
app.use((req, res) => {
    res.status(404).send('Page not found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 Apps Script URL: ${process.env.APPS_SCRIPT_URL}`);
    console.log(`🌍 CORS origin: ${process.env.NODE_ENV === 'production' ? 'https://btff.onrender.com' : 'http://localhost:3000'}`);
});