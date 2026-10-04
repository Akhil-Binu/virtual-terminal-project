/**
 * terminal.js — Terminal UI Component for LinuxMaster
 * Handles rendering, keyboard input, autocomplete, history, and the nano/vim editor.
 */

class Terminal {
  constructor(containerEl, vfs, parser) {
    this.container = containerEl;
    this.vfs = vfs;
    this.parser = parser;

    this._history = [];
    this._historyIndex = -1;
    this._currentInput = '';

    this._inputEl = null;
    this._outputEl = null;
    this._promptEl = null;
    this._cursorEl = null;

    this._editorOpen = false;
    this._editorFile = null;
    this._editorMode = 'normal'; // 'normal' | 'insert'
    this._editorContent = '';
    this._editorCursor = 0;
    this._editorEl = null;
    this._editorCmd = 'nano';

    this._tabState = { suggestions: [], index: 0, prefix: '' };

    this._onCommandListeners = [];

    this._render();
    this._bindKeys();
    this._focusInput();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _render() {
    this.container.innerHTML = `
      <div class="term-header-bar">
        <div class="term-header-dots">
          <span class="term-dot dot-red" id="term-dot-close" title="End Session"></span>
          <span class="term-dot dot-yellow" id="term-dot-clear" title="Clear Screen"></span>
          <span class="term-dot dot-green" id="term-dot-fs" title="Toggle Fullscreen"></span>
        </div>
        <div class="term-header-title">bash — <span style="opacity:0.65">user@linuxmaster</span></div>
        <div class="term-header-actions">
          <button class="term-action-btn" id="btn-term-clear" title="Clear Terminal (Ctrl+L)">Clear</button>
          <button class="term-action-btn" id="btn-term-copy" title="Copy Output to Clipboard">Copy</button>
          <button class="term-action-btn" id="btn-term-fs" title="Fullscreen Terminal">⛶</button>
        </div>
      </div>
      <div class="term-wrapper" id="term-wrapper">
        <div class="term-output" id="term-output" aria-live="polite"></div>
        <div class="term-input-row" id="term-input-row">
          <span class="term-prompt" id="term-prompt">${this._buildPromptHTML()}</span>
          <div class="term-input-area">
            <span class="term-typed" id="term-typed"></span>
            <span class="term-cursor" id="term-cursor">█</span>
            <input class="term-hidden-input" id="term-hidden-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Terminal input">
          </div>
        </div>
      </div>
    `;

    this._outputEl  = this.container.querySelector('#term-output');
    this._promptEl  = this.container.querySelector('#term-prompt');
    this._typedEl   = this.container.querySelector('#term-typed');
    this._cursorEl  = this.container.querySelector('#term-cursor');
    this._inputEl   = this.container.querySelector('#term-hidden-input');

    // Titlebar action handlers
    const clearAction = () => { this.clear(); this._focusInput(); };
    this.container.querySelector('#btn-term-clear')?.addEventListener('click', clearAction);
    this.container.querySelector('#term-dot-clear')?.addEventListener('click', clearAction);

    const toggleFs = () => {
      const termPane = document.getElementById('terminal-pane');
      if (termPane) {
        termPane.classList.toggle('terminal-fullscreen');
        this._scrollToBottom();
        this._focusInput();
      }
    };
    this.container.querySelector('#btn-term-fs')?.addEventListener('click', toggleFs);
    this.container.querySelector('#term-dot-fs')?.addEventListener('click', toggleFs);

    this.container.querySelector('#btn-term-copy')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const text = this._outputEl.innerText || '';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          const oldText = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = oldText; }, 1500);
        });
      }
      this._focusInput();
    });

    this.container.querySelector('#term-dot-close')?.addEventListener('click', () => {
      this.appendLine('<span class="term-warn">Session terminated. Type exit or reset to start fresh.</span>');
    });

    // Welcome message
    this.appendHTML(WELCOME_BANNER);

    // Click on terminal focuses input
    this.container.addEventListener('click', (e) => {
      if (!e.target.closest('.term-header-bar') && !e.target.closest('.editor-overlay')) {
        this._focusInput();
      }
    });
  }

  _buildPromptHTML() {
    const user = this.vfs.getEnv('USER') || 'user';
    const host = this.vfs.getEnv('HOSTNAME') || 'linuxmaster';
    const path = Utils.escapeHtml(this.vfs.getPromptPath());
    return `<span class="prompt-user">${Utils.escapeHtml(user)}</span><span class="prompt-at">@</span><span class="prompt-host">${Utils.escapeHtml(host)}</span><span class="prompt-colon">:</span><span class="prompt-path">${path}</span><span class="prompt-dollar">$ </span>`;
  }

  updatePrompt() {
    if (this._promptEl) {
      this._promptEl.innerHTML = this._buildPromptHTML();
    }
  }

  // ── Key Binding ────────────────────────────────────────────────────────────

  _bindKeys() {
    this._inputEl.addEventListener('keydown', (e) => {
      if (this._editorOpen) {
        this._handleEditorKey(e);
        return;
      }
      this._handleTerminalKey(e);
    });

    this._inputEl.addEventListener('input', () => {
      if (this._editorOpen) return;
      this._currentInput = this._inputEl.value;
      this._typedEl.textContent = this._currentInput;
      this._tabState.suggestions = [];
    });
  }

  _handleTerminalKey(e) {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        this._submitCommand();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this._navigateHistory(-1);
        break;

      case 'ArrowDown':
        e.preventDefault();
        this._navigateHistory(1);
        break;

      case 'Tab':
        e.preventDefault();
        this._handleTab();
        break;

      case 'l':
      case 'L':
        if (e.ctrlKey) { e.preventDefault(); this.clear(); }
        break;

      case 'c':
      case 'C':
        if (e.ctrlKey) {
          e.preventDefault();
          this._cancelLine();
        }
        break;

      case 'u':
      case 'U':
        if (e.ctrlKey) {
          e.preventDefault();
          this._inputEl.value = '';
          this._currentInput = '';
          this._typedEl.textContent = '';
        }
        break;

      case 'a':
      case 'A':
        if (e.ctrlKey) {
          e.preventDefault();
          this._inputEl.setSelectionRange(0, 0);
        }
        break;
    }
  }

  _cancelLine() {
    const displayLine = this._buildPromptHTML() + `<span class="term-typed">${Utils.escapeHtml(this._currentInput)}</span><span style="color:#ff5555">^C</span>`;
    this._appendRawHTML(displayLine);
    this._inputEl.value = '';
    this._currentInput = '';
    this._typedEl.textContent = '';
    this._historyIndex = -1;
    this._scrollToBottom();
  }

  // ── Command Submission ─────────────────────────────────────────────────────

  _submitCommand() {
    const input = this._inputEl.value.trim();

    // Echo the command with prompt
    const echoLine = `<div class="term-line term-echo">${this._buildPromptHTML()}<span class="term-typed">${Utils.escapeHtml(this._inputEl.value)}</span></div>`;
    this._appendRawHTML(echoLine);

    if (input) {
      this._history.unshift(input);
      if (this._history.length > 500) this._history.pop();
    }
    this._historyIndex = -1;
    this._inputEl.value = '';
    this._currentInput = '';
    this._typedEl.textContent = '';

    if (input) {
      const output = this.parser.execute(input);
      if (output !== null && output !== undefined) {
        this.appendHTML(output);
      }
      // Notify listeners
      for (const fn of this._onCommandListeners) fn(input, this.vfs);
    }

    this._scrollToBottom();
    this.updatePrompt();
  }

  // ── History Navigation ─────────────────────────────────────────────────────

  _navigateHistory(dir) {
    const maxIndex = this._history.length - 1;
    this._historyIndex = Math.max(-1, Math.min(maxIndex, this._historyIndex + dir));

    const val = this._historyIndex >= 0 ? this._history[this._historyIndex] : '';
    this._inputEl.value = val;
    this._currentInput = val;
    this._typedEl.textContent = val;
    // Move cursor to end
    setTimeout(() => {
      this._inputEl.setSelectionRange(val.length, val.length);
    }, 0);
  }

  // ── Tab Autocomplete ───────────────────────────────────────────────────────

  _handleTab() {
    const lastDelim = Math.max(input.lastIndexOf('|'), input.lastIndexOf(';'), input.lastIndexOf('&&'));
    const prefixBefore = lastDelim !== -1 ? input.slice(0, lastDelim + 1) + ' ' : '';
    const currentSegment = lastDelim !== -1 ? input.slice(lastDelim + 1).trimStart() : input;
    const tokens = Utils.tokenize(currentSegment);

    const cmds = (this.parser && typeof this.parser.getSupportedCommands === 'function')
      ? this.parser.getSupportedCommands()
      : ['ls','cd','pwd','mkdir','rmdir','touch','rm','cp','mv','cat','echo','find','grep','chmod','chown','whoami','date','uname','clear','history','head','tail','wc','nano','vim','man','help','top','htop','ps','kill','env','export','alias','sort','uniq','cut','diff','file','stat','du','df','ln','printf','which','type'];

    if (tokens.length === 0 || (tokens.length === 1 && !currentSegment.includes(' '))) {
      // Complete command name
      const partial = tokens[0] || '';
      const matches = cmds.filter(c => c.startsWith(partial));
      if (matches.length === 1) {
        const newVal = prefixBefore + matches[0] + ' ';
        this._inputEl.value = newVal;
        this._currentInput = newVal;
        this._typedEl.textContent = newVal;
      } else if (matches.length > 1) {
        this.appendHTML('<span class="term-dim">' + matches.join('  ') + '</span>');
      }
      return;
    }

    // Complete path
    const lastToken = tokens[tokens.length - 1];
    const completions = this.vfs.listCompletions(lastToken);

    if (completions.length === 1) {
      tokens[tokens.length - 1] = completions[0];
      const newVal = prefixBefore + tokens.join(' ');
      this._inputEl.value = newVal;
      this._currentInput = newVal;
      this._typedEl.textContent = newVal;
    } else if (completions.length > 1) {
      // Find common prefix
      const common = this._commonPrefix(completions);
      if (common.length > lastToken.length) {
        tokens[tokens.length - 1] = common;
        const newVal = prefixBefore + tokens.join(' ');
        this._inputEl.value = newVal;
        this._currentInput = newVal;
        this._typedEl.textContent = newVal;
      }
      this.appendHTML('<span class="term-dim">' + completions.map(c => Utils.escapeHtml(c)).join('  ') + '</span>');
    }
  }

  _commonPrefix(strs) {
    if (!strs.length) return '';
    let prefix = strs[0];
    for (const s of strs.slice(1)) {
      while (!s.startsWith(prefix)) prefix = prefix.slice(0, -1);
    }
    return prefix;
  }

  // ── Output Helpers ─────────────────────────────────────────────────────────

  appendHTML(html) {
    if (!html && html !== 0) return;
    const lines = html.split('\n');
    for (const line of lines) {
      const div = document.createElement('div');
      div.className = 'term-line';
      div.innerHTML = line;
      this._outputEl.appendChild(div);
    }
    this._scrollToBottom();
  }

  appendLine(html) {
    this.appendHTML(html);
  }

  _appendRawHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    this._outputEl.appendChild(div);
  }

  clear() {
    this._outputEl.innerHTML = '';
  }

  _scrollToBottom() {
    const wrapper = this.container.querySelector('#term-wrapper');
    if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;
  }

  _focusInput() {
    if (this._inputEl) this._inputEl.focus();
  }

  getHistory() { return [...this._history].reverse(); }

  // ── Text Editor (nano/vim) ─────────────────────────────────────────────────

  openEditor(filename, editorType = 'nano') {
    this._editorOpen = true;
    this._editorFile = filename;
    this._editorCmd = editorType;
    this._editorMode = editorType === 'vim' ? 'normal' : 'insert';

    // Load file content if it exists
    if (filename) {
      const result = this.vfs.cat(filename);
      this._editorContent = result.success ? result.content : '';
    } else {
      this._editorContent = '';
    }

    this._editorCursor = this._editorContent.length;

    // Build editor overlay
    const editorHtml = `
      <div class="editor-overlay" id="editor-overlay">
        <div class="editor-titlebar">
          <span class="editor-title">${Utils.escapeHtml(editorType.toUpperCase())} — ${Utils.escapeHtml(filename || 'New File')}</span>
          <span class="editor-hint">${editorType === 'nano' ? 'Ctrl+S: Save | Ctrl+X: Exit' : 'ESC: Normal | i: Insert | :w Save | :q Quit'}</span>
        </div>
        <div class="editor-body" id="editor-body">
          <textarea class="editor-textarea" id="editor-textarea" spellcheck="false" autocomplete="off">${Utils.escapeHtml(this._editorContent)}</textarea>
        </div>
        <div class="editor-statusbar" id="editor-statusbar">
          <span id="editor-mode-label">${editorType === 'vim' ? '-- NORMAL --' : ''}</span>
          <span>${Utils.escapeHtml(filename || '[No Name]')}</span>
        </div>
        ${editorType === 'vim' ? '<div class="editor-vim-cmd" id="editor-vim-cmd"></div>' : ''}
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.innerHTML = editorHtml;
    document.getElementById('terminal-pane').appendChild(overlay.firstElementChild);

    this._editorEl = document.getElementById('editor-overlay');
    const textarea = document.getElementById('editor-textarea');

    // For nano: textarea is always editable
    // For vim: textarea is readonly in normal mode
    if (editorType === 'vim') {
      textarea.readOnly = true;
      textarea.style.caretColor = 'transparent';
    }

    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    // Bind editor-specific keys
    textarea.addEventListener('keydown', (e) => this._handleEditorKeyOnTextarea(e, textarea));
  }

  _handleEditorKeyOnTextarea(e, textarea) {
    if (this._editorCmd === 'nano') {
      this._handleNanoKey(e, textarea);
    } else {
      this._handleVimKey(e, textarea);
    }
  }

  _handleNanoKey(e, textarea) {
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      this._editorSave(textarea.value);
    } else if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
      e.preventDefault();
      this._editorSave(textarea.value);
      this._closeEditor();
    } else if (e.ctrlKey && (e.key === 'g' || e.key === 'G')) {
      e.preventDefault();
      // Show help in status bar
      document.getElementById('editor-statusbar').innerHTML = '<span>Ctrl+S: Save | Ctrl+X: Exit | Ctrl+G: Help</span>';
    }
  }

  _handleVimKey(e, textarea) {
    if (this._editorMode === 'normal') {
      if (e.key === 'i' || e.key === 'a' || e.key === 'o') {
        e.preventDefault();
        this._editorMode = 'insert';
        textarea.readOnly = false;
        textarea.style.caretColor = '';
        document.getElementById('editor-mode-label').textContent = '-- INSERT --';
      } else if (e.key === ':') {
        e.preventDefault();
        this._handleVimCommand(textarea);
      } else if (e.key === 'Escape') {
        e.preventDefault();
      }
    } else if (this._editorMode === 'insert') {
      if (e.key === 'Escape') {
        e.preventDefault();
        this._editorMode = 'normal';
        textarea.readOnly = true;
        textarea.style.caretColor = 'transparent';
        document.getElementById('editor-mode-label').textContent = '-- NORMAL --';
      }
    }
  }

  _handleVimCommand(textarea) {
    const cmd = prompt('Enter vim command (w, q, wq, q!):');
    if (!cmd) return;
    if (cmd === 'w' || cmd === 'wq' || cmd === 'x') {
      this._editorSave(textarea.value);
    }
    if (cmd === 'q' || cmd === 'wq' || cmd === 'x' || cmd === 'q!') {
      this._closeEditor();
    }
  }

  _handleEditorKey(e) {
    // This is for the hidden terminal input when editor is open — redirect to editor
    // Editor textarea captures keys directly, so we just prevent defaults here
    e.preventDefault();
  }

  _editorSave(content) {
    if (this._editorFile) {
      this.vfs.writeFile(this._editorFile, content);
      const statusbar = document.getElementById('editor-statusbar');
      if (statusbar) {
        statusbar.innerHTML = `<span style="color:#50fa7b">✓ Saved: ${Utils.escapeHtml(this._editorFile)}</span><span>${Utils.escapeHtml(this._editorFile)}</span>`;
        setTimeout(() => {
          if (statusbar) statusbar.innerHTML = `<span id="editor-mode-label"></span><span>${Utils.escapeHtml(this._editorFile)}</span>`;
        }, 2000);
      }
    }
  }

  _closeEditor() {
    if (this._editorEl) {
      this._editorEl.remove();
      this._editorEl = null;
    }
    this._editorOpen = false;
    this._editorFile = null;
    this._editorContent = '';
    // Re-focus hidden input
    this._focusInput();
    // Notify listeners (in case editor created a file)
    for (const fn of this._onCommandListeners) fn(`${this._editorCmd} (closed)`, this.vfs);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  onCommand(fn) {
    this._onCommandListeners.push(fn);
  }

  runCommand(cmd) {
    this._inputEl.value = cmd;
    this._currentInput = cmd;
    this._typedEl.textContent = cmd;
    this._submitCommand();
  }
}

// ── Welcome Banner ──────────────────────────────────────────────────────────
const WELCOME_BANNER = `<div class="welcome-banner">
<span style="color:#bd93f9;font-weight:bold">██╗     ██╗███╗   ██╗██╗   ██╗██╗  ██╗    ███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗ </span>
<span style="color:#bd93f9;font-weight:bold">██║     ██║████╗  ██║██║   ██║╚██╗██╔╝    ████╗ ████║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗</span>
<span style="color:#8be9fd;font-weight:bold">██║     ██║██╔██╗ ██║██║   ██║ ╚███╔╝     ██╔████╔██║███████║███████╗   ██║   █████╗  ██████╔╝</span>
<span style="color:#8be9fd;font-weight:bold">██║     ██║██║╚██╗██║██║   ██║ ██╔██╗     ██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗</span>
<span style="color:#50fa7b;font-weight:bold">███████╗██║██║ ╚████║╚██████╔╝██╔╝ ██╗    ██║ ╚═╝ ██║██║  ██║███████║   ██║   ███████╗██║  ██║</span>
<span style="color:#50fa7b;font-weight:bold">╚══════╝╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝    ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝</span>
<span style="color:#f1fa8c">                    Interactive Linux Terminal Learning Platform v1.0</span>
<span style="color:#6272a4">─────────────────────────────────────────────────────────────────────────────────────────</span>
<span style="color:#f8f8f2">Type <span style="color:#50fa7b">help</span> to see available commands. Select a lesson from the sidebar to begin learning.</span>
<span style="color:#6272a4">Tip: Use Tab for autocomplete, ↑/↓ for history, Ctrl+L to clear screen.</span>
<span style="color:#6272a4">─────────────────────────────────────────────────────────────────────────────────────────</span>
</div>`;

window.Terminal = Terminal;
