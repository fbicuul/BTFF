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
        ? ['https://btff.onrender.com/'] 
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
        const templatePath = path.join(__dirname, 'templates', 'index.template.html');
        let html = fs.readFileSync(templatePath, 'utf8');
        html = injectEnvVars(html);
        res.send(html);
    } catch (error) {
        console.error('Error serving index:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route for admin page
app.get('/admin', (req, res) => {
    try {
        const templatePath = path.join(__dirname, 'templates', 'admin.template.html');
        let html = fs.readFileSync(templatePath, 'utf8');
        html = injectEnvVars(html);
        res.send(html);
    } catch (error) {
        console.error('Error serving admin:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Health check endpoint (Render uses this)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

// API route to get config (if needed)
app.get('/api/config', (req, res) => {
    // Only send public config, never secrets
    res.json({
        appsScriptUrl: process.env.APPS_SCRIPT_URL
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
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
});