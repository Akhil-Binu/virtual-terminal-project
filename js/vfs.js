/**
 * vfs.js — Virtual File System for LinuxMaster
 * Implements an in-memory tree-structured filesystem with Linux semantics.
 */

class VFSNode {
  constructor(name, type = 'file', content = '', permissions = '644', owner = 'user') {
    this.name = name;
    this.type = type; // 'file' | 'dir' | 'link'
    this.content = content;
    this.permissions = permissions;
    this.owner = owner;
    this.group = 'user';
    this.children = type === 'dir' ? {} : null;
    this.createdAt = new Date();
    this.modifiedAt = new Date();
    this.size = type === 'file' ? content.length : 4096;
    this.linkTarget = null; // for symlinks
  }

  isDir() { return this.type === 'dir'; }
  isFile() { return this.type === 'file'; }
  isLink() { return this.type === 'link'; }

  updateContent(content) {
    this.content = content;
    this.size = content.length;
    this.modifiedAt = new Date();
  }

  toPermissionString() {
    const typeChar = this.isDir() ? 'd' : this.isLink() ? 'l' : '-';
    const p = this.permissions.toString();
    const map = { '0': '---', '1': '--x', '2': '-w-', '3': '-wx', '4': 'r--', '5': 'r-x', '6': 'rw-', '7': 'rwx' };
    const owner = p.length >= 3 ? (map[p[p.length - 3]] || '---') : 'rw-';
    const group = p.length >= 2 ? (map[p[p.length - 2]] || '---') : 'r--';
    const other = p.length >= 1 ? (map[p[p.length - 1]] || '---') : 'r--';
    return typeChar + owner + group + other;
  }

  formatDate() {
    const d = this.modifiedAt;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = months[d.getMonth()];
    const day = String(d.getDate()).padStart(2, ' ');
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return `${month} ${day} ${time}`;
  }

  toLsLongEntry() {
    const perm = this.toPermissionString();
    const links = this.isDir() ? Object.keys(this.children).length + 2 : 1;
    const size = String(this.size).padStart(6);
    const date = this.formatDate();
    const name = this.isLink() ? `${this.name} -> ${this.linkTarget}` : this.name;
    return `${perm} ${String(links).padStart(2)} ${this.owner.padEnd(8)} ${this.group.padEnd(8)} ${size} ${date} ${name}`;
  }
}


class VirtualFileSystem {
  constructor() {
    this._root = this._buildInitialTree();
    this._cwd = '/home/user'; // current working directory path string
    this._history = [];
    this._env = {
      HOME: '/home/user',
      USER: 'user',
      SHELL: '/bin/bash',
      PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      TERM: 'xterm-256color',
      HOSTNAME: 'linuxmaster'
    };
  }

  _buildInitialTree() {
    const root = new VFSNode('/', 'dir', '', '755', 'root');
    root.children = {};

    // Helper to recursively add nodes
    const addNode = (parent, path, type, content = '', perms = '644', owner = 'root') => {
      const parts = path.split('/').filter(Boolean);
      let current = parent;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current.children[parts[i]]) {
          current.children[parts[i]] = new VFSNode(parts[i], 'dir', '', '755', 'root');
        }
        current = current.children[parts[i]];
      }
      const name = parts[parts.length - 1];
      const node = new VFSNode(name, type, content, perms, owner);
      current.children[name] = node;
      return node;
    };

    // Build standard Linux directory hierarchy
    const dirs = [
      '/bin', '/sbin', '/etc', '/usr', '/usr/bin', '/usr/local',
      '/usr/local/bin', '/var', '/var/log', '/tmp', '/proc', '/sys',
      '/home', '/home/user', '/home/user/Documents', '/home/user/Downloads',
      '/home/user/Desktop', '/root', '/lib', '/opt', '/dev', '/mnt', '/media'
    ];
    dirs.forEach(d => addNode(root, d, 'dir', '', '755', d.startsWith('/home/user') ? 'user' : 'root'));

    // Add some realistic files
    addNode(root, '/etc/hostname', 'file', 'linuxmaster\n', '644', 'root');
    addNode(root, '/etc/passwd', 'file', 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:user:/home/user:/bin/bash\n', '644', 'root');
    addNode(root, '/etc/os-release', 'file', 'NAME="LinuxMaster OS"\nVERSION="1.0"\nID=linuxmaster\nPRETTY_NAME="LinuxMaster OS 1.0"\n', '644', 'root');
    addNode(root, '/etc/hosts', 'file', '127.0.0.1\tlocalhost\n127.0.1.1\tlinuxmaster\n::1\tlocalhost ip6-localhost\n', '644', 'root');
    addNode(root, '/etc/fstab', 'file', '# /etc/fstab: filesystem table\n/dev/sda1\t/\text4\tdefaults\t0\t1\n', '644', 'root');

    // Home directory files
    addNode(root, '/home/user/.bashrc', 'file', '# ~/.bashrc: executed by bash for non-login shells\nexport PS1="\\u@\\h:\\w\\$ "\nalias ll=\'ls -alF\'\nalias la=\'ls -A\'\nalias l=\'ls -CF\'\n', '644', 'user');
    addNode(root, '/home/user/.bash_history', 'file', 'ls\npwd\ncd Documents\nls -la\n', '600', 'user');
    addNode(root, '/home/user/.profile', 'file', '# ~/.profile: executed by login shells\nif [ -n "$BASH_VERSION" ]; then\n  if [ -f "$HOME/.bashrc" ]; then\n    . "$HOME/.bashrc"\n  fi\nfi\n', '644', 'user');
    addNode(root, '/home/user/readme.txt', 'file', 'Welcome to LinuxMaster!\n\nThis is your home directory. Feel free to explore and practice Linux commands here.\n\nHappy learning!\n', '644', 'user');

    // /var/log files
    addNode(root, '/var/log/syslog', 'file', 'Oct  4 10:00:01 linuxmaster kernel: Linux version 5.15.0\nOct  4 10:00:02 linuxmaster systemd[1]: Started System Logging Service\nOct  4 10:00:05 linuxmaster sshd[123]: Server listening on 0.0.0.0 port 22\n', '640', 'root');
    addNode(root, '/var/log/auth.log', 'file', 'Oct  4 10:00:10 linuxmaster sshd[123]: Accepted password for user from 127.0.0.1\n', '640', 'root');

    // /tmp files
    addNode(root, '/tmp/tempfile.txt', 'file', 'This is a temporary file.\n', '644', 'user');

    // /proc (simulated)
    addNode(root, '/proc/version', 'file', 'Linux version 5.15.0-linuxmaster (user@linuxmaster) (gcc 11.2.0) #1 SMP\n', '444', 'root');
    addNode(root, '/proc/uptime', 'file', '1234.56 5678.90\n', '444', 'root');
    addNode(root, '/proc/cpuinfo', 'file', 'processor\t: 0\nvendor_id\t: GenuineIntel\nmodel name\t: Intel(R) Core(TM) i7 CPU @ 2.80GHz\ncpu MHz\t\t: 2800.000\ncache size\t: 8192 KB\n', '444', 'root');
    addNode(root, '/proc/meminfo', 'file', 'MemTotal:\t 8192000 kB\nMemFree:\t  4096000 kB\nMemAvailable:\t 6000000 kB\nSwapTotal:\t 2097152 kB\nSwapFree:\t  2097152 kB\n', '444', 'root');

    return root;
  }

  // ── Path Resolution ──────────────────────────────────────────────────────────

  resolvePath(inputPath) {
    if (!inputPath || inputPath === '') inputPath = this._cwd;

    let path;
    if (inputPath.startsWith('/')) {
      path = inputPath;
    } else if (inputPath.startsWith('~')) {
      path = inputPath.replace('~', this._env.HOME);
    } else {
      path = this._cwd + '/' + inputPath;
    }

    // Normalize: resolve . and ..
    const parts = path.split('/').filter(Boolean);
    const resolved = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') { resolved.pop(); }
      else { resolved.push(part); }
    }
    return '/' + resolved.join('/');
  }

  _getNode(absPath) {
    if (absPath === '/') return this._root;
    const parts = absPath.split('/').filter(Boolean);
    let node = this._root;
    for (const part of parts) {
      if (!node.isDir() || !node.children[part]) return null;
      node = node.children[part];
    }
    return node;
  }

  _getParentAndName(absPath) {
    const parts = absPath.split('/').filter(Boolean);
    if (parts.length === 0) return { parent: null, name: '' };
    const name = parts.pop();
    const parentPath = '/' + parts.join('/');
    const parent = this._getNode(parentPath || '/');
    return { parent, name };
  }

  // ── Directory Operations ─────────────────────────────────────────────────────

  pwd() { return this._cwd; }

  cd(target) {
    if (!target || target === '~') {
      this._cwd = this._env.HOME;
      return { success: true };
    }
    const abs = this.resolvePath(target);
    const node = this._getNode(abs);
    if (!node) return { success: false, error: `cd: ${target}: No such file or directory` };
    if (!node.isDir()) return { success: false, error: `cd: ${target}: Not a directory` };
    this._cwd = abs === '' ? '/' : abs;
    return { success: true };
  }

  ls(target = '', flags = {}) {
    const abs = this.resolvePath(target || this._cwd);
    const node = this._getNode(abs);

    if (!node) return { success: false, error: `ls: cannot access '${target}': No such file or directory` };

    if (node.isFile()) {
      return { success: true, entries: [node], isDir: false };
    }

    let entries = Object.values(node.children);
    if (!flags.a) {
      entries = entries.filter(e => !e.name.startsWith('.'));
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return { success: true, entries, isDir: true };
  }

  mkdir(path, makeParents = false) {
    const abs = this.resolvePath(path);

    if (makeParents) {
      const parts = abs.split('/').filter(Boolean);
      let current = this._root;
      let currentPath = '';
      for (const part of parts) {
        currentPath += '/' + part;
        if (!current.children[part]) {
          const newDir = new VFSNode(part, 'dir', '', '755', this._env.USER);
          current.children[part] = newDir;
        }
        current = current.children[part];
        if (!current.isDir()) return { success: false, error: `mkdir: cannot create directory '${path}': Not a directory` };
      }
      return { success: true };
    }

    const { parent, name } = this._getParentAndName(abs);
    if (!parent) return { success: false, error: `mkdir: cannot create directory '${path}': No such file or directory` };
    if (!parent.isDir()) return { success: false, error: `mkdir: cannot create directory '${path}': Not a directory` };
    if (parent.children[name]) return { success: false, error: `mkdir: cannot create directory '${path}': File exists` };

    parent.children[name] = new VFSNode(name, 'dir', '', '755', this._env.USER);
    parent.modifiedAt = new Date();
    return { success: true };
  }

  rmdir(path) {
    const abs = this.resolvePath(path);
    const { parent, name } = this._getParentAndName(abs);
    const node = this._getNode(abs);

    if (!node) return { success: false, error: `rmdir: failed to remove '${path}': No such file or directory` };
    if (!node.isDir()) return { success: false, error: `rmdir: failed to remove '${path}': Not a directory` };
    if (Object.keys(node.children).length > 0) return { success: false, error: `rmdir: failed to remove '${path}': Directory not empty` };
    if (!parent) return { success: false, error: `rmdir: failed to remove '${path}': Permission denied` };

    delete parent.children[name];
    return { success: true };
  }

  // ── File Operations ──────────────────────────────────────────────────────────

  touch(path) {
    const abs = this.resolvePath(path);
    const { parent, name } = this._getParentAndName(abs);
    if (!parent) return { success: false, error: `touch: cannot touch '${path}': No such file or directory` };
    if (!parent.isDir()) return { success: false, error: `touch: cannot touch '${path}': Not a directory` };

    if (parent.children[name]) {
      parent.children[name].modifiedAt = new Date();
    } else {
      parent.children[name] = new VFSNode(name, 'file', '', '644', this._env.USER);
    }
    return { success: true };
  }

  rm(path, flags = {}) {
    const abs = this.resolvePath(path);
    const node = this._getNode(abs);
    const { parent, name } = this._getParentAndName(abs);

    if (!node) return { success: false, error: `rm: cannot remove '${path}': No such file or directory` };
    if (!parent) return { success: false, error: `rm: cannot remove '${path}': Permission denied` };

    if (node.isDir()) {
      if (!flags.r && !flags.R) return { success: false, error: `rm: cannot remove '${path}': Is a directory` };
    }

    delete parent.children[name];
    return { success: true };
  }

  cat(path) {
    const abs = this.resolvePath(path);
    const node = this._getNode(abs);
    if (!node) return { success: false, error: `cat: ${path}: No such file or directory` };
    if (node.isDir()) return { success: false, error: `cat: ${path}: Is a directory` };
    return { success: true, content: node.content };
  }

  writeFile(path, content, append = false) {
    const abs = this.resolvePath(path);
    const { parent, name } = this._getParentAndName(abs);
    if (!parent) return { success: false, error: `bash: ${path}: No such file or directory` };
    if (!parent.isDir()) return { success: false, error: `bash: ${path}: Not a directory` };

    if (parent.children[name]) {
      const node = parent.children[name];
      if (node.isDir()) return { success: false, error: `bash: ${path}: Is a directory` };
      node.updateContent(append ? node.content + content : content);
    } else {
      parent.children[name] = new VFSNode(name, 'file', content, '644', this._env.USER);
    }
    return { success: true };
  }

  cp(src, dest, flags = {}) {
    const srcAbs = this.resolvePath(src);
    const srcNode = this._getNode(srcAbs);
    if (!srcNode) return { success: false, error: `cp: ${src}: No such file or directory` };
    if (srcNode.isDir() && !flags.r && !flags.R) {
      return { success: false, error: `cp: -r not specified; omitting directory '${src}'` };
    }

    let destAbs = this.resolvePath(dest);
    const destNode = this._getNode(destAbs);

    if (destNode && destNode.isDir()) {
      destAbs = destAbs.replace(/\/$/, '') + '/' + srcNode.name;
    }

    const { parent: destParent, name: destName } = this._getParentAndName(destAbs);
    if (!destParent) return { success: false, error: `cp: cannot create regular file '${dest}': No such file or directory` };

    const deepCopy = (node, newName) => {
      const copy = new VFSNode(newName, node.type, node.content, node.permissions, this._env.USER);
      if (node.isDir()) {
        copy.children = {};
        for (const [childName, childNode] of Object.entries(node.children)) {
          copy.children[childName] = deepCopy(childNode, childName);
        }
      }
      return copy;
    };

    destParent.children[destName] = deepCopy(srcNode, destName);
    return { success: true };
  }

  mv(src, dest) {
    const srcAbs = this.resolvePath(src);
    const srcNode = this._getNode(srcAbs);
    if (!srcNode) return { success: false, error: `mv: cannot stat '${src}': No such file or directory` };

    let destAbs = this.resolvePath(dest);
    const destNode = this._getNode(destAbs);

    if (destNode && destNode.isDir()) {
      destAbs = destAbs.replace(/\/$/, '') + '/' + srcNode.name;
    }

    const { parent: srcParent, name: srcName } = this._getParentAndName(srcAbs);
    const { parent: destParent, name: destName } = this._getParentAndName(destAbs);

    if (!destParent) return { success: false, error: `mv: cannot move '${src}' to '${dest}': No such file or directory` };

    srcNode.name = destName;
    srcNode.modifiedAt = new Date();
    destParent.children[destName] = srcNode;
    delete srcParent.children[srcName];
    return { success: true };
  }

  // ── Search Operations ─────────────────────────────────────────────────────────

  find(startPath, options = {}) {
    const abs = this.resolvePath(startPath);
    const startNode = this._getNode(abs);
    if (!startNode) return { success: false, error: `find: '${startPath}': No such file or directory` };

    const results = [];
    const traverse = (node, path) => {
      // Apply name filter
      if (options.name) {
        const pattern = options.name.replace('*', '.*').replace('?', '.');
        const regex = new RegExp('^' + pattern + '$');
        if (regex.test(node.name)) results.push(path);
      } else if (options.type) {
        if (options.type === 'f' && node.isFile()) results.push(path);
        else if (options.type === 'd' && node.isDir()) results.push(path);
      } else {
        results.push(path);
      }

      if (node.isDir()) {
        for (const [name, child] of Object.entries(node.children)) {
          traverse(child, path === '/' ? `/${name}` : `${path}/${name}`);
        }
      }
    };

    traverse(startNode, abs);
    return { success: true, results };
  }

  grep(pattern, path, flags = {}) {
    const abs = this.resolvePath(path);
    const node = this._getNode(abs);
    if (!node) return { success: false, error: `grep: ${path}: No such file or directory` };
    if (node.isDir()) return { success: false, error: `grep: ${path}: Is a directory` };

    const lines = node.content.split('\n');
    const regex = flags.i ? new RegExp(pattern, 'i') : new RegExp(pattern);
    const matches = [];
    lines.forEach((line, i) => {
      if (regex.test(line)) {
        if (flags.n) matches.push(`${i + 1}:${line}`);
        else matches.push(line);
      }
    });

    return { success: true, matches, hasMatches: matches.length > 0 };
  }

  // ── Permission Operations ────────────────────────────────────────────────────

  chmod(path, mode) {
    const abs = this.resolvePath(path);
    const node = this._getNode(abs);
    if (!node) return { success: false, error: `chmod: cannot access '${path}': No such file or directory` };
    node.permissions = mode.toString();
    node.modifiedAt = new Date();
    return { success: true };
  }

  chown(path, owner, group) {
    const abs = this.resolvePath(path);
    const node = this._getNode(abs);
    if (!node) return { success: false, error: `chown: cannot access '${path}': No such file or directory` };
    if (owner) node.owner = owner;
    if (group) node.group = group;
    node.modifiedAt = new Date();
    return { success: true };
  }

  // ── Text Processing ──────────────────────────────────────────────────────────

  head(path, lines = 10) {
    const result = this.cat(path);
    if (!result.success) return result;
    const lineArr = result.content.split('\n');
    return { success: true, content: lineArr.slice(0, lines).join('\n') };
  }

  tail(path, lines = 10) {
    const result = this.cat(path);
    if (!result.success) return result;
    const lineArr = result.content.split('\n');
    return { success: true, content: lineArr.slice(-lines).join('\n') };
  }

  wc(path, flags = {}) {
    const result = this.cat(path);
    if (!result.success) return result;
    const content = result.content;
    const lines = content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const chars = content.length;
    const bytes = new Blob([content]).size;

    if (flags.l) return { success: true, output: `${String(lines).padStart(7)} ${path}` };
    if (flags.w) return { success: true, output: `${String(words).padStart(7)} ${path}` };
    if (flags.c) return { success: true, output: `${String(bytes).padStart(7)} ${path}` };
    return { success: true, output: `${String(lines).padStart(7)} ${String(words).padStart(7)} ${String(bytes).padStart(7)} ${path}` };
  }

  // ── State Persistence ────────────────────────────────────────────────────────

  serialize() {
    const serializeNode = (node) => ({
      name: node.name, type: node.type, content: node.content,
      permissions: node.permissions, owner: node.owner, group: node.group,
      createdAt: node.createdAt.toISOString(), modifiedAt: node.modifiedAt.toISOString(),
      size: node.size, linkTarget: node.linkTarget,
      children: node.isDir() ? Object.fromEntries(
        Object.entries(node.children).map(([k, v]) => [k, serializeNode(v)])
      ) : null
    });
    return JSON.stringify({ root: serializeNode(this._root), cwd: this._cwd });
  }

  static deserialize(json) {
    const data = JSON.parse(json);
    const vfs = new VirtualFileSystem();

    const deserializeNode = (obj) => {
      const node = new VFSNode(obj.name, obj.type, obj.content, obj.permissions, obj.owner);
      node.group = obj.group;
      node.createdAt = new Date(obj.createdAt);
      node.modifiedAt = new Date(obj.modifiedAt);
      node.size = obj.size;
      node.linkTarget = obj.linkTarget;
      node.children = obj.type === 'dir'
        ? Object.fromEntries(Object.entries(obj.children).map(([k, v]) => [k, deserializeNode(v)]))
        : null;
      return node;
    };

    vfs._root = deserializeNode(data.root);
    vfs._cwd = data.cwd;
    return vfs;
  }

  // ── Utility ──────────────────────────────────────────────────────────────────

  getPromptPath() {
    const home = this._env.HOME;
    if (this._cwd === home) return '~';
    if (this._cwd.startsWith(home + '/')) return '~' + this._cwd.slice(home.length);
    return this._cwd;
  }

  listCompletions(partial) {
    // Return tab completion suggestions for a partial path
    let dir, prefix;
    const lastSlash = partial.lastIndexOf('/');
    if (lastSlash === -1) {
      dir = this._cwd;
      prefix = partial;
    } else {
      dir = this.resolvePath(partial.slice(0, lastSlash) || '/');
      prefix = partial.slice(lastSlash + 1);
    }

    const node = this._getNode(dir);
    if (!node || !node.isDir()) return [];

    return Object.keys(node.children)
      .filter(n => n.startsWith(prefix))
      .map(n => {
        const child = node.children[n];
        return lastSlash === -1 ? (child.isDir() ? n + '/' : n) : partial.slice(0, lastSlash + 1) + (child.isDir() ? n + '/' : n);
      });
  }

  nodeExists(path) {
    const abs = this.resolvePath(path);
    return this._getNode(abs) !== null;
  }

  isDirectory(path) {
    const abs = this.resolvePath(path);
    const node = this._getNode(abs);
    return node !== null && node.isDir();
  }

  getEnv(key) { return this._env[key]; }
  setEnv(key, value) { this._env[key] = value; }
}

// Export for use in other modules
window.VirtualFileSystem = VirtualFileSystem;
window.VFSNode = VFSNode;
