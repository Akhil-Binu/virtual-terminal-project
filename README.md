# LinuxMaster 🐧

**Interactive Linux Terminal Learning Platform** — Learn Linux commands A to Z in a real-time simulated terminal environment.

---

## 🚀 Quick Start

No build step required! Just open `index.html` in any modern browser:

```bash
# Using Python's built-in server (recommended to avoid CORS issues):
python -m http.server 8080
# Then visit: http://localhost:8080

# Or simply open the file directly:
start index.html        # Windows
open index.html         # macOS
xdg-open index.html     # Linux
```

---

## 📁 Project Structure

```
virtual-terminal-project/
├── index.html              ← Main entry point (open this)
├── css/
│   └── styles.css          ← Dracula-inspired dark theme
├── js/
│   ├── utils.js            ← Shared utilities (tokenizer, escape, storage)
│   ├── vfs.js              ← Virtual File System (in-memory Linux FS)
│   ├── commandParser.js    ← Command executor (100+ Linux commands, pipes & redirects)
│   ├── terminal.js         ← Terminal UI (keyboard, history, editor, window controls)
│   ├── curriculum.js       ← A–Z lesson data + validation logic
│   └── app.js              ← App bootstrap, cheatsheet modal & lesson manager
└── README.md
```

---

## ✨ Features

### 🖥️ Interactive Terminal Simulator
- Realistic `user@linuxmaster:~/path$` prompt
- **100+ Linux commands** implemented locally in JavaScript
- Multi-stage pipe (`|`) stream processing (grep, wc, sort, uniq, cut, awk, sed, tr, tee, bc, xargs)
- Redirection support (`>`, `>>`)
- **Context-aware Tab autocomplete** for commands, flags, paths, and pipe segments
- **↑/↓ arrow keys** for command history navigation
- **Ctrl+L** clear, **Ctrl+C** cancel, **Ctrl+U** clear line
- **Window header controls**: Clear, Copy to clipboard, and Fullscreen toggle (⛶)

### 📚 A–Z Curriculum (26 Lessons)
| Letter | Topic |
|--------|-------|
| A | Absolute & Relative Paths |
| B | Basic Navigation (pwd, ls, cd) |
| C | Creating Files & Directories |
| D | Deleting Files & Directories |
| E | Echo & Environment Variables |
| F | File Viewing (cat, head, tail) |
| G | Grep: Searching Text |
| H | History & Shell Shortcuts |
| I | Input/Output Redirection |
| J | Joining & Moving Files (cp, mv) |
| K | Kill Processes (ps, kill) |
| L | Links (Hard & Symbolic) |
| M | Man Pages & Help |
| N | Nano Text Editor |
| O | Ownership (chown, chmod) |
| P | Pipes & Pipelines |
| Q | Querying System Info |
| R | Recursion in File Operations |
| S | Searching with find |
| T | Text Processing (wc, sort, cut) |
| U | Users and Permissions |
| V | Vim Basics |
| W | Writing & Appending to Files |
| X | Executing Scripts & Permissions |
| Y | Your Shell Environment |
| Z | Zipping it All: Shell Scripting |

### 🗂️ Virtual File System
Pre-populated with a realistic Linux directory tree:
- `/bin`, `/etc`, `/home/user`, `/var/log`, `/tmp`, `/proc`, etc.
- Files: `/etc/passwd`, `/etc/hosts`, `/etc/os-release`, `~/.bashrc`, etc.
- Full support: absolute/relative paths, `.`, `..`, `~`

### 🎯 Real-Time Validation & Verification
Each lesson automatically validates your work:
- Checks VFS state (files created, paths visited)
- Inspects command history
- Interactive **"Check Work"** button gives instant diagnostic feedback
- Awards completion badge instantly upon goal fulfillment

### 💾 Progress Persistence
- Completed lessons saved to `localStorage`
- VFS state persisted across sessions
- Reset button to start fresh anytime

### 📚 Interactive Cheatsheet Modal
- Press **Ctrl+K** or **F1** or click **📚 Cheatsheet** in top bar
- Search by keyword or filter by categories (Files, Text, System, Network, Processes, Users, Archiving, Shell)
- Click any command card to instantly execute it in the terminal!

---

## ⌨️ Supported Commands (100+ Commands)

| Category | Commands |
|----------|----------|
| **Navigation** | `pwd`, `cd`, `ls` (-l, -a, -la, -1), `tree` (via find) |
| **File Operations** | `touch`, `mkdir` (-p), `rm` (-r, -f), `cp` (-r), `mv`, `cat` (-n), `echo`, `ln` (-s), `stat`, `file` |
| **Text Processing** | `head`, `tail`, `grep` (-i, -n, -r, -v, -c), `wc` (-l, -w, -c), `sort` (-r, -n, -u), `uniq`, `cut` (-d, -f), `tr`, `sed`, `awk`, `tac`, `rev`, `nl`, `column` (-t), `paste`, `fold`, `shuf`, `strings`, `diff`, `split`, `tee` |
| **Search & Location** | `find` (-name, -type), `locate`, `whereis`, `which`, `type` |
| **Archiving & Compression** | `tar` (-czf, -xzf, -tf), `gzip`, `gunzip`, `zip`, `unzip`, `bzip2`, `xz` |
| **Permissions & Users** | `chmod` (octal & symbolic), `chown`, `umask`, `id`, `groups`, `who`, `w`, `last`, `su`, `sudo`, `passwd`, `useradd`, `userdel`, `groupadd` |
| **Process Management** | `ps` (aux), `top`, `htop`, `kill`, `killall`, `pkill`, `pgrep`, `pstree`, `lsof`, `jobs`, `bg`, `fg`, `nohup`, `time`, `watch`, `crontab`, `vmstat`, `iostat` |
| **System & Hardware** | `whoami`, `date`, `uname` (-a), `hostname`, `uptime`, `free` (-h), `lscpu`, `lsblk`, `lspci`, `lsusb`, `dmesg`, `journalctl`, `systemctl`, `service`, `mount`, `umount`, `blkid`, `fdisk` (-l), `df` (-h), `du` (-sh) |
| **Networking** | `ping` (-c), `curl` (-I, -o), `wget`, `ifconfig`, `ip` (addr, route, link), `ss`, `netstat`, `dig`, `nslookup`, `host`, `traceroute`, `ssh`, `scp` |
| **Package Management** | `apt` (update, install, remove, list, search), `apt-get`, `yum`, `dnf`, `snap`, `dpkg` (-l), `rpm` (-qa) |
| **Shell & Math** | `export`, `env`, `printenv`, `unset`, `alias`, `history`, `source`, `basename`, `dirname`, `realpath`, `readlink`, `expr`, `bc`, `seq`, `factor`, `cal`, `base64` (-d), `md5sum`, `sha256sum`, `sha1sum`, `cksum`, `xargs`, `yes`, `test` |
| **Editors** | `nano` (Ctrl+S / Ctrl+X), `vim` / `vi` (Insert mode, :wq) |
| **Manual & Help** | `man` (detailed man pages for 30+ commands), `help`, `clear`, `reset` |
| **Pipes & Streams** | `\|` (multi-stage pipelines for grep, wc, sort, uniq, cut, awk, sed, tr, tee, bc, xargs), `>`, `>>` |

---

## 🎨 Tech Stack

- **Frontend**: Pure HTML5 / CSS3 / Vanilla JavaScript (no build step)
- **Fonts**: JetBrains Mono + Inter (via Google Fonts)
- **Theme**: Dracula color palette
- **Storage**: `localStorage` for VFS + progress persistence

---

## 🛠️ Extending LinuxMaster

### Adding a New Command
In `js/commandParser.js`, add a case in `_runCommand()` and implement the handler:
```javascript
case 'mycommand': return this._myCommand(flags, args);

_myCommand(flags, args) {
  return `<span class="term-success">My command output</span>`;
}
```

### Adding a New Lesson
In `js/curriculum.js`, add a new entry to the `CURRICULUM` array:
```javascript
{
  id: 'NEW',
  title: 'New Lesson Title',
  icon: '🎯',
  color: '#50fa7b',
  concept: `<h3>...</h3><p>...</p>`,
  task: 'Task description...',
  taskCommands: ['command to run'],
  hints: ['Hint 1', 'Hint 2'],
  solution: 'command1\ncommand2',
  validate: (vfs, history) => {
    return history.some(cmd => cmd.includes('expected'));
  },
  validateMessage: 'Validation description'
}
```

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

*Built with ❤️ as an open-source EdTech project.*
