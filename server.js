// server.js - TEMPORARY FIX FOR TESTING
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();

// DISABLE CSP COMPLETELY FOR TESTING
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', 
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "style-src * 'unsafe-inline' data: blob:; " +
        "img-src * data: blob:; " +
        "frame-src *; " +
        "connect-src *; " +
        "media-src *;"
    );
    next();
});

// CORS configuration
app.use(cors({
    origin: '*',
    credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Proxy endpoint for Apps Script
app.all('/api/proxy', async (req, res) => {
    try {
        const targetUrl = process.env.APPS_SCRIPT_URL;
        
        if (!targetUrl) {
            return res.status(500).json({ success: false, error: 'Server configuration error' });
        }
        
        const url = new URL(targetUrl);
        Object.keys(req.query).forEach(key => {
            url.searchParams.append(key, req.query[key]);
        });
        
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
        
        try {
            const jsonData = JSON.parse(responseText);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.send(jsonData);
        } catch (e) {
            return res.status(500).json({ success: false, error: 'Invalid JSON response' });
        }
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve main page
app.get('/', (req, res) => {
    try {
        const templatePath = path.join(__dirname, 'index.html');
        let html = fs.readFileSync(templatePath, 'utf8');
        html = html.replace('%%APPS_SCRIPT_URL%%', process.env.APPS_SCRIPT_URL || '');
        res.send(html);
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});

// Serve admin page
app.get('/admin', (req, res) => {
    try {
        const templatePath = path.join(__dirname, 'admin.html');
        let html = fs.readFileSync(templatePath, 'utf8');
        html = html.replace('%%APPS_SCRIPT_URL%%', process.env.APPS_SCRIPT_URL || '');
        res.send(html);
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 Apps Script URL: ${process.env.APPS_SCRIPT_URL}`);
});