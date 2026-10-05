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

    // Initialize Theme Manager & 3D Parallax Effects
    initThemeManager();
    init3DParallaxEffects();

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

  // ── Theme Manager ──────────────────────────────────────────────────────────
  function initThemeManager() {
    const themeWrapper = document.getElementById('theme-dropdown-wrapper');
    const themeBtn = document.getElementById('btn-theme');
    const themeMenu = document.getElementById('theme-menu');
    const themeLabel = document.getElementById('theme-label');
    const themeOptions = document.querySelectorAll('.theme-option');

    const themes = {
      cyberpunk: 'Cyberpunk',
      dracula: 'Dracula',
      matrix: 'Matrix',
      tokyo: 'Tokyo'
    };

    function applyTheme(name) {
      if (!themes[name]) name = 'cyberpunk';
      document.documentElement.setAttribute('data-theme', name);
      localStorage.setItem('lm_theme', name);
      if (themeLabel) themeLabel.textContent = themes[name];
      themeOptions.forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === name);
      });
    }

    const savedTheme = localStorage.getItem('lm_theme') || 'cyberpunk';
    applyTheme(savedTheme);

    themeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = themeMenu?.classList.toggle('hidden');
      themeBtn.setAttribute('aria-expanded', !isHidden);
    });

    themeOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        applyTheme(opt.dataset.theme);
        themeMenu?.classList.add('hidden');
        themeBtn?.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (themeWrapper && !themeWrapper.contains(e.target)) {
        themeMenu?.classList.add('hidden');
        themeBtn?.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ── 3D Parallax & Micro-Interaction Engine ────────────────────────────────
  function init3DParallaxEffects() {
    const btnToggle3D = document.getElementById('btn-toggle-3d');
    let is3DEnabled = localStorage.getItem('lm_3dfx') !== 'false';

    function set3DState(enabled) {
      is3DEnabled = enabled;
      localStorage.setItem('lm_3dfx', enabled ? 'true' : 'false');
      document.body.classList.toggle('fx-3d-disabled', !enabled);
      if (btnToggle3D) {
        btnToggle3D.classList.toggle('active', enabled);
        const statusSpan = btnToggle3D.querySelector('.btn-text');
        if (statusSpan) statusSpan.textContent = `3D FX`;
      }
    }

    set3DState(is3DEnabled);

    btnToggle3D?.addEventListener('click', () => {
      set3DState(!is3DEnabled);
    });

    // Check prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      set3DState(false);
      return;
    }

    // High-performance event delegation for 3D card tilt
    // Caches card rect on mouseenter so getBoundingClientRect() is NEVER called repeatedly on mousemove!
    let activeCard = null;
    let cardRect = null;
    let rafId = null;

    document.addEventListener('mouseover', (e) => {
      if (!is3DEnabled) return;
      const target = e.target.closest('.lesson-item, .lesson-task-box, .lesson-concept, .cheatsheet-card');
      if (target && target !== activeCard) {
        if (activeCard) activeCard.style.transform = '';
        activeCard = target;
        cardRect = target.getBoundingClientRect();
      }
    }, { passive: true });

    document.addEventListener('mousemove', (e) => {
      if (!is3DEnabled || !activeCard || !cardRect) return;

      if (rafId) return; // Throttled to display refresh rate
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!activeCard || !cardRect) return;

        const x = e.clientX - cardRect.left;
        const y = e.clientY - cardRect.top;

        // If cursor drifted outside card
        if (x < -10 || x > cardRect.width + 10 || y < -10 || y > cardRect.height + 10) {
          activeCard.style.transform = '';
          activeCard = null;
          cardRect = null;
          return;
        }

        const normX = (x / cardRect.width) - 0.5;
        const normY = (y / cardRect.height) - 0.5;
        const maxDeg = 5;
        const rotX = (-normY * maxDeg).toFixed(2);
        const rotY = (normX * maxDeg).toFixed(2);

        activeCard.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(6px) scale3d(1.012, 1.012, 1.012)`;
      });
    }, { passive: true });

    document.addEventListener('mouseout', (e) => {
      if (!activeCard) return;
      const related = e.relatedTarget;
      if (!related || !activeCard.contains(related)) {
        activeCard.style.transform = '';
        activeCard = null;
        cardRect = null;
      }
    }, { passive: true });
  }

  // ── Layout Resizer (RAF Optimized) ─────────────────────────────────────────

  function initResizer() {
    const resizer = document.getElementById('panel-resizer');
    const sidebar = document.getElementById('sidebar');
    if (!resizer || !sidebar) return;

    let isResizing = false;
    let startX = 0, startWidth = 0;
    let resizeRaf = null;

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
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        if (!isResizing) return;
        const dx = clientX - startX;
        const newWidth = Math.max(200, Math.min(480, startWidth + dx));
        sidebar.style.width = newWidth + 'px';
      });
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
    {
      "name": "ls",
      "cat": "files",
      "desc": "List directory contents and filesystem metadata (files, folders, permissions, file sizes, and dates).",
      "syntax": "ls [OPTIONS] [FILE/DIR...]",
      "flags": [
        {
          "flag": "-l",
          "desc": "Long listing format (permissions, owner, size, modification timestamp)"
        },
        {
          "flag": "-a",
          "desc": "All files, including hidden dotfiles (. and ..)"
        },
        {
          "flag": "-h",
          "desc": "Human-readable sizes (K, M, G) with -l"
        },
        {
          "flag": "-t",
          "desc": "Sort by modification time, newest first"
        },
        {
          "flag": "-R",
          "desc": "Recursively list subdirectories and contents"
        }
      ],
      "example": "ls -lah /var/log",
      "explain": "List all log files in long format with hidden files and human-readable file sizes.",
      "tip": "Alias \"ll='ls -lah'\" in ~/.bashrc for the ultimate everyday directory viewer."
    },
    {
      "name": "cd",
      "cat": "files",
      "desc": "Change current working directory to navigate the filesystem tree.",
      "syntax": "cd [DIRECTORY]",
      "flags": [
        {
          "flag": "~",
          "desc": "Navigate directly to your user home directory (/home/user)"
        },
        {
          "flag": "..",
          "desc": "Move up one directory level to the parent"
        },
        {
          "flag": "-",
          "desc": "Toggle back to the previous working directory ($OLDPWD)"
        },
        {
          "flag": "/",
          "desc": "Jump to the root directory"
        }
      ],
      "example": "cd -",
      "explain": "Quickly toggle back to your previous directory without retyping the path.",
      "tip": "\"cd\" with no arguments always returns you to your home directory."
    },
    {
      "name": "pwd",
      "cat": "files",
      "desc": "Print working directory: displays the absolute path from the root (/) to where you currently are.",
      "syntax": "pwd [OPTIONS]",
      "flags": [
        {
          "flag": "-L",
          "desc": "Print logical path (resolves symlinks symbolic names)"
        },
        {
          "flag": "-P",
          "desc": "Print physical path (resolves all symbolic links to real targets)"
        }
      ],
      "example": "pwd",
      "explain": "Prints the exact absolute path of the active shell directory.",
      "tip": "Useful in shell scripts and commands like \"BACKUP_DIR=$(pwd)\"."
    },
    {
      "name": "mkdir",
      "cat": "files",
      "desc": "Make directories: creates one or more new folders on the filesystem.",
      "syntax": "mkdir [OPTIONS] DIRECTORY...",
      "flags": [
        {
          "flag": "-p",
          "desc": "Create intermediate parent directories as needed without error if they already exist"
        },
        {
          "flag": "-v",
          "desc": "Verbose mode: print a message for each created directory"
        },
        {
          "flag": "-m",
          "desc": "Set permission mode bits (e.g., -m 755) directly upon creation"
        }
      ],
      "example": "mkdir -p project/src/components",
      "explain": "Creates the entire nested hierarchy in a single command safely.",
      "tip": "Always use \"-p\" in automated deployment scripts so existing folders never cause errors."
    },
    {
      "name": "rmdir",
      "cat": "files",
      "desc": "Remove empty directories from the filesystem.",
      "syntax": "rmdir [OPTIONS] DIRECTORY...",
      "flags": [
        {
          "flag": "-p",
          "desc": "Remove DIRECTORY and its parent ancestors if they become empty"
        },
        {
          "flag": "-v",
          "desc": "Verbose: display diagnostic output for each directory processed"
        }
      ],
      "example": "rmdir old_backup",
      "explain": "Safely removes empty folder \"old_backup\" without risking deleting files inside.",
      "tip": "Unlike \"rm -r\", rmdir will refuse to delete any folder containing files."
    },
    {
      "name": "touch",
      "cat": "files",
      "desc": "Update file timestamps (access and modification) or create empty files if they do not exist.",
      "syntax": "touch [OPTIONS] FILE...",
      "flags": [
        {
          "flag": "-a",
          "desc": "Change access time only"
        },
        {
          "flag": "-m",
          "desc": "Change modification time only"
        },
        {
          "flag": "-c",
          "desc": "Do not create file if it does not already exist"
        }
      ],
      "example": "touch app.log config.json",
      "explain": "Creates two empty files instantly, or touches their timestamps if already present.",
      "tip": "Use touch to initialize placeholder lock files, trigger build watchers, or create new source files."
    },
    {
      "name": "rm",
      "cat": "files",
      "desc": "Remove files or directory hierarchies permanently from the filesystem.",
      "syntax": "rm [OPTIONS] FILE...",
      "flags": [
        {
          "flag": "-r, -R",
          "desc": "Recursively remove directories and their contents"
        },
        {
          "flag": "-f",
          "desc": "Force removal without prompting or complaining if files do not exist"
        },
        {
          "flag": "-i",
          "desc": "Interactive: prompt for confirmation before every removal"
        }
      ],
      "example": "rm -rf ./temp_cache",
      "explain": "Recursively and forcefully deletes the directory and all nested files.",
      "tip": "There is NO Recycle Bin in Linux! Double-check paths before running \"rm -rf\"."
    },
    {
      "name": "cp",
      "cat": "files",
      "desc": "Copy files and directories from source to destination paths.",
      "syntax": "cp [OPTIONS] SOURCE... DEST",
      "flags": [
        {
          "flag": "-r, -R",
          "desc": "Copy directories recursively"
        },
        {
          "flag": "-p",
          "desc": "Preserve file attributes: mode, ownership, and timestamps"
        },
        {
          "flag": "-i",
          "desc": "Interactive: prompt before overwriting existing destination files"
        },
        {
          "flag": "-a",
          "desc": "Archive mode: equivalent to -dpR (preserves all metadata recursively)"
        }
      ],
      "example": "cp -r src/ backup/",
      "explain": "Copies the complete \"src\" directory and all nested files into \"backup/\".",
      "tip": "Use \"cp -a\" for system backups to ensure permissions and symlinks are preserved exactly."
    },
    {
      "name": "mv",
      "cat": "files",
      "desc": "Move or rename files and directories from source to destination.",
      "syntax": "mv [OPTIONS] SOURCE... DEST",
      "flags": [
        {
          "flag": "-i",
          "desc": "Prompt before overwriting an existing destination file"
        },
        {
          "flag": "-f",
          "desc": "Force: overwrite destination without asking"
        },
        {
          "flag": "-n",
          "desc": "No clobber: do not overwrite an existing file"
        },
        {
          "flag": "-u",
          "desc": "Update: move only if source is newer than destination"
        }
      ],
      "example": "mv old_report.txt archive/report_2026.txt",
      "explain": "Moves the file into the archive folder while renaming it simultaneously.",
      "tip": "In Linux, renaming and moving are identical operations performed by \"mv\"."
    },
    {
      "name": "find",
      "cat": "files",
      "desc": "Search for files and directories in a directory hierarchy based on names, types, sizes, and timestamps.",
      "syntax": "find [PATH] [CRITERIA] [ACTIONS]",
      "flags": [
        {
          "flag": "-name \"PATTERN\"",
          "desc": "Match file names (case-sensitive; use -iname for insensitive)"
        },
        {
          "flag": "-type f/d/l",
          "desc": "Filter by file type: f (file), d (directory), l (symlink)"
        },
        {
          "flag": "-size +N",
          "desc": "Filter by size (e.g., +10M for files larger than 10MB)"
        },
        {
          "flag": "-mtime -N",
          "desc": "Filter files modified within the last N days"
        },
        {
          "flag": "-exec CMD {} +",
          "desc": "Execute command on every matched result"
        }
      ],
      "example": "find . -name \"*.txt\" -type f",
      "explain": "Finds all regular text files in the current folder and all subdirectories.",
      "tip": "Quote patterns like \"*.log\" so the shell does not expand them before find executes."
    },
    {
      "name": "stat",
      "cat": "files",
      "desc": "Display comprehensive POSIX file or filesystem status and inode metadata.",
      "syntax": "stat [OPTIONS] FILE...",
      "flags": [
        {
          "flag": "-c FORMAT",
          "desc": "Format output with custom tokens (%a permissions, %s size, %U owner)"
        },
        {
          "flag": "-f",
          "desc": "Display filesystem status instead of file status"
        }
      ],
      "example": "stat /etc/passwd",
      "explain": "Inspects inode number, access permissions, owner UID/GID, block size, and 3 timestamps.",
      "tip": "stat is the definitive tool to check Access, Modify, and Change (atime, mtime, ctime)."
    },
    {
      "name": "file",
      "cat": "files",
      "desc": "Determine file type by examining magic numbers and file headers regardless of file extension.",
      "syntax": "file [OPTIONS] FILE...",
      "flags": [
        {
          "flag": "-b",
          "desc": "Brief mode: do not prepend filenames to output lines"
        },
        {
          "flag": "-i, --mime",
          "desc": "Output MIME type strings (e.g., text/plain, image/png)"
        }
      ],
      "example": "file /bin/bash",
      "explain": "Identifies binary architecture, link status, and ELF execution format.",
      "tip": "Linux does not rely on extensions like .exe or .txt; file inspects the actual file contents."
    },
    {
      "name": "ln",
      "cat": "files",
      "desc": "Create hard links or symbolic (soft) links pointing to target files or directories.",
      "syntax": "ln [OPTIONS] TARGET LINK_NAME",
      "flags": [
        {
          "flag": "-s",
          "desc": "Create symbolic (soft) link instead of a hard link"
        },
        {
          "flag": "-f",
          "desc": "Force: remove existing destination files if needed"
        },
        {
          "flag": "-v",
          "desc": "Verbose: print name of each linked file"
        }
      ],
      "example": "ln -s /etc/hosts ~/my_hosts",
      "explain": "Creates a convenient symbolic shortcut in the home directory pointing to /etc/hosts.",
      "tip": "Symbolic links can cross filesystems and link directories; hard links cannot."
    },
    {
      "name": "du",
      "cat": "files",
      "desc": "Estimate and summarize file space usage recursively for directories.",
      "syntax": "du [OPTIONS] [PATH...]",
      "flags": [
        {
          "flag": "-s",
          "desc": "Summary: display only a total for each specified argument"
        },
        {
          "flag": "-h",
          "desc": "Human-readable sizes (K, M, G)"
        },
        {
          "flag": "-d N",
          "desc": "Max depth: recurse at most N levels down"
        },
        {
          "flag": "-a",
          "desc": "Include files as well as directories"
        }
      ],
      "example": "du -sh /home/user",
      "explain": "Displays the total cumulative disk space occupied by the user home directory.",
      "tip": "Run \"du -sh * | sort -h\" to instantly spot the largest space-consuming folders."
    },
    {
      "name": "df",
      "cat": "files",
      "desc": "Report file system disk space usage, mount points, and remaining capacity.",
      "syntax": "df [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-h",
          "desc": "Human-readable: print sizes in powers of 1024 (1K, 234M, 2G)"
        },
        {
          "flag": "-T",
          "desc": "Print filesystem type (ext4, tmpfs, xfs)"
        },
        {
          "flag": "-i",
          "desc": "List inode information instead of block usage"
        }
      ],
      "example": "df -h",
      "explain": "Displays total, used, available disk space and usage percentage for all mounted filesystems.",
      "tip": "Always check \"df -h\" when a server throws \"No space left on device\" errors."
    },
    {
      "name": "cat",
      "cat": "text",
      "desc": "Concatenate files and print their contents to the standard output.",
      "syntax": "cat [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-n",
          "desc": "Number all output lines starting from 1"
        },
        {
          "flag": "-b",
          "desc": "Number non-empty output lines only"
        },
        {
          "flag": "-s",
          "desc": "Squeeze multiple adjacent blank lines into a single blank line"
        },
        {
          "flag": "-E",
          "desc": "Display a $ at the end of each line"
        }
      ],
      "example": "cat -n /etc/os-release",
      "explain": "Outputs system distribution details with numbered lines for easy reference.",
      "tip": "Use \"cat <<EOF > file.txt\" (heredoc) to quickly write multi-line text files from the shell."
    },
    {
      "name": "head",
      "cat": "text",
      "desc": "Output the beginning portion (first lines or bytes) of specified files.",
      "syntax": "head [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-n K",
          "desc": "Print the first K lines (defaults to 10 lines)"
        },
        {
          "flag": "-c K",
          "desc": "Print the first K bytes of each file"
        },
        {
          "flag": "-q",
          "desc": "Never print headers giving file names"
        }
      ],
      "example": "head -n 5 /etc/passwd",
      "explain": "Prints the first 5 user account entries from the system password database.",
      "tip": "Combine with pipes: \"ls -la | head -n 10\" shows the top 10 items without flooding the screen."
    },
    {
      "name": "tail",
      "cat": "text",
      "desc": "Output the last part (end lines) of files, with optional continuous live monitoring.",
      "syntax": "tail [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-n K",
          "desc": "Output the last K lines (defaults to 10 lines)"
        },
        {
          "flag": "-f",
          "desc": "Follow: loop and print appended data in real-time as file grows"
        },
        {
          "flag": "-F",
          "desc": "Follow by name, tracking file even if rotated or recreated"
        }
      ],
      "example": "tail -n 20 /var/log/syslog",
      "explain": "Inspects the 20 most recent system log entries.",
      "tip": "In live servers, \"tail -f /var/log/nginx/access.log\" monitors web requests live."
    },
    {
      "name": "wc",
      "cat": "text",
      "desc": "Print newline, word, and byte/character counts for each file or standard input stream.",
      "syntax": "wc [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-l",
          "desc": "Print the newline counts (number of lines)"
        },
        {
          "flag": "-w",
          "desc": "Print the word counts"
        },
        {
          "flag": "-c",
          "desc": "Print the byte counts"
        },
        {
          "flag": "-m",
          "desc": "Print the character counts"
        }
      ],
      "example": "wc -l /etc/passwd",
      "explain": "Counts the total number of user accounts defined in the password database.",
      "tip": "Chain with pipes like \"ps aux | grep node | wc -l\" to quickly count running instances."
    },
    {
      "name": "grep",
      "cat": "text",
      "desc": "Print lines matching a specified regular expression or text pattern across files or streams.",
      "syntax": "grep [OPTIONS] PATTERN [FILE...]",
      "flags": [
        {
          "flag": "-i",
          "desc": "Ignore case distinctions in patterns and input data"
        },
        {
          "flag": "-n",
          "desc": "Prefix each output line with its 1-based line number"
        },
        {
          "flag": "-v",
          "desc": "Invert match: select non-matching lines"
        },
        {
          "flag": "-r, -R",
          "desc": "Recursively search all files under subdirectories"
        },
        {
          "flag": "-c",
          "desc": "Print only a count of selected matching lines"
        },
        {
          "flag": "-E",
          "desc": "Interpret PATTERN as an extended regular expression (egrep)"
        }
      ],
      "example": "grep -in \"root\" /etc/passwd",
      "explain": "Searches case-insensitively for \"root\" and prints line numbers and matching text.",
      "tip": "Combine flags: \"grep -rn 'TODO' src/\" is the classic codebase search command."
    },
    {
      "name": "sort",
      "cat": "text",
      "desc": "Sort lines of text files alphabetically or numerically, with key column selection.",
      "syntax": "sort [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-r",
          "desc": "Reverse the result of comparisons (descending order)"
        },
        {
          "flag": "-n",
          "desc": "Compare according to numerical string value"
        },
        {
          "flag": "-u",
          "desc": "Unique: output only the first of an equal run"
        },
        {
          "flag": "-k POS",
          "desc": "Start a key at position POS (column sorting)"
        },
        {
          "flag": "-t SEP",
          "desc": "Use SEP as the field separator character"
        }
      ],
      "example": "sort -r names.txt",
      "explain": "Sorts names in descending alphabetical order from Z to A.",
      "tip": "Always pair with uniq: \"sort file.txt | uniq\" guarantees accurate deduplication."
    },
    {
      "name": "uniq",
      "cat": "text",
      "desc": "Report or filter out repeated adjacent lines from sorted input streams.",
      "syntax": "uniq [OPTIONS] [INPUT [OUTPUT]]",
      "flags": [
        {
          "flag": "-c",
          "desc": "Prefix lines by the number of occurrences (frequency count)"
        },
        {
          "flag": "-d",
          "desc": "Only print duplicate lines"
        },
        {
          "flag": "-u",
          "desc": "Only print unique lines (lines that appear exactly once)"
        },
        {
          "flag": "-i",
          "desc": "Ignore differences in case when comparing"
        }
      ],
      "example": "cat list.txt | sort | uniq -c",
      "explain": "Sorts lines and prints each unique entry prefixed by how many times it occurred.",
      "tip": "uniq only detects ADJACENT duplicates, so always pipe sorted input into uniq."
    },
    {
      "name": "cut",
      "cat": "text",
      "desc": "Extract and print selected sections or delimiter-separated fields from each line of files.",
      "syntax": "cut [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-d DELIM",
          "desc": "Use DELIM as the field delimiter character (defaults to TAB)"
        },
        {
          "flag": "-f LIST",
          "desc": "Select only these fields (e.g., -f 1,3 or -f 2-5)"
        },
        {
          "flag": "-c LIST",
          "desc": "Select only specified character positions"
        }
      ],
      "example": "cut -d: -f1,7 /etc/passwd",
      "explain": "Extracts usernames (field 1) and default login shells (field 7) separated by colons.",
      "tip": "Combine with sort & uniq: \"cut -d: -f7 /etc/passwd | sort | uniq\" lists all installed shells."
    },
    {
      "name": "tr",
      "cat": "text",
      "desc": "Translate, squeeze, or delete characters from standard input and write to standard output.",
      "syntax": "tr [OPTIONS] SET1 [SET2]",
      "flags": [
        {
          "flag": "-d",
          "desc": "Delete characters in SET1, do not translate"
        },
        {
          "flag": "-s",
          "desc": "Squeeze repeats: replace sequences of repeated characters with a single character"
        },
        {
          "flag": "-c",
          "desc": "Complement: invert SET1"
        }
      ],
      "example": "echo \"hello world\" | tr \"a-z\" \"A-Z\"",
      "explain": "Translates all lowercase ASCII characters to uppercase.",
      "tip": "Use \"tr -d '\\r' < file.txt > unix.txt\" to convert Windows CRLF line endings to Linux LF."
    },
    {
      "name": "sed",
      "cat": "text",
      "desc": "Stream editor for filtering, finding, and transforming text lines with regular expressions.",
      "syntax": "sed [OPTIONS] SCRIPT [FILE...]",
      "flags": [
        {
          "flag": "-i",
          "desc": "Edit files in-place instead of printing to standard output"
        },
        {
          "flag": "-e SCRIPT",
          "desc": "Add script commands to the processing chain"
        },
        {
          "flag": "-n",
          "desc": "Suppress automatic printing of pattern space"
        }
      ],
      "example": "sed \"s/linux/Linux/g\" readme.txt",
      "explain": "Substitutes all occurrences of \"linux\" with \"Linux\" globally throughout the text.",
      "tip": "Use another delimiter if paths contain slashes: \"sed 's|/usr/local|/opt|g' file\"."
    },
    {
      "name": "awk",
      "cat": "text",
      "desc": "Versatile pattern scanning and data processing language for columnar text files.",
      "syntax": "awk [OPTIONS] 'SCRIPT' [FILE...]",
      "flags": [
        {
          "flag": "-F FS",
          "desc": "Define the input field separator (e.g., -F: for colons)"
        },
        {
          "flag": "-v VAR=VAL",
          "desc": "Assign variable values prior to execution"
        }
      ],
      "example": "awk -F: '{print $1, \"->\", $6}' /etc/passwd",
      "explain": "Parses /etc/passwd using colon delimiters and prints username with home directory.",
      "tip": "Special variables: $0 is full line, $1..$N are columns, NF is field count, NR is line number."
    },
    {
      "name": "tac",
      "cat": "text",
      "desc": "Concatenate and print files in reverse order (bottom line first to top line last).",
      "syntax": "tac [FILE...]",
      "flags": [
        {
          "flag": "-b",
          "desc": "Attach separator before instead of after"
        }
      ],
      "example": "tac /var/log/syslog | head -n 5",
      "explain": "Prints the newest syslog messages first by reading the file backwards.",
      "tip": "tac is literally \"cat\" spelled backwards!"
    },
    {
      "name": "rev",
      "cat": "text",
      "desc": "Reverse lines characterwise: flips each line horizontally from right to left.",
      "syntax": "rev [FILE...]",
      "flags": [],
      "example": "echo \"stressed\" | rev",
      "explain": "Reverses character sequence to output \"desserts\".",
      "tip": "Fun for checking palindromes or reversing string tokens in scripts."
    },
    {
      "name": "nl",
      "cat": "text",
      "desc": "Number lines of files with customizable numbering formats, margins, and separators.",
      "syntax": "nl [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-b a",
          "desc": "Number all lines (including blank lines)"
        },
        {
          "flag": "-s SEP",
          "desc": "Specify string separator between line number and line text"
        }
      ],
      "example": "nl -b a /etc/os-release",
      "explain": "Numbers every line in the file including blanks for clear documentation referencing.",
      "tip": "Unlike \"cat -n\", nl gives full control over numbering format, width, and blank lines."
    },
    {
      "name": "column",
      "cat": "text",
      "desc": "Columnate lists into aligned, easy-to-read tabular format.",
      "syntax": "column [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-t",
          "desc": "Determine the number of columns the input contains and create a table"
        },
        {
          "flag": "-s SEP",
          "desc": "Specify delimiter characters for table mode"
        }
      ],
      "example": "column -t -s: /etc/passwd",
      "explain": "Formats colon-delimited user entries into perfectly aligned columns.",
      "tip": "Transform any messy CSV or delimited text into a clean terminal table in one step."
    },
    {
      "name": "paste",
      "cat": "text",
      "desc": "Merge corresponding lines of files side-by-side separated by tabs.",
      "syntax": "paste [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-d DELIM",
          "desc": "Use characters from DELIM instead of TAB to separate fields"
        },
        {
          "flag": "-s",
          "desc": "Paste one file at a time serially instead of in parallel"
        }
      ],
      "example": "paste -d \",\" names.txt ages.txt",
      "explain": "Merges two files row-by-row into comma-separated pairs.",
      "tip": "Combine with cut to rearrange and stitch columns from different data sources."
    },
    {
      "name": "strings",
      "cat": "text",
      "desc": "Print sequences of displayable characters from binary executable files.",
      "syntax": "strings [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-n MIN",
          "desc": "Locate sequences that are at least MIN characters long (default 4)"
        },
        {
          "flag": "-a",
          "desc": "Scan the entire file, not just data sections"
        }
      ],
      "example": "strings /bin/bash | grep \"version\"",
      "explain": "Extracts embedded human-readable text and version strings from the bash binary.",
      "tip": "Indispensable tool for reverse engineering, malware analysis, and inspecting compiled binaries."
    },
    {
      "name": "diff",
      "cat": "text",
      "desc": "Compare two files line by line and display differences.",
      "syntax": "diff [OPTIONS] FILES...",
      "flags": [
        {
          "flag": "-u",
          "desc": "Output NUM (default 3) lines of unified context (standard patch format)"
        },
        {
          "flag": "-y",
          "desc": "Output in two parallel columns side-by-side"
        },
        {
          "flag": "-i",
          "desc": "Ignore case differences in file contents"
        },
        {
          "flag": "-w",
          "desc": "Ignore all white space characters"
        }
      ],
      "example": "diff -u file1.txt file2.txt",
      "explain": "Shows unified diff format with + for added lines and - for deleted lines.",
      "tip": "The unified output of \"diff -u\" is the standard format used by git and patch."
    },
    {
      "name": "tee",
      "cat": "text",
      "desc": "Read from standard input and write simultaneously to standard output AND files.",
      "syntax": "tee [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-a",
          "desc": "Append to the given FILEs, do not overwrite"
        },
        {
          "flag": "-i",
          "desc": "Ignore interrupt signals"
        }
      ],
      "example": "ls -la | tee dir_contents.txt",
      "explain": "Displays directory contents on screen while saving an identical copy to file.",
      "tip": "Need sudo redirection? \"echo 'nameserver 1.1.1.1' | sudo tee -a /etc/resolv.conf\" works where >> fails!"
    },
    {
      "name": "fold",
      "cat": "text",
      "desc": "Wrap each input line to fit in a specified character width column.",
      "syntax": "fold [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-w WIDTH",
          "desc": "Use WIDTH columns instead of default 80"
        },
        {
          "flag": "-s",
          "desc": "Break at word boundaries (spaces) rather than mid-word"
        }
      ],
      "example": "fold -w 60 -s article.txt",
      "explain": "Wraps text nicely at 60 characters wide without breaking words in half.",
      "tip": "Great for formatting terminal output, readme displays, and text for narrow screens."
    },
    {
      "name": "shuf",
      "cat": "text",
      "desc": "Generate random permutations: randomly shuffles lines from input.",
      "syntax": "shuf [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-n COUNT",
          "desc": "Output at most COUNT lines"
        },
        {
          "flag": "-e",
          "desc": "Treat each ARG as an input line"
        },
        {
          "flag": "-i LO-HI",
          "desc": "Treat each number from LO through HI as an input line"
        }
      ],
      "example": "shuf -n 3 participants.txt",
      "explain": "Randomly selects 3 winners from the participants file.",
      "tip": "Use \"shuf -i 1-100 -n 1\" to generate a quick random number from 1 to 100."
    },
    {
      "name": "whoami",
      "cat": "sys",
      "desc": "Print the current active effective user name associated with the shell session.",
      "syntax": "whoami",
      "flags": [],
      "example": "whoami",
      "explain": "Displays \"user\" (or \"root\" if escalated), verifying your current privileges.",
      "tip": "Useful in scripts to verify if a user has root rights before continuing."
    },
    {
      "name": "date",
      "cat": "sys",
      "desc": "Display or configure the system date, time, and timezone.",
      "syntax": "date [OPTIONS] [+FORMAT]",
      "flags": [
        {
          "flag": "+%Y-%m-%d",
          "desc": "Format date with custom specifiers (e.g. YYYY-MM-DD)"
        },
        {
          "flag": "-u",
          "desc": "Display Universal Time (UTC) instead of local time"
        }
      ],
      "example": "date \"+%Y-%m-%d %H:%M:%S\"",
      "explain": "Outputs standard ISO-formatted timestamp suitable for filenames and logs.",
      "tip": "Generate timestamped backup files: \"cp app.db app.db.$(date +%F)\"."
    },
    {
      "name": "uname",
      "cat": "sys",
      "desc": "Print system architecture, OS name, kernel version, and hardware platform.",
      "syntax": "uname [OPTIONS]",
      "flags": [
        {
          "flag": "-a",
          "desc": "Print all available system information"
        },
        {
          "flag": "-r",
          "desc": "Print the operating system release / kernel version"
        },
        {
          "flag": "-m",
          "desc": "Print the machine hardware architecture (e.g., x86_64, aarch64)"
        },
        {
          "flag": "-s",
          "desc": "Print the operating system kernel name (Linux)"
        }
      ],
      "example": "uname -a",
      "explain": "Displays kernel build, machine architecture, hostname, and OS family.",
      "tip": "Essential command to diagnose kernel versions and check if 32-bit or 64-bit."
    },
    {
      "name": "hostname",
      "cat": "sys",
      "desc": "Display or configure the system network host name.",
      "syntax": "hostname [OPTIONS]",
      "flags": [
        {
          "flag": "-I",
          "desc": "Display all network IP addresses assigned to the host"
        },
        {
          "flag": "-f",
          "desc": "Display fully qualified domain name (FQDN)"
        }
      ],
      "example": "hostname",
      "explain": "Prints the network identifier name configured for this machine.",
      "tip": "In bash prompts, the hostname appears right after the @ sign (e.g., user@hostname)."
    },
    {
      "name": "uptime",
      "cat": "sys",
      "desc": "Show how long system has been running, logged-in users, and load averages (1, 5, 15 min).",
      "syntax": "uptime [OPTIONS]",
      "flags": [
        {
          "flag": "-p",
          "desc": "Pretty print: show uptime in human-readable friendly words"
        },
        {
          "flag": "-s",
          "desc": "Since: show system boot date and time"
        }
      ],
      "example": "uptime",
      "explain": "Outputs current time, uptime duration, active users, and system load averages.",
      "tip": "Load averages exceeding your CPU core count signal that processes are queuing for CPU."
    },
    {
      "name": "free",
      "cat": "sys",
      "desc": "Display amount of free, used, and cached physical RAM and swap memory.",
      "syntax": "free [OPTIONS]",
      "flags": [
        {
          "flag": "-h",
          "desc": "Human-readable: automatically scale memory units to B, K, M, G"
        },
        {
          "flag": "-m",
          "desc": "Display memory values in mebibytes (MB)"
        },
        {
          "flag": "-t",
          "desc": "Display a total line combining RAM and Swap"
        }
      ],
      "example": "free -h",
      "explain": "Shows total, used, free, shared, buff/cache, and available RAM in gigabytes/megabytes.",
      "tip": "Look at the \"available\" column, not \"free\"! Linux uses free RAM for buffers/cache automatically."
    },
    {
      "name": "lscpu",
      "cat": "sys",
      "desc": "Gather and display detailed CPU architecture, core counts, threads, cache sizes, and clock speeds.",
      "syntax": "lscpu [OPTIONS]",
      "flags": [],
      "example": "lscpu",
      "explain": "Shows CPU model, architecture, virtualization support, sockets, and L1/L2/L3 caches.",
      "tip": "Quickly verify hyperthreading and core counts on new servers."
    },
    {
      "name": "lsblk",
      "cat": "sys",
      "desc": "List information about all available or specified block storage devices in a tree format.",
      "syntax": "lsblk [OPTIONS]",
      "flags": [
        {
          "flag": "-f",
          "desc": "Output info about filesystems (UUID, mountpoint, filesystem type)"
        },
        {
          "flag": "-a",
          "desc": "List all devices including empty ones"
        }
      ],
      "example": "lsblk -f",
      "explain": "Visualizes hard drives, SSDs, partitions, filesystems, and mount locations.",
      "tip": "Use before mounting USB drives or partitioning disks to ensure you target the right device."
    },
    {
      "name": "lspci",
      "cat": "sys",
      "desc": "List all PCI buses and attached hardware devices (GPUs, NICs, RAID controllers).",
      "syntax": "lspci [OPTIONS]",
      "flags": [
        {
          "flag": "-v",
          "desc": "Be verbose and display detailed information about all devices"
        },
        {
          "flag": "-nn",
          "desc": "Show PCI vendor and device codes both as numbers and names"
        }
      ],
      "example": "lspci",
      "explain": "Displays connected graphics cards, sound cards, and network adapters.",
      "tip": "Filter for graphics devices: \"lspci | grep -i vga\" or \"lspci | grep -i nvidia\"."
    },
    {
      "name": "lsusb",
      "cat": "sys",
      "desc": "List USB buses and all connected USB devices.",
      "syntax": "lsusb [OPTIONS]",
      "flags": [
        {
          "flag": "-v",
          "desc": "Display verbose information about USB devices"
        }
      ],
      "example": "lsusb",
      "explain": "Shows USB hubs, keyboards, mice, flash drives, and external interfaces.",
      "tip": "Check if Linux recognizes a freshly plugged USB device before attempting to mount it."
    },
    {
      "name": "dmesg",
      "cat": "sys",
      "desc": "Print or control the kernel ring buffer diagnostic messages.",
      "syntax": "dmesg [OPTIONS]",
      "flags": [
        {
          "flag": "-T",
          "desc": "Print human-readable timestamps"
        },
        {
          "flag": "-l LEVEL",
          "desc": "Filter by message priority level (err, warn, info)"
        }
      ],
      "example": "dmesg -T | tail -n 20",
      "explain": "Inspects the last 20 kernel messages with readable timestamps.",
      "tip": "Plug in a hardware device and run \"dmesg | tail\" to see how the kernel assigns it."
    },
    {
      "name": "journalctl",
      "cat": "sys",
      "desc": "Query and view logs generated by systemd-journald and system services.",
      "syntax": "journalctl [OPTIONS]",
      "flags": [
        {
          "flag": "-u SERVICE",
          "desc": "Show logs for a specific unit (e.g., -u nginx)"
        },
        {
          "flag": "-f",
          "desc": "Follow new log messages live"
        },
        {
          "flag": "-p err",
          "desc": "Filter by error priority levels only"
        },
        {
          "flag": "-b",
          "desc": "Show messages from the current boot only"
        }
      ],
      "example": "journalctl -u sshd -n 20",
      "explain": "Displays the 20 most recent log entries specifically from the SSH daemon.",
      "tip": "Use \"-xe\" flag (\"journalctl -xe\") when a service fails to start to see why."
    },
    {
      "name": "systemctl",
      "cat": "sys",
      "desc": "Control systemd system and service manager (start, stop, restart, enable, status).",
      "syntax": "systemctl [COMMAND] [UNIT...]",
      "flags": [
        {
          "flag": "status",
          "desc": "Show runtime status of a service"
        },
        {
          "flag": "start / stop",
          "desc": "Start or stop a service immediately"
        },
        {
          "flag": "restart",
          "desc": "Restart a service"
        },
        {
          "flag": "enable / disable",
          "desc": "Configure service to start automatically on system boot"
        }
      ],
      "example": "systemctl status sshd",
      "explain": "Checks whether the SSH daemon service is active (running), disabled, or failed.",
      "tip": "\"systemctl restart service\" is safer than stop and start because it preserves dependencies."
    },
    {
      "name": "mount",
      "cat": "sys",
      "desc": "Attach filesystems to the directory hierarchy or list currently mounted systems.",
      "syntax": "mount [OPTIONS] [DEVICE] [DIRECTORY]",
      "flags": [
        {
          "flag": "-t TYPE",
          "desc": "Specify filesystem type (ext4, vfat, nfs)"
        },
        {
          "flag": "-o OPTIONS",
          "desc": "Mount options (ro read-only, rw read-write, noexec)"
        }
      ],
      "example": "mount",
      "explain": "Lists all mounted storage devices, virtual filesystems, and mount parameters.",
      "tip": "Pair with umount: never remove storage without unmounting first: \"umount /media/usb\"."
    },
    {
      "name": "fdisk",
      "cat": "sys",
      "desc": "Manipulate disk partition table (MBR / GPT) on block devices.",
      "syntax": "fdisk [OPTIONS] [DEVICE]",
      "flags": [
        {
          "flag": "-l",
          "desc": "List the partition tables for all or specified devices"
        }
      ],
      "example": "fdisk -l",
      "explain": "Displays disk sizes, partition sectors, and filesystem types for all drives.",
      "tip": "Requires root privileges (sudo fdisk -l) on real Linux systems."
    },
    {
      "name": "ping",
      "cat": "net",
      "desc": "Send ICMP ECHO_REQUEST packets to network hosts to test connectivity and latency.",
      "syntax": "ping [OPTIONS] DESTINATION",
      "flags": [
        {
          "flag": "-c COUNT",
          "desc": "Stop after sending COUNT packets"
        },
        {
          "flag": "-i INTERVAL",
          "desc": "Wait INTERVAL seconds between sending each packet"
        },
        {
          "flag": "-W TIMEOUT",
          "desc": "Time to wait for a response, in seconds"
        }
      ],
      "example": "ping -c 4 google.com",
      "explain": "Sends 4 test packets to google.com and reports packet loss and round-trip times.",
      "tip": "On Linux, ping runs indefinitely by default; always use \"-c 4\" in automated checks."
    },
    {
      "name": "curl",
      "cat": "net",
      "desc": "Transfer data from or to a server using protocols (HTTP, HTTPS, FTP, SCP).",
      "syntax": "curl [OPTIONS] URL",
      "flags": [
        {
          "flag": "-I",
          "desc": "Fetch HTTP headers only (HEAD request)"
        },
        {
          "flag": "-o FILE",
          "desc": "Write output to FILE instead of standard output"
        },
        {
          "flag": "-s",
          "desc": "Silent mode: do not show progress meter or error messages"
        },
        {
          "flag": "-L",
          "desc": "Follow HTTP 3xx redirects automatically"
        },
        {
          "flag": "-X METHOD",
          "desc": "Specify custom request method (POST, PUT, DELETE)"
        }
      ],
      "example": "curl -I https://example.com",
      "explain": "Fetches HTTP response headers (status code, content type, server) from the target URL.",
      "tip": "Download files with progress: \"curl -O https://example.com/file.zip\"."
    },
    {
      "name": "wget",
      "cat": "net",
      "desc": "The non-interactive network downloader for HTTP, HTTPS, and FTP files.",
      "syntax": "wget [OPTIONS] URL...",
      "flags": [
        {
          "flag": "-c",
          "desc": "Resume a partially downloaded file"
        },
        {
          "flag": "-O FILE",
          "desc": "Write documents to FILE"
        },
        {
          "flag": "-q",
          "desc": "Quiet mode: turn off wget output"
        },
        {
          "flag": "-b",
          "desc": "Go to background immediately after startup"
        }
      ],
      "example": "wget https://example.com/archive.tar.gz",
      "explain": "Downloads the remote file directly to the current working directory.",
      "tip": "Use \"wget -c\" for large downloads so network dropouts do not force restarting from 0%."
    },
    {
      "name": "ifconfig",
      "cat": "net",
      "desc": "Configure or view network interface parameters (IP addresses, netmasks, MAC).",
      "syntax": "ifconfig [INTERFACE] [OPTIONS]",
      "flags": [
        {
          "flag": "-a",
          "desc": "Display all interfaces currently available, even if down"
        }
      ],
      "example": "ifconfig",
      "explain": "Displays IP addresses, hardware MAC addresses, MTU, and packet statistics.",
      "tip": "Modern Linux systems use \"ip addr\", but ifconfig remains widely recognized."
    },
    {
      "name": "ip",
      "cat": "net",
      "desc": "Show or manipulate routing, network devices, interfaces, and tunnels (iproute2).",
      "syntax": "ip [OPTIONS] OBJECT [COMMAND]",
      "flags": [
        {
          "flag": "addr (a)",
          "desc": "Inspect or configure IP addresses on interfaces"
        },
        {
          "flag": "route (r)",
          "desc": "Show or configure routing tables"
        },
        {
          "flag": "link (l)",
          "desc": "Show or configure state of network interfaces (up/down)"
        },
        {
          "flag": "-c",
          "desc": "Color: use colorized output for readability"
        }
      ],
      "example": "ip -c addr",
      "explain": "Lists all network adapters and their assigned IPv4 and IPv6 addresses in color.",
      "tip": "To find your default gateway: \"ip route show default\"."
    },
    {
      "name": "ss",
      "cat": "net",
      "desc": "Socket statistics: modern utility to investigate network sockets and listening ports.",
      "syntax": "ss [OPTIONS] [FILTER]",
      "flags": [
        {
          "flag": "-t",
          "desc": "Display TCP sockets"
        },
        {
          "flag": "-u",
          "desc": "Display UDP sockets"
        },
        {
          "flag": "-l",
          "desc": "Display listening sockets only"
        },
        {
          "flag": "-p",
          "desc": "Show process using socket"
        },
        {
          "flag": "-n",
          "desc": "Do not resolve service names (show numeric ports like 80, 443, 22)"
        }
      ],
      "example": "ss -tulpn",
      "explain": "Displays all listening TCP and UDP sockets with numeric ports and owning PIDs.",
      "tip": "The fastest, modern replacement for the older \"netstat\" tool."
    },
    {
      "name": "netstat",
      "cat": "net",
      "desc": "Print network connections, routing tables, interface statistics, and masquerade connections.",
      "syntax": "netstat [OPTIONS]",
      "flags": [
        {
          "flag": "-t",
          "desc": "Show TCP connections"
        },
        {
          "flag": "-u",
          "desc": "Show UDP connections"
        },
        {
          "flag": "-l",
          "desc": "Show only listening sockets"
        },
        {
          "flag": "-n",
          "desc": "Show numerical addresses instead of trying to resolve names"
        },
        {
          "flag": "-p",
          "desc": "Show the PID and name of the program to which each socket belongs"
        }
      ],
      "example": "netstat -tuln",
      "explain": "Lists all open listening TCP/UDP ports numerically.",
      "tip": "Essential for finding if port 80 or 8080 is already occupied by another web server."
    },
    {
      "name": "dig",
      "cat": "net",
      "desc": "DNS lookup utility: query DNS name servers for DNS records (A, AAAA, MX, TXT).",
      "syntax": "dig [@SERVER] DOMAIN [TYPE]",
      "flags": [
        {
          "flag": "+short",
          "desc": "Print only clean, concise answers without header text"
        },
        {
          "flag": "A, MX, TXT",
          "desc": "Query specific DNS record types"
        }
      ],
      "example": "dig +short google.com",
      "explain": "Queries DNS servers and returns only the resolved IP address.",
      "tip": "Test custom DNS resolvers: \"dig @1.1.1.1 example.com\"."
    },
    {
      "name": "nslookup",
      "cat": "net",
      "desc": "Query Internet name servers interactively or non-interactively for host info.",
      "syntax": "nslookup DOMAIN [SERVER]",
      "flags": [],
      "example": "nslookup google.com",
      "explain": "Queries the default DNS server for domain name IP resolutions.",
      "tip": "Supported across Linux, macOS, and Windows for quick cross-platform DNS checks."
    },
    {
      "name": "host",
      "cat": "net",
      "desc": "Simple DNS lookup utility that translates domain names to IP addresses and vice versa.",
      "syntax": "host [OPTIONS] DOMAIN [SERVER]",
      "flags": [
        {
          "flag": "-t TYPE",
          "desc": "Specify query type (A, CNAME, MX, NS)"
        }
      ],
      "example": "host example.com",
      "explain": "Returns IPv4, IPv6, and mail handling records for example.com.",
      "tip": "Gives cleaner, more concise output than dig when you just want a quick address lookup."
    },
    {
      "name": "traceroute",
      "cat": "net",
      "desc": "Print the route network packets take across intermediate routers to a network host.",
      "syntax": "traceroute [OPTIONS] HOST",
      "flags": [
        {
          "flag": "-n",
          "desc": "Do not resolve IP addresses to domain names (faster)"
        },
        {
          "flag": "-m MAX_TTL",
          "desc": "Set the maximum number of hops (default 30)"
        }
      ],
      "example": "traceroute -n 8.8.8.8",
      "explain": "Traces each router hop to Google DNS with response times in milliseconds.",
      "tip": "Pinpoints exactly where internet latency or packet drops occur along the route."
    },
    {
      "name": "ssh",
      "cat": "net",
      "desc": "OpenSSH remote login client for secure encrypted remote shell sessions.",
      "syntax": "ssh [OPTIONS] [USER@]HOSTNAME [COMMAND]",
      "flags": [
        {
          "flag": "-p PORT",
          "desc": "Port to connect to on the remote host (default 22)"
        },
        {
          "flag": "-i KEY_FILE",
          "desc": "Select identity file (private key) for public key auth"
        },
        {
          "flag": "-X / -Y",
          "desc": "Enable X11 graphical forwarding"
        }
      ],
      "example": "ssh -p 22 user@remote.server.com",
      "explain": "Initiates an encrypted remote shell session on the target server.",
      "tip": "Use SSH keys instead of passwords: \"ssh-copy-id user@host\" sets up instant secure login."
    },
    {
      "name": "scp",
      "cat": "net",
      "desc": "Secure copy: copy files between hosts over an encrypted SSH connection.",
      "syntax": "scp [OPTIONS] SOURCE... DEST",
      "flags": [
        {
          "flag": "-r",
          "desc": "Recursively copy entire directories"
        },
        {
          "flag": "-P PORT",
          "desc": "Specify port to connect to on the remote host"
        },
        {
          "flag": "-p",
          "desc": "Preserves modification times, access times, and modes"
        }
      ],
      "example": "scp -r ./dist user@server.com:/var/www/html/",
      "explain": "Copies the local build folder to the remote web server directory over SSH.",
      "tip": "For large transfers or syncing, consider \"rsync -avz -e ssh\" for resuming capabilities."
    },
    {
      "name": "ps",
      "cat": "proc",
      "desc": "Report a snapshot of currently running processes with PID, user, CPU%, and memory%.",
      "syntax": "ps [OPTIONS]",
      "flags": [
        {
          "flag": "aux",
          "desc": "BSD style: all processes (a), user details (u), processes without tty (x)"
        },
        {
          "flag": "-ef",
          "desc": "Standard UNIX syntax: all processes (-e) in full format (-f)"
        },
        {
          "flag": "--forest",
          "desc": "ASCII art process tree visualization"
        }
      ],
      "example": "ps aux | grep node",
      "explain": "Lists all system processes and filters for Node.js application instances.",
      "tip": "\"ps aux\" is the quintessential command every Linux administrator runs daily."
    },
    {
      "name": "top",
      "cat": "proc",
      "desc": "Display dynamic real-time Linux processes, CPU usage, memory consumption, and system load.",
      "syntax": "top [OPTIONS]",
      "flags": [
        {
          "flag": "-d SECS",
          "desc": "Specify screen refresh update delay"
        },
        {
          "flag": "-u USER",
          "desc": "Monitor processes belonging to a specific user only"
        }
      ],
      "example": "top",
      "explain": "Launches real-time process manager showing system resource consumption.",
      "tip": "Inside top: press \"q\" to quit, \"M\" to sort by Memory, \"P\" to sort by CPU, \"k\" to kill a PID."
    },
    {
      "name": "kill",
      "cat": "proc",
      "desc": "Send POSIX signals (terminate, kill, reload) to processes specified by Process ID (PID).",
      "syntax": "kill [OPTIONS] PID...",
      "flags": [
        {
          "flag": "-15 (SIGTERM)",
          "desc": "Graceful termination: asks process to clean up and exit (default)"
        },
        {
          "flag": "-9 (SIGKILL)",
          "desc": "Force kill: immediately terminates process at the kernel level"
        },
        {
          "flag": "-1 (SIGHUP)",
          "desc": "Hangup: signals daemon to reload configuration files"
        },
        {
          "flag": "-l",
          "desc": "List all available signals"
        }
      ],
      "example": "kill -15 1024",
      "explain": "Sends graceful termination signal to process with PID 1024.",
      "tip": "Always try graceful SIGTERM (-15) first before reaching for aggressive SIGKILL (-9)!"
    },
    {
      "name": "killall",
      "cat": "proc",
      "desc": "Kill processes by program name rather than numeric process ID.",
      "syntax": "killall [OPTIONS] PROCESS_NAME...",
      "flags": [
        {
          "flag": "-9",
          "desc": "Force kill all instances with SIGKILL"
        },
        {
          "flag": "-i",
          "desc": "Ask for confirmation before killing each process"
        },
        {
          "flag": "-u USER",
          "desc": "Kill only processes owned by specified user"
        }
      ],
      "example": "killall node",
      "explain": "Terminates every running instance of the \"node\" process.",
      "tip": "Use with caution: terminates ALL matching processes across the system!"
    },
    {
      "name": "pkill",
      "cat": "proc",
      "desc": "Look up processes based on name and pattern and send them signals.",
      "syntax": "pkill [OPTIONS] PATTERN",
      "flags": [
        {
          "flag": "-f",
          "desc": "Match against full command line instead of process name only"
        },
        {
          "flag": "-9",
          "desc": "Send SIGKILL force kill"
        },
        {
          "flag": "-u USER",
          "desc": "Match only processes belonging to specified user"
        }
      ],
      "example": "pkill -f \"python server.py\"",
      "explain": "Kills the python process matching the full arguments string.",
      "tip": "Combine with pgrep to test what you will hit before pulling the trigger with pkill."
    },
    {
      "name": "pgrep",
      "cat": "proc",
      "desc": "Look up processes based on name and regex patterns and print their matching PIDs.",
      "syntax": "pgrep [OPTIONS] PATTERN",
      "flags": [
        {
          "flag": "-l",
          "desc": "List the process name as well as the process ID"
        },
        {
          "flag": "-a",
          "desc": "List the full command line arguments with the process ID"
        },
        {
          "flag": "-u USER",
          "desc": "Only match processes owned by specified user"
        }
      ],
      "example": "pgrep -la python",
      "explain": "Lists all running Python process IDs and their full invocation arguments.",
      "tip": "Far cleaner than piping \"ps aux | grep something | grep -v grep\"."
    },
    {
      "name": "pstree",
      "cat": "proc",
      "desc": "Display active processes as an ASCII tree showing parent-child process hierarchy.",
      "syntax": "pstree [OPTIONS] [PID/USER]",
      "flags": [
        {
          "flag": "-p",
          "desc": "Show PIDs in parentheses next to process names"
        },
        {
          "flag": "-u",
          "desc": "Show user name transitions when privileges change"
        }
      ],
      "example": "pstree -p",
      "explain": "Visualizes the hierarchy showing systemd (PID 1) as root of all spawned processes.",
      "tip": "Invaluable for identifying orphan processes and tracking which parent spawned rogue subprocesses."
    },
    {
      "name": "lsof",
      "cat": "proc",
      "desc": "List open files: reports which process opened which file, socket, pipe, or network port.",
      "syntax": "lsof [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-i :PORT",
          "desc": "List processes listening or connected on specified port (e.g., -i :8080)"
        },
        {
          "flag": "-u USER",
          "desc": "List files opened by specified user"
        },
        {
          "flag": "+D DIR",
          "desc": "List all open files inside directory DIR"
        }
      ],
      "example": "lsof -i :8080",
      "explain": "Finds which process is currently occupying and listening on port 8080.",
      "tip": "Every socket, pipe, and device in Linux is a file; lsof inspects everything!"
    },
    {
      "name": "jobs",
      "cat": "proc",
      "desc": "List active background and suspended jobs running in the current shell session.",
      "syntax": "jobs [OPTIONS]",
      "flags": [
        {
          "flag": "-l",
          "desc": "List process IDs in addition to normal information"
        },
        {
          "flag": "-r",
          "desc": "List running jobs only"
        },
        {
          "flag": "-s",
          "desc": "List stopped jobs only"
        }
      ],
      "example": "jobs -l",
      "explain": "Lists background jobs with their job numbers [%1, %2] and process IDs.",
      "tip": "Bring a job back to the foreground using \"fg %1\" or resume in background with \"bg %1\"."
    },
    {
      "name": "nohup",
      "cat": "proc",
      "desc": "Run a command immune to hangups: keeps long-running processes alive even after closing SSH terminal.",
      "syntax": "nohup COMMAND [ARG...] [&]",
      "flags": [],
      "example": "nohup ./backup_script.sh &",
      "explain": "Runs backup script in background redirecting output to nohup.out so logging off does not abort it.",
      "tip": "For production background tasks, consider systemd services or tmux/screen."
    },
    {
      "name": "time",
      "cat": "proc",
      "desc": "Run programs and summarize system resource usage (real, user, and system CPU time).",
      "syntax": "time COMMAND [ARGS...]",
      "flags": [
        {
          "flag": "-p",
          "desc": "Print timing statistics in standard POSIX format"
        }
      ],
      "example": "time tar -czf backup.tar.gz ./data",
      "explain": "Measures total wall-clock time and CPU time spent compressing data.",
      "tip": "\"real\" is total elapsed time; \"user\" is CPU time in user mode; \"sys\" is kernel CPU time."
    },
    {
      "name": "watch",
      "cat": "proc",
      "desc": "Execute a program periodically and display full-screen output showing changes over time.",
      "syntax": "watch [OPTIONS] COMMAND",
      "flags": [
        {
          "flag": "-n SECS",
          "desc": "Specify update interval in seconds (default 2 seconds)"
        },
        {
          "flag": "-d",
          "desc": "Highlight differences between consecutive updates"
        }
      ],
      "example": "watch -n 2 -d df -h",
      "explain": "Monitors disk space changes every 2 seconds with differences highlighted.",
      "tip": "Great for watching file download progress or queue processing in real time."
    },
    {
      "name": "crontab",
      "cat": "proc",
      "desc": "Maintain crontab schedule tables for executing automated background jobs periodically.",
      "syntax": "crontab [OPTIONS]",
      "flags": [
        {
          "flag": "-l",
          "desc": "Display the current user crontab schedule"
        },
        {
          "flag": "-e",
          "desc": "Edit the user crontab file using default editor"
        },
        {
          "flag": "-r",
          "desc": "Remove the crontab schedule"
        }
      ],
      "example": "crontab -l",
      "explain": "Lists scheduled automated cron jobs (minute, hour, day, month, day-of-week).",
      "tip": "Remember the 5-star order: * (minute) * (hour) * (day) * (month) * (weekday)."
    },
    {
      "name": "vmstat",
      "cat": "proc",
      "desc": "Report virtual memory statistics, process states, memory paging, I/O blocks, and CPU activity.",
      "syntax": "vmstat [OPTIONS] [DELAY [COUNT]]",
      "flags": [
        {
          "flag": "-s",
          "desc": "Display a summary table of various event counters"
        },
        {
          "flag": "-m",
          "desc": "Displays slabinfo memory cache statistics"
        }
      ],
      "example": "vmstat 2 5",
      "explain": "Prints 5 snapshots of memory and CPU statistics updated every 2 seconds.",
      "tip": "Look at the \"si\" (swap in) and \"so\" (swap out) columns: high numbers mean severe RAM starvation."
    },
    {
      "name": "iostat",
      "cat": "proc",
      "desc": "Report CPU utilization and Input/Output statistics for block devices and partitions.",
      "syntax": "iostat [OPTIONS] [INTERVAL [COUNT]]",
      "flags": [
        {
          "flag": "-x",
          "desc": "Display extended statistics (%util, await, r/s, w/s)"
        },
        {
          "flag": "-h",
          "desc": "Human readable output"
        }
      ],
      "example": "iostat -x 1 3",
      "explain": "Inspects disk I/O throughput and percentage disk utilization.",
      "tip": "A \"%util\" column near 100% indicates the storage disk is the performance bottleneck."
    },
    {
      "name": "chmod",
      "cat": "users",
      "desc": "Change file mode bits / permissions (Read, Write, Execute for User, Group, Others).",
      "syntax": "chmod [OPTIONS] MODE[,MODE]... FILE...",
      "flags": [
        {
          "flag": "755",
          "desc": "rwxr-xr-x: Owner has full access; group and others can read and execute"
        },
        {
          "flag": "644",
          "desc": "rw-r--r--: Owner can read/write; group and others can read only (standard files)"
        },
        {
          "flag": "+x",
          "desc": "Grant execute permission to user, group, and others"
        },
        {
          "flag": "-R",
          "desc": "Recursively apply permission changes to all files in directories"
        }
      ],
      "example": "chmod 755 deploy.sh",
      "explain": "Sets executable permissions on script so it can be run directly as ./deploy.sh.",
      "tip": "Octal math: 4 = Read (r), 2 = Write (w), 1 = Execute (x). 4+2+1 = 7!"
    },
    {
      "name": "chown",
      "cat": "users",
      "desc": "Change file owner and group ownership attributes.",
      "syntax": "chown [OPTIONS] [OWNER][:GROUP] FILE...",
      "flags": [
        {
          "flag": "-R",
          "desc": "Recursively operate on files and directories"
        },
        {
          "flag": "-h",
          "desc": "Affect symbolic links themselves rather than referenced files"
        }
      ],
      "example": "chown -R www-data:www-data /var/www/html",
      "explain": "Recursively gives ownership of the web directory to the web server user and group.",
      "tip": "Changing both user and group in one command: \"chown user:group filename\"."
    },
    {
      "name": "umask",
      "cat": "users",
      "desc": "Set or display file mode creation mask, determining default permissions for newly created files.",
      "syntax": "umask [OPTIONS] [MASK]",
      "flags": [
        {
          "flag": "-S",
          "desc": "Print mask symbolically (e.g. u=rwx,g=rx,o=rx)"
        }
      ],
      "example": "umask 022",
      "explain": "Sets default creation mask: new files receive 644 and directories receive 755.",
      "tip": "The umask acts as a filter: default base permissions minus the mask equals final permissions."
    },
    {
      "name": "id",
      "cat": "users",
      "desc": "Print real and effective user ID (UID), group ID (GID), and secondary group memberships.",
      "syntax": "id [OPTIONS] [USER]",
      "flags": [
        {
          "flag": "-u",
          "desc": "Print only the numeric effective user ID"
        },
        {
          "flag": "-g",
          "desc": "Print only the effective group ID"
        },
        {
          "flag": "-G",
          "desc": "Print all group IDs the user belongs to"
        },
        {
          "flag": "-un",
          "desc": "Print user name instead of number"
        }
      ],
      "example": "id user",
      "explain": "Displays UID, primary GID, and supplemental group affiliations (sudo, docker, adm).",
      "tip": "UID 0 is reserved for root; any process running with UID 0 has full system power."
    },
    {
      "name": "groups",
      "cat": "users",
      "desc": "Print names of all groups that specified user accounts belong to.",
      "syntax": "groups [USER...]",
      "flags": [],
      "example": "groups user",
      "explain": "Lists all groups the current user is a member of (e.g., sudo, docker, adm).",
      "tip": "Check if you have sudo rights by seeing if \"sudo\" or \"wheel\" appears in your groups list."
    },
    {
      "name": "who",
      "cat": "users",
      "desc": "Show who is logged on to the system, their terminal line (pts/0), and login time.",
      "syntax": "who [OPTIONS]",
      "flags": [
        {
          "flag": "-b",
          "desc": "Show time of last system boot"
        },
        {
          "flag": "-q",
          "desc": "Quick mode: count and show usernames only"
        }
      ],
      "example": "who",
      "explain": "Lists all users with active terminal or SSH sessions.",
      "tip": "\"who am i\" shows the user identity and terminal line for your own current connection."
    },
    {
      "name": "w",
      "cat": "users",
      "desc": "Show who is logged on and what commands their active sessions are currently executing.",
      "syntax": "w [OPTIONS] [USER]",
      "flags": [
        {
          "flag": "-h",
          "desc": "Do not print header summary row"
        },
        {
          "flag": "-s",
          "desc": "Short format: omit login time and JCPU/PCPU times"
        }
      ],
      "example": "w",
      "explain": "Displays system load, logged-in users, idle times, and their running commands.",
      "tip": "Combines uptime, who, and ps into a comprehensive administrative summary."
    },
    {
      "name": "last",
      "cat": "users",
      "desc": "Show a listing of last logged in users from the system wtmp audit log.",
      "syntax": "last [OPTIONS] [USER...] [TTY...]",
      "flags": [
        {
          "flag": "-n NUM",
          "desc": "How many entries to show"
        },
        {
          "flag": "-i",
          "desc": "Display IP address in dotted-quad notation"
        }
      ],
      "example": "last -n 5",
      "explain": "Displays the 5 most recent user logins and reboots.",
      "tip": "Crucial security audit tool to verify when accounts logged in and from which IP address."
    },
    {
      "name": "su",
      "cat": "users",
      "desc": "Substitute user: change user ID or become superuser (root) in the current shell session.",
      "syntax": "su [OPTIONS] [USER]",
      "flags": [
        {
          "flag": "-",
          "desc": "Login shell: initialize environment as if the user logged in directly"
        },
        {
          "flag": "-c CMD",
          "desc": "Pass a single command to the shell without opening interactive session"
        }
      ],
      "example": "su - root",
      "explain": "Switches to the root user account with root's full environment variables and PATH.",
      "tip": "Always include the hyphen (\"su -\") so you inherit the target user's full PATH and profile."
    },
    {
      "name": "sudo",
      "cat": "users",
      "desc": "Execute a command with superuser (root) privileges as allowed by /etc/sudoers.",
      "syntax": "sudo [OPTIONS] COMMAND",
      "flags": [
        {
          "flag": "-i",
          "desc": "Simulate initial login as root (provides root shell and environment)"
        },
        {
          "flag": "-u USER",
          "desc": "Run command as specified user rather than root"
        },
        {
          "flag": "-l",
          "desc": "List allowed and forbidden commands for the current user"
        }
      ],
      "example": "sudo apt update",
      "explain": "Elevates privileges securely to update the system package database.",
      "tip": "Use \"sudo -i\" for an administrative root session instead of sharing the root password."
    },
    {
      "name": "useradd",
      "cat": "users",
      "desc": "Create a new user account on the Linux system.",
      "syntax": "useradd [OPTIONS] LOGIN",
      "flags": [
        {
          "flag": "-m",
          "desc": "Create the user's home directory (/home/username)"
        },
        {
          "flag": "-s SHELL",
          "desc": "Specify user's login shell (e.g. /bin/bash)"
        },
        {
          "flag": "-G GROUPS",
          "desc": "List of supplementary groups the user should join"
        }
      ],
      "example": "useradd -m -s /bin/bash developer",
      "explain": "Creates a new user named \"developer\" with a home folder and bash shell.",
      "tip": "Remember to set a password immediately after creation using \"passwd username\"."
    },
    {
      "name": "userdel",
      "cat": "users",
      "desc": "Delete a user account and associated system files.",
      "syntax": "userdel [OPTIONS] LOGIN",
      "flags": [
        {
          "flag": "-r",
          "desc": "Remove user's home directory and mail spool along with account"
        },
        {
          "flag": "-f",
          "desc": "Force removal of user account even if user is currently logged in"
        }
      ],
      "example": "userdel -r developer",
      "explain": "Deletes user account \"developer\" and completely removes /home/developer.",
      "tip": "Without \"-r\", the user account is removed but orphaned files remain on disk."
    },
    {
      "name": "tar",
      "cat": "archive",
      "desc": "Tape archive: pack multiple files and directory hierarchies into a single archive file, with optional compression.",
      "syntax": "tar [OPTIONS] [ARCHIVE_FILE] [FILES...]",
      "flags": [
        {
          "flag": "-c",
          "desc": "Create a new archive file"
        },
        {
          "flag": "-x",
          "desc": "Extract files from an archive"
        },
        {
          "flag": "-z",
          "desc": "Filter archive through gzip (.tar.gz)"
        },
        {
          "flag": "-j",
          "desc": "Filter archive through bzip2 (.tar.bz2)"
        },
        {
          "flag": "-v",
          "desc": "Verbosely list files processed"
        },
        {
          "flag": "-f FILE",
          "desc": "Use archive file name"
        }
      ],
      "example": "tar -czvf backup.tar.gz /home/user/docs",
      "explain": "Compresses docs folder into a gzip-compressed archive named backup.tar.gz.",
      "tip": "Golden mnemonic: \"c\" = Create, \"x\" = eXtract, \"z\" = gZip, \"v\" = Verbose, \"f\" = File!"
    },
    {
      "name": "gzip",
      "cat": "archive",
      "desc": "Compress files using Lempel-Ziv coding (LZ77) into .gz format.",
      "syntax": "gzip [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-d",
          "desc": "Decompress file (same as gunzip)"
        },
        {
          "flag": "-k",
          "desc": "Keep input files: do not delete original uncompressed file"
        },
        {
          "flag": "-9",
          "desc": "Maximum compression level"
        },
        {
          "flag": "-r",
          "desc": "Recursively compress all files in directories"
        }
      ],
      "example": "gzip -k notes.txt",
      "explain": "Compresses notes.txt into notes.txt.gz while preserving the original file.",
      "tip": "By default, gzip deletes the original file unless you specify \"-k\" (keep)!"
    },
    {
      "name": "gunzip",
      "cat": "archive",
      "desc": "Decompress files created with gzip (.gz archives).",
      "syntax": "gunzip [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-k",
          "desc": "Keep original .gz compressed file during decompression"
        },
        {
          "flag": "-v",
          "desc": "Verbose mode: display names and compression ratios"
        }
      ],
      "example": "gunzip -k notes.txt.gz",
      "explain": "Restores notes.txt from the compressed .gz file.",
      "tip": "\"gunzip file.gz\" is an alias for \"gzip -d file.gz\"."
    },
    {
      "name": "zip",
      "cat": "archive",
      "desc": "Package and compress files into standard .zip cross-platform archives.",
      "syntax": "zip [OPTIONS] ARCHIVE.ZIP [FILES...]",
      "flags": [
        {
          "flag": "-r",
          "desc": "Recurse into directories to include all nested files"
        },
        {
          "flag": "-e",
          "desc": "Encrypt the contents of the zip archive with password"
        },
        {
          "flag": "-q",
          "desc": "Quiet mode: suppress non-error messages"
        }
      ],
      "example": "zip -r project.zip src/ index.html",
      "explain": "Packages the source directory and index.html into a cross-platform zip archive.",
      "tip": "Zip archives are natively readable on Windows, macOS, and Linux without extra tools."
    },
    {
      "name": "unzip",
      "cat": "archive",
      "desc": "List, test, and extract compressed files from a ZIP archive.",
      "syntax": "unzip [OPTIONS] ARCHIVE.ZIP",
      "flags": [
        {
          "flag": "-l",
          "desc": "List archive contents without extracting"
        },
        {
          "flag": "-d DIR",
          "desc": "Extract files into specified destination directory"
        },
        {
          "flag": "-q",
          "desc": "Quiet mode"
        }
      ],
      "example": "unzip -l archive.zip",
      "explain": "Lists all files, sizes, and timestamps inside the zip archive without extracting.",
      "tip": "Always run \"unzip -l\" first to verify whether the archive unpacks into a single directory or creates clutter."
    },
    {
      "name": "bzip2",
      "cat": "archive",
      "desc": "Compress files using Burrows-Wheeler block sorting text compression (.bz2).",
      "syntax": "bzip2 [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-d",
          "desc": "Decompress file (bunzip2)"
        },
        {
          "flag": "-k",
          "desc": "Keep (don't delete) input files"
        },
        {
          "flag": "-9",
          "desc": "Set block size to 900k for maximum compression"
        }
      ],
      "example": "bzip2 -k database.sql",
      "explain": "Compresses SQL dump into database.sql.bz2 with higher compression ratios than gzip.",
      "tip": "bzip2 typically achieves higher compression than gzip on large text and log files."
    },
    {
      "name": "xz",
      "cat": "archive",
      "desc": "Compress or decompress .xz files using the high-ratio LZMA2 algorithm.",
      "syntax": "xz [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-d",
          "desc": "Decompress file (unxz)"
        },
        {
          "flag": "-k",
          "desc": "Keep original input file"
        },
        {
          "flag": "-9",
          "desc": "Maximum compression"
        }
      ],
      "example": "xz -k big_data.csv",
      "explain": "Compresses file using state-of-the-art LZMA algorithm for smallest possible size.",
      "tip": "Linux kernel source tarballs are distributed as .tar.xz for maximum compression."
    },
    {
      "name": "echo",
      "cat": "shell",
      "desc": "Print text, variable values, and formatted strings to standard output.",
      "syntax": "echo [OPTIONS] [STRING...]",
      "flags": [
        {
          "flag": "-e",
          "desc": "Enable interpretation of backslash escapes (\\n newline, \\t tab)"
        },
        {
          "flag": "-n",
          "desc": "Do not output trailing newline"
        }
      ],
      "example": "echo \"Welcome, $USER!\"",
      "explain": "Expands the environment variable $USER and prints the greeting message.",
      "tip": "Combine with redirection to create files: \"echo 'DEBUG=true' > .env\"."
    },
    {
      "name": "export",
      "cat": "shell",
      "desc": "Set export attribute for shell variables, making them available to child processes and subshells.",
      "syntax": "export [-n] [NAME[=VALUE] ...]",
      "flags": [
        {
          "flag": "-p",
          "desc": "Display a list of all exported variables"
        }
      ],
      "example": "export NODE_ENV=production",
      "explain": "Defines NODE_ENV and exports it so programs spawned in this shell can read it.",
      "tip": "Without export, a variable is local to the current shell only and unseen by running programs."
    },
    {
      "name": "env",
      "cat": "shell",
      "desc": "Display all exported environment variables, or run a program in a modified environment.",
      "syntax": "env [OPTIONS] [NAME=VALUE...] [COMMAND]",
      "flags": [
        {
          "flag": "-i",
          "desc": "Start with an empty environment"
        },
        {
          "flag": "-u NAME",
          "desc": "Unset variable from the environment"
        }
      ],
      "example": "env | grep -i path",
      "explain": "Displays the active system PATH containing directories searched for executable binaries.",
      "tip": "Use \"#!/usr/bin/env bash\" as the shebang line in scripts for portability across distributions."
    },
    {
      "name": "alias",
      "cat": "shell",
      "desc": "Create convenient shortcuts or abbreviations for long commands.",
      "syntax": "alias [NAME[=VALUE] ...]",
      "flags": [
        {
          "flag": "-p",
          "desc": "Print all defined aliases in reusable format"
        }
      ],
      "example": "alias ll=\"ls -lah\"",
      "explain": "Defines \"ll\" as an instant shortcut for \"ls -lah\".",
      "tip": "To make aliases permanent, add them to your \"~/.bashrc\" or \"~/.zshrc\" configuration file."
    },
    {
      "name": "history",
      "cat": "shell",
      "desc": "Display the session command history list with line numbers.",
      "syntax": "history [NUM]",
      "flags": [
        {
          "flag": "-c",
          "desc": "Clear the history list by deleting all entries"
        },
        {
          "flag": "-d OFFSET",
          "desc": "Delete the history entry at position OFFSET"
        }
      ],
      "example": "history | tail -n 10",
      "explain": "Shows the 10 most recently executed commands in the current shell.",
      "tip": "Re-run any history command by number using exclamation mark: \"!42\" runs command #42."
    },
    {
      "name": "source",
      "cat": "shell",
      "desc": "Execute commands from a file in the CURRENT shell environment (same as dot \".\").",
      "syntax": "source FILENAME [ARGUMENTS]",
      "flags": [],
      "example": "source ~/.bashrc",
      "explain": "Reloads shell configuration immediately without needing to close and reopen the terminal.",
      "tip": "Unlike executing \"./script.sh\" in a subshell, source modifies variables in your current shell!"
    },
    {
      "name": "basename",
      "cat": "shell",
      "desc": "Strip directory and suffix from filenames, returning only the filename portion.",
      "syntax": "basename NAME [SUFFIX]",
      "flags": [
        {
          "flag": "-a",
          "desc": "Support multiple arguments and treat each as a NAME"
        }
      ],
      "example": "basename /var/log/nginx/access.log",
      "explain": "Strips the directory paths to return just \"access.log\".",
      "tip": "Add a suffix argument: \"basename path/file.tar.gz .tar.gz\" returns just \"file\"."
    },
    {
      "name": "dirname",
      "cat": "shell",
      "desc": "Strip last component from file name, returning the parent directory path.",
      "syntax": "dirname [OPTIONS] NAME...",
      "flags": [],
      "example": "dirname /home/user/project/index.html",
      "explain": "Extracts the directory path \"/home/user/project\".",
      "tip": "Classic script idiom: \"SCRIPT_DIR=$(dirname $(realpath $0))\" locates a script's folder."
    },
    {
      "name": "which",
      "cat": "shell",
      "desc": "Locate an executable binary in the system PATH environment variable.",
      "syntax": "which [OPTIONS] PROGRAM_NAME...",
      "flags": [
        {
          "flag": "-a",
          "desc": "Print all matching pathnames of each argument"
        }
      ],
      "example": "which python3",
      "explain": "Returns the exact filesystem location of the active python3 binary (e.g. /usr/bin/python3).",
      "tip": "Use to verify which version of a binary runs when multiple environments are installed."
    },
    {
      "name": "type",
      "cat": "shell",
      "desc": "Display information about command type (shell builtin, alias, function, or disk executable).",
      "syntax": "type [OPTIONS] NAME...",
      "flags": [
        {
          "flag": "-t",
          "desc": "Output a single word: alias, keyword, function, builtin, or file"
        },
        {
          "flag": "-a",
          "desc": "Display all locations containing an executable named NAME"
        }
      ],
      "example": "type cd",
      "explain": "Reports that \"cd is a shell builtin\", explaining why no /bin/cd binary is needed.",
      "tip": "More informative than which because type identifies aliases and builtins correctly."
    },
    {
      "name": "expr",
      "cat": "shell",
      "desc": "Evaluate expressions and perform integer arithmetic, string comparisons, and regex matching.",
      "syntax": "expr EXPRESSION",
      "flags": [],
      "example": "expr 15 + 27",
      "explain": "Calculates the integer sum and prints 42 to the terminal.",
      "tip": "Operators must be separated by spaces: \"expr 2 + 2\", not \"expr 2+2\"."
    },
    {
      "name": "bc",
      "cat": "shell",
      "desc": "An arbitrary precision calculator language supporting floating point decimals and complex math.",
      "syntax": "bc [OPTIONS]",
      "flags": [
        {
          "flag": "-l",
          "desc": "Define the standard math library and set decimal scale to 20"
        }
      ],
      "example": "echo \"scale=4; 22 / 7\" | bc",
      "explain": "Calculates 22 divided by 7 with 4 decimal places of precision (3.1428).",
      "tip": "Set \"scale=N\" to control how many decimal digits bc calculates."
    },
    {
      "name": "seq",
      "cat": "shell",
      "desc": "Print a sequence of numbers from FIRST to LAST with optional INCREMENT step.",
      "syntax": "seq [OPTIONS] [FIRST [INCREMENT]] LAST",
      "flags": [
        {
          "flag": "-s STRING",
          "desc": "Use STRING to separate numbers (default is newline)"
        },
        {
          "flag": "-w",
          "desc": "Equalize width by padding with leading zeros"
        }
      ],
      "example": "seq 1 5",
      "explain": "Prints numbers 1 through 5, one per line.",
      "tip": "Handy for shell for-loops: \"for i in $(seq 1 10); do echo $i; done\"."
    },
    {
      "name": "factor",
      "cat": "shell",
      "desc": "Factor numbers into their mathematical prime factors.",
      "syntax": "factor [NUMBER...]",
      "flags": [],
      "example": "factor 42",
      "explain": "Computes prime factors of 42 to display \"42: 2 3 7\".",
      "tip": "A classic Unix math utility dating back to Version 6 Unix (1975)."
    },
    {
      "name": "cal",
      "cat": "shell",
      "desc": "Display a clean Gregorian calendar for current, specified, or full-year dates.",
      "syntax": "cal [OPTIONS] [MONTH] [YEAR]",
      "flags": [
        {
          "flag": "-3",
          "desc": "Display previous, current and next month"
        },
        {
          "flag": "-y",
          "desc": "Display a calendar for the entire current year"
        }
      ],
      "example": "cal 10 2026",
      "explain": "Displays the full calendar grid for October 2026.",
      "tip": "Quickly check weekday positions and month layouts without leaving your terminal."
    },
    {
      "name": "base64",
      "cat": "shell",
      "desc": "Base64 encode or decode data and print to standard output.",
      "syntax": "base64 [OPTIONS] [FILE]",
      "flags": [
        {
          "flag": "-d",
          "desc": "Decode data (reverses base64 into plain text/binary)"
        },
        {
          "flag": "-w COLS",
          "desc": "Wrap encoded lines after COLS characters (0 to disable)"
        }
      ],
      "example": "echo \"hello world\" | base64",
      "explain": "Encodes the text string into standard base64 \"aGVsbG8gd29ybGQK\".",
      "tip": "Decode tokens or credentials: \"echo 'aGVsbG8=' | base64 -d\"."
    },
    {
      "name": "md5sum",
      "cat": "shell",
      "desc": "Compute and check MD5 128-bit cryptographic message digests for file integrity.",
      "syntax": "md5sum [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-c FILE",
          "desc": "Read checksums from FILE and verify integrity against actual files"
        }
      ],
      "example": "md5sum /etc/os-release",
      "explain": "Generates a 32-character hexadecimal MD5 hash of the file.",
      "tip": "Use to verify that downloaded files were not corrupted in transit."
    },
    {
      "name": "sha256sum",
      "cat": "shell",
      "desc": "Compute and check SHA256 256-bit cryptographic hash for secure verification.",
      "syntax": "sha256sum [OPTIONS] [FILE...]",
      "flags": [
        {
          "flag": "-c FILE",
          "desc": "Read SHA256 sums from FILE and verify"
        }
      ],
      "example": "sha256sum /etc/os-release",
      "explain": "Computes SHA-256 checksum to guarantee file authenticity and detect modifications.",
      "tip": "Standard checksum used for verifying OS ISOs, software releases, and container layers."
    },
    {
      "name": "xargs",
      "cat": "shell",
      "desc": "Build and execute command lines from standard input lines or arguments.",
      "syntax": "xargs [OPTIONS] [COMMAND [INITIAL_ARGS...]]",
      "flags": [
        {
          "flag": "-I REPLACE",
          "desc": "Replace occurrences of REPLACE string with input items"
        },
        {
          "flag": "-n MAX",
          "desc": "Use at most MAX arguments per command line"
        },
        {
          "flag": "-0",
          "desc": "Input items are terminated by null character instead of whitespace"
        },
        {
          "flag": "-P MAX",
          "desc": "Run up to MAX parallel processes at a time"
        }
      ],
      "example": "echo \"f1.txt f2.txt\" | xargs touch",
      "explain": "Pipes file names into xargs, which passes them as arguments to touch.",
      "tip": "Safely handle file paths with spaces: \"find . -name '*.log' -print0 | xargs -0 rm\"."
    },
    {
      "name": "man",
      "cat": "shell",
      "desc": "System reference manual: interface to online reference manuals for commands, functions, and files.",
      "syntax": "man [OPTIONS] [SECTION] PAGE",
      "flags": [
        {
          "flag": "-k KEYWORD",
          "desc": "Search manual pages for keyword (same as apropos)"
        }
      ],
      "example": "man grep",
      "explain": "Opens the complete manual page describing grep, all options, and exit status codes.",
      "tip": "The ultimate source of truth in Linux! Inside man: press \"/\" to search and \"q\" to quit."
    }
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

    const CAT_LABELS = {
      files: 'Files & Dirs',
      text: 'Text Processing',
      sys: 'System & Info',
      net: 'Networking',
      proc: 'Processes',
      users: 'Users & Perms',
      archive: 'Archiving',
      shell: 'Shell & Math'
    };

    function renderCards() {
      const q = searchQuery.toLowerCase();
      const countEl = document.getElementById('cheatsheet-count');
      const filtered = CHEATSHEET_DATA.filter(cmd => {
        const matchesCat = activeCategory === 'all' || cmd.cat === activeCategory;
        const matchesSearch = !q ||
          cmd.name.toLowerCase().includes(q) ||
          cmd.desc.toLowerCase().includes(q) ||
          (cmd.syntax && cmd.syntax.toLowerCase().includes(q)) ||
          (cmd.example && cmd.example.toLowerCase().includes(q)) ||
          (cmd.explain && cmd.explain.toLowerCase().includes(q)) ||
          (cmd.tip && cmd.tip.toLowerCase().includes(q)) ||
          (cmd.flags && cmd.flags.some(f => f.flag.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q)));
        return matchesCat && matchesSearch;
      });

      if (countEl) {
        countEl.textContent = `${filtered.length} command${filtered.length === 1 ? '' : 's'}`;
      }

      if (!filtered.length) {
        content.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:50px 20px; color:var(--fg-dim);">
          <div style="font-size:2rem; margin-bottom:8px">🔍</div>
          <div>No commands matching "<strong>${Utils.escapeHtml(searchQuery)}</strong>"</div>
          <div style="font-size:0.8rem; margin-top:6px; color:var(--fg-muted)">Try searching by category, common flags (-la, -r), or command names.</div>
        </div>`;
        return;
      }

      content.innerHTML = filtered.map(cmd => {
        const flagsHtml = (cmd.flags && cmd.flags.length) ? `
          <div class="cmd-flags-wrap">
            <div class="cmd-sub-heading">⚡ Key Flags & Options:</div>
            <div class="cmd-flags-grid">
              ${cmd.flags.map(f => `
                <div class="cmd-flag-pill">
                  <code class="cmd-flag-badge">${Utils.escapeHtml(f.flag)}</code>
                  <span class="cmd-flag-text">${Utils.escapeHtml(f.desc)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : '';

        const tipHtml = cmd.tip ? `
          <div class="cmd-tip-box">
            <span class="cmd-tip-icon">💡</span>
            <div class="cmd-tip-body"><strong>Pro Tip:</strong> ${Utils.escapeHtml(cmd.tip)}</div>
          </div>
        ` : '';

        return `
          <div class="cmd-card" data-cmd="${Utils.escapeHtml(cmd.example)}">
            <div class="cmd-card-header">
              <div class="cmd-card-title-group">
                <span class="cmd-card-name">${Utils.escapeHtml(cmd.name)}</span>
                <span class="cmd-cat-badge cat-${cmd.cat}">${CAT_LABELS[cmd.cat] || cmd.cat}</span>
              </div>
              <div class="cmd-card-actions">
                <button class="cmd-btn-action btn-copy-cmd" title="Copy command" data-copy="${Utils.escapeHtml(cmd.example)}">📋 Copy</button>
                <button class="cmd-btn-action btn-run-cmd" title="Run in Terminal" data-run="${Utils.escapeHtml(cmd.example)}">⚡ Run</button>
              </div>
            </div>

            ${cmd.syntax ? `
              <div class="cmd-syntax-row">
                <span class="cmd-syntax-prefix">SYNTAX</span>
                <code class="cmd-syntax-code">${Utils.escapeHtml(cmd.syntax)}</code>
              </div>
            ` : ''}

            <div class="cmd-card-desc">${Utils.escapeHtml(cmd.desc)}</div>

            ${flagsHtml}

            <div class="cmd-example-section">
              <div class="cmd-sub-heading">💻 Practical Example:</div>
              <div class="cmd-example-code-bar">
                <code>$ ${Utils.escapeHtml(cmd.example)}</code>
                <button class="cmd-code-run-btn" title="Run in terminal" data-run="${Utils.escapeHtml(cmd.example)}">Run ⚡</button>
              </div>
              ${cmd.explain ? `<div class="cmd-example-explain">${Utils.escapeHtml(cmd.explain)}</div>` : ''}
            </div>

            ${tipHtml}
          </div>
        `;
      }).join('');

      // Wire Copy Buttons
      content.querySelectorAll('.btn-copy-cmd').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const text = btn.dataset.copy;
          if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
              const old = btn.textContent;
              btn.textContent = '✓ Copied!';
              btn.classList.add('copied');
              setTimeout(() => {
                btn.textContent = old;
                btn.classList.remove('copied');
              }, 1400);
            }).catch(() => {});
          }
        });
      });

      // Wire Run Buttons
      content.querySelectorAll('.btn-run-cmd, .cmd-code-run-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const cmdStr = btn.dataset.run;
          modal.classList.add('hidden');
          modal.setAttribute('aria-hidden', 'true');
          terminal.runCommand(cmdStr);
        });
      });

      // Wire Click Anywhere on Card to Run
      content.querySelectorAll('.cmd-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.cmd-btn-action') || e.target.closest('.cmd-code-run-btn')) return;
          const cmdStr = card.dataset.cmd;
          modal.classList.add('hidden');
          modal.setAttribute('aria-hidden', 'true');
          terminal.runCommand(cmdStr);
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

    let searchDebounce = null;
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        searchQuery = e.target.value.trim();
        renderCards();
      }, 40);
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
