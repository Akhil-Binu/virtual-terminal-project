/**
 * app.js — Main application bootstrap for LinuxMaster
 * Wires all modules together, manages UI state, lesson flow, and localStorage persistence.
 */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let vfs, parser, terminal;
  let currentLesson = null;
  let completedLessons = new Set();
  let commandHistory = [];

  // ── Initialization ─────────────────────────────────────────────────────────

  function init() {
    // Load saved progress
    const savedProgress = Utils.loadFromStorage('lm_progress', []);
    completedLessons = new Set(savedProgress);

    // Initialize VFS (try to restore from storage)
    const savedVFS = Utils.loadFromStorage('lm_vfs', null);
    try {
      vfs = savedVFS ? VirtualFileSystem.deserialize(savedVFS) : new VirtualFileSystem();
    } catch (e) {
      vfs = new VirtualFileSystem();
    }

    // Initialize terminal
    const terminalPane = document.getElementById('terminal-pane');
    terminal = new Terminal(terminalPane, vfs, null); // parser set after

    // Initialize command parser
    parser = new CommandParser(vfs, terminal);
    terminal.parser = parser;

    // Listen for commands to run validation
    terminal.onCommand(onCommandExecuted);

    // Build curriculum sidebar
    buildSidebar();
    updateProgressBar();

    // Auto-select first incomplete lesson or lesson A
    const firstIncomplete = CURRICULUM.find(l => !completedLessons.has(l.id));
    if (firstIncomplete) selectLesson(firstIncomplete.id);
    else selectLesson('A');

    // Persist VFS periodically
    setInterval(saveState, 10000);

    // Handle panel resize
    initResizer();

    // Initialize command cheatsheet modal
    initCheatsheetModal();

    // Mobile sidebar toggle
    document.getElementById('sidebar-toggle')?.addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
  }

  // ── Sidebar & Lessons ──────────────────────────────────────────────────────

  function buildSidebar() {
    const list = document.getElementById('lesson-list');
    list.innerHTML = '';

    CURRICULUM.forEach((lesson) => {
      const isComplete = completedLessons.has(lesson.id);
      const li = document.createElement('li');
      li.className = `lesson-item${isComplete ? ' completed' : ''}`;
      li.dataset.lessonId = lesson.id;
      li.innerHTML = `
        <span class="lesson-icon">${lesson.icon}</span>
        <span class="lesson-label">${lesson.title}</span>
        ${isComplete ? '<span class="lesson-check">✓</span>' : ''}
      `;
      li.style.setProperty('--lesson-color', lesson.color);
      li.addEventListener('click', () => selectLesson(lesson.id));
      list.appendChild(li);
    });
  }

  function selectLesson(id) {
    currentLesson = CURRICULUM.find(l => l.id === id);
    if (!currentLesson) return;

    // Update sidebar active state
    document.querySelectorAll('.lesson-item').forEach(el => {
      el.classList.toggle('active', el.dataset.lessonId === id);
    });

    // Render lesson content
    renderLessonPanel(currentLesson);

    // Close sidebar on mobile
    if (window.innerWidth < 768) closeSidebar();
  }

  function renderLessonPanel(lesson) {
    const panel = document.getElementById('lesson-panel');
    const isComplete = completedLessons.has(lesson.id);

    panel.innerHTML = `
      <div class="lesson-header" style="border-left-color:${lesson.color}">
        <div class="lesson-header-top">
          <span class="lesson-header-icon">${lesson.icon}</span>
          <h2 class="lesson-title">${lesson.title}</h2>
          ${isComplete ? '<span class="badge-complete">✓ Completed</span>' : ''}
        </div>
      </div>

      <div class="lesson-concept">
        ${lesson.concept}
      </div>

      <div class="lesson-task-box" style="border-color:${lesson.color}40">
        <div class="task-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${lesson.color}" stroke-width="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
          Task
        </div>
        <p class="task-text">${lesson.task}</p>
        <div id="validation-result" class="validation-result hidden"></div>
      </div>

      <div class="lesson-actions">
        <button class="btn btn-check" id="btn-check" style="background:#50fa7b20;border-color:#50fa7b60;color:#50fa7b">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Check Work
        </button>
        <button class="btn btn-hint" id="btn-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          Hint
        </button>
        <button class="btn btn-solution" id="btn-solution">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          Solution
        </button>
        <button class="btn btn-run" id="btn-run" style="background:${lesson.color}20;border-color:${lesson.color}60;color:${lesson.color}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          Run Example
        </button>
        ${isComplete ? '' : `<button class="btn btn-next" id="btn-next" style="background:${lesson.color}20;border-color:${lesson.color}60;color:${lesson.color}" disabled>
          Next Lesson →
        </button>`}
        ${isComplete ? `<button class="btn btn-next" id="btn-next" style="background:${lesson.color};color:#282a36">
          Next Lesson →
        </button>` : ''}
      </div>

      <div id="hint-box" class="hint-box hidden"></div>
      <div id="solution-box" class="solution-box hidden"></div>
    `;

    // Bind action buttons
    document.getElementById('btn-check')?.addEventListener('click', () => {
      const resultBox = document.getElementById('validation-result');
      if (!resultBox) return;
      resultBox.classList.remove('hidden');
      try {
        const passed = lesson.validate(vfs, commandHistory);
        if (passed) {
          resultBox.className = 'validation-result success';
          resultBox.innerHTML = `✓ Great job! Challenge requirement met.`;
          markLessonComplete(lesson.id);
        } else {
          resultBox.className = 'validation-result error';
          resultBox.innerHTML = `⏳ Incomplete: ${lesson.validateMessage || 'Task objectives not yet fulfilled.'} Keep trying!`;
        }
      } catch (err) {
        resultBox.className = 'validation-result error';
        resultBox.innerHTML = `Error checking task: ${err.message}`;
      }
    });

    let hintIndex = 0;
    document.getElementById('btn-hint').addEventListener('click', () => {
      const hintBox = document.getElementById('hint-box');
      hintBox.classList.remove('hidden');
      hintBox.innerHTML = `
        <div class="hint-header">💡 Hint ${hintIndex + 1} of ${lesson.hints.length}</div>
        <p>${lesson.hints[hintIndex]}</p>
        ${hintIndex < lesson.hints.length - 1 ? '<span style="color:#6272a4;font-size:0.8em">Click again for next hint</span>' : ''}
      `;
      hintIndex = (hintIndex + 1) % lesson.hints.length;
    });

    document.getElementById('btn-solution').addEventListener('click', () => {
      const solutionBox = document.getElementById('solution-box');
      const isVisible = !solutionBox.classList.contains('hidden');
      if (isVisible) {
        solutionBox.classList.add('hidden');
      } else {
        solutionBox.classList.remove('hidden');
        solutionBox.innerHTML = `
          <div class="solution-header">📋 Solution</div>
          <pre class="solution-code">${Utils.escapeHtml(lesson.solution)}</pre>
          <button class="btn btn-copy-solution" onclick="copyToTerminal('${encodeURIComponent(lesson.solution)}')">
            ▶ Run in Terminal
          </button>
        `;
      }
    });

    document.getElementById('btn-run')?.addEventListener('click', () => {
      const firstCmd = lesson.taskCommands[0];
      if (firstCmd) terminal.runCommand(firstCmd);
    });

    document.getElementById('btn-next')?.addEventListener('click', () => {
      const currentIdx = CURRICULUM.findIndex(l => l.id === lesson.id);
      if (currentIdx < CURRICULUM.length - 1) {
        selectLesson(CURRICULUM[currentIdx + 1].id);
      }
    });
  }

  // ── Command Validation ────────────────────────────────────────────────────

  function onCommandExecuted(cmd, vfsInstance) {
    commandHistory.push(cmd);
    saveState();

    if (!currentLesson) return;
    if (completedLessons.has(currentLesson.id)) return;

    // Run validation
    try {
      const passed = currentLesson.validate(vfsInstance, commandHistory);
      if (passed) {
        const resultBox = document.getElementById('validation-result');
        if (resultBox) {
          resultBox.classList.remove('hidden');
          resultBox.className = 'validation-result success';
          resultBox.innerHTML = `✓ Challenge objective completed!`;
        }
        markLessonComplete(currentLesson.id);
      }
    } catch (e) {
      // Validation errors are non-fatal
    }
  }

  function markLessonComplete(id) {
    if (completedLessons.has(id)) return;
    completedLessons.add(id);

    // Show completion in terminal
    terminal.appendHTML(`
      <div class="completion-banner">
        🎉 <span style="color:#50fa7b;font-weight:bold">Lesson ${id} Complete!</span>
        <span style="color:#f1fa8c"> Keep going! Select the next lesson from the sidebar.</span>
      </div>
    `);

    // Update sidebar
    const lessonEl = document.querySelector(`.lesson-item[data-lesson-id="${id}"]`);
    if (lessonEl) {
      lessonEl.classList.add('completed');
      if (!lessonEl.querySelector('.lesson-check')) {
        lessonEl.insertAdjacentHTML('beforeend', '<span class="lesson-check">✓</span>');
      }
    }

    // Update lesson panel
    renderLessonPanel(currentLesson);

    // Update progress
    updateProgressBar();
    saveState();
  }

  function updateProgressBar() {
    const pct = Math.round((completedLessons.size / CURRICULUM.length) * 100);
    const bar = document.getElementById('progress-bar-fill');
    const label = document.getElementById('progress-label');
    if (bar) bar.style.width = pct + '%';
    if (label) label.textContent = `${completedLessons.size} / ${CURRICULUM.length} Lessons`;

    // Animate color
    if (bar) {
      if (pct < 30) bar.style.background = '#ff5555';
      else if (pct < 60) bar.style.background = '#ffb86c';
      else if (pct < 90) bar.style.background = '#f1fa8c';
      else bar.style.background = '#50fa7b';
    }
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  function saveState() {
    Utils.saveToStorage('lm_progress', [...completedLessons]);
    try { Utils.saveToStorage('lm_vfs', vfs.serialize()); } catch (e) {}
  }

  // ── Layout Resizer ─────────────────────────────────────────────────────────

  function initResizer() {
    const resizer = document.getElementById('panel-resizer');
    const sidebar = document.getElementById('sidebar');
    if (!resizer || !sidebar) return;

    let isResizing = false;
    let startX = 0, startWidth = 0;

    const startDrag = (clientX) => {
      if (window.innerWidth <= 768) return;
      isResizing = true;
      startX = clientX;
      startWidth = sidebar.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    const dragMove = (clientX) => {
      if (!isResizing) return;
      const dx = clientX - startX;
      const newWidth = Math.max(200, Math.min(480, startWidth + dx));
      sidebar.style.width = newWidth + 'px';
    };

    const endDrag = () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    resizer.addEventListener('mousedown', (e) => startDrag(e.clientX));
    document.addEventListener('mousemove', (e) => dragMove(e.clientX));
    document.addEventListener('mouseup', endDrag);

    resizer.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) startDrag(e.touches[0].clientX);
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) dragMove(e.touches[0].clientX);
    }, { passive: true });
    document.addEventListener('touchend', endDrag);
  }

  // ── Sidebar Mobile ─────────────────────────────────────────────────────────

  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('sidebar-open');
    overlay.classList.toggle('hidden');
  }

  function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.remove('sidebar-open');
    overlay.classList.add('hidden');
  }

  // ── Command Cheatsheet Modal ───────────────────────────────────────────────

  const CHEATSHEET_DATA = [
    // Files & Dirs
    { name: 'ls', cat: 'files', desc: 'List directory contents', example: 'ls -la' },
    { name: 'cd', cat: 'files', desc: 'Change working directory', example: 'cd /home/user/Documents' },
    { name: 'pwd', cat: 'files', desc: 'Print working directory', example: 'pwd' },
    { name: 'mkdir', cat: 'files', desc: 'Create directory (with parents)', example: 'mkdir -p project/src' },
    { name: 'rmdir', cat: 'files', desc: 'Remove empty directories', example: 'rmdir old_folder' },
    { name: 'touch', cat: 'files', desc: 'Create empty file or update timestamp', example: 'touch notes.txt' },
    { name: 'rm', cat: 'files', desc: 'Remove files or directories', example: 'rm -r project_backup' },
    { name: 'cp', cat: 'files', desc: 'Copy files or directories', example: 'cp -r src/ backup/' },
    { name: 'mv', cat: 'files', desc: 'Move or rename files', example: 'mv file.txt new_name.txt' },
    { name: 'find', cat: 'files', desc: 'Search for files in a directory tree', example: 'find . -name "*.txt"' },
    { name: 'stat', cat: 'files', desc: 'Display detailed file/filesystem status', example: 'stat /etc/passwd' },
    { name: 'file', cat: 'files', desc: 'Determine file type', example: 'file script.sh' },
    { name: 'ln', cat: 'files', desc: 'Make links between files (symbolic: -s)', example: 'ln -s /etc/hosts hosts_link' },
    { name: 'du', cat: 'files', desc: 'Estimate file space usage', example: 'du -sh /home/user' },
    { name: 'df', cat: 'files', desc: 'Report file system disk space usage', example: 'df -h' },

    // Text Processing
    { name: 'cat', cat: 'text', desc: 'Concatenate and display file content', example: 'cat /etc/os-release' },
    { name: 'head', cat: 'text', desc: 'Output the first lines of files', example: 'head -n 5 /etc/passwd' },
    { name: 'tail', cat: 'text', desc: 'Output the last lines of files', example: 'tail -n 5 /var/log/syslog' },
    { name: 'wc', cat: 'text', desc: 'Print newline, word, and byte counts', example: 'wc -l /etc/passwd' },
    { name: 'grep', cat: 'text', desc: 'Print lines that match patterns', example: 'grep -in "root" /etc/passwd' },
    { name: 'sort', cat: 'text', desc: 'Sort lines of text files', example: 'sort -r names.txt' },
    { name: 'uniq', cat: 'text', desc: 'Report or omit repeated lines', example: 'cat list.txt | sort | uniq' },
    { name: 'cut', cat: 'text', desc: 'Remove sections from each line of files', example: 'cut -d: -f1 /etc/passwd' },
    { name: 'tr', cat: 'text', desc: 'Translate or delete characters', example: 'cat text.txt | tr "a-z" "A-Z"' },
    { name: 'sed', cat: 'text', desc: 'Stream editor for filtering and transforming', example: 'sed "s/linux/Linux/g" readme.txt' },
    { name: 'awk', cat: 'text', desc: 'Pattern scanning and processing language', example: 'awk -F: "{print $1,$3}" /etc/passwd' },
    { name: 'tac', cat: 'text', desc: 'Concatenate and print files in reverse', example: 'tac /etc/hosts' },
    { name: 'rev', cat: 'text', desc: 'Reverse lines characterwise', example: 'echo "hello" | rev' },
    { name: 'nl', cat: 'text', desc: 'Number lines of files', example: 'nl /etc/os-release' },
    { name: 'column', cat: 'text', desc: 'Columnate lists (-t for table)', example: 'column -t /etc/passwd' },
    { name: 'paste', cat: 'text', desc: 'Merge lines of files', example: 'paste file1.txt file2.txt' },
    { name: 'strings', cat: 'text', desc: 'Print printable character sequences', example: 'strings /bin/bash' },
    { name: 'diff', cat: 'text', desc: 'Compare files line by line', example: 'diff file1.txt file2.txt' },
    { name: 'tee', cat: 'text', desc: 'Read from stdin and write to stdout & files', example: 'ls -la | tee listing.txt' },
    { name: 'fold', cat: 'text', desc: 'Wrap each input line to fit in width', example: 'fold -w 40 text.txt' },
    { name: 'shuf', cat: 'text', desc: 'Generate random permutations', example: 'shuf list.txt' },

    // System & Hardware
    { name: 'whoami', cat: 'sys', desc: 'Print effective user name', example: 'whoami' },
    { name: 'date', cat: 'sys', desc: 'Display or set system date and time', example: 'date' },
    { name: 'uname', cat: 'sys', desc: 'Print system information', example: 'uname -a' },
    { name: 'hostname', cat: 'sys', desc: 'Show or set the system host name', example: 'hostname' },
    { name: 'uptime', cat: 'sys', desc: 'Tell how long the system has been running', example: 'uptime' },
    { name: 'free', cat: 'sys', desc: 'Display amount of free and used memory', example: 'free -h' },
    { name: 'lscpu', cat: 'sys', desc: 'Display CPU architecture information', example: 'lscpu' },
    { name: 'lsblk', cat: 'sys', desc: 'List information about block devices', example: 'lsblk' },
    { name: 'lspci', cat: 'sys', desc: 'List all PCI devices', example: 'lspci' },
    { name: 'lsusb', cat: 'sys', desc: 'List USB devices', example: 'lsusb' },
    { name: 'dmesg', cat: 'sys', desc: 'Print or control the kernel ring buffer', example: 'dmesg | head -10' },
    { name: 'journalctl', cat: 'sys', desc: 'Query the systemd journal', example: 'journalctl' },
    { name: 'systemctl', cat: 'sys', desc: 'Control systemd services', example: 'systemctl status sshd' },
    { name: 'mount', cat: 'sys', desc: 'Mount a filesystem or list mounts', example: 'mount' },
    { name: 'fdisk', cat: 'sys', desc: 'Manipulate disk partition table', example: 'fdisk -l' },

    // Networking
    { name: 'ping', cat: 'net', desc: 'Send ICMP ECHO_REQUEST to network hosts', example: 'ping google.com -c 4' },
    { name: 'curl', cat: 'net', desc: 'Transfer data from or to a server', example: 'curl -I https://example.com' },
    { name: 'wget', cat: 'net', desc: 'The non-interactive network downloader', example: 'wget https://example.com/file.tar.gz' },
    { name: 'ifconfig', cat: 'net', desc: 'Configure network interface parameters', example: 'ifconfig' },
    { name: 'ip', cat: 'net', desc: 'Show / manipulate routing, network devices', example: 'ip addr' },
    { name: 'ss', cat: 'net', desc: 'Investigate sockets', example: 'ss -tulpn' },
    { name: 'netstat', cat: 'net', desc: 'Print network connections and routing tables', example: 'netstat -tuln' },
    { name: 'dig', cat: 'net', desc: 'DNS lookup utility', example: 'dig google.com' },
    { name: 'nslookup', cat: 'net', desc: 'Query Internet name servers interactively', example: 'nslookup google.com' },
    { name: 'host', cat: 'net', desc: 'DNS lookup utility', example: 'host example.com' },
    { name: 'traceroute', cat: 'net', desc: 'Print the route packets trace to host', example: 'traceroute 8.8.8.8' },
    { name: 'ssh', cat: 'net', desc: 'OpenSSH remote login client (simulated)', example: 'ssh user@remote' },
    { name: 'scp', cat: 'net', desc: 'Secure copy over SSH (simulated)', example: 'scp file.txt remote:~/backup/' },

    // Processes
    { name: 'ps', cat: 'proc', desc: 'Report a snapshot of the current processes', example: 'ps aux' },
    { name: 'top', cat: 'proc', desc: 'Display Linux processes in real time', example: 'top' },
    { name: 'kill', cat: 'proc', desc: 'Send a signal to a process (PID)', example: 'kill 1024' },
    { name: 'killall', cat: 'proc', desc: 'Kill processes by name', example: 'killall node' },
    { name: 'pkill', cat: 'proc', desc: 'Signal processes based on name', example: 'pkill bash' },
    { name: 'pgrep', cat: 'proc', desc: 'Look up processes based on name', example: 'pgrep node' },
    { name: 'pstree', cat: 'proc', desc: 'Display a tree of processes', example: 'pstree' },
    { name: 'lsof', cat: 'proc', desc: 'List open files by processes', example: 'lsof' },
    { name: 'jobs', cat: 'proc', desc: 'List active jobs', example: 'jobs' },
    { name: 'nohup', cat: 'proc', desc: 'Run a command immune to hangups', example: 'nohup ./script.sh &' },
    { name: 'time', cat: 'proc', desc: 'Run programs and summarize system resource usage', example: 'time ls -la' },
    { name: 'watch', cat: 'proc', desc: 'Execute a program periodically', example: 'watch -n 2 df -h' },
    { name: 'crontab', cat: 'proc', desc: 'Maintain crontab files for individual users', example: 'crontab -l' },
    { name: 'vmstat', cat: 'proc', desc: 'Report virtual memory statistics', example: 'vmstat' },
    { name: 'iostat', cat: 'proc', desc: 'Report CPU and I/O statistics', example: 'iostat' },

    // Users & Perms
    { name: 'chmod', cat: 'users', desc: 'Change file mode bits / permissions', example: 'chmod 755 script.sh' },
    { name: 'chown', cat: 'users', desc: 'Change file owner and group', example: 'chown user:user file.txt' },
    { name: 'umask', cat: 'users', desc: 'Set file mode creation mask', example: 'umask' },
    { name: 'id', cat: 'users', desc: 'Print real and effective user/group IDs', example: 'id' },
    { name: 'groups', cat: 'users', desc: 'Print the groups a user is in', example: 'groups' },
    { name: 'who', cat: 'users', desc: 'Show who is logged on', example: 'who' },
    { name: 'w', cat: 'users', desc: 'Show who is logged on and what they are doing', example: 'w' },
    { name: 'last', cat: 'users', desc: 'Show a listing of last logged in users', example: 'last' },
    { name: 'su', cat: 'users', desc: 'Change user ID or become superuser', example: 'su root' },
    { name: 'sudo', cat: 'users', desc: 'Execute a command as another user / root', example: 'sudo apt update' },
    { name: 'useradd', cat: 'users', desc: 'Create a new user', example: 'useradd alice' },
    { name: 'userdel', cat: 'users', desc: 'Delete a user account and files', example: 'userdel alice' },

    // Archiving
    { name: 'tar', cat: 'archive', desc: 'An archiving utility (-czf to create, -xzf to extract)', example: 'tar -czf backup.tar.gz docs/' },
    { name: 'gzip', cat: 'archive', desc: 'Compress files (.gz)', example: 'gzip notes.txt' },
    { name: 'gunzip', cat: 'archive', desc: 'Decompress files (.gz)', example: 'gunzip notes.txt.gz' },
    { name: 'zip', cat: 'archive', desc: 'Package and compress (archive) files', example: 'zip archive.zip file1 file2' },
    { name: 'unzip', cat: 'archive', desc: 'List, test and extract compressed files in a ZIP archive', example: 'unzip archive.zip' },
    { name: 'bzip2', cat: 'archive', desc: 'A block-sorting file compressor', example: 'bzip2 file.txt' },
    { name: 'xz', cat: 'archive', desc: 'Compress or decompress .xz files', example: 'xz file.txt' },

    // Shell & Math
    { name: 'echo', cat: 'shell', desc: 'Display a line of text', example: 'echo "Hello Linux" > greeting.txt' },
    { name: 'export', cat: 'shell', desc: 'Set export attribute for shell variables', example: 'export APP_ENV=production' },
    { name: 'env', cat: 'shell', desc: 'Show environment variables', example: 'env' },
    { name: 'alias', cat: 'shell', desc: 'Define or display aliases', example: 'alias ll="ls -la"' },
    { name: 'history', cat: 'shell', desc: 'Display command history list', example: 'history' },
    { name: 'source', cat: 'shell', desc: 'Execute commands from a file in current shell', example: 'source ~/.bashrc' },
    { name: 'basename', cat: 'shell', desc: 'Strip directory and suffix from filenames', example: 'basename /etc/passwd' },
    { name: 'dirname', cat: 'shell', desc: 'Strip last component from file name', example: 'dirname /home/user/file.txt' },
    { name: 'which', cat: 'shell', desc: 'Locate a command in PATH', example: 'which bash' },
    { name: 'type', cat: 'shell', desc: 'Display information about command type', example: 'type cd' },
    { name: 'expr', cat: 'shell', desc: 'Evaluate expressions', example: 'expr 10 + 25' },
    { name: 'bc', cat: 'shell', desc: 'Arbitrary precision calculator language', example: 'echo "12 * 8" | bc' },
    { name: 'seq', cat: 'shell', desc: 'Print a sequence of numbers', example: 'seq 1 5' },
    { name: 'factor', cat: 'shell', desc: 'Factor numbers into prime factors', example: 'factor 42' },
    { name: 'cal', cat: 'shell', desc: 'Display a calendar', example: 'cal 10 2026' },
    { name: 'base64', cat: 'shell', desc: 'Base64 encode/decode data', example: 'echo "hello" | base64' },
    { name: 'md5sum', cat: 'shell', desc: 'Compute and check MD5 digest', example: 'md5sum /etc/os-release' },
    { name: 'sha256sum', cat: 'shell', desc: 'Compute and check SHA256 digest', example: 'sha256sum /etc/os-release' },
    { name: 'xargs', cat: 'shell', desc: 'Build and execute commands from standard input', example: 'echo "a b c" | xargs touch' },
    { name: 'man', cat: 'shell', desc: 'System reference manual', example: 'man grep' }
  ];

  function initCheatsheetModal() {
    const modal = document.getElementById('cheatsheet-modal');
    const openBtn = document.getElementById('btn-open-cheatsheet');
    const closeBtn = document.getElementById('btn-close-cheatsheet');
    const content = document.getElementById('cheatsheet-content');
    const searchInput = document.getElementById('cheatsheet-search');
    const tabBtns = document.querySelectorAll('#cheatsheet-tabs .tab-btn');

    if (!modal || !content) return;

    let activeCategory = 'all';
    let searchQuery = '';

    function renderCards() {
      const q = searchQuery.toLowerCase();
      const filtered = CHEATSHEET_DATA.filter(cmd => {
        const matchesCat = activeCategory === 'all' || cmd.cat === activeCategory;
        const matchesSearch = !q || cmd.name.toLowerCase().includes(q) || cmd.desc.toLowerCase().includes(q) || cmd.example.toLowerCase().includes(q);
        return matchesCat && matchesSearch;
      });

      if (!filtered.length) {
        content.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--fg-dim);">No commands matching "${Utils.escapeHtml(searchQuery)}"</div>`;
        return;
      }

      content.innerHTML = filtered.map(cmd => `
        <div class="cmd-card" data-cmd="${Utils.escapeHtml(cmd.example)}" title="Click to run in terminal">
          <div class="cmd-card-name">${Utils.escapeHtml(cmd.name)}</div>
          <div class="cmd-card-desc">${Utils.escapeHtml(cmd.desc)}</div>
          <div class="cmd-card-example">${Utils.escapeHtml(cmd.example)}</div>
        </div>
      `).join('');

      // Click card to paste into terminal
      content.querySelectorAll('.cmd-card').forEach(card => {
        card.addEventListener('click', () => {
          const example = card.dataset.cmd;
          modal.classList.add('hidden');
          modal.setAttribute('aria-hidden', 'true');
          terminal.runCommand(example);
        });
      });
    }

    function openModal() {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
      renderCards();
      setTimeout(() => searchInput?.focus(), 50);
    }

    function closeModal() {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }

    openBtn?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderCards();
    });

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.dataset.cat || 'all';
        renderCards();
      });
    });

    // Global keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && (e.key === 'k' || e.key === 'K')) || e.key === 'F1') {
        e.preventDefault();
        if (modal.classList.contains('hidden')) openModal();
        else closeModal();
      }
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeModal();
      }
    });
  }

  // ── Global Helpers (called from HTML) ─────────────────────────────────────

  window.copyToTerminal = function(encoded) {
    const commands = decodeURIComponent(encoded).split('\n');
    for (const cmd of commands) {
      if (cmd.trim()) {
        setTimeout(() => terminal.runCommand(cmd), 100);
      }
    }
  };

  window.resetProgress = function() {
    if (confirm('Reset all progress? This cannot be undone.')) {
      localStorage.removeItem('lm_progress');
      localStorage.removeItem('lm_vfs');
      location.reload();
    }
  };

  // ── Start ─────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
