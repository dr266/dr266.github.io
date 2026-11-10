'use strict';

const STATUS_URL = './status.json';
const MAX_AGE_SECONDS = 900;

function setStatus(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return 'N/A';
    return (bytes / (1024 ** 3)).toFixed(1) + ' GiB';
}

function formatUptime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return 'N/A';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);

    return `${days}d ${hours}h`;
}

async function updateNodeStatus() {
    try {
        const response = await fetch(STATUS_URL, {
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.network !== 'cosmoshub-4') {
            throw new Error('Wrong network');
        }

        const timestamp = Date.parse(data.timestamp);
        const age = (Date.now() - timestamp) / 1000;

        const stale = !Number.isFinite(age) ||
                      age < -300 ||
                      age > MAX_AGE_SECONDS;

        setStatus('block-height',
            Number(data.block_height).toLocaleString('en-US'));

        setStatus('sync-status',
            stale ? 'STALE' :
            data.service !== 'active' ? 'SERVICE DOWN' :
            data.catching_up ? 'SYNCING' : 'SYNCED');

        setStatus('node-peers', data.peers ?? 'N/A');

        setStatus('node-uptime',
            formatUptime(Number(data.uptime_seconds)));

        const mem = data.memory;
        if (mem) {
            const used = mem.total_bytes - mem.available_bytes;
            setStatus('node-ram',
                `${formatBytes(used)} / ${formatBytes(mem.total_bytes)}`);
        }

        const disk = data.disk;
        if (disk) {
            setStatus('node-disk',
                `${disk.used_percent}% / ${formatBytes(disk.total_bytes)}`);
        }

        setStatus('node-updated',
            Number.isFinite(timestamp)
                ? new Date(timestamp).toLocaleString()
                : 'N/A');

    } catch (error) {
        console.error('Node status:', error);
        setStatus('sync-status', 'UNAVAILABLE');
    }
}

updateNodeStatus();
setInterval(updateNodeStatus, 60000);

// Juno: independent status source; Cosmos Hub status remains unchanged.
async function updateJunoStatus() {
    const prefix = 'juno-';
    try {
        const response = await fetch('./juno-status.json', {cache: 'no-store'});
        if (!response.ok) throw new Error(`Juno status HTTP ${response.status}`);
        const data = await response.json();
        if (data.network !== 'juno-1') throw new Error('Wrong Juno network');
        const timestamp = Date.parse(data.timestamp);
        const age = (Date.now() - timestamp) / 1000;
        const stale = !Number.isFinite(age) || age < -300 || age > MAX_AGE_SECONDS;
        const height = Number(data.block_height);
        setStatus(prefix + 'block-height', Number.isFinite(height) && height >= 0 ? height.toLocaleString('en-US') : 'N/A');
        setStatus(prefix + 'sync-status', stale ? 'STALE' :
            data.service !== 'active' ? 'SERVICE DOWN' :
            data.catching_up ? 'SYNCING' : 'SYNCED');
        const power = Number(data.voting_power);
        setStatus(prefix + 'voting-power', Number.isFinite(power) && power >= 0 ? power.toLocaleString('en-US') : 'N/A');
        setStatus(prefix + 'node-peers', data.peers ?? 'N/A');
        setStatus(prefix + 'node-uptime', formatUptime(Number(data.uptime_seconds)));
        const mem = data.memory;
        if (mem && Number.isFinite(Number(mem.total_bytes)) && Number.isFinite(Number(mem.available_bytes))) {
            const total = Number(mem.total_bytes);
            setStatus(prefix + 'node-ram', `${formatBytes(total - Number(mem.available_bytes))} / ${formatBytes(total)}`);
        }
        const disk = data.disk;
        if (disk) setStatus(prefix + 'node-disk', `${disk.used_percent}% / ${formatBytes(Number(disk.total_bytes))}`);
        setStatus(prefix + 'node-updated', Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : 'N/A');
    } catch (error) {
        console.error('Juno node status:', error);
        setStatus(prefix + 'sync-status', 'UNAVAILABLE');
    }
}
updateJunoStatus();
setInterval(updateJunoStatus, 60000);
