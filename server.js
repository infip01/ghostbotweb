const express = require('express');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = 1218;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve React static files
app.use(express.static('dist'));

// --- Configuration ---
const TELEGRAM_BOT_TOKEN = "8075529195:AAEIsCBp74oJG2ooIrx8k4B0NHGHqI4tggs";
const TELEGRAM_GROUP_ID = "-1002502277172";
const BLOCKED_IPS_FILE = 'blocked_ips.txt';

// --- Global State ---
let blockedIps = new Set();
let cooldownUntil = 0;
let ipRequests = {};
const RATE_LIMIT = 3;
const RATE_LIMIT_WINDOW = 60000; // 60 seconds in milliseconds
const IP_REPUTATION_CACHE = {};
const IP_REPUTATION_CACHE_TTL = 3600000; // 1 hour in milliseconds

// --- Utility Functions ---
function loadBlockedIps() {
    try {
        if (fs.existsSync(BLOCKED_IPS_FILE)) {
            const data = fs.readFileSync(BLOCKED_IPS_FILE, 'utf8');
            blockedIps = new Set(data.split('\n').filter(ip => ip.trim()));
        }
    } catch (error) {
        console.error('Error loading blocked IPs:', error);
        blockedIps = new Set();
    }
}

function saveBlockedIp(ip) {
    try {
        fs.appendFileSync(BLOCKED_IPS_FILE, ip + '\n');
        blockedIps.add(ip);
    } catch (error) {
        console.error('Error saving blocked IP:', error);
    }
}

function unblockIp(ip) {
    try {
        loadBlockedIps();
        if (blockedIps.has(ip)) {
            blockedIps.delete(ip);
            const ipsArray = Array.from(blockedIps);
            fs.writeFileSync(BLOCKED_IPS_FILE, ipsArray.join('\n') + '\n');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error unblocking IP:', error);
        return false;
    }
}

async function checkIpReputation(ip) {
    // Check cache first
    if (IP_REPUTATION_CACHE[ip]) {
        const entry = IP_REPUTATION_CACHE[ip];
        if (Date.now() - entry.timestamp < IP_REPUTATION_CACHE_TTL) {
            console.log(`IP Reputation Cache HIT for ${ip}.`);
            return entry;
        }
    }

    console.log(`IP Reputation Cache MISS for ${ip}. Querying ipquery.io...`);
    const apiUrl = `https://api.ipquery.io/${ip}?format=json`;

    try {
        const response = await axios.get(apiUrl, { timeout: 5000 });
        const data = response.data;
        
        const riskData = data.risk || {};
        const blockReasons = [];
        
        if (riskData.is_vpn) blockReasons.push("VPN");
        if (riskData.is_tor) blockReasons.push("Tor");
        if (riskData.is_proxy) blockReasons.push("Proxy");
        if (riskData.is_datacenter) blockReasons.push("Datacenter");

        const result = {
            blocked: blockReasons.length > 0,
            reason: blockReasons.join(", "),
            timestamp: Date.now()
        };

        IP_REPUTATION_CACHE[ip] = result;
        return result;
    } catch (error) {
        console.error(`Error calling ipquery.io: ${error}. Allowing request by default (fail-open).`);
        const result = { blocked: false, reason: '', timestamp: Date.now() };
        IP_REPUTATION_CACHE[ip] = result;
        return result;
    }
}

function handleApiError(error) {
    let errorMessage = null;
    
    if (error.response && error.response.data) {
        const errorData = error.response.data;
        if (errorData.error) {
            if (typeof errorData.error === 'object' && errorData.error.message) {
                errorMessage = errorData.error.message;
            } else if (typeof errorData.error === 'string') {
                errorMessage = errorData.error;
            }
        } else if (errorData.message) {
            errorMessage = errorData.message;
        }
    }

    if (error.response && error.response.status === 429) {
        console.log("Error 429: Too Many Requests. Initiating 5-minute cooldown.");
        cooldownUntil = Date.now() + 300000; // 5 minutes
        return { success: false, error: 'Rate limit hit. Cooling down for 5 minutes.' };
    } else if (error.response && errorMessage) {
        console.log(`API Error ${error.response.status}: ${errorMessage}`);
        return { success: false, error: errorMessage };
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.log(`Connection Error: ${error}`);
        return { success: false, error: 'Could not connect to the image generation API.' };
    } else {
        console.log(`An unexpected error occurred: ${error}`);
        return { success: false, error: errorMessage || 'An unexpected error occurred during the API call.' };
    }
}

async function generateUncenImage(taskData) {
    console.log(`Processing 'uncen' request. Prompt: ${taskData.prompt.substring(0, 30)}...`);

    const apiUrl = "https://api.infip.pro/gen";
    const headers = { 'accept': 'application/json', 'Content-Type': 'application/json' };

    const payload = {
        prompt: taskData.prompt,
        num_images: 1,
        seed: 0,
        aspect_ratio: taskData.aspect_ratio || 'IMAGE_ASPECT_RATIO_SQUARE',
        models: "uncen"
    };

    try {
        const response = await axios.post(apiUrl, payload, { headers });
        const result = response.data;
        const imageUrls = result.images || [];
        const seedsUsed = Array(imageUrls.length).fill(result.seed);
        return { image_urls: imageUrls, seeds_used: seedsUsed, success: imageUrls.length > 0 };
    } catch (error) {
        return handleApiError(error);
    }
}

async function generateKontextImages(taskData) {
    const model = taskData.model;
    let numImages = taskData.num_images || 4;
    
    if (['flux-1-1-pro', 'flux-pro'].includes(model)) {
        numImages = 1;
    }
    
    console.log(`Processing '${model}' request for ${numImages} images. Prompt: ${taskData.prompt.substring(0, 30)}...`);
    
    const modelMapping = {
        'kontext-max': 'black-forest-labs/FLUX.1-kontext-max',
        'kontext-pro': 'black-forest-labs/FLUX.1-kontext-pro',
        'flux-1-1-pro': 'black-forest-labs/FLUX.1.1-pro',
        'flux-dev': 'black-forest-labs/FLUX.1-dev',
        'flux-pro': 'black-forest-labs/FLUX.1-pro',
        'flux-schnell': 'black-forest-labs/FLUX.1-schnell'
    };
    
    const apiModel = modelMapping[model] || model;
    const apiUrl = "https://api.together.xyz/v1/images/generations";
    const headers = {
        'Authorization': 'Bearer 56c8eeff9971269d7a7e625ff88e8a83a34a556003a5c87c289ebe9a3d8a3d2c',
        'Content-Type': 'application/json'
    };
    
    const payload = {
        model: apiModel,
        prompt: taskData.prompt,
        n: numImages
    };
    
    if (!['kontext-max', 'kontext-pro'].includes(model)) {
        payload.width = 1024;
        payload.height = 1024;
    }
    
    if (['flux-dev', 'flux-schnell'].includes(model)) {
        payload.steps = model === 'flux-schnell' ? 4 : 28;
    }
    
    if (taskData.image_url) {
        console.log(`Processing image URL: ${taskData.image_url}`);
        payload.image_url = taskData.image_url;
    }

    try {
        console.log(`Sending request to Together API with payload keys: ${Object.keys(payload)}`);
        const response = await axios.post(apiUrl, payload, { headers });
        const result = response.data;
        
        const imageUrls = [];
        if (result.data) {
            for (const item of result.data) {
                if (item.url) {
                    imageUrls.push(item.url);
                }
            }
        }
        
        const seedsUsed = imageUrls.map(() => Math.floor(Math.random() * 8999999) + 1000000);
        return { image_urls: imageUrls, seeds_used: seedsUsed, success: imageUrls.length > 0 };
    } catch (error) {
        console.log(`Exception in API call: ${error}`);
        if (error.response) {
            console.log(`Error response content: ${error.response.data}`);
        }
        return handleApiError(error);
    }
}

async function generateStandardImages(taskData) {
    const model = taskData.model || 'img3';
    const numImages = taskData.num_images || 4;

    console.log(`Processing '${model}' request for ${numImages} images. Prompt: ${taskData.prompt.substring(0, 30)}...`);

    const apiUrl = "https://api.infip.pro/gen";
    const headers = { 'accept': 'application/json', 'Content-Type': 'application/json' };

    const payload = {
        prompt: taskData.prompt,
        num_images: numImages,
        seed: 0,
        aspect_ratio: taskData.aspect_ratio || 'IMAGE_ASPECT_RATIO_SQUARE',
        models: model
    };

    try {
        const response = await axios.post(apiUrl, payload, { headers });
        const result = response.data;

        const imageUrls = result.images || [];
        const seedsUsed = imageUrls.map(() => result.seed);
        return { image_urls: imageUrls, seeds_used: seedsUsed, success: imageUrls.length > 0 };
    } catch (error) {
        const errorResult = handleApiError(error);
        return { image_urls: [], seeds_used: [], success: false, error: errorResult.error };
    }
}

// --- Middleware ---
app.use(async (req, res, next) => {
    // Allow access to static files and block pages without checks
    if (req.path.startsWith('/assets') || req.path === '/block' || req.path === '/unblock') {
        return next();
    }

    const ip = req.headers['cf-connecting-ip'] || req.ip || req.connection.remoteAddress;

    // Check against manually blocked IPs first
    if (blockedIps.has(ip)) {
        console.log(`Blocking manually blocked IP: ${ip}`);
        return res.status(403).send(`
            <!DOCTYPE html>
            <html><head><title>Access Denied</title></head>
            <body style="text-align:center;padding:50px;">
                <h1>Access Denied</h1>
                <p>Your request has been blocked.</p>
                <p><strong>Reason:</strong> Spamming Or Botting Or Automating With Same Prompt</p>
            </body></html>
        `);
    }

    // Skip checks for localhost
    if (ip === '127.0.0.1' || ip === '::1') {
        return next();
    }

    try {
        const reputation = await checkIpReputation(ip);
        if (reputation.blocked) {
            const reasonText = `Use of an anonymizing service (${reputation.reason}) is not permitted.`;
            console.log(`Blocking request from IP ${ip}. Reason: ${reasonText}`);
            return res.status(403).send(`
                <!DOCTYPE html>
                <html><head><title>Access Denied</title></head>
                <body style="text-align:center;padding:50px;">
                    <h1>Access Denied</h1>
                    <p>Your request has been blocked.</p>
                    <p><strong>Reason:</strong> ${reasonText}</p>
                </body></html>
            `);
        }
    } catch (error) {
        console.error('Error checking IP reputation:', error);
    }

    next();
});

// --- Routes ---

// Serve React app for all frontend routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.get('/models', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.get('/api-page', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// API Routes
app.post('/api/generate', async (req, res) => {
    const ip = req.headers['cf-connecting-ip'] || req.ip || req.connection.remoteAddress;
    const data = req.body;

    const timeElapsed = data.time_elapsed || 0;
    if (timeElapsed < 2) {
        console.log(`Bot detected for IP ${ip} (submission time: ${timeElapsed}s). Request rejected.`);
        return res.status(400).json({ success: false, error: 'Request rejected as potential automation.' });
    }

    // Rate limiting
    const currentTime = Date.now();
    
    // Clean up stale entries
    Object.keys(ipRequests).forEach(ipAddr => {
        if (currentTime - ipRequests[ipAddr].start_time > RATE_LIMIT_WINDOW) {
            delete ipRequests[ipAddr];
        }
    });

    if (!ipRequests[ip]) {
        ipRequests[ip] = { count: 1, start_time: currentTime };
    } else {
        if (ipRequests[ip].count >= RATE_LIMIT) {
            console.log(`Rate limit exceeded for IP: ${ip}`);
            return res.status(429).json({ success: false, error: 'Rate limit exceeded. Please try again in a minute.' });
        } else {
            ipRequests[ip].count++;
        }
    }

    try {
        if (!data.prompt || !data.prompt.trim()) {
            return res.status(400).json({ success: false, error: 'Prompt is required' });
        }

        // Check cooldown
        const waitTime = cooldownUntil - Date.now();
        if (waitTime > 0) {
            console.log(`Request blocked due to cooldown. Waiting for ${Math.floor(waitTime / 1000)} seconds.`);
            return res.status(503).json({ success: false, error: 'Service temporarily unavailable due to rate limiting.' });
        }

        const workerData = {
            prompt: data.prompt,
            num_images: data.num_images,
            aspect_ratio: data.aspect_ratio,
            model: data.model,
            image_url: data.image_url
        };

        console.log(`Request from IP ${ip} for prompt '${data.prompt.substring(0, 30)}...' processing.`);

        let result;
        if (workerData.model === 'uncen') {
            result = await generateUncenImage(workerData);
        } else if (['kontext-max', 'kontext-pro', 'flux-1-1-pro', 'flux-dev', 'flux-pro', 'flux-schnell'].includes(workerData.model)) {
            result = await generateKontextImages(workerData);
        } else {
            result = await generateStandardImages(workerData);
        }

        // Send to Telegram if successful (simplified - just log for now)
        if (result.success && result.image_urls) {
            console.log(`Images generated successfully. Model: ${workerData.model}, Images: ${result.image_urls.length}`);
            // Note: Telegram functionality would be implemented here
        }

        res.json(result);

    } catch (error) {
        console.log(`Error in /api/generate route: ${error}`);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.get('/api/generate-key', async (req, res) => {
    const internalApiUrl = "http://localhost:1217/generate-api-key";
    try {
        const userIp = req.headers['cf-connecting-ip'] || req.ip || req.connection.remoteAddress;
        const headers = { 'CF-Connecting-IP': userIp };
        
        const response = await axios.get(internalApiUrl, { headers, timeout: 10000 });
        res.json(response.data);
    } catch (error) {
        console.log(`Error calling internal API service: ${error}`);
        res.status(503).json({ error: 'The API key service is currently unavailable. Please try again later.' });
    }
});

app.get('/api/telegram-status', (req, res) => {
    res.json({
        bot_initialized: false,
        error: 'Telegram bot functionality not implemented in Node.js version',
        send_queue_size: 0,
        retry_queue_size: 0
    });
});

// File upload
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file provided' });
    }

    const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];
    const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid file format. Please upload PNG, JPG, JPEG, GIF, BMP, or WebP files.' 
        });
    }

    try {
        const snapzionUrl = "https://upload.snapzion.com/api/public-upload";
        const headers = {
            "Authorization": "Bearer NAI-PQUXIcD24u7afjAyYRKmeJMqSWnH1u0F6PEfmQaWiCKsUrvpG2KsQFzqmgKV"
        };

        const formData = new FormData();
        const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
        formData.append('file', blob, req.file.originalname);

        console.log(`Uploading file ${req.file.originalname} to Snapzion...`);
        console.log(`File size: ${req.file.buffer.length} bytes`);

        const response = await axios.post(snapzionUrl, formData, { 
            headers: { ...headers, ...formData.getHeaders() },
            timeout: 30000 
        });

        console.log(`Snapzion response status: ${response.status}`);
        console.log(`Snapzion response:`, response.data);

        if (response.status === 200 && response.data.url) {
            const fileUrl = response.data.url;
            console.log(`Successfully uploaded to Snapzion: ${fileUrl}`);
            
            return res.json({
                success: true,
                file_url: fileUrl,
                filename: req.file.originalname
            });
        } else {
            console.log(`No 'url' field in Snapzion response:`, response.data);
            return res.status(500).json({ success: false, error: 'Invalid response from upload service' });
        }
    } catch (error) {
        console.log(`Error uploading to Snapzion: ${error}`);
        if (error.code === 'ECONNABORTED') {
            return res.status(500).json({ success: false, error: 'Upload service timed out' });
        } else if (error.response) {
            console.log(`Snapzion error response:`, error.response.data);
            return res.status(500).json({ success: false, error: `Upload service returned status ${error.response.status}` });
        } else {
            return res.status(500).json({ success: false, error: 'Network error during upload' });
        }
    }
});

// Download image
app.get('/download/:imageUrl(*)', async (req, res) => {
    try {
        const imageUrl = req.params.imageUrl;
        const response = await axios.get(imageUrl, { responseType: 'stream' });
        
        const imageName = imageUrl.split('/').pop();
        const contentType = response.headers['content-type'] || '';
        
        const extensionMap = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/bmp': '.bmp',
            'image/webp': '.webp'
        };
        
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        const hasExtension = validExtensions.some(ext => imageName.toLowerCase().endsWith(ext));
        
        let downloadFilename;
        let mimetype;
        
        if (!hasExtension) {
            const extension = extensionMap[contentType] || '.jpg';
            mimetype = contentType || 'image/jpeg';
            const baseName = imageName.split('.')[0] || imageName;
            downloadFilename = `${baseName}${extension}`;
        } else {
            downloadFilename = imageName;
            const fileExt = imageName.toLowerCase().split('.').pop();
            const mimeTypeMap = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'bmp': 'image/bmp',
                'webp': 'image/webp'
            };
            mimetype = mimeTypeMap[fileExt] || 'image/jpeg';
        }
        
        res.setHeader('Content-Type', mimetype);
        res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
        response.data.pipe(res);
    } catch (error) {
        console.log(`Error downloading image: ${error}`);
        res.status(500).send('Error downloading image');
    }
});

// Block/Unblock routes with basic auth
const authUsers = { 'Infip': '1217' };
const authMiddleware = basicAuth({
    users: authUsers,
    challenge: true,
    realm: 'Login Required'
});

app.get('/block', authMiddleware, (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html><head><title>Block/Unblock IP Address</title></head>
        <body style="text-align:center;padding:50px;">
            <h1>Block IP Address</h1>
            <form action="/block" method="POST">
                <input type="text" name="ip" placeholder="Enter IP to block" required>
                <button type="submit">Block IP</button>
            </form>
            <h1>Unblock IP Address</h1>
            <form action="/unblock" method="POST">
                <input type="text" name="ip" placeholder="Enter IP to unblock" required>
                <button type="submit">Unblock IP</button>
            </form>
        </body></html>
    `);
});

app.post('/block', authMiddleware, (req, res) => {
    const ipToBlock = req.body.ip;
    if (ipToBlock) {
        saveBlockedIp(ipToBlock);
        console.log(`ADMIN ACTION: Manually blocked IP ${ipToBlock}`);
        res.send(`Successfully blocked IP: ${ipToBlock}`);
    } else {
        res.send('No IP provided');
    }
});

app.post('/unblock', authMiddleware, (req, res) => {
    const ipToUnblock = req.body.ip;
    if (ipToUnblock) {
        if (unblockIp(ipToUnblock)) {
            console.log(`ADMIN ACTION: Manually unblocked IP ${ipToUnblock}`);
            res.send(`Successfully unblocked IP: ${ipToUnblock}`);
        } else {
            res.send(`IP ${ipToUnblock} was not found in the block list.`);
        }
    } else {
        res.send('No IP provided');
    }
});

// Catch-all route for React Router
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Initialize and start server
loadBlockedIps();

app.listen(PORT, '0.0.0.0', () => {
    console.log("=" * 50);
    console.log("Image Generation Server Starting");
    console.log(`Loaded ${blockedIps.size} manually blocked IPs.`);
    console.log("Processing Model: Concurrent Processing");
    console.log("IP Rate Limiting: 3 Requests/Minute per IP");
    console.log("Security: Timing Analysis Enabled");
    console.log("Security: VPN/Proxy/Tor Blocking is ENABLED.");
    console.log("Telegram Bot: DISABLED (Node.js version)");
    console.log("=" * 50);
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});