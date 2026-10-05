# LinuxMaster 🐧

**Interactive Linux Terminal Learning Platform** — Master Linux commands from A to Z in a real-time, browser-based simulated terminal environment.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Zero Build Steps](https://img.shields.io/badge/Build-Zero%20Dependencies-brightgreen.svg)](#-tech-stack)
[![Commands](https://img.shields.io/badge/Commands-100%2B%20Supported-purple.svg)](#-supported-commands-100-commands)
[![Curriculum](https://img.shields.io/badge/Curriculum-A--Z%20(26%20Lessons)-blue.svg)](#-a-z-curriculum-26-lessons)

---

## 🚀 Quick Start

Zero build step or configuration required! Run locally in any modern browser:

```bash
# Using Python's built-in web server:
python -m http.server 8080
# Then visit: http://localhost:8080

# Or using Node.js:
npx serve -l 8080

# Or simply open the file directly:
start index.html        # Windows
open index.html         # macOS
xdg-open index.html     # Linux
```

---

## 📁 Project Structure

```
virtual-terminal-project/
├── index.html              ← Responsive application markup & layout
├── css/
│   └── styles.css          ← Dracula-inspired dark theme & responsive media queries
├── js/
│   ├── utils.js            ← Tokenizer, escaping, ANSI styling, date & string helpers
│   ├── vfs.js              ← Virtual File System (in-memory Linux FS, permissions, OLDPWD)
│   ├── commandParser.js    ← Command dispatcher (100+ commands, pipes, redirects, tildes)
│   ├── terminal.js         ← Terminal UI (xterm-style, key events, history, editor, resize)
│   ├── curriculum.js       ← A–Z 26 structured lessons, challenges, hints & validation
│   └── app.js              ← App bootstrap, state management, cheatsheet modal & drawer
└── README.md
```

---

## ✨ Features

### 🖥️ Interactive Terminal Simulator
- Realistic prompt (`user@linuxmaster:~/path$`) with live working directory tracking.
- **100+ Linux commands** implemented locally in Vanilla JavaScript.
- **Full Path Symbol Support**:
  - `.` (current directory), `..` (parent directory), `...` (two levels up)
  - `~` (home directory `/home/user`) with automatic argument expansion (`echo ~`, `cat ~/.bashrc`)
  - `-` (`cd -` toggles between current and previous `$OLDPWD` directories)
  - `ls -a` and `ls -la` directory listings include `.` and `..` with realistic permissions and links
- Multi-stage pipe (`|`) stream processing (`grep`, `wc`, `sort`, `uniq`, `cut`, `awk`, `sed`, `tr`, `tee`, `bc`, `xargs`).
- Input/output redirection (`>`, `>>`).
- **Context-aware Tab autocomplete** for commands, flags, paths, symbols, and pipe segments.
- **History navigation**: ↑/↓ arrow keys for command recall.
- **Terminal shortcuts**: `Ctrl+L` (clear), `Ctrl+C` (cancel), `Ctrl+U` (clear line).
- **Window header tools**: Clear output, Copy session to clipboard, and Fullscreen toggle (⛶).

### 📱 Fully Responsive Design
- **Universal compatibility**: Optimized for mobile phones, tablets, laptops, and ultra-wide monitors.
- **Mobile drawer navigation**: Toggleable sliding curriculum sidebar with backdrop blur overlay.
- **Touch-friendly controls**: Action buttons, responsive modal dialogs, and adaptive terminal heights.
- **Split-pane layout**: Desktop horizontal resizer pane dynamically converts to an ergonomic vertical layout on smaller viewports.

### 📚 A–Z Curriculum (26 Guided Modules)
| Letter | Topic | Description |
|:------:|-------|-------------|
| **A** | Absolute & Relative Paths | Path symbols (`.`, `..`, `~`, `/`, `-`), navigation & root hierarchy |
| **B** | Basic Navigation | Essential triad (`pwd`, `ls -la`, `cd`) |
| **C** | Creating Files & Directories | File creation with `touch` and directory trees with `mkdir -p` |
| **D** | Deleting Files & Directories | Safe file removal with `rm` and `rmdir` |
| **E** | Echo & Environment Variables | Outputting text, reading `$HOME`, `$USER`, `$PATH`, `$SHELL` |
| **F** | File Viewing | Inspecting files with `cat -n`, `head`, and `tail` |
| **G** | Grep: Searching Text | Pattern matching, regex, `-i`, `-n`, `-v`, `-c` flags |
| **H** | History & Shell Shortcuts | Reviewing `history` and command-line keyboard productivity |
| **I** | Input/Output Redirection | Writing (`>`) and appending (`>>`) streams to files |
| **J** | Joining & Moving Files | Copying (`cp -r`) and moving/renaming (`mv`) |
| **K** | Kill Processes | Inspecting process trees (`ps aux`, `pstree`) and signaling (`kill`) |
| **L** | Links (Hard & Symbolic) | Creating symlinks (`ln -s`) and hard links |
| **M** | Man Pages & Help | Comprehensive manual pages (`man grep`, `man tar`) and `help` |
| **N** | Nano Text Editor | In-terminal interactive modal text editor with `Ctrl+S` & `Ctrl+X` |
| **O** | Ownership & Permissions | Modifying access modes with `chmod` and owners with `chown` |
| **P** | Pipes & Pipelines | Chaining commands together (`ps aux \| grep root \| wc -l`) |
| **Q** | Querying System Info | Exploring `uname -a`, `hostname`, `uptime`, `free -h`, `df -h` |
| **R** | Recursion in File Operations | Recursive directory listing, copy, and search |
| **S** | Searching with find | Powerful filesystem searches with `find -name` and `-type` |
| **T** | Text Processing | Stream transformation with `wc`, `sort`, `uniq`, `cut`, `awk`, `sed` |
| **U** | Users and Permissions | User inspection (`whoami`, `id`, `groups`, `w`, `last`) |
| **V** | Vim Basics | Modal editing with Insert mode (`i`), Normal mode, and `:wq` |
| **W** | Writing & Appending | Structured data generation using pipes and redirection |
| **X** | Executing Scripts | File execution permissions (`chmod +x`) and script execution |
| **Y** | Your Shell Environment | Managing shell configuration with `export`, `alias`, and `source` |
| **Z** | Shell Scripting & Automation | Combining pipelines, scripts, and automation routines |

### 🗂️ Virtual File System (VFS)
- Complete in-memory directory tree: `/bin`, `/etc`, `/home/user`, `/var/log`, `/tmp`, `/proc`, `/sys`.
- Pre-populated realistic files: `/etc/passwd`, `/etc/hosts`, `/etc/os-release`, `~/.bashrc`, `/var/log/syslog`.
- Inode-like metadata: POSIX file modes (`644`, `755`), ownership (`user:user`, `root:root`), file size, and timestamps.
- Node persistence and serialization in `localStorage`.

### 🎯 Real-Time Task Validation Engine
- Automatic validation on command execution.
- Evaluates both filesystem state (directories, created files, content) and executed command history.
- Immediate diagnostic feedback with **"Check Work"**, progressive hints, and expandable solutions.
- Visual completion badges and animated progress bar tracking.

### 📚 Interactive Cheatsheet Modal
- Press **Ctrl+K**, **F1**, or click **📚 Cheatsheet** in the top navigation bar.
- Search 100+ commands by keyword or filter by domain (Files, Text, System, Network, Processes, Users, Archiving, Shell).
- Click any command card to instantly transfer and execute it in the terminal!

---

## ⌨️ Supported Commands (100+ Commands)

| Category | Commands |
|----------|----------|
| **Navigation & Paths** | `pwd`, `cd`, `cd -`, `..`, `...`, `~`, `/`, `ls` (`-l`, `-a`, `-la`, `-1`), `tree` (via find) |
| **File Operations** | `touch`, `mkdir` (`-p`), `rm` (`-r`, `-f`), `cp` (`-r`), `mv`, `cat` (`-n`), `echo`, `ln` (`-s`), `stat`, `file` |
| **Text Processing** | `head`, `tail`, `grep` (`-i`, `-n`, `-r`, `-v`, `-c`), `wc` (`-l`, `-w`, `-c`), `sort` (`-r`, `-n`, `-u`), `uniq`, `cut` (`-d`, `-f`), `tr`, `sed`, `awk`, `tac`, `rev`, `nl`, `column` (`-t`), `paste`, `fold`, `shuf`, `strings`, `diff`, `split`, `tee` |
| **Search & Discovery** | `find` (`-name`, `-type`), `locate`, `whereis`, `which`, `type` |
| **Archiving & Compression** | `tar` (`-czf`, `-xzf`, `-tf`), `gzip`, `gunzip`, `zip`, `unzip`, `bzip2`, `xz` |
| **Permissions & Users** | `chmod` (octal & symbolic), `chown`, `umask`, `id`, `groups`, `who`, `w`, `last`, `su`, `sudo`, `passwd`, `useradd`, `userdel`, `groupadd` |
| **Process Management** | `ps` (`aux`), `top`, `htop`, `kill`, `killall`, `pkill`, `pgrep`, `pstree`, `lsof`, `jobs`, `bg`, `fg`, `nohup`, `time`, `watch`, `crontab`, `vmstat`, `iostat` |
| **System & Hardware** | `whoami`, `date`, `uname` (`-a`), `hostname`, `uptime`, `free` (`-h`), `lscpu`, `lsblk`, `lspci`, `lsusb`, `dmesg`, `journalctl`, `systemctl`, `service`, `mount`, `umount`, `blkid`, `fdisk` (`-l`), `df` (`-h`), `du` (`-sh`) |
| **Networking** | `ping` (`-c`), `curl` (`-I`, `-o`), `wget`, `ifconfig`, `ip` (`addr`, `route`, `link`), `ss`, `netstat`, `dig`, `nslookup`, `host`, `traceroute`, `ssh`, `scp` |
| **Package Management** | `apt` (`update`, `install`, `remove`, `list`, `search`), `apt-get`, `yum`, `dnf`, `snap`, `dpkg` (`-l`), `rpm` (`-qa`) |
| **Shell & Math** | `export`, `env`, `printenv`, `unset`, `alias`, `history`, `source`, `.`, `basename`, `dirname`, `realpath`, `readlink`, `expr`, `bc`, `seq`, `factor`, `cal`, `base64` (`-d`), `md5sum`, `sha256sum`, `sha1sum`, `cksum`, `xargs`, `yes`, `test` |
| **In-Terminal Editors** | `nano` (`Ctrl+S` save, `Ctrl+X` exit), `vim` / `vi` (Insert mode `i`, Normal mode `<Esc>`, `:wq`) |
| **Manual & Help** | `man` (detailed manual pages for 30+ tools), `help`, `clear`, `reset` |
| **Pipes & Redirection** | `\|` (multi-command pipeline streams), `>`, `>>` |

---

## 🎨 Tech Stack

- **Core**: Vanilla ECMAScript 2022+ / HTML5 / CSS3 (zero npm packages or compiler dependencies)
- **Typography**: [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) + [Inter](https://fonts.google.com/specimen/Inter)
- **Palette**: Dark Mode / Dracula Aesthetic (`#282a36`, `#44475a`, `#50fa7b`, `#bd93f9`, `#ff79c6`, `#8be9fd`, `#ffb86c`)
- **State Storage**: Native browser `localStorage`

---

## 🛠️ Extending LinuxMaster

### Adding a New Command
In [`js/commandParser.js`](js/commandParser.js), register your command name in the `supportedCommands` list, add a case to `_runCommand()`, and implement the handler:

```javascript
case 'mycommand': return this._myCommand(flags, args);

_myCommand(flags, args) {
  return `<span class="term-success">Hello from custom command!</span>`;
}
```

### Adding a New Lesson
In [`js/curriculum.js`](js/curriculum.js), append a new module object to the `CURRICULUM` array:

```javascript
{
  id: 'NEW',
  title: 'Lesson Title',
  icon: '🚀',
  color: '#50fa7b',
  concept: `<h3>Concept Overview</h3><p>Explanation here...</p>`,
  task: 'Create directory <code>test</code> and file <code>test/sample.txt</code>.',
  taskCommands: ['mkdir test', 'touch test/sample.txt'],
  hints: ['Use mkdir to make directory.', 'Use touch to create the file.'],
  solution: 'mkdir test\ntouch test/sample.txt',
  validate: (vfs, history) => {
    return vfs.isDirectory('test') && vfs.nodeExists('test/sample.txt');
  },
  validateMessage: 'Create directory test and test/sample.txt'
}
```

---

## 📄 License

MIT License — Free to use, adapt, and distribute for personal and educational purposes.
