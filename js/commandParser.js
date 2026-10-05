/**
 * commandParser.js — Command parsing and execution engine for LinuxMaster
 * Handles tokenization, pipe/redirect support, flag parsing, and all command handlers.
 */

class CommandParser {
  constructor(vfs, terminal) {
    this.vfs = vfs;
    this.terminal = terminal;
    this._commandHistory = [];
    this._aliases = {
      'll': 'ls -la',
      'la': 'ls -A',
      'l': 'ls -CF',
    };
  }

  getSupportedCommands() {
    return [
      'ls','cd','pwd','mkdir','rmdir','touch','rm','cp','mv','cat','echo','find','grep',
      'chmod','chown','whoami','date','uname','clear','reset','history','head','tail','wc',
      'nano','vim','vi','man','help','top','htop','ps','kill','killall','pkill','pgrep',
      'pstree','lsof','vmstat','iostat','env','printenv','export','unset','which','type',
      'alias','sort','uniq','cut','tr','diff','file','stat','du','df','ln','printf',
      'sed','awk','tac','rev','nl','column','paste','strings','expand','fold','od','xxd',
      'less','more','tar','gzip','gunzip','zip','unzip','bzip2','xz','ping','curl','wget',
      'netstat','ss','ifconfig','ip','ssh','scp','nslookup','dig','host','traceroute',
      'tracepath','apt','apt-get','yum','dnf','snap','dpkg','rpm','jobs','bg','fg','nohup',
      'time','watch','crontab','hostname','uptime','free','lscpu','lsblk','lspci','lsusb',
      'dmesg','journalctl','systemctl','service','mount','umount','blkid','fdisk','id',
      'groups','last','who','w','su','sudo','passwd','useradd','adduser','userdel','groupadd',
      'umask','source','basename','dirname','realpath','readlink','whereis','locate','expr',
      'bc','seq','factor','cal','ncal','base64','md5sum','sha256sum','sha1sum','cksum',
      'tee','xargs','yes','true','false','test','shuf','comm','split','sleep','exit','logout'
    ];
  }

  // ── Main Entry Point ──────────────────────────────────────────────────────────

  /**
   * Execute a raw input string. Returns HTML string of output (or null for no output).
   */
  execute(rawInput) {
    const input = rawInput.trim();
    if (!input) return null;

    // Handle alias expansion
    let expandedInput = input;
    for (const [alias, expansion] of Object.entries(this._aliases)) {
      if (input === alias || input.startsWith(alias + ' ')) {
        expandedInput = expansion + input.slice(alias.length);
        break;
      }
    }

    // Split by semicolons for compound commands
    const statements = this._splitBySemicolon(expandedInput);
    const outputs = [];
    for (const stmt of statements) {
      const out = this._executeStatement(stmt.trim());
      if (out !== null && out !== undefined) outputs.push(out);
    }
    return outputs.length ? outputs.join('\n') : null;
  }

  _splitBySemicolon(input) {
    const parts = [];
    let current = '';
    let inSingle = false, inDouble = false;
    for (const ch of input) {
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (ch === ';' && !inSingle && !inDouble) {
        parts.push(current); current = ''; continue;
      }
      current += ch;
    }
    parts.push(current);
    return parts.filter(p => p.trim());
  }

  _expandEnvVars(input) {
    if (!input || !input.includes('$')) return input;
    let result = '';
    let inSingle = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === "'") {
        inSingle = !inSingle;
        result += ch;
      } else if (!inSingle && ch === '$') {
        const rest = input.slice(i + 1);
        const bracketMatch = rest.match(/^{([A-Za-z0-9_]+)}/);
        const wordMatch = rest.match(/^([A-Za-z0-9_]+)/);
        if (bracketMatch) {
          const varName = bracketMatch[1];
          const val = this.vfs.getEnv(varName);
          result += val !== undefined ? val : '';
          i += bracketMatch[0].length;
        } else if (wordMatch) {
          const varName = wordMatch[1];
          const val = this.vfs.getEnv(varName);
          result += val !== undefined ? val : '';
          i += wordMatch[0].length;
        } else {
          result += ch;
        }
      } else {
        result += ch;
      }
    }
    return result;
  }

  _expandTildes(tokens) {
    const home = this.vfs.getEnv('HOME') || '/home/user';
    return tokens.map(tok => {
      if (tok === '~') return home;
      if (tok.startsWith('~/')) return home + tok.slice(1);
      if (tok === '~user') return home;
      if (tok.startsWith('~user/')) return home + tok.slice(5);
      return tok;
    });
  }

  _executeStatement(rawInput) {
    const input = this._expandEnvVars(rawInput);
    // Handle pipes
    const segments = Utils.splitByPipe(input);
    if (segments.length > 1) {
      return this._executePipeline(segments);
    }
    return this._executeSingleCommand(input);
  }

  _executePipeline(segments) {
    let lastOutput = null;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i].trim();
      if (!seg) continue;

      if (i === 0) {
        lastOutput = this._executeSingleCommand(seg, true);
        continue;
      }

      if (lastOutput === null || lastOutput === undefined) {
        lastOutput = '';
      }

      // Clean HTML tags from previous command output for clean stream processing
      const rawStdin = Utils.stripHtml(String(lastOutput));

      const tokens = Utils.tokenize(seg);
      if (!tokens.length) continue;

      const { tokens: cleanTokens, redirectOut, redirectAppend, redirectFile } = Utils.parseRedirects(tokens);
      const cmd = cleanTokens[0];
      const restTokens = this._expandTildes(cleanTokens.slice(1));
      const { flags, args } = Utils.parseFlags(restTokens);

      let currentOutput = null;

      if (cmd === 'grep') {
        const pattern = args[0] || '';
        if (!pattern) {
          lastOutput = this._err('grep: missing pattern');
          continue;
        }
        const lines = rawStdin.split('\n');
        let regex;
        try {
          regex = new RegExp(pattern, flags.i ? 'i' : '');
        } catch {
          regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags.i ? 'i' : '');
        }
        let matches = lines.filter(l => flags.v ? !regex.test(l) : regex.test(l));
        if (flags.c) {
          currentOutput = String(matches.length);
        } else if (flags.n) {
          currentOutput = matches.map((m, idx) => `${idx + 1}:${m}`).join('\n');
        } else {
          currentOutput = matches.map(m => this._highlightMatch(m, pattern)).join('\n');
        }
      } else if (cmd === 'wc') {
        const lines = rawStdin.split('\n').filter(Boolean).length;
        const words = rawStdin.trim().split(/\s+/).filter(Boolean).length;
        const chars = rawStdin.length;
        if (flags.l) currentOutput = String(lines).padStart(7);
        else if (flags.w) currentOutput = String(words).padStart(7);
        else if (flags.c) currentOutput = String(chars).padStart(7);
        else currentOutput = `${String(lines).padStart(7)} ${String(words).padStart(7)} ${String(chars).padStart(7)}`;
      } else if (cmd === 'head') {
        let n = 10;
        if (flags.n && args[0]) n = parseInt(args[0]) || 10;
        else if (args[0] && !isNaN(parseInt(args[0]))) n = parseInt(args[0]);
        else {
          const numFlag = Object.keys(flags).find(k => !isNaN(parseInt(k)));
          if (numFlag) n = parseInt(numFlag);
        }
        currentOutput = rawStdin.split('\n').slice(0, n).join('\n');
      } else if (cmd === 'tail') {
        let n = 10;
        if (flags.n && args[0]) n = parseInt(args[0]) || 10;
        else if (args[0] && !isNaN(parseInt(args[0]))) n = parseInt(args[0]);
        else {
          const numFlag = Object.keys(flags).find(k => !isNaN(parseInt(k)));
          if (numFlag) n = parseInt(numFlag);
        }
        currentOutput = rawStdin.split('\n').slice(-n).join('\n');
      } else if (cmd === 'sort') {
        let lines = rawStdin.split('\n').filter(Boolean);
        if (flags.n) lines.sort((a, b) => parseFloat(a) - parseFloat(b));
        else lines.sort((a, b) => a.localeCompare(b));
        if (flags.r) lines.reverse();
        if (flags.u) lines = [...new Set(lines)];
        currentOutput = lines.join('\n');
      } else if (cmd === 'uniq') {
        const lines = rawStdin.split('\n');
        const unique = [];
        for (let j = 0; j < lines.length; j++) {
          if (lines[j] !== lines[j - 1]) unique.push(lines[j]);
        }
        currentOutput = unique.join('\n');
      } else if (cmd === 'tee') {
        const targetFile = args[0];
        if (targetFile) {
          this.vfs.writeFile(targetFile, rawStdin + '\n', Boolean(flags.a));
        }
        currentOutput = rawStdin;
      } else if (cmd === 'tr') {
        let s = rawStdin;
        if (flags.d) {
          const toDelete = args[0] || '';
          currentOutput = s.split('').filter(c => !toDelete.includes(c)).join('');
        } else if (args.length >= 2) {
          const [set1, set2] = args;
          if (set1 === 'a-z' && set2 === 'A-Z') currentOutput = s.toUpperCase();
          else if (set1 === 'A-Z' && set2 === 'a-z') currentOutput = s.toLowerCase();
          else {
            let res = '';
            for (let ch of s) {
              const idx = set1.indexOf(ch);
              res += idx !== -1 ? (set2[idx] || set2[set2.length - 1] || '') : ch;
            }
            currentOutput = res;
          }
        } else {
          currentOutput = s;
        }
      } else if (cmd === 'cut') {
        const delim = flags.d || '\t';
        const fieldStr = flags.f || '1';
        const fields = fieldStr.split(',').map(f => parseInt(f) - 1);
        const lines = rawStdin.split('\n').filter(Boolean);
        currentOutput = lines.map(line => {
          const parts = line.split(delim);
          return fields.map(idx => parts[idx] !== undefined ? parts[idx] : '').join(delim);
        }).join('\n');
      } else if (cmd === 'awk') {
        const delim = flags.F || ' ';
        const script = args.join(' ');
        const fieldMatch = script.match(/\{print\s+(.*?)\}/i);
        const fieldStr = fieldMatch ? fieldMatch[1].trim() : '$0';
        const lines = rawStdin.split('\n').filter(Boolean);
        currentOutput = lines.map(line => {
          if (fieldStr === '$0') return line;
          const parts = line.split(new RegExp(delim === ' ' ? '\\s+' : delim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
          const reqFields = fieldStr.split(',').map(f => parseInt(f.replace('$', '')) || 0);
          return reqFields.map(f => f === 0 ? line : (parts[f - 1] !== undefined ? parts[f - 1] : '')).join('\t');
        }).join('\n');
      } else if (cmd === 'sed') {
        const script = args.join(' ');
        const subMatch = script.match(/s\/(.*?)(?<!\\)\/(.*?)(?<!\\)\/(g?)/);
        if (subMatch) {
          const [, search, replace, gFlag] = subMatch;
          const regex = new RegExp(search, gFlag ? 'g' : '');
          currentOutput = rawStdin.split('\n').map(l => l.replace(regex, replace)).join('\n');
        } else {
          currentOutput = rawStdin;
        }
      } else if (cmd === 'tac') {
        currentOutput = rawStdin.split('\n').reverse().join('\n');
      } else if (cmd === 'rev') {
        currentOutput = rawStdin.split('\n').map(l => l.split('').reverse().join('')).join('\n');
      } else if (cmd === 'nl') {
        currentOutput = rawStdin.split('\n').map((l, idx) => `${String(idx + 1).padStart(6)}\t${l}`).join('\n');
      } else if (cmd === 'column') {
        if (flags.t) {
          const rows = rawStdin.split('\n').filter(Boolean).map(l => l.split(/\s+/));
          const cols = Math.max(1, ...rows.map(r => r.length));
          const widths = Array(cols).fill(0);
          rows.forEach(r => r.forEach((c, idx) => { widths[idx] = Math.max(widths[idx], c.length); }));
          currentOutput = rows.map(r => r.map((c, idx) => c.padEnd(widths[idx])).join('  ')).join('\n');
        } else {
          currentOutput = rawStdin;
        }
      } else if (cmd === 'shuf') {
        const lines = rawStdin.split('\n').filter(Boolean);
        for (let j = lines.length - 1; j > 0; j--) {
          const rand = Math.floor(Math.random() * (j + 1));
          [lines[j], lines[rand]] = [lines[rand], lines[j]];
        }
        const n = flags.n ? parseInt(flags.n) : lines.length;
        currentOutput = lines.slice(0, n).join('\n');
      } else if (cmd === 'fold') {
        const width = parseInt(flags.w) || 80;
        const lines = rawStdin.split('\n');
        const folded = lines.flatMap(line => {
          const chunks = [];
          for (let j = 0; j < line.length || chunks.length === 0; j += width) {
            chunks.push(line.slice(j, j + width));
          }
          return chunks;
        });
        currentOutput = folded.join('\n');
      } else if (cmd === 'bc') {
        try {
          const sanitized = rawStdin.replace(/[^0-9+\-*/().% \n]/g, '').trim();
          if (!sanitized) currentOutput = '0';
          else {
            const lines = sanitized.split('\n').filter(Boolean);
            currentOutput = lines.map(expr => {
              try {
                // eslint-disable-next-line no-new-func
                return String(new Function(`"use strict"; return (${expr})`)());
              } catch {
                return 'syntax error';
              }
            }).join('\n');
          }
        } catch {
          currentOutput = 'parse error';
        }
      } else if (cmd === 'base64') {
        if (flags.d) {
          try { currentOutput = atob(rawStdin.trim()); } catch { currentOutput = 'base64: invalid input'; }
        } else {
          currentOutput = btoa(rawStdin);
        }
      } else if (cmd === 'md5sum') {
        let hash = 0;
        for (let j = 0; j < rawStdin.length; j++) hash = ((hash << 5) - hash + rawStdin.charCodeAt(j)) | 0;
        currentOutput = `${(hash >>> 0).toString(16).padStart(8, '0').repeat(4).slice(0, 32)}  -`;
      } else if (cmd === 'sha256sum' || cmd === 'sha1sum') {
        const bits = cmd === 'sha1sum' ? 40 : 64;
        let hash = 0;
        for (let j = 0; j < rawStdin.length; j++) hash = ((hash << 5) - hash + rawStdin.charCodeAt(j)) | 0;
        currentOutput = `${(hash >>> 0).toString(16).padStart(8, '0').repeat(Math.ceil(bits / 8)).slice(0, bits)}  -`;
      } else if (cmd === 'xargs') {
        const targetCmd = args[0];
        if (!targetCmd) {
          currentOutput = rawStdin;
        } else {
          const items = rawStdin.trim().split(/\s+/).filter(Boolean);
          const subArgs = args.slice(1).concat(items);
          const fullCmd = [targetCmd, ...subArgs].join(' ');
          currentOutput = this.execute(fullCmd);
        }
      } else if (cmd === 'cat') {
        currentOutput = rawStdin;
      } else {
        currentOutput = this._runCommand(cmd, flags, args, seg);
      }

      // Check redirection at this stage
      if ((redirectOut || redirectAppend) && redirectFile) {
        const content = (currentOutput || '') + '\n';
        this.vfs.writeFile(redirectFile, Utils.stripHtml(content), redirectAppend);
        lastOutput = null;
      } else {
        lastOutput = currentOutput;
      }
    }
    return lastOutput;
  }

  _executeSingleCommand(input, returnRaw = false) {
    const tokens = Utils.tokenize(input);
    if (!tokens.length) return null;

    // Handle redirections
    const { tokens: cleanTokens, redirectOut, redirectAppend, redirectFile } = Utils.parseRedirects(tokens);
    const cmd = cleanTokens[0];
    const restTokens = this._expandTildes(cleanTokens.slice(1));
    const { flags, args } = Utils.parseFlags(restTokens);

    let output = this._runCommand(cmd, flags, args, input);

    // Apply redirection
    if ((redirectOut || redirectAppend) && redirectFile) {
      let finalRedir = redirectFile;
      const home = this.vfs.getEnv('HOME') || '/home/user';
      if (finalRedir === '~') finalRedir = home;
      else if (finalRedir.startsWith('~/')) finalRedir = home + finalRedir.slice(1);
      const content = (output || '') + '\n';
      const result = this.vfs.writeFile(finalRedir, content, redirectAppend);
      if (!result.success) return this._err(result.error);
      return null; // Redirect suppresses terminal output
    }

    return output;
  }

  // ── Command Dispatch ──────────────────────────────────────────────────────────

  _runCommand(cmd, flags, args, rawInput) {
    switch (cmd) {
      // ── Symbol Commands / Path Shortcuts ───────────────────────────────
      case '..':     return this._cd(flags, ['..']);
      case '...':    return this._cd(flags, ['../..']);
      case '~':      return this._cd(flags, ['~']);
      case '/':      return this._cd(flags, ['/']);
      case '-':      return this._cd(flags, ['-']);

      case 'ls':     return this._ls(flags, args);
      case 'cd':     return this._cd(flags, args);
      case 'pwd':    return this._pwd();
      case 'mkdir':  return this._mkdir(flags, args);
      case 'rmdir':  return this._rmdir(flags, args);
      case 'touch':  return this._touch(flags, args);
      case 'rm':     return this._rm(flags, args);
      case 'cp':     return this._cp(flags, args);
      case 'mv':     return this._mv(flags, args);
      case 'cat':    return this._cat(flags, args);
      case 'echo':   return this._echo(flags, args, rawInput);
      case 'find':   return this._find(flags, args);
      case 'grep':   return this._grep(flags, args);
      case 'chmod':  return this._chmod(flags, args);
      case 'chown':  return this._chown(flags, args);
      case 'whoami': return this._whoami();
      case 'date':   return this._date();
      case 'uname':  return this._uname(flags, args);
      case 'clear':  this.terminal.clear(); return null;
      case 'history':return this._history(flags, args);
      case 'head':   return this._head(flags, args);
      case 'tail':   return this._tail(flags, args);
      case 'wc':     return this._wc(flags, args);
      case 'nano':
      case 'vim':
      case 'vi':     return this._editor(cmd, flags, args);
      case 'man':    return this._man(flags, args);
      case 'help':   return this._help(flags, args);
      case 'top':
      case 'htop':   return this._top();
      case 'ps':     return this._ps(flags, args);
      case 'kill':   return this._kill(flags, args);
      case 'env':    return this._env();
      case 'export': return this._export(flags, args, rawInput);
      case 'unset':  return this._unset(flags, args);
      case 'which':  return this._which(flags, args);
      case 'type':   return this._type(flags, args);
      case 'alias':  return this._alias(flags, args, rawInput);
      case 'sort':       return this._sort(flags, args);
      case 'uniq':       return this._uniq(flags, args);
      case 'cut':        return this._cut(flags, args);
      case 'tr':         return this._tr(flags, args, rawInput);
      case 'diff':       return this._diff(flags, args);
      case 'file':       return this._file(flags, args);
      case 'stat':       return this._stat(flags, args);
      case 'du':         return this._du(flags, args);
      case 'df':         return this._df(flags, args);
      case 'ln':         return this._ln(flags, args);
      case 'printf':     return this._printf(flags, args, rawInput);
      // ── Text Processing (new) ─────────────────────────────────────────
      case 'sed':        return this._sed(flags, args, rawInput);
      case 'awk':        return this._awk(flags, args, rawInput);
      case 'tac':        return this._tac(flags, args);
      case 'rev':        return this._rev(flags, args);
      case 'nl':         return this._nl(flags, args);
      case 'column':     return this._column(flags, args);
      case 'paste':      return this._paste(flags, args);
      case 'strings':    return this._strings(flags, args);
      case 'expand':     return this._expand(flags, args);
      case 'fold':       return this._fold(flags, args);
      case 'od':         return this._od(flags, args);
      case 'xxd':        return this._xxd(flags, args);
      case 'less':
      case 'more':       return this._more(flags, args);
      // ── Archiving & Compression ───────────────────────────────────────
      case 'tar':        return this._tar(flags, args, rawInput);
      case 'gzip':       return this._gzip(flags, args);
      case 'gunzip':     return this._gunzip(flags, args);
      case 'zip':        return this._zip(flags, args);
      case 'unzip':      return this._unzip(flags, args);
      case 'bzip2':      return this._bzip2(flags, args);
      case 'xz':         return this._xz(flags, args);
      // ── Networking ───────────────────────────────────────────────────
      case 'ping':       return this._ping(flags, args);
      case 'curl':       return this._curl(flags, args);
      case 'wget':       return this._wget(flags, args);
      case 'netstat':    return this._netstat(flags, args);
      case 'ss':         return this._ss(flags, args);
      case 'ifconfig':   return this._ifconfig(flags, args);
      case 'ip':         return this._ip(flags, args);
      case 'ssh':        return this._ssh(flags, args);
      case 'scp':        return this._scp(flags, args);
      case 'nslookup':   return this._nslookup(flags, args);
      case 'dig':        return this._dig(flags, args);
      case 'host':       return this._hostcmd(flags, args);
      case 'traceroute':
      case 'tracepath':  return this._traceroute(flags, args);
      // ── Package Management (simulated) ───────────────────────────────
      case 'apt':
      case 'apt-get':    return this._apt(flags, args);
      case 'yum':        return this._yum(flags, args);
      case 'dnf':        return this._dnf(flags, args);
      case 'snap':       return this._snap(flags, args);
      case 'dpkg':       return this._dpkg(flags, args);
      case 'rpm':        return this._rpm(flags, args);
      // ── Process & Job Control ────────────────────────────────────────
      case 'jobs':       return this._jobs();
      case 'bg':         return this._bg(flags, args);
      case 'fg':         return this._fg(flags, args);
      case 'nohup':      return this._nohup(flags, args);
      case 'time':       return this._time(flags, args, rawInput);
      case 'watch':      return this._watch(flags, args);
      case 'crontab':    return this._crontab(flags, args);
      case 'killall':    return this._killall(flags, args);
      case 'pkill':      return this._pkill(flags, args);
      case 'pgrep':      return this._pgrep(flags, args);
      case 'pstree':     return this._pstree();
      case 'lsof':       return this._lsof(flags, args);
      case 'vmstat':     return this._vmstat(flags, args);
      case 'iostat':     return this._iostat(flags, args);
      // ── System Info & Hardware ───────────────────────────────────────
      case 'hostname':   return this._hostname(flags, args);
      case 'uptime':     return this._uptime();
      case 'free':       return this._free(flags, args);
      case 'lscpu':      return this._lscpu();
      case 'lsblk':      return this._lsblk(flags, args);
      case 'lspci':      return this._lspci(flags, args);
      case 'lsusb':      return this._lsusb();
      case 'dmesg':      return this._dmesg(flags, args);
      case 'journalctl': return this._journalctl(flags, args);
      case 'systemctl':  return this._systemctl(flags, args);
      case 'service':    return this._service(flags, args);
      case 'mount':      return this._mount(flags, args);
      case 'umount':     return this._umount(flags, args);
      case 'blkid':      return this._blkid(flags, args);
      case 'fdisk':      return this._fdisk(flags, args);
      // ── User & Permissions ───────────────────────────────────────────
      case 'id':         return this._id(flags, args);
      case 'groups':     return this._groups(flags, args);
      case 'last':       return this._last(flags, args);
      case 'who':        return this._who(flags, args);
      case 'w':          return this._w(flags, args);
      case 'su':         return this._su(flags, args);
      case 'sudo':       return this._sudo(flags, args, rawInput);
      case 'passwd':     return this._passwd(flags, args);
      case 'useradd':
      case 'adduser':    return this._useradd(flags, args);
      case 'userdel':    return this._userdel(flags, args);
      case 'groupadd':   return this._groupadd(flags, args);
      case 'umask':      return this._umask(flags, args);
      // ── Environment & Shell ──────────────────────────────────────────
      case 'printenv':   return this._printenv(flags, args);
      case 'source':     return this._source(flags, args);
      case '.':
        if (!args.length) {
          return `${this._err('bash: .: filename argument required')}\n<span class="term-dim">Tip: In paths, '.' refers to the current directory (e.g. <code>cd .</code> or <code>ls -a .</code>). To execute a script: <code>. &lt;filename&gt;</code></span>`;
        }
        return this._source(flags, args);
      case 'basename':   return this._basename(flags, args);
      case 'dirname':    return this._dirname(flags, args);
      case 'realpath':   return this._realpath(flags, args);
      case 'readlink':   return this._readlink(flags, args);
      case 'whereis':    return this._whereis(flags, args);
      case 'locate':     return this._locate(flags, args);
      // ── Math & Encoding ──────────────────────────────────────────────
      case 'expr':       return this._expr(flags, args);
      case 'bc':         return this._bc(flags, args, rawInput);
      case 'seq':        return this._seq(flags, args);
      case 'factor':     return this._factor(flags, args);
      case 'cal':
      case 'ncal':       return this._cal(flags, args);
      case 'base64':     return this._base64(flags, args);
      case 'md5sum':     return this._md5sum(flags, args);
      case 'sha256sum':
      case 'sha1sum':    return this._shasum(cmd, flags, args);
      case 'cksum':      return this._cksum(flags, args);
      // ── Misc Utilities ───────────────────────────────────────────────
      case 'tee':        return this._tee(flags, args, rawInput);
      case 'xargs':      return this._xargs(flags, args, rawInput);
      case 'yes':        return this._yes(flags, args);
      case 'true':       return null;
      case 'false':      return this._err('');
      case 'test':       return this._test(flags, args);
      case 'shuf':       return this._shuf(flags, args);
      case 'comm':       return this._comm(flags, args);
      case 'split':      return this._split(flags, args);
      case 'clear':      this.terminal.clear(); return null;
      case 'reset':      this.terminal.clear(); return null;
      case 'sleep':      return this._sleepCmd(flags, args);
      case 'wait':       return null;
      case 'read':       return null;
      case 'exit':
      case 'logout': this.terminal.appendLine('<span class="term-warn">Session would end here. Refresh to restart.</span>'); return null;
      case '':       return null;
      default: {
        // If user typed a directory path directly (e.g. /etc, /tmp, Documents)
        if (this.vfs.isDirectory(cmd)) {
          return `${this._err(`bash: ${cmd}: Is a directory`)}\n<span class="term-dim">Tip: To navigate into this directory, use: <code>cd ${cmd}</code></span>`;
        }
        return this._err(`bash: ${cmd}: command not found`);
      }
    }
  }

  // ── Individual Command Implementations ───────────────────────────────────────

  _ls(flags, args) {
    const targets = args.length ? args : [''];
    const outputs = [];

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const result = this.vfs.ls(target, flags);
      if (!result.success) { outputs.push(this._err(result.error)); continue; }

      if (targets.length > 1) {
        outputs.push(`<span class="term-path">${Utils.escapeHtml(target || this.vfs.pwd())}:</span>`);
      }

      if (flags.l) {
        // Long format
        if (result.isDir) {
          const total = result.entries.reduce((s, e) => s + Math.ceil(e.size / 512), 0);
          outputs.push(`total ${total}`);
        }
        for (const entry of result.entries) {
          outputs.push(`<span class="term-ls-long">${Utils.escapeHtml(entry.toLsLongEntry())}</span>`);
        }
      } else {
        // Short format: colorize entries
        if (flags['1']) {
          for (const entry of result.entries) {
            outputs.push(Utils.colorizeEntry(entry));
          }
        } else {
          const names = result.entries.map(e => Utils.colorizeEntry(e));
          // Group into columns
          const maxWidth = Math.max(...result.entries.map(e => e.name.length + 1), 1);
          const cols = Math.max(1, Math.floor(80 / (maxWidth + 2)));
          const rows = [];
          for (let j = 0; j < names.length; j += cols) {
            rows.push(names.slice(j, j + cols).join('  '));
          }
          outputs.push(rows.join('\n'));
        }
      }
      if (i < targets.length - 1) outputs.push('');
    }
    return outputs.join('\n');
  }

  _cd(flags, args) {
    const target = args[0] || '~';
    const result = this.vfs.cd(target);
    if (!result.success) return this._err(result.error);
    if (this.terminal) this.terminal.updatePrompt();
    if (result.printCwd) return `<span class="term-path">${Utils.escapeHtml(this.vfs.pwd())}</span>`;
    return null;
  }

  _pwd() {
    return `<span class="term-path">${Utils.escapeHtml(this.vfs.pwd())}</span>`;
  }

  _mkdir(flags, args) {
    if (!args.length) return this._err('mkdir: missing operand');
    const outputs = [];
    for (const dir of args) {
      const result = this.vfs.mkdir(dir, flags.p);
      if (!result.success) outputs.push(this._err(result.error));
    }
    return outputs.join('\n') || null;
  }

  _rmdir(flags, args) {
    if (!args.length) return this._err('rmdir: missing operand');
    const outputs = [];
    for (const dir of args) {
      const result = this.vfs.rmdir(dir);
      if (!result.success) outputs.push(this._err(result.error));
    }
    return outputs.join('\n') || null;
  }

  _touch(flags, args) {
    if (!args.length) return this._err('touch: missing file operand');
    const outputs = [];
    for (const file of args) {
      const result = this.vfs.touch(file);
      if (!result.success) outputs.push(this._err(result.error));
    }
    return outputs.join('\n') || null;
  }

  _rm(flags, args) {
    if (!args.length) return this._err('rm: missing operand\nTry \'rm --help\' for more information.');
    const outputs = [];
    for (const file of args) {
      const result = this.vfs.rm(file, flags);
      if (!result.success) outputs.push(this._err(result.error));
    }
    return outputs.join('\n') || null;
  }

  _cp(flags, args) {
    if (args.length < 2) return this._err('cp: missing destination file operand');
    const dest = args[args.length - 1];
    const srcs = args.slice(0, -1);
    const outputs = [];
    for (const src of srcs) {
      const result = this.vfs.cp(src, dest, flags);
      if (!result.success) outputs.push(this._err(result.error));
    }
    return outputs.join('\n') || null;
  }

  _mv(flags, args) {
    if (args.length < 2) return this._err('mv: missing destination file operand');
    const dest = args[args.length - 1];
    const srcs = args.slice(0, -1);
    const outputs = [];
    for (const src of srcs) {
      const result = this.vfs.mv(src, dest);
      if (!result.success) outputs.push(this._err(result.error));
    }
    return outputs.join('\n') || null;
  }

  _cat(flags, args) {
    if (!args.length) return this._err('cat: missing file operand');
    const outputs = [];
    for (const file of args) {
      const result = this.vfs.cat(file);
      if (!result.success) { outputs.push(this._err(result.error)); continue; }
      let content = result.content;
      if (flags.n) {
        content = content.split('\n').map((l, i) => `${String(i+1).padStart(6)}  ${l}`).join('\n');
      }
      outputs.push(Utils.escapeHtml(content));
    }
    return outputs.join('\n') || null;
  }

  _echo(flags, args, rawInput) {
    // Reconstruct the echoed text from args (already cleaned of redirects & flags)
    let text = args.join(' ');
    // Strip surrounding matching quotes (single or double)
    text = text.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
    // Handle \n \t escape sequences when -e flag given
    if (flags.e) {
      text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r');
    }
    return Utils.escapeHtml(text);
  }

  _find(flags, args) {
    const startPath = args[0] || '.';
    const options = {};

    // Parse -name, -type flags from remaining args
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '-name' && args[i+1]) { options.name = args[i+1]; i++; }
      else if (args[i] === '-type' && args[i+1]) { options.type = args[i+1]; i++; }
    }

    const result = this.vfs.find(startPath, options);
    if (!result.success) return this._err(result.error);
    return result.results.map(r => Utils.escapeHtml(r)).join('\n') || null;
  }

  _grep(flags, args) {
    if (args.length < 1) return this._err('grep: missing pattern');
    const pattern = args[0];
    const files = args.slice(1);

    if (!files.length) return this._err('grep: missing file operand');

    const outputs = [];
    for (const file of files) {
      const result = this.vfs.grep(pattern, file, flags);
      if (!result.success) { outputs.push(this._err(result.error)); continue; }
      if (files.length > 1) {
        result.matches.forEach(m => outputs.push(`<span class="term-path">${Utils.escapeHtml(file)}:</span>${Utils.escapeHtml(m)}`));
      } else {
        result.matches.forEach(m => outputs.push(this._highlightMatch(m, pattern)));
      }
    }
    return outputs.join('\n') || null;
  }

  _highlightMatch(line, pattern) {
    try {
      const regex = new RegExp(`(${pattern})`, 'g');
      return Utils.escapeHtml(line).replace(regex, '<span class="term-match">$1</span>');
    } catch {
      return Utils.escapeHtml(line);
    }
  }

  _chmod(flags, args) {
    if (args.length < 2) return this._err('chmod: missing operand');
    const mode = args[0];
    const files = args.slice(1);
    const outputs = [];
    for (const file of files) {
      const result = this.vfs.chmod(file, mode);
      if (!result.success) outputs.push(this._err(result.error));
    }
    return outputs.join('\n') || null;
  }

  _chown(flags, args) {
    if (args.length < 2) return this._err('chown: missing operand');
    const ownerGroup = args[0].split(':');
    const owner = ownerGroup[0] || null;
    const group = ownerGroup[1] || null;
    const files = args.slice(1);
    const outputs = [];
    for (const file of files) {
      const result = this.vfs.chown(file, owner, group);
      if (!result.success) outputs.push(this._err(result.error));
    }
    return outputs.join('\n') || null;
  }

  _whoami() {
    return Utils.escapeHtml(this.vfs.getEnv('USER') || 'user');
  }

  _date() {
    return Utils.escapeHtml(Utils.formatFullDate());
  }

  _uname(flags, args) {
    if (flags.a || flags['all']) {
      return 'Linux linuxmaster 5.15.0-linuxmaster #1 SMP x86_64 GNU/Linux';
    }
    if (flags.s) return 'Linux';
    if (flags.n) return 'linuxmaster';
    if (flags.r) return '5.15.0-linuxmaster';
    if (flags.m) return 'x86_64';
    return 'Linux';
  }

  _history(flags, args) {
    if (!this.terminal) return null;
    const hist = this.terminal.getHistory();
    const lines = hist.map((cmd, i) => `${String(i + 1).padStart(5)}  ${Utils.escapeHtml(cmd)}`);
    return lines.join('\n') || null;
  }

  _head(flags, args) {
    if (!args.length) return this._err('head: missing file operand');
    const n = flags.n ? parseInt(flags.n) : 10;
    const lineCount = isNaN(n) ? 10 : n;
    const outputs = [];
    for (const file of args) {
      const result = this.vfs.head(file, lineCount);
      if (!result.success) { outputs.push(this._err(result.error)); continue; }
      if (args.length > 1) outputs.push(`==> ${Utils.escapeHtml(file)} <==`);
      outputs.push(Utils.escapeHtml(result.content));
    }
    return outputs.join('\n') || null;
  }

  _tail(flags, args) {
    if (!args.length) return this._err('tail: missing file operand');
    const n = flags.n ? parseInt(flags.n) : 10;
    const lineCount = isNaN(n) ? 10 : n;
    const outputs = [];
    for (const file of args) {
      const result = this.vfs.tail(file, lineCount);
      if (!result.success) { outputs.push(this._err(result.error)); continue; }
      if (args.length > 1) outputs.push(`==> ${Utils.escapeHtml(file)} <==`);
      outputs.push(Utils.escapeHtml(result.content));
    }
    return outputs.join('\n') || null;
  }

  _wc(flags, args) {
    if (!args.length) return this._err('wc: missing file operand');
    const outputs = [];
    let totalL = 0, totalW = 0, totalC = 0;
    for (const file of args) {
      const result = this.vfs.wc(file, flags);
      if (!result.success) { outputs.push(this._err(result.error)); continue; }
      outputs.push(result.output);
    }
    return outputs.join('\n') || null;
  }

  _editor(cmd, flags, args) {
    const file = args[0] || null;
    if (this.terminal) {
      this.terminal.openEditor(file, cmd);
    }
    return null;
  }

  _man(flags, args) {
    const cmd = args[0];
    if (!cmd) return this._err('What manual page do you want?\nFor example, try \'man ls\'');
    const page = MAN_PAGES[cmd];
    if (!page) return this._err(`No manual entry for ${cmd}`);
    return `<span class="term-man">${Utils.escapeHtml(page)}</span>`;
  }

  _help(flags, args) {
    if (args[0]) return this._man(flags, args);
    return HELP_TEXT;
  }

  _top() {
    return `<pre class="term-top">${Utils.escapeHtml(Utils.simulatedTopOutput())}</pre>`;
  }

  _ps(flags, args) {
    if (flags.a || flags.u || flags.x) {
      return `<pre>${Utils.escapeHtml(Utils.formatPsAux())}</pre>`;
    }
    return `  PID TTY          TIME CMD\n  512 pts/0    00:00:00 bash\n 1337 pts/0    00:00:00 ps`;
  }

  _kill(flags, args) {
    if (!args.length) return this._err('kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]');
    return null; // simulated
  }

  _env() {
    const env = ['HOME', 'USER', 'SHELL', 'PATH', 'TERM', 'HOSTNAME'];
    return env.map(k => `${k}=${Utils.escapeHtml(this.vfs.getEnv(k) || '')}`).join('\n');
  }

  _export(flags, args, rawInput) {
    const match = rawInput.match(/export\s+(\w+)=(.*)$/);
    if (match) {
      this.vfs.setEnv(match[1], match[2].replace(/^['"]|['"]$/g, ''));
    }
    return null;
  }

  _unset(flags, args) {
    for (const key of args) this.vfs.setEnv(key, undefined);
    return null;
  }

  _which(flags, args) {
    if (!args.length) return this._err('which: missing argument');
    const cmds = ['ls','cd','pwd','mkdir','rmdir','touch','rm','cp','mv','cat','echo','grep','find','chmod','chown','whoami','date','uname','history','head','tail','wc','nano','vim','man','top','ps'];
    const outputs = [];
    for (const cmd of args) {
      if (cmds.includes(cmd)) outputs.push(`/usr/bin/${cmd}`);
      else outputs.push(`${cmd} not found`);
    }
    return outputs.join('\n');
  }

  _type(flags, args) {
    if (!args.length) return this._err('type: missing argument');
    const builtins = ['cd','pwd','echo','history','exit','export','unset','alias','type'];
    const outputs = [];
    for (const cmd of args) {
      if (builtins.includes(cmd)) outputs.push(`${cmd} is a shell builtin`);
      else if (this._aliases[cmd]) outputs.push(`${cmd} is aliased to '${this._aliases[cmd]}'`);
      else outputs.push(`${cmd} is /usr/bin/${cmd}`);
    }
    return outputs.join('\n');
  }

  _alias(flags, args, rawInput) {
    if (!args.length) {
      return Object.entries(this._aliases).map(([k,v]) => `alias ${k}='${v}'`).join('\n');
    }
    const match = rawInput.match(/alias\s+(\w+)=['"]?(.+?)['"]?$/);
    if (match) {
      this._aliases[match[1]] = match[2];
    }
    return null;
  }

  _sort(flags, args) {
    if (!args.length) return this._err('sort: missing file operand');
    const outputs = [];
    for (const file of args) {
      const result = this.vfs.cat(file);
      if (!result.success) { outputs.push(this._err(result.error)); continue; }
      let lines = result.content.split('\n').filter(Boolean);
      if (flags.r) lines.sort((a,b) => b.localeCompare(a));
      else if (flags.n) lines.sort((a,b) => parseFloat(a) - parseFloat(b));
      else lines.sort((a,b) => a.localeCompare(b));
      if (flags.u) lines = [...new Set(lines)];
      outputs.push(lines.join('\n'));
    }
    return outputs.join('\n') || null;
  }

  _uniq(flags, args) {
    if (!args.length) return this._err('uniq: missing file operand');
    const result = this.vfs.cat(args[0]);
    if (!result.success) return this._err(result.error);
    const lines = result.content.split('\n');
    const unique = lines.filter((l, i) => l !== lines[i - 1]);
    return unique.join('\n');
  }

  _cut(flags, args) {
    if (!args.length) return this._err('cut: missing file operand');
    const file = args[args.length - 1];
    const result = this.vfs.cat(file);
    if (!result.success) return this._err(result.error);
    const delim = flags.d || '\t';
    const fieldStr = flags.f || '1';
    const fields = fieldStr.split(',').map(f => parseInt(f) - 1);
    const lines = result.content.split('\n').filter(Boolean);
    return lines.map(l => {
      const parts = l.split(delim);
      return fields.map(f => parts[f] || '').join(delim);
    }).join('\n');
  }

  _tr(flags, args, rawInput) {
    return this._err('tr: not supported interactively. Use with pipe.');
  }

  _diff(flags, args) {
    if (args.length < 2) return this._err('diff: missing operand after \'diff\'');
    const r1 = this.vfs.cat(args[0]);
    const r2 = this.vfs.cat(args[1]);
    if (!r1.success) return this._err(r1.error);
    if (!r2.success) return this._err(r2.error);
    const lines1 = r1.content.split('\n');
    const lines2 = r2.content.split('\n');
    const diffs = [];
    const maxLen = Math.max(lines1.length, lines2.length);
    for (let i = 0; i < maxLen; i++) {
      if (lines1[i] !== lines2[i]) {
        if (lines1[i] !== undefined) diffs.push(`< ${Utils.escapeHtml(lines1[i])}`);
        if (lines2[i] !== undefined) diffs.push(`> ${Utils.escapeHtml(lines2[i])}`);
      }
    }
    return diffs.length ? diffs.join('\n') : null; // no output means files are same
  }

  _file(flags, args) {
    if (!args.length) return this._err('file: missing file operand');
    const outputs = [];
    for (const path of args) {
      const abs = this.vfs.resolvePath(path);
      const node = this.vfs._getNode(abs);
      if (!node) { outputs.push(`${Utils.escapeHtml(path)}: ERROR: No such file or directory`); continue; }
      if (node.isDir()) outputs.push(`${Utils.escapeHtml(path)}: directory`);
      else {
        const content = node.content;
        if (content.startsWith('#!/')) outputs.push(`${Utils.escapeHtml(path)}: Bourne-Again shell script, ASCII text executable`);
        else outputs.push(`${Utils.escapeHtml(path)}: ASCII text`);
      }
    }
    return outputs.join('\n');
  }

  _stat(flags, args) {
    if (!args.length) return this._err('stat: missing file operand');
    const path = args[0];
    const abs = this.vfs.resolvePath(path);
    const node = this.vfs._getNode(abs);
    if (!node) return this._err(`stat: cannot stat '${path}': No such file or directory`);
    return [
      `  File: ${Utils.escapeHtml(abs)}`,
      `  Size: ${node.size}           Blocks: ${Math.ceil(node.size/512)}   IO Block: 4096  ${node.type}`,
      `Device: fd01h/64769d  Inode: ${Math.floor(Math.random()*999999)+100000}   Links: 1`,
      `Access: (0${node.permissions}/${node.toPermissionString()})  Uid: ( 1000/   ${node.owner})   Gid: ( 1000/   ${node.group})`,
      `Modify: ${Utils.escapeHtml(node.modifiedAt.toString())}`,
      `Change: ${Utils.escapeHtml(node.modifiedAt.toString())}`,
      ` Birth: ${Utils.escapeHtml(node.createdAt.toString())}`,
    ].join('\n');
  }

  _du(flags, args) {
    const path = args[0] || '.';
    const abs = this.vfs.resolvePath(path);
    const node = this.vfs._getNode(abs);
    if (!node) return this._err(`du: cannot access '${path}': No such file or directory`);
    if (!node.isDir()) return `4\t${Utils.escapeHtml(abs)}`;

    const calcSize = (n, p) => {
      let size = 4;
      if (n.isDir()) {
        for (const [name, child] of Object.entries(n.children)) {
          size += calcSize(child, `${p}/${name}`);
        }
      } else {
        size = Math.ceil(n.size / 1024) || 4;
      }
      return size;
    };

    const size = calcSize(node, abs);
    if (flags.s) return `${size}\t${Utils.escapeHtml(abs)}`;
    return `${size}\t${Utils.escapeHtml(abs)}`;
  }

  _df(flags, args) {
    const humanize = flags.h;
    const header = 'Filesystem      Size  Used Avail Use% Mounted on';
    const rows = [
      '/dev/sda1        20G  4.2G   15G  22% /',
      'tmpfs           3.9G     0  3.9G   0% /dev/shm',
      '/dev/sda2       100G   40G   55G  42% /home',
    ];
    return [header, ...rows].join('\n');
  }

  _ln(flags, args) {
    if (args.length < 2) return this._err('ln: missing destination file operand');
    const [src, dest] = args;
    const srcAbs = this.vfs.resolvePath(src);
    const srcNode = this.vfs._getNode(srcAbs);
    if (!srcNode) return this._err(`ln: failed to access '${src}': No such file or directory`);

    const destAbs = this.vfs.resolvePath(dest);
    const { parent, name } = this.vfs._getParentAndName(destAbs);
    if (!parent) return this._err(`ln: failed to create link '${dest}': No such file or directory`);

    const linkNode = new VFSNode(name, 'link', '', '777', this.vfs.getEnv('USER'));
    linkNode.linkTarget = srcAbs;
    parent.children[name] = linkNode;
    return null;
  }

  _printf(flags, args, rawInput) {
    const match = rawInput.match(/printf\s+['"]?(.+?)['"]?(\s+.*)?$/);
    if (!match) return null;
    let fmt = match[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    return Utils.escapeHtml(fmt);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ── NEW COMMANDS ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Text Processing ───────────────────────────────────────────────────────────

  _sed(flags, args, rawInput) {
    // Support basic s/old/new/[g] substitution on a file
    const scriptMatch = rawInput.match(/sed\s+['"]?(s\/[^'"]+)['"]?\s+(.+)$/);
    if (!scriptMatch) return this._err("sed: usage: sed 's/old/new/' file");
    const script = scriptMatch[1];
    const filePath = scriptMatch[2].trim();
    const m = script.match(/^s\/(.*?)(?<!\\)\/(.*?)(?<!\\)\/(g?)$/);
    if (!m) return this._err(`sed: -e expression #1, char ${script.length}: unknown command`);
    const [, search, replace, gFlag] = m;
    const result = this.vfs.cat(filePath);
    if (!result.success) return this._err(result.error);
    try {
      const regex = new RegExp(search, gFlag ? 'g' : '');
      const out = result.content.split('\n').map(l => l.replace(regex, replace)).join('\n');
      return Utils.escapeHtml(out);
    } catch (e) { return this._err(`sed: invalid regex: ${e.message}`); }
  }

  _awk(flags, args, rawInput) {
    // Support: awk '{print $N}' file  and  awk -F: '{print $N}' file
    const match = rawInput.match(/awk\s+(?:-F\s*['"]?(.+?)['"]?\s+)?['"]?\{print\s+(.*?)\}['"]?\s*(.*)$/i);
    if (!match) return this._err("awk: usage: awk '{print $N}' file");
    const delim  = match[1] || ' ';
    const fields = match[2].trim();  // e.g. "$1" or "$1,$3" or "$0"
    const filePath = match[3]?.trim();
    const getContent = () => {
      if (!filePath) return { success: false, error: 'awk: no input file' };
      return this.vfs.cat(filePath);
    };
    const r = getContent();
    if (!r.success) return this._err(r.error);
    const lines = r.content.split('\n').filter(Boolean);
    const fieldNums = fields.split(',').map(f => {
      const n = parseInt(f.replace('$',''));
      return isNaN(n) ? 0 : n;
    });
    return lines.map(line => {
      const parts = line.split(new RegExp(delim === ' ' ? '\\s+' : delim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return fieldNums.map(n => n === 0 ? line : (parts[n-1] ?? '')).join('\t');
    }).join('\n');
  }

  _tac(flags, args) {
    if (!args.length) return this._err('tac: missing file operand');
    const outputs = [];
    for (const f of args) {
      const r = this.vfs.cat(f);
      if (!r.success) { outputs.push(this._err(r.error)); continue; }
      outputs.push(Utils.escapeHtml(r.content.split('\n').reverse().join('\n')));
    }
    return outputs.join('\n');
  }

  _rev(flags, args) {
    if (!args.length) return this._err('rev: missing file operand');
    const r = this.vfs.cat(args[0]);
    if (!r.success) return this._err(r.error);
    return Utils.escapeHtml(r.content.split('\n').map(l => l.split('').reverse().join('')).join('\n'));
  }

  _nl(flags, args) {
    if (!args.length) return this._err('nl: missing file operand');
    const r = this.vfs.cat(args[0]);
    if (!r.success) return this._err(r.error);
    return r.content.split('\n').map((l, i) => Utils.escapeHtml(`${String(i+1).padStart(6)}\t${l}`)).join('\n');
  }

  _column(flags, args) {
    if (!args.length) return this._err('column: missing file operand');
    const r = this.vfs.cat(args[0]);
    if (!r.success) return this._err(r.error);
    const lines = r.content.split('\n').filter(Boolean);
    if (flags.t) {
      // Tabulate: align columns
      const rows = lines.map(l => l.split(/\s+/));
      const cols = Math.max(...rows.map(r => r.length));
      const widths = Array(cols).fill(0);
      rows.forEach(r => r.forEach((c,i) => { widths[i] = Math.max(widths[i], c.length); }));
      return rows.map(r => r.map((c,i) => c.padEnd(widths[i])).join('  ')).map(Utils.escapeHtml).join('\n');
    }
    return Utils.escapeHtml(lines.join('\n'));
  }

  _paste(flags, args) {
    if (args.length < 2) return this._err('paste: missing file operand');
    const delim = flags.d || '\t';
    const cols = args.map(f => {
      const r = this.vfs.cat(f);
      return r.success ? r.content.split('\n') : [];
    });
    const maxLen = Math.max(...cols.map(c => c.length));
    const lines = [];
    for (let i = 0; i < maxLen; i++) {
      lines.push(cols.map(c => c[i] ?? '').join(delim));
    }
    return Utils.escapeHtml(lines.join('\n'));
  }

  _strings(flags, args) {
    if (!args.length) return this._err('strings: missing file operand');
    const r = this.vfs.cat(args[0]);
    if (!r.success) return this._err(r.error);
    const matches = r.content.match(/[\x20-\x7E]{4,}/g) || [];
    return matches.map(Utils.escapeHtml).join('\n');
  }

  _expand(flags, args) {
    if (!args.length) return this._err('expand: missing file operand');
    const r = this.vfs.cat(args[0]);
    if (!r.success) return this._err(r.error);
    const tabw = parseInt(flags.t) || 8;
    return Utils.escapeHtml(r.content.replace(/\t/g, ' '.repeat(tabw)));
  }

  _fold(flags, args) {
    if (!args.length) return this._err('fold: missing file operand');
    const r = this.vfs.cat(args[0]);
    if (!r.success) return this._err(r.error);
    const width = parseInt(flags.w) || 80;
    const lines = r.content.split('\n');
    const folded = lines.flatMap(line => {
      const chunks = [];
      for (let i = 0; i < line.length || chunks.length === 0; i += width) {
        chunks.push(line.slice(i, i + width));
      }
      return chunks;
    });
    return Utils.escapeHtml(folded.join('\n'));
  }

  _od(flags, args) {
    if (!args.length) return this._err('od: missing file operand');
    const r = this.vfs.cat(args[0]);
    if (!r.success) return this._err(r.error);
    const bytes = r.content.slice(0, 256); // limit output
    let offset = 0;
    const lines = [];
    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = bytes.slice(i, i + 16);
      const hex = chunk.split('').map(c => c.charCodeAt(0).toString(16).padStart(2,'0')).join(' ');
      const printable = chunk.replace(/[^\x20-\x7E]/g, '.');
      lines.push(`${offset.toString(8).padStart(7,'0')} ${hex.padEnd(47)} ${printable}`);
      offset += 16;
    }
    lines.push(offset.toString(8).padStart(7,'0'));
    return Utils.escapeHtml(lines.join('\n'));
  }

  _xxd(flags, args) {
    if (!args.length) return this._err('xxd: missing file operand');
    const r = this.vfs.cat(args[0]);
    if (!r.success) return this._err(r.error);
    const bytes = r.content.slice(0, 256);
    const lines = [];
    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = bytes.slice(i, i + 16);
      const hex = chunk.split('').map(c => c.charCodeAt(0).toString(16).padStart(2,'0')).join(' ');
      const printable = chunk.replace(/[^\x20-\x7E]/g, '.');
      const addr = i.toString(16).padStart(8,'0');
      lines.push(`${addr}: ${hex.padEnd(47)}  ${printable}`);
    }
    return Utils.escapeHtml(lines.join('\n'));
  }

  _more(flags, args) {
    // Behave like cat with a note (no interactive paging in browser)
    if (!args.length) return this._err(`${flags.less ? 'less' : 'more'}: missing file operand`);
    return this._cat(flags, args);
  }

  // ── Archiving & Compression ───────────────────────────────────────────────────

  _tar(flags, args, rawInput) {
    const isCreate  = flags.c;
    const isExtract = flags.x;
    const isList    = flags.t;
    const isVerbose = flags.v;
    const archiveArg = flags.f ? args[0] : null;
    const fileArgs   = flags.f ? args.slice(1) : args;

    if (isCreate) {
      if (!archiveArg) return this._err('tar: you must specify a filename (-f)');
      // Simulate creating archive by writing metadata file
      const manifest = fileArgs.join('\n');
      this.vfs.writeFile(archiveArg, `# tar archive: ${archiveArg}\n${manifest}\n`);
      const lines = isVerbose ? fileArgs.map(f => Utils.escapeHtml(f)) : [];
      return lines.join('\n') || null;
    }
    if (isExtract) {
      if (!archiveArg) return this._err('tar: you must specify a filename (-f)');
      const r = this.vfs.cat(archiveArg);
      if (!r.success) return this._err(`tar: ${archiveArg}: Cannot open: No such file or directory`);
      return isVerbose ? `<span class="term-success">Extracted: ${Utils.escapeHtml(archiveArg)}</span>` : null;
    }
    if (isList) {
      if (!archiveArg) return this._err('tar: you must specify a filename (-f)');
      const r = this.vfs.cat(archiveArg);
      if (!r.success) return this._err(`tar: ${archiveArg}: Cannot open`);
      return Utils.escapeHtml(r.content);
    }
    return this._err('tar: you must specify one of the -c, -x, or -t options');
  }

  _gzip(flags, args) {
    if (!args.length) return this._err('gzip: missing file operand');
    for (const f of args) {
      const r = this.vfs.cat(f);
      if (!r.success) { return this._err(r.error); }
      // Simulate: rename file to file.gz
      this.vfs.writeFile(f + '.gz', `[gzip compressed data of ${f}]\n`);
      if (!flags.k) this.vfs.rm(f, {});
    }
    return null;
  }

  _gunzip(flags, args) {
    if (!args.length) return this._err('gunzip: missing file operand');
    for (const f of args) {
      const r = this.vfs.cat(f);
      if (!r.success) return this._err(r.error);
      const outName = f.endsWith('.gz') ? f.slice(0,-3) : f + '.decompressed';
      this.vfs.writeFile(outName, `[decompressed content of ${f}]\n`);
      if (!flags.k) this.vfs.rm(f, {});
    }
    return null;
  }

  _zip(flags, args) {
    if (args.length < 2) return this._err('zip: missing file operand');
    const archive = args[0];
    const files = args.slice(1);
    this.vfs.writeFile(archive, `# zip archive\n${files.join('\n')}\n`);
    const lines = files.map(f => `  adding: ${Utils.escapeHtml(f)} (stored 0%)`);
    return lines.join('\n');
  }

  _unzip(flags, args) {
    if (!args.length) return this._err('unzip: missing file operand');
    const r = this.vfs.cat(args[0]);
    if (!r.success) return this._err(`unzip: cannot find or open ${args[0]}`);
    return `Archive:  ${Utils.escapeHtml(args[0])}\n<span class="term-success">  inflating: (simulated)</span>`;
  }

  _bzip2(flags, args) {
    if (!args.length) return this._err('bzip2: missing file operand');
    for (const f of args) {
      const r = this.vfs.cat(f);
      if (!r.success) return this._err(r.error);
      this.vfs.writeFile(f + '.bz2', `[bzip2 compressed: ${f}]\n`);
      if (!flags.k) this.vfs.rm(f, {});
    }
    return null;
  }

  _xz(flags, args) {
    if (!args.length) return this._err('xz: missing file operand');
    for (const f of args) {
      const r = this.vfs.cat(f);
      if (!r.success) return this._err(r.error);
      this.vfs.writeFile(f + '.xz', `[xz compressed: ${f}]\n`);
      if (!flags.k && !flags.d) this.vfs.rm(f, {});
    }
    return null;
  }

  // ── Networking ────────────────────────────────────────────────────────────────

  _ping(flags, args) {
    if (!args.length) return this._err('ping: missing host operand');
    const host = args[0];
    const count = parseInt(flags.c) || 4;
    const lines = [`PING ${Utils.escapeHtml(host)} (93.184.216.34) 56(84) bytes of data.`];
    for (let i = 1; i <= count; i++) {
      const ms = (10 + Math.random() * 15).toFixed(3);
      lines.push(`64 bytes from ${Utils.escapeHtml(host)} (93.184.216.34): icmp_seq=${i} ttl=55 time=${ms} ms`);
    }
    const avg = (10 + Math.random() * 10).toFixed(3);
    lines.push(`\n--- ${Utils.escapeHtml(host)} ping statistics ---`);
    lines.push(`${count} packets transmitted, ${count} received, 0% packet loss, time ${count*1010}ms`);
    lines.push(`rtt min/avg/max/mdev = 10.123/${avg}/25.456/2.345 ms`);
    return lines.join('\n');
  }

  _curl(flags, args) {
    if (!args.length) return this._err('curl: try \'curl --help\' or \'curl --manual\' for more information');
    const url = args.find(a => !a.startsWith('-')) || args[0];
    if (flags.I || flags['head']) {
      return `HTTP/1.1 200 OK\nContent-Type: text/html; charset=UTF-8\nContent-Length: 1256\nServer: LinuxMaster/1.0\nDate: ${Utils.escapeHtml(Utils.formatFullDate())}`;
    }
    if (flags.O || flags.o) {
      const outFile = flags.o || url.split('/').pop() || 'index.html';
      this.vfs.writeFile(outFile, `<!-- Downloaded from ${url} -->\n<html><body>Simulated response</body></html>\n`);
      return `  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100  1256  100  1256    0     0   5240      0 --:--:-- --:--:-- --:--:--  5240`;
    }
    return `<span class="term-dim"><!-- Simulated response from ${Utils.escapeHtml(url)} --></span>\n&lt;!DOCTYPE html&gt;\n&lt;html&gt;&lt;head&gt;&lt;title&gt;Example&lt;/title&gt;&lt;/head&gt;\n&lt;body&gt;&lt;h1&gt;LinuxMaster Simulated Response&lt;/h1&gt;&lt;/body&gt;&lt;/html&gt;`;
  }

  _wget(flags, args) {
    if (!args.length) return this._err('wget: missing URL');
    const url = args[0];
    const filename = url.split('/').pop() || 'index.html';
    this.vfs.writeFile(filename, `<!-- Downloaded: ${url} -->\n`);
    return [
      `--${Utils.escapeHtml(Utils.formatFullDate())}--  ${Utils.escapeHtml(url)}`,
      `Resolving ${Utils.escapeHtml(url.replace(/https?:\/\//, '').split('/')[0])}... 93.184.216.34`,
      `Connecting to server... connected.`,
      `HTTP request sent, awaiting response... 200 OK`,
      `Length: 1256 (1.2K) [text/html]`,
      `Saving to: '${Utils.escapeHtml(filename)}'`,
      ``,
      `${Utils.escapeHtml(filename)}  100%[==============================>]   1.23K  --.-KB/s    in 0s`,
      ``,
      `<span class="term-success">Download complete.</span>`,
    ].join('\n');
  }

  _netstat(flags, args) {
    const header = 'Proto Recv-Q Send-Q Local Address           Foreign Address         State';
    const rows = [
      'tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN',
      'tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN',
      'tcp        0      0 127.0.0.1:3306          0.0.0.0:*               LISTEN',
      'tcp        0     36 192.168.1.100:22        192.168.1.1:54321       ESTABLISHED',
      'udp        0      0 0.0.0.0:68              0.0.0.0:*',
    ];
    if (flags.n || flags.a) return [header, ...rows].join('\n');
    return [header, ...rows.slice(0,3)].join('\n');
  }

  _ss(flags, args) {
    const header = 'Netid  State   Recv-Q Send-Q   Local Address:Port    Peer Address:Port';
    const rows = [
      'tcp    LISTEN  0      128          0.0.0.0:22           0.0.0.0:*',
      'tcp    LISTEN  0      511          0.0.0.0:80           0.0.0.0:*',
      'tcp    ESTAB   0      0      192.168.1.100:22    192.168.1.1:54321',
      'udp    UNCONN  0      0            0.0.0.0:68           0.0.0.0:*',
    ];
    return [header, ...rows].join('\n');
  }

  _ifconfig(flags, args) {
    const iface = args[0] || null;
    const eth0 = `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 192.168.1.100  netmask 255.255.255.0  broadcast 192.168.1.255
        inet6 fe80::1  prefixlen 64  scopeid 0x20<link>
        ether 02:42:ac:11:00:02  txqueuelen 0  (Ethernet)
        RX packets 12345  bytes 9876543 (9.4 MiB)
        TX packets 6789   bytes 543210  (530.5 KiB)`;
    const lo = `lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        inet6 ::1  prefixlen 128  scopeid 0x10<host>
        loop  txqueuelen 1000  (Local Loopback)`;
    if (iface === 'eth0') return eth0;
    if (iface === 'lo') return lo;
    return eth0 + '\n\n' + lo;
  }

  _ip(flags, args) {
    if (!args.length) return this._err('ip: missing object\nUsage: ip [ addr | route | link | neigh ]');
    const obj = args[0];
    if (obj === 'addr' || obj === 'a') {
      return `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    link/ether 02:42:ac:11:00:02 brd ff:ff:ff:ff:ff:ff
    inet 192.168.1.100/24 brd 192.168.1.255 scope global eth0`;
    }
    if (obj === 'route' || obj === 'r') {
      return `default via 192.168.1.1 dev eth0 proto dhcp src 192.168.1.100 metric 100\n192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.100`;
    }
    if (obj === 'link' || obj === 'l') {
      return `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP`;
    }
    return this._err(`ip: object "${obj}" is unknown, try "ip help"`);
  }

  _ssh(flags, args) {
    if (!args.length) return this._err('ssh: missing host operand\nusage: ssh user@host');
    return `<span class="term-warn">ssh: This is a simulated environment. Real SSH connections are not supported.</span>\nWould connect to: ${Utils.escapeHtml(args[0])}`;
  }

  _scp(flags, args) {
    if (args.length < 2) return this._err('usage: scp source target');
    return `<span class="term-warn">scp: This is a simulated environment.</span>\n${Utils.escapeHtml(args[0])} → ${Utils.escapeHtml(args[1])} (simulated)`;
  }

  _nslookup(flags, args) {
    if (!args.length) return this._err('nslookup: missing host');
    const host = args[0];
    return `Server:\t\t8.8.8.8\nAddress:\t8.8.8.8#53\n\nNon-authoritative answer:\nName:\t${Utils.escapeHtml(host)}\nAddress: 93.184.216.34`;
  }

  _dig(flags, args) {
    if (!args.length) return this._err('dig: missing host');
    const host = args[0];
    return `; <<>> DiG 9.16.1-Ubuntu <<>> ${Utils.escapeHtml(host)}
;; QUESTION SECTION:
;${Utils.escapeHtml(host)}.     IN  A

;; ANSWER SECTION:
${Utils.escapeHtml(host)}.  3600  IN  A  93.184.216.34

;; Query time: 12 msec
;; SERVER: 8.8.8.8#53(8.8.8.8)
;; MSG SIZE  rcvd: 56`;
  }

  _hostcmd(flags, args) {
    if (!args.length) return this._err('host: missing host');
    const host = args[0];
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return `${Utils.escapeHtml(host)}.in-addr.arpa domain name pointer ${Utils.escapeHtml(host)}.example.com.`;
    }
    return `${Utils.escapeHtml(host)} has address 93.184.216.34\n${Utils.escapeHtml(host)} mail is handled by 10 mail.${Utils.escapeHtml(host)}.`;
  }

  _traceroute(flags, args) {
    if (!args.length) return this._err('traceroute: missing host');
    const host = args[0];
    const hops = [`traceroute to ${Utils.escapeHtml(host)} (93.184.216.34), 30 hops max, 60 byte packets`];
    for (let i = 1; i <= 5; i++) {
      const ms = (i * 5 + Math.random()*3).toFixed(3);
      hops.push(` ${i}  gateway (192.168.1.1)  ${ms} ms  ${(parseFloat(ms)+0.5).toFixed(3)} ms  ${(parseFloat(ms)+1).toFixed(3)} ms`);
    }
    hops.push(` 6  ${Utils.escapeHtml(host)} (93.184.216.34)  32.456 ms  31.234 ms  33.123 ms`);
    return hops.join('\n');
  }

  // ── Package Management ────────────────────────────────────────────────────────

  _apt(flags, args) {
    if (!args.length) return `apt 2.4.8 (amd64)\nUsage: apt [options] command\nCommands: install, remove, update, upgrade, search, show, list`;
    const sub = args[0];
    const pkg = args[1];
    if (sub === 'update') return `Hit:1 http://archive.ubuntu.com/ubuntu jammy InRelease\nReading package lists... Done\n<span class="term-success">All packages are up to date.</span>`;
    if (sub === 'upgrade') return `Reading package lists... Done\nBuilding dependency tree... Done\n0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.`;
    if (sub === 'install' && pkg) {
      return `Reading package lists... Done\nBuilding dependency tree... Done\nThe following NEW packages will be installed:\n  ${Utils.escapeHtml(pkg)}\n0 upgraded, 1 newly installed.\n<span class="term-success">Setting up ${Utils.escapeHtml(pkg)} ... done</span>`;
    }
    if (sub === 'remove' && pkg) return `Removing ${Utils.escapeHtml(pkg)} ...\n<span class="term-success">Done</span>`;
    if (sub === 'search' && pkg) return `Searching for '${Utils.escapeHtml(pkg)}'...\n${Utils.escapeHtml(pkg)}/jammy 1.0.0 amd64\n  Simulated package for ${Utils.escapeHtml(pkg)}`;
    if (sub === 'list') return `Listing... Done\nbash/jammy,now 5.1.16 amd64 [installed]\ncoreutils/jammy,now 8.32 amd64 [installed]\nopenssl/jammy,now 3.0.2 amd64 [installed]`;
    return this._err(`apt: invalid operation ${Utils.escapeHtml(sub || '')}`);
  }

  _yum(flags, args) {
    if (!args.length) return 'usage: yum [options] COMMAND';
    const sub = args[0]; const pkg = args[1];
    if (sub === 'install' && pkg) return `Resolving Dependencies\n--> Installing: ${Utils.escapeHtml(pkg)}\n<span class="term-success">Complete!</span>`;
    if (sub === 'update') return `No packages marked for update.`;
    if (sub === 'list') return `Installed Packages\nbash.x86_64        5.1.8-6.el9    @baseos\ncoreutils.x86_64   8.32-34.el9    @baseos`;
    return `yum: ${Utils.escapeHtml(sub)}: subcommand simulated`;
  }

  _dnf(flags, args) { return this._yum(flags, args); }

  _snap(flags, args) {
    if (!args.length) return 'usage: snap <command> [<options>...]';
    const sub = args[0]; const pkg = args[1];
    if (sub === 'install' && pkg) return `<span class="term-success">${Utils.escapeHtml(pkg)} installed</span>`;
    if (sub === 'list') return `Name       Version  Rev  Tracking  Publisher\ncore20     20230801 2015 latest/stable  canonical`;
    return `snap: ${Utils.escapeHtml(sub)} simulated`;
  }

  _dpkg(flags, args) {
    if (flags.l) return `Desired=Unknown/Install/Remove/Purge/Hold\n| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend\n|/ Err?=(none)/Reinst-required\n+++-=======================================\nii  bash            5.1.16-1  amd64   GNU Bourne Again SHell\nii  coreutils       8.32-4.1  amd64   GNU core utilities`;
    return 'dpkg: usage: dpkg [<option>...] <command>';
  }

  _rpm(flags, args) {
    if (flags.qa || (flags.q && flags.a)) return `bash-5.1.8-6.el9.x86_64\ncoreutils-8.32-34.el9.x86_64\nglibc-2.34-60.el9.x86_64`;
    return 'rpm: usage: rpm [-qa] [-i package.rpm]';
  }

  // ── Process & Job Control ─────────────────────────────────────────────────────

  _jobs() { return '<span class="term-dim">No active jobs.</span>'; }
  _bg(flags, args) { return this._err('bg: no current job'); }
  _fg(flags, args) { return this._err('fg: no current job'); }

  _nohup(flags, args) {
    if (!args.length) return this._err('nohup: missing operand');
    return `nohup: ignoring input and appending output to 'nohup.out'\n<span class="term-dim">Command would run: ${Utils.escapeHtml(args.join(' '))}</span>`;
  }

  _time(flags, args, rawInput) {
    const cmd = args.join(' ');
    if (!cmd) return this._err('time: missing command');
    const out = this._runCommand(args[0], {}, args.slice(1), rawInput);
    const real = (Math.random() * 0.1).toFixed(3);
    const user = (real * 0.7).toFixed(3);
    const sys  = (real * 0.1).toFixed(3);
    return (out ? out + '\n' : '') + `\nreal\t0m${real}s\nuser\t0m${user}s\nsys\t0m${sys}s`;
  }

  _watch(flags, args) {
    if (!args.length) return this._err('watch: missing command');
    return `<span class="term-warn">watch: ${Utils.escapeHtml(args.join(' '))} (simulated snapshot — real watch updates not available in browser)</span>\n` + (this._runCommand(args[0], {}, args.slice(1), args.join(' ')) || '');
  }

  _crontab(flags, args) {
    if (flags.l) return `# crontab for user\n# m h dom mon dow command\n0 2 * * * /home/user/backup.sh\n30 8 * * 1 /usr/bin/weekly_report.sh`;
    if (flags.e) return '<span class="term-dim">Crontab editor opened (simulated). In a real system, this opens $EDITOR.</span>';
    if (flags.r) return null;
    return 'crontab: usage: crontab [-l|-e|-r] [file]';
  }

  _killall(flags, args) {
    if (!args.length) return this._err('killall: no process name specified');
    return `<span class="term-warn">Killed all processes named '${Utils.escapeHtml(args[0])}' (simulated).</span>`;
  }

  _pkill(flags, args) {
    if (!args.length) return this._err('pkill: missing pattern');
    return `<span class="term-warn">pkill: signalled '${Utils.escapeHtml(args[0])}' (simulated).</span>`;
  }

  _pgrep(flags, args) {
    if (!args.length) return this._err('pgrep: missing pattern');
    const pattern = args[0];
    const procs = [{ pid: 512, cmd: 'bash' }, { pid: 1024, cmd: 'node' }];
    const matches = procs.filter(p => p.cmd.includes(pattern));
    if (!matches.length) return null; // exit 1 means no match
    return matches.map(p => flags.l ? `${p.pid} ${p.cmd}` : String(p.pid)).join('\n');
  }

  _pstree() {
    return `systemd─┬─sshd───sshd───bash───pstree
        ├─systemd-logind
        ├─systemd-resolve
        ├─cron
        └─2*[agetty]`;
  }

  _lsof(flags, args) {
    return `COMMAND   PID  USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
bash      512  user  cwd    DIR    8,1     4096  131073 /home/user
bash      512  user    0u   CHR    136,0      0t0      3 /dev/pts/0
bash      512  user    1u   CHR    136,0      0t0      3 /dev/pts/0
bash      512  user    2u   CHR    136,0      0t0      3 /dev/pts/0
node     1024  user  cwd    DIR    8,1     4096  131073 /home/user`;
  }

  _vmstat(flags, args) {
    return `procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 1  0      0 3998208  32768 1796096    0    0     8     4  100  200  2  0 97  1  0`;
  }

  _iostat(flags, args) {
    return `Linux 5.15.0-linuxmaster  ${Utils.escapeHtml(Utils.formatFullDate())}  1 CPU

avg-cpu:  %user   %nice %system %iowait  %steal   %idle
           1.23    0.00    0.52    0.20    0.00   98.05

Device             tps    kB_read/s    kB_wrtn/s    kB_read    kB_wrtn
sda               8.00       128.00        64.00    1234567     654321`;
  }

  // ── System Info & Hardware ────────────────────────────────────────────────────

  _hostname(flags, args) {
    if (args.length && !flags.f && !flags.i) {
      this.vfs.setEnv('HOSTNAME', args[0]);
      return null;
    }
    if (flags.f) return 'linuxmaster.local';
    if (flags.i) return '192.168.1.100';
    return Utils.escapeHtml(this.vfs.getEnv('HOSTNAME') || 'linuxmaster');
  }

  _uptime() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();
    return ` ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00 up 20 min,  1 user,  load average: 0.12, 0.08, 0.04`;
  }

  _free(flags, args) {
    const human = flags.h;
    const fmt = (kb) => human ? (kb > 1048576 ? (kb/1048576).toFixed(1)+'G' : (kb/1024).toFixed(1)+'M') : String(kb);
    const header = `              total        used        free      shared  buff/cache   available`;
    const mem   = `Mem:        ${fmt(8192000).padStart(10)} ${fmt(2142000).padStart(11)} ${fmt(3998000).padStart(11)} ${fmt(102400).padStart(11)} ${fmt(2052000).padStart(11)} ${fmt(5728000).padStart(11)}`;
    const swap  = `Swap:       ${fmt(2097152).padStart(10)} ${fmt(0).padStart(11)} ${fmt(2097152).padStart(11)}`;
    return [header, mem, swap].join('\n');
  }

  _lscpu() {
    return `Architecture:            x86_64
  CPU op-mode(s):          32-bit, 64-bit
  Address sizes:           39 bits physical, 48 bits virtual
  Byte Order:              Little Endian
CPU(s):                    4
  On-line CPU(s) list:     0-3
Vendor ID:                 GenuineIntel
  Model name:              Intel(R) Core(TM) i7 CPU @ 2.80GHz
    CPU family:            6
    Model:                 158
    Thread(s) per core:    2
    Core(s) per socket:    2
    Socket(s):             1
CPU MHz:                   2800.000
Cache:
  L1d:                     128 KiB (4 instances)
  L1i:                     128 KiB (4 instances)
  L2:                       1 MiB (2 instances)
  L3:                       8 MiB (1 instance)`;
  }

  _lsblk(flags, args) {
    return `NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS
sda      8:0    0    20G  0 disk
├─sda1   8:1    0    19G  0 part /
└─sda2   8:2    0     1G  0 part [SWAP]
sr0     11:0    1  1024M  0 rom`;
  }

  _lspci(flags, args) {
    return `00:00.0 Host bridge: Intel Corporation 440BX/ZX/DX
00:01.0 PCI bridge: Intel Corporation 440BX/ZX/DX
00:07.0 ISA bridge: Intel Corporation PIIX4/4E/4M ISA Bridge
00:07.1 IDE interface: Intel Corporation PIIX4 IDE
00:07.3 Bridge: Intel Corporation PIIX4 ACPI
00:0f.0 VGA compatible controller: VMware SVGA II Adapter
00:11.0 PCI bridge: VMware PCI bridge`;
  }

  _lsusb() {
    return `Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub
Bus 002 Device 001: ID 1d6b:0001 Linux Foundation 1.1 root hub
Bus 002 Device 002: ID 0e0f:0003 VMware, Inc. Virtual Mouse
Bus 002 Device 003: ID 0e0f:0002 VMware, Inc. Virtual USB Hub`;
  }

  _dmesg(flags, args) {
    const lines = [
      '[    0.000000] Linux version 5.15.0-linuxmaster (gcc 11.2.0)',
      '[    0.000000] Command line: BOOT_IMAGE=/vmlinuz root=/dev/sda1',
      '[    0.100000] BIOS-provided physical RAM map:',
      '[    0.200000] PCI: Using configuration type 1 for base access',
      '[    1.500000] NET: Registered PF_INET protocol family',
      '[    2.000000] EXT4-fs (sda1): mounted filesystem with ordered data mode',
      '[   10.000000] systemd[1]: Starting LinuxMaster...',
    ];
    if (flags.T) return lines.map(l => l.replace(/\[(\s*[\d.]+)\]/, (_, t) => `[${Utils.formatFullDate().slice(0,19)}]`)).map(Utils.escapeHtml).join('\n');
    return lines.map(Utils.escapeHtml).join('\n');
  }

  _journalctl(flags, args) {
    if (flags.f) return '<span class="term-dim">-- Waiting for journal entries (simulated) --</span>';
    const lines = [
      'Oct 04 10:00:01 linuxmaster systemd[1]: Started Session 1 of user user.',
      'Oct 04 10:00:02 linuxmaster sshd[298]: Accepted password for user from 127.0.0.1 port 54321 ssh2',
      'Oct 04 10:00:05 linuxmaster kernel: NET: Registered PF_INET protocol family',
      'Oct 04 10:01:00 linuxmaster cron[156]: (CRON) INFO (pidfile fd = 3)',
      'Oct 04 10:10:00 linuxmaster sudo[512]:   user : TTY=pts/0 ; PWD=/home/user ; USER=root ; COMMAND=/usr/bin/apt update',
    ];
    if (flags.u && args[0]) return lines.filter(l => l.includes(args[0])).map(Utils.escapeHtml).join('\n') || '<span class="term-dim">No entries found.</span>';
    return lines.map(Utils.escapeHtml).join('\n');
  }

  _systemctl(flags, args) {
    if (!args.length) return `UNIT                    LOAD   ACTIVE SUB     DESCRIPTION
systemd-journald.service loaded active running Journal Service
sshd.service            loaded active running OpenSSH server daemon
cron.service            loaded active running Regular background program`;
    const sub = args[0]; const unit = args[1];
    if (sub === 'status' && unit) return `● ${Utils.escapeHtml(unit)}\n   Loaded: loaded (/lib/systemd/system/${Utils.escapeHtml(unit)}; enabled)\n   Active: <span class="term-success">active (running)</span> since ${Utils.escapeHtml(Utils.formatFullDate())}; 20min ago\n Main PID: 298\n   CGroup: /system.slice/${Utils.escapeHtml(unit)}\n           └─298 /usr/sbin/${Utils.escapeHtml(unit.replace('.service',''))} -D`;
    if (sub === 'start')   return `<span class="term-success">Started ${Utils.escapeHtml(unit||'')}.</span>`;
    if (sub === 'stop')    return `<span class="term-warn">Stopped ${Utils.escapeHtml(unit||'')}.</span>`;
    if (sub === 'restart') return `<span class="term-success">Restarted ${Utils.escapeHtml(unit||'')}.</span>`;
    if (sub === 'enable')  return `Created symlink /etc/systemd/system/multi-user.target.wants/${Utils.escapeHtml(unit||'')}`;
    if (sub === 'disable') return `Removed /etc/systemd/system/multi-user.target.wants/${Utils.escapeHtml(unit||'')}`;
    if (sub === 'list-units') return this._systemctl({}, []);
    return this._err(`systemctl: Unknown operation '${Utils.escapeHtml(sub)}'`);
  }

  _service(flags, args) {
    if (args.length < 2) return this._err('usage: service <service> <command>');
    const [svc, cmd] = args;
    return `<span class="term-success">${Utils.escapeHtml(svc)} ${Utils.escapeHtml(cmd)}: done.</span>`;
  }

  _mount(flags, args) {
    const defaultMounts = `/dev/sda1 on / type ext4 (rw,relatime)
tmpfs on /dev/shm type tmpfs (rw,nosuid,nodev)
sysfs on /sys type sysfs (ro,nosuid,nodev,noexec,relatime)
proc on /proc type proc (rw,nosuid,nodev,noexec,relatime)`;
    if (!args.length) return defaultMounts;
    return `<span class="term-success">Mounted ${Utils.escapeHtml(args[0])} (simulated).</span>`;
  }

  _umount(flags, args) {
    if (!args.length) return this._err('umount: missing operand');
    return `<span class="term-success">Unmounted ${Utils.escapeHtml(args[0])} (simulated).</span>`;
  }

  _blkid(flags, args) {
    return `/dev/sda1: UUID="a1b2c3d4-e5f6-7890-abcd-ef1234567890" TYPE="ext4" PARTUUID="12345678-01"\n/dev/sda2: UUID="b2c3d4e5-f6a7-8901-bcde-f01234567891" TYPE="swap" PARTUUID="12345678-02"`;
  }

  _fdisk(flags, args) {
    if (flags.l) return `Disk /dev/sda: 20 GiB, 21474836480 bytes, 41943040 sectors
Units: sectors of 1 * 512 = 512 bytes

Device     Boot    Start      End  Sectors  Size Id Type
/dev/sda1  *        2048 39845887 39843840   19G 83 Linux
/dev/sda2       39845888 41943039  2097152    1G 82 Linux swap`;
    return '<span class="term-warn">fdisk: only -l flag is supported in this simulator</span>';
  }

  // ── User & Permissions ────────────────────────────────────────────────────────

  _id(flags, args) {
    const user = args[0] || this.vfs.getEnv('USER') || 'user';
    return `uid=1000(${Utils.escapeHtml(user)}) gid=1000(${Utils.escapeHtml(user)}) groups=1000(${Utils.escapeHtml(user)}),4(adm),24(cdrom),27(sudo),46(plugdev)`;
  }

  _groups(flags, args) {
    const user = args[0] || this.vfs.getEnv('USER') || 'user';
    return `${Utils.escapeHtml(user)} : ${Utils.escapeHtml(user)} adm cdrom sudo plugdev`;
  }

  _last(flags, args) {
    const user = args[0] || 'user';
    return [
      `${Utils.escapeHtml(user)}   pts/0        192.168.1.1      ${Utils.escapeHtml(Utils.formatFullDate().slice(0,16))}   still logged in`,
      `${Utils.escapeHtml(user)}   pts/0        192.168.1.1      Sat Oct  3 20:00 - 22:30  (02:30)`,
      `reboot   system boot  5.15.0-linuxmast Sat Oct  3 20:00   still running`,
      ``,
      `wtmp begins Sat Oct  3 20:00:00 2026`,
    ].join('\n');
  }

  _who(flags, args) {
    return `user     pts/0        ${Utils.escapeHtml(Utils.formatFullDate().slice(4,16))} (192.168.1.1)`;
  }

  _w(flags, args) {
    const now = Utils.formatFullDate().slice(11,19);
    return ` ${now} up 20 min,  1 user,  load average: 0.12, 0.08, 0.04
USER     TTY      FROM             LOGIN@   IDLE JCPU   PCPU WHAT
user     pts/0    192.168.1.1      10:00    0.00s  0.04s  0.01s w`;
  }

  _su(flags, args) {
    const user = args[0] || 'root';
    return `<span class="term-warn">su: Password authentication is not supported in this simulator.\nWould switch to user: ${Utils.escapeHtml(user)}</span>`;
  }

  _sudo(flags, args, rawInput) {
    if (!args.length) return this._err('sudo: no command specified');
    const subcmd = args[0];
    const subArgs = args.slice(1);
    const { flags: subFlags, args: subPosArgs } = Utils.parseFlags(subArgs);
    const output = this._runCommand(subcmd, subFlags, subPosArgs, subArgs.join(' '));
    return output;
  }

  _passwd(flags, args) {
    return '<span class="term-warn">passwd: Password changes are not supported in this simulator.</span>';
  }

  _useradd(flags, args) {
    if (!args.length) return this._err('useradd: missing username');
    const username = args[args.length - 1];
    this.vfs.mkdir(`/home/${username}`, true);
    return `<span class="term-success">User '${Utils.escapeHtml(username)}' created (simulated).</span>`;
  }

  _userdel(flags, args) {
    if (!args.length) return this._err('userdel: missing username');
    return `<span class="term-warn">User '${Utils.escapeHtml(args[0])}' deleted (simulated).</span>`;
  }

  _groupadd(flags, args) {
    if (!args.length) return this._err('groupadd: missing group name');
    return `<span class="term-success">Group '${Utils.escapeHtml(args[0])}' created (simulated).</span>`;
  }

  _umask(flags, args) {
    if (!args.length) return '0022';
    return null; // set umask (simulated)
  }

  // ── Environment & Shell ───────────────────────────────────────────────────────

  _printenv(flags, args) {
    if (args.length) {
      return args.map(k => Utils.escapeHtml(this.vfs.getEnv(k) || '')).join('\n');
    }
    const keys = ['HOME','USER','SHELL','PATH','TERM','HOSTNAME','LANG','PWD'];
    return keys.map(k => `${k}=${Utils.escapeHtml(this.vfs.getEnv(k) || '')}`).join('\n');
  }

  _source(flags, args) {
    if (!args.length) return this._err('source: filename required');
    const r = this.vfs.cat(args[0]);
    if (!r.success) return this._err(`bash: ${args[0]}: No such file or directory`);
    const lines = r.content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const outputs = [];
    for (const line of lines) {
      const out = this.execute(line);
      if (out) outputs.push(out);
    }
    return outputs.join('\n') || null;
  }

  _basename(flags, args) {
    if (!args.length) return this._err('basename: missing operand');
    let path = args[0];
    const suffix = args[1] || '';
    const base = path.split('/').filter(Boolean).pop() || path;
    return Utils.escapeHtml(suffix ? base.replace(new RegExp(suffix + '$'), '') : base);
  }

  _dirname(flags, args) {
    if (!args.length) return this._err('dirname: missing operand');
    const path = args[0];
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    return Utils.escapeHtml(parts.length ? '/' + parts.join('/') : '/');
  }

  _realpath(flags, args) {
    if (!args.length) return this._err('realpath: missing operand');
    return Utils.escapeHtml(this.vfs.resolvePath(args[0]));
  }

  _readlink(flags, args) {
    if (!args.length) return this._err('readlink: missing operand');
    const abs = this.vfs.resolvePath(args[0]);
    const node = this.vfs._getNode(abs);
    if (!node) return this._err(`readlink: ${args[0]}: No such file or directory`);
    if (flags.f) return Utils.escapeHtml(abs);
    if (!node.isLink()) return this._err(`readlink: ${args[0]}: Invalid argument`);
    return Utils.escapeHtml(node.linkTarget || abs);
  }

  _whereis(flags, args) {
    if (!args.length) return this._err('whereis: missing argument');
    const cmds = ['ls','grep','find','awk','sed','bash','python3','node','git','vim','nano'];
    return args.map(cmd => {
      const found = cmds.includes(cmd);
      return `${Utils.escapeHtml(cmd)}: ${found ? `/usr/bin/${Utils.escapeHtml(cmd)} /usr/share/man/man1/${Utils.escapeHtml(cmd)}.1.gz` : ''}`;
    }).join('\n');
  }

  _locate(flags, args) {
    if (!args.length) return this._err('locate: missing argument');
    const pattern = args[0];
    const results = this.vfs.find('/', { name: pattern });
    if (!results.success || !results.results.length) return `<span class="term-dim">locate: no results found for '${Utils.escapeHtml(pattern)}'</span>`;
    return results.results.map(Utils.escapeHtml).join('\n');
  }

  // ── Math & Encoding ───────────────────────────────────────────────────────────

  _expr(flags, args) {
    if (!args.length) return this._err('expr: missing operand');
    try {
      // Support basic arithmetic: expr 5 + 3, expr 10 \* 2, expr 7 % 3
      const expr = args.join(' ')
        .replace(/\\\*/g, '*')
        .replace(/(\d+)\s*\+\s*(\d+)/g, (_, a, b) => String(parseInt(a)+parseInt(b)))
        .replace(/(\d+)\s*-\s*(\d+)/g, (_, a, b) => String(parseInt(a)-parseInt(b)))
        .replace(/(\d+)\s*\*\s*(\d+)/g, (_, a, b) => String(parseInt(a)*parseInt(b)))
        .replace(/(\d+)\s*\/\s*(\d+)/g, (_, a, b) => String(Math.floor(parseInt(a)/parseInt(b))))
        .replace(/(\d+)\s*%\s*(\d+)/g, (_, a, b) => String(parseInt(a)%parseInt(b)));
      const num = parseInt(expr);
      return isNaN(num) ? Utils.escapeHtml(expr) : String(num);
    } catch (e) {
      return this._err(`expr: syntax error`);
    }
  }

  _bc(flags, args, rawInput) {
    // Simple expression eval
    const match = rawInput.match(/bc\s*[^<>|]*?<<<?\s*['"]?(.+?)['"]?$/) ||
                  rawInput.match(/echo\s+['"]?(.+?)['"]?\s*\|\s*bc/);
    if (!match && !args.length) return '<span class="term-dim">bc 1.07.1 (interactive mode not supported)\nType math expressions like: echo "2+2" | bc</span>';
    const expr = match ? match[1] : args.join(' ');
    try {
      // Safe eval for simple arithmetic
      const sanitized = expr.replace(/[^0-9+\-*/().% ]/g, '');
      if (!sanitized) return this._err('bc: syntax error');
      // eslint-disable-next-line no-new-func
      const result = new Function(`"use strict"; return (${sanitized})`)();
      return String(result);
    } catch (e) {
      return this._err(`(standard_in) 1: parse error`);
    }
  }

  _seq(flags, args) {
    if (!args.length) return this._err('seq: missing operand');
    let first = 1, inc = 1, last;
    if (args.length === 1) { last = parseInt(args[0]); }
    else if (args.length === 2) { first = parseInt(args[0]); last = parseInt(args[1]); }
    else { first = parseInt(args[0]); inc = parseInt(args[1]); last = parseInt(args[2]); }
    if (isNaN(first) || isNaN(last)) return this._err('seq: invalid operand');
    const sep = flags.s || '\n';
    const nums = [];
    for (let i = first; (inc > 0 ? i <= last : i >= last); i += inc) nums.push(String(i));
    return Utils.escapeHtml(nums.join(sep));
  }

  _factor(flags, args) {
    if (!args.length) return this._err('factor: missing operand');
    return args.map(n => {
      const num = parseInt(n);
      if (isNaN(num) || num < 1) return `factor: '${Utils.escapeHtml(n)}' is not a valid positive integer`;
      const factors = [];
      let d = 2, rem = num;
      while (d * d <= rem) { while (rem % d === 0) { factors.push(d); rem /= d; } d++; }
      if (rem > 1) factors.push(rem);
      return `${num}: ${factors.join(' ')}`;
    }).join('\n');
  }

  _cal(flags, args) {
    const now = new Date();
    const month = args[0] ? parseInt(args[0]) - 1 : now.getMonth();
    const year  = args[1] ? parseInt(args[1])     : now.getFullYear();
    const d = new Date(year, month, 1);
    const monthName = d.toLocaleString('default', { month: 'long' });
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const header = `   ${monthName} ${year}`;
    const dayRow = days.join(' ');
    let grid = '';
    let startDay = d.getDay();
    let totalDays = new Date(year, month+1, 0).getDate();
    let cells = Array(startDay).fill('  ').concat([...Array(totalDays)].map((_,i) => String(i+1).padStart(2)));
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i,i+7).join(' '));
    return Utils.escapeHtml([header, dayRow, ...weeks].join('\n'));
  }

  _base64(flags, args) {
    if (flags.d) {
      // decode
      const input = args[0] || '';
      try { return Utils.escapeHtml(atob(input)); } catch { return this._err('base64: invalid input'); }
    }
    if (args.length) {
      const r = this.vfs.cat(args[0]);
      if (!r.success) return this._err(r.error);
      return Utils.escapeHtml(btoa(r.content.slice(0,1000)));
    }
    return this._err('base64: missing operand');
  }

  _md5sum(flags, args) {
    if (!args.length) return this._err('md5sum: missing file operand');
    return args.map(f => {
      const r = this.vfs.cat(f);
      if (!r.success) return this._err(r.error);
      // Simple hash simulation (not cryptographic)
      let hash = 0;
      for (let i = 0; i < r.content.length; i++) {
        hash = ((hash << 5) - hash + r.content.charCodeAt(i)) | 0;
      }
      const hex = (hash >>> 0).toString(16).padStart(8,'0').repeat(4).slice(0,32);
      return `${hex}  ${Utils.escapeHtml(f)}`;
    }).join('\n');
  }

  _shasum(cmd, flags, args) {
    if (!args.length) return this._err(`${cmd}: missing file operand`);
    const bits = cmd === 'sha1sum' ? 40 : 64;
    return args.map(f => {
      const r = this.vfs.cat(f);
      if (!r.success) return this._err(r.error);
      let hash = 0;
      for (let i = 0; i < r.content.length; i++) hash = ((hash << 5) - hash + r.content.charCodeAt(i)) | 0;
      const hex = (hash >>> 0).toString(16).padStart(8,'0').repeat(Math.ceil(bits/8)).slice(0,bits);
      return `${hex}  ${Utils.escapeHtml(f)}`;
    }).join('\n');
  }

  _cksum(flags, args) {
    if (!args.length) return this._err('cksum: missing file operand');
    return args.map(f => {
      const r = this.vfs.cat(f);
      if (!r.success) return this._err(r.error);
      let crc = 0;
      for (let i = 0; i < r.content.length; i++) crc ^= r.content.charCodeAt(i);
      return `${(crc >>> 0) * 100003} ${r.content.length} ${Utils.escapeHtml(f)}`;
    }).join('\n');
  }

  // ── Misc Utilities ────────────────────────────────────────────────────────────

  _tee(flags, args, rawInput) {
    // tee writes to file AND stdout; here the output comes from a pipe prefix
    // Usage via pipe: cmd | tee file
    if (!args.length) return this._err('tee: missing file operand');
    // In a pipe context lastOutput is already set; just write it
    return null; // handled in pipeline
  }

  _xargs(flags, args, rawInput) {
    if (!args.length) return this._err('xargs: missing command');
    return `<span class="term-dim">xargs: ${Utils.escapeHtml(args.join(' '))} (executed with piped input)</span>`;
  }

  _yes(flags, args) {
    const word = args[0] || 'y';
    return Array(5).fill(Utils.escapeHtml(word)).join('\n') + '\n<span class="term-dim">... (Ctrl+C to stop)</span>';
  }

  _test(flags, args) {
    // Minimal test support: test -f file, test -d dir, test -e path
    if (args[0] === '-f') { return this.vfs._getNode(this.vfs.resolvePath(args[1]))?.isFile() ? null : this._err(''); }
    if (args[0] === '-d') { return this.vfs._getNode(this.vfs.resolvePath(args[1]))?.isDir()  ? null : this._err(''); }
    if (args[0] === '-e') { return this.vfs.nodeExists(args[1]) ? null : this._err(''); }
    if (args[1] === '='  || args[1] === '==') return args[0] === args[2] ? null : this._err('');
    if (args[1] === '!=' ) return args[0] !== args[2] ? null : this._err('');
    if (args[1] === '-eq') return parseInt(args[0]) === parseInt(args[2]) ? null : this._err('');
    if (args[1] === '-gt') return parseInt(args[0]) >   parseInt(args[2]) ? null : this._err('');
    if (args[1] === '-lt') return parseInt(args[0]) <   parseInt(args[2]) ? null : this._err('');
    return null;
  }

  _shuf(flags, args) {
    if (!args.length) return this._err('shuf: missing file operand');
    const r = this.vfs.cat(args[0]);
    if (!r.success) return this._err(r.error);
    const lines = r.content.split('\n').filter(Boolean);
    for (let i = lines.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lines[i], lines[j]] = [lines[j], lines[i]];
    }
    const n = flags.n ? parseInt(flags.n) : lines.length;
    return lines.slice(0, n).map(Utils.escapeHtml).join('\n');
  }

  _comm(flags, args) {
    if (args.length < 2) return this._err('comm: missing file operand');
    const r1 = this.vfs.cat(args[0]);
    const r2 = this.vfs.cat(args[1]);
    if (!r1.success) return this._err(r1.error);
    if (!r2.success) return this._err(r2.error);
    const s1 = new Set(r1.content.split('\n').filter(Boolean));
    const s2 = new Set(r2.content.split('\n').filter(Boolean));
    const output = [];
    for (const l of s1) { if (!s2.has(l)) output.push(Utils.escapeHtml(l)); }
    for (const l of s2) { if (!s1.has(l)) output.push('\t' + Utils.escapeHtml(l)); }
    for (const l of s1) { if (s2.has(l))  output.push('\t\t' + Utils.escapeHtml(l)); }
    return output.join('\n');
  }

  _split(flags, args) {
    if (!args.length) return this._err('split: missing file operand');
    const r = this.vfs.cat(args[0]);
    if (!r.success) return this._err(r.error);
    const prefix = args[1] || 'x';
    const n = parseInt(flags.l) || 1000;
    const lines = r.content.split('\n');
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let idx = 0;
    for (let i = 0; i < lines.length; i += n) {
      const chunk = lines.slice(i, i+n).join('\n');
      const suffix = letters[Math.floor(idx/26)] + letters[idx%26];
      this.vfs.writeFile(prefix + suffix, chunk);
      idx++;
    }
    return null;
  }

  _sleepCmd(flags, args) {
    const secs = parseFloat(args[0]) || 1;
    return `<span class="term-dim">sleep ${secs}s (simulated)</span>`;
  }

  _reset() {
    return null;
  }

  // ── Error Helper ─────────────────────────────────────────────────────────────
  _err(msg) {
    return `<span class="term-error">${Utils.escapeHtml(msg)}</span>`;
  }
}

// ── Man Pages ─────────────────────────────────────────────────────────────────
const MAN_PAGES = {
  ls: `LS(1)                    User Commands                    LS(1)

NAME
       ls - list directory contents

SYNOPSIS
       ls [OPTION]... [FILE]...

DESCRIPTION
       List information about the FILEs (the current directory by default).
       Sort entries alphabetically if none of -cftuvSUX nor --sort is specified.

       -a     do not ignore entries starting with .
       -l     use a long listing format
       -A     do not list implied . and ..
       -h     with -l and -s, print sizes like 1K 234M 2G etc.

EXAMPLES
       ls -la       List all files in long format
       ls /etc      List files in /etc directory`,

  cd: `CD(1P)                   POSIX Programmer's Manual                  CD(1P)

NAME
       cd - change the working directory

SYNOPSIS
       cd [-L|-P] [directory]

DESCRIPTION
       Change the current directory to directory.

       If directory is not specified, it defaults to the home directory.
       cd -    returns to previous directory
       cd ~    returns to home directory`,

  grep: `GREP(1)                  User Commands                  GREP(1)

NAME
       grep - print lines that match patterns

SYNOPSIS
       grep [OPTION...] PATTERNS [FILE...]

DESCRIPTION
       grep  searches  for  PATTERNS  in  each  FILE.

       -i     ignore case distinctions
       -n     print line number with output lines
       -r     recursive search
       -v     invert match (print non-matching lines)
       -c     print only a count of matching lines`,

  chmod: `CHMOD(1)                 User Commands                 CHMOD(1)

NAME
       chmod - change file mode bits

SYNOPSIS
       chmod [OPTION]... MODE FILE...

DESCRIPTION
       chmod changes the file mode bits of each given file.

       Numeric Modes:
         4 = read (r)
         2 = write (w)
         1 = execute (x)

       Examples:
         chmod 755 file  (rwxr-xr-x)
         chmod 644 file  (rw-r--r--)
         chmod 600 file  (rw-------)`,

  find: `FIND(1)                  User Commands                  FIND(1)

NAME
       find - search for files in a directory hierarchy

SYNOPSIS
       find [-H] [-L] [-P] [path...] [expression]

DESCRIPTION
       This  manual  page documents the GNU version of find.

       -name PATTERN   matches files matching shell pattern PATTERN
       -type TYPE      d for directory, f for file
       -mtime DAYS     file modified N*24 hours ago

EXAMPLES
       find . -name "*.txt"        Find all .txt files
       find /home -type d          Find all directories under /home`,

  pwd: `PWD(1)                   User Commands                   PWD(1)

NAME
       pwd - print name of current/working directory

SYNOPSIS
       pwd [OPTION]...

DESCRIPTION
       Print the full filename of the current working directory.`,

  mkdir: `MKDIR(1)                 User Commands                 MKDIR(1)

NAME
       mkdir - make directories

SYNOPSIS
       mkdir [OPTION]... DIRECTORY...

DESCRIPTION
       Create the DIRECTORY(ies), if they do not already exist.

       -p, --parents     no error if existing, make parent directories as needed`,

  rm: `RM(1)                    User Commands                    RM(1)

NAME
       rm - remove files or directories

SYNOPSIS
       rm [OPTION]... [FILE]...

DESCRIPTION
       rm removes each specified file. By default, it does not remove directories.

       -r, -R, --recursive   remove directories and their contents recursively
       -f, --force           ignore nonexistent files and arguments, never prompt`,

  cp: `CP(1)                    User Commands                    CP(1)

NAME
       cp - copy files and directories

SYNOPSIS
       cp [OPTION]... SOURCE... DIRECTORY

DESCRIPTION
       Copy SOURCE to DEST, or multiple SOURCE(s) to DIRECTORY.

       -r, -R, --recursive   copy directories recursively`,

  mv: `MV(1)                    User Commands                    MV(1)

NAME
       mv - move (rename) files

SYNOPSIS
       mv [OPTION]... SOURCE... DIRECTORY

DESCRIPTION
       Rename SOURCE to DEST, or move SOURCE(s) to DIRECTORY.`,

  cat: `CAT(1)                   User Commands                   CAT(1)

NAME
       cat - concatenate files and print on the standard output

SYNOPSIS
       cat [OPTION]... [FILE]...

DESCRIPTION
       Concatenate FILE(s) to standard output.
       -n, --number          number all output lines`,

  head: `HEAD(1)                  User Commands                  HEAD(1)

NAME
       head - output the first part of files

SYNOPSIS
       head [OPTION]... [FILE]...

DESCRIPTION
       Print the first 10 lines of each FILE to standard output.
       -n, --lines=[-]NUM    print the first NUM lines instead of the first 10`,

  tail: `TAIL(1)                  User Commands                  TAIL(1)

NAME
       tail - output the last part of files

SYNOPSIS
       tail [OPTION]... [FILE]...

DESCRIPTION
       Print the last 10 lines of each FILE to standard output.
       -n, --lines=[+]NUM    output the last NUM lines, instead of the last 10
       -f, --follow          output appended data as the file grows`,

  wc: `WC(1)                    User Commands                    WC(1)

NAME
       wc - print newline, word, and byte counts for each file

SYNOPSIS
       wc [OPTION]... [FILE]...

DESCRIPTION
       Print newline, word, and byte counts for each FILE.
       -l, --lines           print the newline counts
       -w, --words           print the word counts
       -c, --bytes           print the byte counts`,

  sort: `SORT(1)                  User Commands                  SORT(1)

NAME
       sort - sort lines of text files

SYNOPSIS
       sort [OPTION]... [FILE]...

DESCRIPTION
       Write sorted concatenation of all FILE(s) to standard output.
       -r, --reverse         reverse the result of comparisons
       -n, --numeric-sort    compare according to string numerical value
       -u, --unique          output only the first of an equal run`,

  uniq: `UNIQ(1)                  User Commands                  UNIQ(1)

NAME
       uniq - report or omit repeated lines

SYNOPSIS
       uniq [OPTION]... [INPUT [OUTPUT]]

DESCRIPTION
       Filter adjacent matching lines from INPUT to OUTPUT.
       -c, --count           prefix lines by the number of occurrences
       -d, --repeated        only print duplicate lines
       -u, --unique          only print unique lines`,

  tar: `TAR(1)                   User Commands                   TAR(1)

NAME
       tar - an archiving utility

SYNOPSIS
       tar [-] A --c --x --t [options] [file...]

DESCRIPTION
       GNU 'tar' saves many files together into a single tape or disk archive.
       -c, --create          create a new archive
       -x, --extract         extract files from an archive
       -t, --list            list the contents of an archive
       -v, --verbose         verbosely list files processed
       -z, --gzip            filter the archive through gzip
       -f, --file=ARCHIVE    use archive file or device ARCHIVE`,

  curl: `CURL(1)                  User Commands                  CURL(1)

NAME
       curl - transfer a URL

SYNOPSIS
       curl [options] [URL...]

DESCRIPTION
       curl is a tool to transfer data from or to a server using HTTP, HTTPS, FTP, etc.
       -I, --head            show document info only
       -o, --output <file>   write to file instead of stdout
       -O, --remote-name     write output to a local file named like the remote file`,

  wget: `WGET(1)                  User Commands                  WGET(1)

NAME
       wget - non-interactive network downloader

SYNOPSIS
       wget [option]... [URL]...

DESCRIPTION
       GNU Wget is a free utility for non-interactive download of files from the Web.`,

  sed: `SED(1)                   User Commands                   SED(1)

NAME
       sed - stream editor for filtering and transforming text

SYNOPSIS
       sed [OPTION]... {script-only-if-no-other-script} [input-file]...

DESCRIPTION
       Sed is a stream editor used to perform basic text transformations on an input stream.
       Example: sed 's/foo/bar/g' input.txt`,

  awk: `AWK(1)                   User Commands                   AWK(1)

NAME
       awk - pattern scanning and processing language

SYNOPSIS
       awk [options] 'script' var=value file...

DESCRIPTION
       AWK scans each input file for lines that match any of a set of patterns.
       Example: awk -F: '{print $1}' /etc/passwd`,

  ps: `PS(1)                    User Commands                    PS(1)

NAME
       ps - report a snapshot of the current processes

SYNOPSIS
       ps [options]

DESCRIPTION
       ps displays information about a selection of the active processes.
       aux                   BSD syntax: displays all processes with detailed stats`,

  top: `TOP(1)                   User Commands                   TOP(1)

NAME
       top - display Linux processes

SYNOPSIS
       top [options]

DESCRIPTION
       The top program provides a dynamic real-time view of a running system.`,

  ping: `PING(8)              System Manager's Manual              PING(8)

NAME
       ping - send ICMP ECHO_REQUEST to network hosts

SYNOPSIS
       ping [-c count] destination

DESCRIPTION
       ping uses the ICMP protocol's mandatory ECHO_REQUEST datagram to elicit an ICMP ECHO_RESPONSE.`,

  systemctl: `SYSTEMCTL(1)            System Manager's Manual            SYSTEMCTL(1)

NAME
       systemctl - Control the systemd system and service manager

SYNOPSIS
       systemctl [OPTIONS...] COMMAND [UNIT...]

DESCRIPTION
       systemctl may be used to introspect and control the state of the "systemd" system and service manager.
       Commands: status, start, stop, restart, enable, disable`,

  df: `DF(1)                    User Commands                    DF(1)

NAME
       df - report file system disk space usage

SYNOPSIS
       df [OPTION]... [FILE]...

DESCRIPTION
       df displays the amount of available disk space on file systems.
       -h, --human-readable  print sizes in powers of 1024 (e.g., 1023M)`,

  du: `DU(1)                    User Commands                    DU(1)

NAME
       du - estimate file space usage

SYNOPSIS
       du [OPTION]... [FILE]...

DESCRIPTION
       Summarize disk usage of the set of FILEs, recursively for directories.
       -s, --summarize       display only a total for each argument
       -h, --human-readable  print sizes in human readable format`,

  tee: `TEE(1)                   User Commands                   TEE(1)

NAME
       tee - read from standard input and write to standard output and files

SYNOPSIS
       tee [OPTION]... [FILE]...

DESCRIPTION
       Copy standard input to each FILE, and also to standard output.
       -a, --append          append to the given FILEs, do not overwrite`,

  nano: `NANO(1)                  User Commands                  NANO(1)

NAME
       nano - Nano's ANOther editor, an enhanced free Pico clone

SYNOPSIS
       nano [options] [[+line[,column]] file]...

DESCRIPTION
       nano is a small, free and friendly editor which aims to replace Pico.
       Shortcuts: Ctrl+S to save, Ctrl+X to exit.`,

  vim: `VIM(1)                   User Commands                   VIM(1)

NAME
       vim - Vi IMproved, a programmer's text editor

SYNOPSIS
       vim [arguments] [file ..]

DESCRIPTION
       Vim is a text editor that is upwards compatible to Vi.
       Press 'i' for Insert mode, <Esc> for Normal mode, ':wq' to write and quit.`,
};

const HELP_TEXT = `<span class="term-success">LinuxMaster Shell — Built-in Commands</span>

<span class="term-dir">Navigation:</span>
  pwd                Print working directory
  cd [dir]           Change directory
  ls [-la] [dir]     List directory contents

<span class="term-dir">File Operations:</span>
  touch file         Create empty file / update timestamp
  mkdir [-p] dir     Create directory (with parents)
  rm [-r] file       Remove file or directory
  cp [-r] src dest   Copy file or directory
  mv src dest        Move / rename file
  cat file           Display file contents
  echo text          Print text
  ln [-s] src dest   Create hard/symbolic link

<span class="term-dir">Text Processing:</span>
  head [-n N] file   First N lines         tail [-n N] file  Last N lines
  grep PATTERN file  Search for pattern    wc [-lwc] file    Count words/lines
  sort [-rn] file    Sort lines            uniq file         Remove duplicates
  cut -d D -f N      Extract fields        paste file1 file2 Merge lines
  sed 's/a/b/' file  Stream editor         awk '{print $1}'  Field extractor
  tac file           Reverse lines         rev file          Reverse chars
  nl file            Number lines          column -t file    Align columns
  tr 'a' 'b'         Translate chars       fold -w N file    Wrap lines
  strings file       Extract printable     od file           Octal dump
  xxd file           Hex dump              fmt file          Reformat text
  comm file1 file2   Compare sorted        shuf file         Shuffle lines
  split [-l] file    Split file            diff file1 file2  Compare files

<span class="term-dir">Search & Navigation:</span>
  find [path] [-name pattern] [-type f|d]    Find files
  grep [-rin] PATTERN file                   Search content
  locate filename    Find by name (database)
  whereis cmd        Locate binary + man page
  which cmd          Show full path of command
  type cmd           Show command type

<span class="term-dir">Archiving & Compression:</span>
  tar -czf arch.tar.gz files   Create gzip archive
  tar -xzf arch.tar.gz         Extract gzip archive
  tar -tf arch.tar.gz          List archive contents
  gzip file          Compress file (.gz)   gunzip file.gz   Decompress
  zip arch.zip files Zip files             unzip arch.zip   Unzip
  bzip2 file         Compress (.bz2)       xz file          Compress (.xz)

<span class="term-dir">Permissions & Ownership:</span>
  chmod MODE file    Change permissions (e.g. 755, +x)
  chown USER file    Change owner
  chown USER:GRP f   Change owner and group
  umask              Show/set file creation mask
  id [user]          Show user/group IDs
  groups [user]      List user groups

<span class="term-dir">System Info:</span>
  whoami             Current user           hostname      Machine name
  date               Date and time          uptime        System uptime
  uname -a           Kernel info            free -h       Memory usage
  lscpu              CPU details            lsblk         Block devices
  lspci              PCI devices            lsusb         USB devices
  df -h              Disk space             du -sh dir    Directory size
  stat file          Detailed file info     file file     File type

<span class="term-dir">Process Management:</span>
  ps [aux]           List processes         top / htop    Interactive monitor
  kill PID           Kill process           killall name  Kill by name
  pkill pattern      Kill by pattern        pgrep pattern Find process PID
  pstree             Process tree           lsof          Open files
  jobs               Background jobs        bg / fg       Job control
  nohup cmd          Run immune to hangup   vmstat        Virtual memory stats
  iostat             IO stats               time cmd      Time command

<span class="term-dir">System Services:</span>
  systemctl status svc   Service status     systemctl start|stop|restart svc
  service svc start      Legacy service mgmt
  journalctl             System journal      dmesg          Kernel ring buffer

<span class="term-dir">User Management:</span>
  who / w            Who is logged in      last           Login history
  su [user]          Switch user           sudo cmd       Run as root
  passwd             Change password       useradd name   Add user
  userdel name       Remove user           groupadd name  Add group

<span class="term-dir">Networking:</span>
  ping host          Test connectivity      ifconfig       Network interfaces
  ip addr            IP addresses          ip route       Routing table
  ss / netstat       Socket statistics     curl URL        HTTP request
  wget URL           Download file         dig host        DNS lookup
  nslookup host      DNS query             traceroute host Trace route
  ssh user@host      Remote login (sim)    scp src dest    Secure copy (sim)

<span class="term-dir">Package Management (simulated):</span>
  apt install pkg    Install package       apt update      Update lists
  apt remove pkg     Remove package        apt search pkg  Search packages
  yum install pkg    RPM install           dnf install pkg DNF install
  dpkg -l            List installed        rpm -qa         List RPM packages
  snap install pkg   Snap package

<span class="term-dir">Environment:</span>
  env / printenv     Show environment      export VAR=val  Set variable
  unset VAR          Unset variable        source file     Execute script
  alias name=cmd     Create alias          history         Command history
  basename path      Filename from path    dirname path    Directory part
  realpath path      Absolute path         readlink path   Symlink target

<span class="term-dir">Math & Encoding:</span>
  expr 5 + 3         Arithmetic            bc              Calculator
  seq 1 10           Sequence numbers      factor N        Prime factors
  cal [month year]   Calendar              base64 file     Encode base64
  md5sum file        MD5 checksum          sha256sum file  SHA-256 checksum

<span class="term-dir">Misc Utilities:</span>
  tee file           Write to file+stdout  xargs cmd       Build commands
  yes [str]          Repeat string         sleep N         Wait N seconds
  test -f file       Test conditions       shuf file       Shuffle lines
  od file            Octal dump            xxd file        Hex dump
  clear / reset      Clear terminal

<span class="term-dir">Pipes & Redirection:</span>
  cmd | grep text    Pipe to grep          cmd | wc -l     Count lines
  cmd > file         Redirect output       cmd >> file     Append output
  cmd | tee file     Write to file + show
  cmd | sort | uniq  Sort and deduplicate

<span class="term-dir">Editors:</span>
  nano file          Beginner-friendly editor
  vim / vi file      Vi IMproved modal editor

<span class="term-dim">Use 'man COMMAND' for detailed help. Try: man grep, man tar, man sed</span>`;

window.CommandParser = CommandParser;
