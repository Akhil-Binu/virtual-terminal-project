/**
 * utils.js — Shared utility functions for LinuxMaster
 */

const Utils = (() => {

  // ── String Utilities ─────────────────────────────────────────────────────────

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function colorize(text, colorClass) {
    return `<span class="${colorClass}">${escapeHtml(text)}</span>`;
  }

  function stripHtml(html) {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
  }

  function unescapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
  }

  // Apply ANSI-like coloring for ls output
  function colorizeEntry(entry) {
    const name = escapeHtml(entry.name);
    if (entry.isDir()) return `<span class="term-dir">${name}/</span>`;
    if (entry.isLink()) return `<span class="term-link">${name}</span>`;
    // Executable check (permissions contain x bit)
    const perms = entry.permissions.toString();
    if (perms.includes('7') || perms.includes('5') || perms.includes('1')) {
      return `<span class="term-exec">${name}</span>`;
    }
    return `<span class="term-file">${name}</span>`;
  }

  // ── Command Parsing ──────────────────────────────────────────────────────────

  /**
   * Tokenize a command line, respecting quotes.
   * Returns an array of tokens.
   */
  function tokenize(input) {
    const tokens = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];

      if (ch === "'" && !inDouble) {
        inSingle = !inSingle;
      } else if (ch === '"' && !inSingle) {
        inDouble = !inDouble;
      } else if (ch === ' ' && !inSingle && !inDouble) {
        if (current.length > 0) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += ch;
      }
    }
    if (current.length > 0) tokens.push(current);
    return tokens;
  }

  /**
   * Split a command line by pipes (respecting quotes).
   */
  function splitByPipe(input) {
    const segments = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (ch === '|' && !inSingle && !inDouble) {
        segments.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    segments.push(current.trim());
    return segments.filter(Boolean);
  }

  /**
   * Parse redirection operators from a token list.
   * Returns { tokens, redirectOut, redirectAppend, redirectFile }
   */
  function parseRedirects(tokens) {
    const result = {
      tokens: [],
      redirectOut: false,
      redirectAppend: false,
      redirectFile: null
    };

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === '>>' && i + 1 < tokens.length) {
        result.redirectAppend = true;
        result.redirectFile = tokens[i + 1];
        i++;
      } else if (tokens[i] === '>' && i + 1 < tokens.length) {
        result.redirectOut = true;
        result.redirectFile = tokens[i + 1];
        i++;
      } else {
        result.tokens.push(tokens[i]);
      }
    }
    return result;
  }

  /**
   * Parse flags from a token list.
   * Returns { flags: { flagChar: true }, args: [...remaining] }
   */
  function parseFlags(tokens) {
    const flags = {};
    const args = [];

    for (const token of tokens) {
      if (token.startsWith('-') && token.length > 1 && !token.startsWith('--')) {
        for (const ch of token.slice(1)) {
          flags[ch] = true;
        }
      } else if (token.startsWith('--')) {
        flags[token.slice(2)] = true;
      } else {
        args.push(token);
      }
    }
    return { flags, args };
  }

  // ── Date/Time ────────────────────────────────────────────────────────────────

  function formatFullDate(date = new Date()) {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const day = days[date.getDay()];
    const month = months[date.getMonth()];
    const dom = String(date.getDate()).padStart(2, ' ');
    const time = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}:${String(date.getSeconds()).padStart(2,'0')}`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const year = date.getFullYear();
    return `${day} ${month} ${dom} ${time} ${tz} ${year}`;
  }

  // ── LocalStorage ─────────────────────────────────────────────────────────────

  function saveToStorage(key, value) {
    try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); }
    catch (e) { console.warn('Storage save failed:', e); }
  }

  function loadFromStorage(key, defaultValue = null) {
    try {
      const val = localStorage.getItem(key);
      if (val === null) return defaultValue;
      try { return JSON.parse(val); } catch { return val; }
    } catch (e) { return defaultValue; }
  }

  // ── Misc ─────────────────────────────────────────────────────────────────────

  function generateSimulatedProcesses() {
    return [
      { pid: 1,    user: 'root', cpu: '0.0', mem: '0.1', vsz: 167896,  rss: 12320,  stat: 'Ss', start: '10:00', time: '0:01', cmd: '/sbin/init' },
      { pid: 2,    user: 'root', cpu: '0.0', mem: '0.0', vsz: 0,       rss: 0,      stat: 'S',  start: '10:00', time: '0:00', cmd: '[kthreadd]' },
      { pid: 156,  user: 'root', cpu: '0.0', mem: '0.1', vsz: 16284,   rss: 9640,   stat: 'Ss', start: '10:00', time: '0:00', cmd: '/lib/systemd/systemd-logind' },
      { pid: 298,  user: 'root', cpu: '0.1', mem: '0.2', vsz: 72296,   rss: 5864,   stat: 'Ss', start: '10:00', time: '0:00', cmd: '/usr/sbin/sshd -D' },
      { pid: 512,  user: 'user', cpu: '0.0', mem: '0.1', vsz: 9880,    rss: 3568,   stat: 'Ss', start: '10:01', time: '0:00', cmd: '-bash' },
      { pid: 1024, user: 'user', cpu: '0.5', mem: '0.8', vsz: 512000,  rss: 32768,  stat: 'Sl', start: '10:05', time: '0:02', cmd: 'node linuxmaster.js' },
      { pid: 1337, user: 'user', cpu: '0.0', mem: '0.0', vsz: 9224,    rss: 1536,   stat: 'R+', start: '10:10', time: '0:00', cmd: 'ps aux' },
    ];
  }

  function simulatedTopOutput() {
    const procs = generateSimulatedProcesses();
    const header = `top - ${formatFullDate().slice(4, 12)} up 20 min,  1 user,  load average: 0.12, 0.08, 0.04
Tasks:   7 total,   1 running,   6 sleeping,   0 stopped,   0 zombie
%Cpu(s):  1.2 us,  0.5 sy,  0.0 ni, 98.1 id,  0.2 wa,  0.0 hi,  0.0 si
MiB Mem :   7936.8 total,   3998.2 free,   2142.4 used,   1796.2 buff/cache
MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   5512.7 avail Mem

  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND`;
    const rows = procs.map(p =>
      `${String(p.pid).padStart(5)} ${p.user.padEnd(9)} 20   0 ${String(p.vsz).padStart(7)} ${String(p.rss).padStart(6)} ${String(Math.floor(p.rss/2)).padStart(6)} ${p.stat.padEnd(1)}  ${p.cpu.padStart(4)}  ${p.mem.padStart(4) } ${p.time.padStart(9)} ${p.cmd}`
    );
    return header + '\n' + rows.join('\n');
  }

  function formatPsAux() {
    const procs = generateSimulatedProcesses();
    const header = 'USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND';
    const rows = procs.map(p =>
      `${p.user.padEnd(13)}${String(p.pid).padStart(4)} ${p.cpu.padStart(4)} ${p.mem.padStart(4)} ${String(p.vsz).padStart(6)} ${String(p.rss).padStart(5)} pts/0    ${p.stat.padEnd(4)} ${p.start.padStart(5)}   ${p.time.padStart(4)} ${p.cmd}`
    );
    return header + '\n' + rows.join('\n');
  }

  // Glob expansion (simple)
  function matchGlob(pattern, name) {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return regex.test(name);
  }

  return {
    escapeHtml, stripHtml, unescapeHtml, colorize, colorizeEntry,
    tokenize, splitByPipe, parseRedirects, parseFlags,
    formatFullDate, saveToStorage, loadFromStorage,
    simulatedTopOutput, formatPsAux, matchGlob
  };
})();

window.Utils = Utils;
