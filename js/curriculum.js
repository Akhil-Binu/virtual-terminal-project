/**
 * curriculum.js — A to Z Linux learning curriculum for LinuxMaster
 * Contains all 26 lessons with content, tasks, hints, and validation logic.
 */

const CURRICULUM = [
  // ── A ─────────────────────────────────────────────────────────────────────
  {
    id: 'A',
    title: 'A — Absolute & Relative Paths',
    icon: '📁',
    color: '#bd93f9',
    concept: `
<h3>Understanding Paths in Linux</h3>
<p>In Linux, every file and directory has a unique path. There are two types:</p>
<ul>
  <li><strong>Absolute Path</strong> — starts from the root <code>/</code> (e.g., <code>/home/user/Documents</code>)</li>
  <li><strong>Relative Path</strong> — relative to your current location (e.g., <code>Documents</code> or <code>../Downloads</code>)</li>
</ul>
<p>Special path symbols used in navigation:</p>
<ul>
  <li><code>.</code> — current directory (e.g., <code>cd .</code>, <code>ls -a .</code>)</li>
  <li><code>..</code> — parent directory (e.g., <code>cd ..</code> moves up one level)</li>
  <li><code>~</code> — your home directory (<code>/home/user</code>, e.g., <code>cd ~</code> or <code>cd</code>)</li>
  <li><code>/</code> — root filesystem directory (e.g., <code>cd /</code>)</li>
  <li><code>-</code> — previous directory (e.g., <code>cd -</code> switches back)</li>
</ul>
<h4>Essential Navigation Commands with Symbols:</h4>
<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:0.9em">
  <tr style="border-bottom:1px solid #44475a;color:#bd93f9">
    <th style="text-align:left;padding:5px">Command</th>
    <th style="text-align:left;padding:5px">Description</th>
  </tr>
  <tr><td style="padding:5px"><code>cd /etc</code></td><td style="padding:5px">Navigate using an absolute path from root <code>/</code></td></tr>
  <tr><td style="padding:5px"><code>cd ..</code></td><td style="padding:5px">Navigate up to parent directory</td></tr>
  <tr><td style="padding:5px"><code>cd .</code></td><td style="padding:5px">Stay in current directory</td></tr>
  <tr><td style="padding:5px"><code>cd ~</code> or <code>cd</code></td><td style="padding:5px">Return to home directory (<code>/home/user</code>)</td></tr>
  <tr><td style="padding:5px"><code>cd -</code></td><td style="padding:5px">Toggle back to the previous directory</td></tr>
  <tr><td style="padding:5px"><code>ls -a</code></td><td style="padding:5px">Show hidden files including <code>.</code> and <code>..</code></td></tr>
</table>
<h4>Real-World Use Case</h4>
<p>When writing shell scripts or configuring services, using absolute paths ensures the script works regardless of where it's run from.</p>
    `,
    task: 'Navigate to <code>/etc</code> using an absolute path (<code>cd /etc</code>), then return home using <code>cd ~</code> (or <code>cd</code>).',
    taskCommands: ['cd /etc', 'cd ~'],
    hints: [
      'Type <code>cd /etc</code> to navigate using an absolute path.',
      'Type <code>cd ~</code> (or simply <code>cd</code>) to return to your home directory.',
      'You can also try <code>cd ..</code> to go to the parent directory, or <code>cd -</code> to return to your previous directory!',
    ],
    solution: 'cd /etc\ncd ~',
    validate: (vfs, history) => {
      // Check that user visited /etc and returned to home
      const homePath = '/home/user';
      const visitedEtc = history.some(cmd => {
        const c = cmd.trim();
        return c === 'cd /etc' || c === 'cd /etc/' || c.startsWith('cd /etc');
      });
      const returnedHome = vfs.pwd() === homePath && history.some(cmd => {
        const c = cmd.trim();
        return c === 'cd ~' || c === 'cd' || c === 'cd /home/user' || c === '~' || c.startsWith('cd ~');
      });
      return visitedEtc && returnedHome;
    },
    validateMessage: 'Navigate to /etc with cd /etc, then return home with cd ~'
  },

  // ── B ─────────────────────────────────────────────────────────────────────
  {
    id: 'B',
    title: 'B — Basic Navigation (pwd, ls, cd)',
    icon: '🧭',
    color: '#50fa7b',
    concept: `
<h3>The Three Essential Navigation Commands</h3>
<p>Before anything else, master these three commands:</p>
<table style="width:100%;border-collapse:collapse;margin-top:8px">
  <tr style="border-bottom:1px solid #44475a">
    <th style="text-align:left;padding:6px;color:#bd93f9">Command</th>
    <th style="text-align:left;padding:6px;color:#bd93f9">Purpose</th>
    <th style="text-align:left;padding:6px;color:#bd93f9">Example</th>
  </tr>
  <tr><td style="padding:6px"><code>pwd</code></td><td style="padding:6px">Print Working Directory</td><td style="padding:6px"><code>pwd</code></td></tr>
  <tr><td style="padding:6px"><code>ls</code></td><td style="padding:6px">List directory contents</td><td style="padding:6px"><code>ls -la</code></td></tr>
  <tr><td style="padding:6px"><code>cd</code></td><td style="padding:6px">Change Directory</td><td style="padding:6px"><code>cd /tmp</code></td></tr>
</table>
<p style="margin-top:12px">Common <code>ls</code> flags: <code>-l</code> (long format), <code>-a</code> (show hidden), <code>-h</code> (human-readable sizes).</p>
    `,
    task: 'Run <code>pwd</code> to see where you are, then list all files (including hidden) in your home directory.',
    taskCommands: ['pwd', 'ls -la'],
    hints: [
      'Run <code>pwd</code> first to print the current directory.',
      'Use <code>ls -la</code> — <code>-l</code> gives long format, <code>-a</code> shows hidden files (starting with <code>.</code>).',
    ],
    solution: 'pwd\nls -la',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.trim() === 'ls -la' || cmd.trim() === 'ls -al');
    },
    validateMessage: 'Run pwd and then ls -la'
  },

  // ── C ─────────────────────────────────────────────────────────────────────
  {
    id: 'C',
    title: 'C — Creating Files & Directories',
    icon: '📝',
    color: '#ffb86c',
    concept: `
<h3>Creating Files and Directories</h3>
<p>Two fundamental creation commands:</p>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">touch filename     # Create an empty file (or update timestamp)
mkdir dirname      # Create a new directory
mkdir -p a/b/c     # Create nested directories at once</pre>
<h4>Real-World Use Case</h4>
<p>When starting a new project, you'd create a directory structure:</p>
<pre style="background:#282a36;padding:10px;border-radius:6px">mkdir -p myproject/{src,tests,docs}
touch myproject/README.md</pre>
    `,
    task: 'Create a directory named <code>myproject</code> inside your home directory, then create an empty file <code>README.md</code> inside it.',
    taskCommands: ['mkdir myproject', 'touch myproject/README.md'],
    hints: [
      'Use <code>mkdir myproject</code> to create the directory.',
      'Use <code>touch myproject/README.md</code> to create the file inside.',
    ],
    solution: 'mkdir myproject\ntouch myproject/README.md',
    validate: (vfs, history) => {
      return vfs.isDirectory('myproject') && vfs.nodeExists('myproject/README.md');
    },
    validateMessage: 'Create directory myproject and file myproject/README.md'
  },

  // ── D ─────────────────────────────────────────────────────────────────────
  {
    id: 'D',
    title: 'D — Deleting Files & Directories',
    icon: '🗑️',
    color: '#ff5555',
    concept: `
<h3>Removing Files and Directories</h3>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">rm file.txt        # Delete a file
rm -r directory/   # Delete directory and its contents (recursive)
rm -rf dir/        # Force delete (no prompts) — USE WITH CAUTION
rmdir emptydir/    # Delete only empty directories</pre>
<div style="background:#44475a;border-left:4px solid #ff5555;padding:10px;border-radius:4px;margin-top:8px">
  ⚠️ <strong>Warning:</strong> <code>rm</code> is permanent! There's no Recycle Bin in Linux.
  Always double-check before running <code>rm -rf</code>.
</div>
    `,
    task: 'Create a file called <code>trash.txt</code>, then delete it. Also try creating and removing an empty directory.',
    taskCommands: ['touch trash.txt', 'rm trash.txt'],
    hints: [
      'First create the file: <code>touch trash.txt</code>',
      'Then delete it: <code>rm trash.txt</code>',
      'For a directory: <code>mkdir emptydir && rmdir emptydir</code>',
    ],
    solution: 'touch trash.txt\nrm trash.txt',
    validate: (vfs, history) => {
      return !vfs.nodeExists('trash.txt') && history.some(cmd => cmd.includes('rm'));
    },
    validateMessage: 'Create and then delete trash.txt using rm'
  },

  // ── E ─────────────────────────────────────────────────────────────────────
  {
    id: 'E',
    title: 'E — Echo & Environment Variables',
    icon: '📢',
    color: '#8be9fd',
    concept: `
<h3>Echo and Environment Variables</h3>
<p><code>echo</code> prints text to the terminal. Combined with environment variables (prefixed with <code>$</code>), it's very powerful.</p>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">echo "Hello World"         # Print a string
echo $HOME                 # Print HOME variable value
echo $USER                 # Print current user
echo $PATH                 # Print executable search path
export MY_VAR="hello"      # Set a new environment variable
echo $MY_VAR               # Print it</pre>
    `,
    task: 'Print your home directory using <code>echo $HOME</code>, then create a file and write text into it using echo with redirection.',
    taskCommands: ['echo $HOME', 'echo "Hello Linux" > hello.txt'],
    hints: [
      'Run <code>echo $HOME</code> to see your home path.',
      'Use <code>echo "Hello Linux" > hello.txt</code> to write text to a file.',
    ],
    solution: 'echo $HOME\necho "Hello Linux" > hello.txt',
    validate: (vfs, history) => {
      return vfs.nodeExists('hello.txt') && history.some(cmd => cmd.includes('echo') && cmd.includes('$HOME'));
    },
    validateMessage: 'Use echo $HOME and create hello.txt with echo redirection'
  },

  // ── F ─────────────────────────────────────────────────────────────────────
  {
    id: 'F',
    title: 'F — File Viewing (cat, head, tail)',
    icon: '👁️',
    color: '#f1fa8c',
    concept: `
<h3>Viewing File Contents</h3>
<table style="width:100%;border-collapse:collapse;margin:8px 0">
  <tr style="border-bottom:1px solid #44475a">
    <th style="text-align:left;padding:6px;color:#bd93f9">Command</th>
    <th style="text-align:left;padding:6px;color:#bd93f9">Description</th>
  </tr>
  <tr><td style="padding:6px"><code>cat file</code></td><td style="padding:6px">Display entire file</td></tr>
  <tr><td style="padding:6px"><code>head -n 5 file</code></td><td style="padding:6px">First 5 lines</td></tr>
  <tr><td style="padding:6px"><code>tail -n 5 file</code></td><td style="padding:6px">Last 5 lines</td></tr>
  <tr><td style="padding:6px"><code>wc -l file</code></td><td style="padding:6px">Count lines</td></tr>
</table>
<h4>Real-World Use Case</h4>
<p><code>tail -f /var/log/syslog</code> is used in production to watch log files in real time.</p>
    `,
    task: 'View the contents of <code>/etc/os-release</code> using cat, then show only the first 3 lines using head.',
    taskCommands: ['cat /etc/os-release', 'head -n 3 /etc/os-release'],
    hints: [
      'Run <code>cat /etc/os-release</code> to display the full file.',
      'Run <code>head -n 3 /etc/os-release</code> to see only the first 3 lines.',
    ],
    solution: 'cat /etc/os-release\nhead -n 3 /etc/os-release',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.includes('cat') && cmd.includes('os-release')) &&
             history.some(cmd => cmd.includes('head') && cmd.includes('os-release'));
    },
    validateMessage: 'Use cat and head on /etc/os-release'
  },

  // ── G ─────────────────────────────────────────────────────────────────────
  {
    id: 'G',
    title: 'G — Grep: Searching Text',
    icon: '🔍',
    color: '#50fa7b',
    concept: `
<h3>Searching with grep</h3>
<p><code>grep</code> is one of the most powerful text search tools in Linux.</p>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">grep "pattern" file        # Find lines containing pattern
grep -i "pattern" file     # Case-insensitive search
grep -n "pattern" file     # Show line numbers
grep -r "pattern" dir/     # Recursive search in directory
grep -v "pattern" file     # Invert: lines NOT matching</pre>
<h4>Real-World Use Case</h4>
<p><code>grep -r "TODO" ./src/</code> — Find all TODO comments in source code.</p>
    `,
    task: 'Search for the word "user" in <code>/etc/passwd</code> and show line numbers.',
    taskCommands: ['grep -n "user" /etc/passwd'],
    hints: [
      'Use <code>grep -n "user" /etc/passwd</code>',
      'The <code>-n</code> flag adds line numbers to the output.',
    ],
    solution: 'grep -n "user" /etc/passwd',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.includes('grep') && cmd.includes('passwd'));
    },
    validateMessage: 'Use grep to search in /etc/passwd'
  },

  // ── H ─────────────────────────────────────────────────────────────────────
  {
    id: 'H',
    title: 'H — History & Shell Shortcuts',
    icon: '⏮️',
    color: '#bd93f9',
    concept: `
<h3>Command History and Shortcuts</h3>
<p>The shell remembers your previous commands. Use these shortcuts to work faster:</p>
<table style="width:100%;border-collapse:collapse;margin:8px 0">
  <tr style="border-bottom:1px solid #44475a">
    <th style="text-align:left;padding:6px;color:#bd93f9">Shortcut</th>
    <th style="text-align:left;padding:6px;color:#bd93f9">Action</th>
  </tr>
  <tr><td style="padding:6px"><code>↑ / ↓</code></td><td style="padding:6px">Navigate command history</td></tr>
  <tr><td style="padding:6px"><code>Tab</code></td><td style="padding:6px">Autocomplete command or path</td></tr>
  <tr><td style="padding:6px"><code>Ctrl+L</code></td><td style="padding:6px">Clear the terminal</td></tr>
  <tr><td style="padding:6px"><code>Ctrl+C</code></td><td style="padding:6px">Cancel current command</td></tr>
  <tr><td style="padding:6px"><code>history</code></td><td style="padding:6px">View command history list</td></tr>
</table>
    `,
    task: 'Run the <code>history</code> command to see your command history.',
    taskCommands: ['history'],
    hints: [
      'Simply type <code>history</code> and press Enter.',
      'Try pressing the ↑ arrow key to scroll through previous commands.',
    ],
    solution: 'history',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.trim() === 'history');
    },
    validateMessage: 'Run the history command'
  },

  // ── I ─────────────────────────────────────────────────────────────────────
  {
    id: 'I',
    title: 'I — Input/Output Redirection',
    icon: '↔️',
    color: '#8be9fd',
    concept: `
<h3>Redirection & Piping</h3>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">command > file.txt    # Redirect output to file (overwrite)
command >> file.txt   # Append output to file
command1 | command2   # Pipe: output of cmd1 becomes input of cmd2</pre>
<h4>Practical Examples</h4>
<pre style="background:#282a36;padding:10px;border-radius:6px">ls -la > listing.txt          # Save directory listing to file
cat file.txt | grep "error"   # Find errors in a file
echo "line2" >> notes.txt     # Append a line to notes</pre>
    `,
    task: 'List all files in <code>/etc</code> and save the output to <code>etc_listing.txt</code> in your home directory.',
    taskCommands: ['ls /etc > etc_listing.txt'],
    hints: [
      'Use <code>ls /etc > etc_listing.txt</code>',
      'Then verify with <code>cat etc_listing.txt</code>',
    ],
    solution: 'ls /etc > etc_listing.txt',
    validate: (vfs, history) => {
      return vfs.nodeExists('etc_listing.txt');
    },
    validateMessage: 'Create etc_listing.txt using output redirection'
  },

  // ── J ─────────────────────────────────────────────────────────────────────
  {
    id: 'J',
    title: 'J — Joining & Moving Files (cp, mv)',
    icon: '🔀',
    color: '#ffb86c',
    concept: `
<h3>Copying and Moving Files</h3>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">cp source dest          # Copy file
cp -r src_dir/ dest/    # Copy directory recursively
mv oldname newname      # Rename file
mv file /new/path/      # Move file to new location</pre>
<h4>Real-World Examples</h4>
<pre style="background:#282a36;padding:10px;border-radius:6px">cp config.bak config.cfg       # Restore backup
mv app_v1.py app_v2.py         # Rename versioned file
cp -r project/ /opt/deploy/    # Deploy project</pre>
    `,
    task: 'Copy <code>readme.txt</code> to <code>readme_backup.txt</code>, then rename the backup to <code>readme_copy.txt</code>.',
    taskCommands: ['cp readme.txt readme_backup.txt', 'mv readme_backup.txt readme_copy.txt'],
    hints: [
      'Use <code>cp readme.txt readme_backup.txt</code> to create a copy.',
      'Use <code>mv readme_backup.txt readme_copy.txt</code> to rename it.',
    ],
    solution: 'cp readme.txt readme_backup.txt\nmv readme_backup.txt readme_copy.txt',
    validate: (vfs, history) => {
      return vfs.nodeExists('readme_copy.txt') && !vfs.nodeExists('readme_backup.txt');
    },
    validateMessage: 'Copy readme.txt and rename the copy to readme_copy.txt'
  },

  // ── K ─────────────────────────────────────────────────────────────────────
  {
    id: 'K',
    title: 'K — Kill Processes (ps, kill)',
    icon: '⚡',
    color: '#ff5555',
    concept: `
<h3>Managing Processes</h3>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">ps aux              # List all running processes
ps aux | grep name  # Find specific process
kill PID            # Send SIGTERM to process
kill -9 PID         # Force kill (SIGKILL)
top                 # Interactive process monitor</pre>
<h4>Common Signals</h4>
<ul>
  <li><code>SIGTERM (15)</code> — Graceful shutdown request</li>
  <li><code>SIGKILL (9)</code> — Force kill (cannot be caught)</li>
  <li><code>SIGHUP (1)</code> — Reload configuration</li>
</ul>
    `,
    task: 'Use <code>ps aux</code> to view running processes, then use <code>top</code> to see system resources.',
    taskCommands: ['ps aux', 'top'],
    hints: [
      'Run <code>ps aux</code> to list all processes.',
      'Run <code>top</code> to see a dynamic process view.',
    ],
    solution: 'ps aux\ntop',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.includes('ps')) && history.some(cmd => cmd === 'top' || cmd === 'htop');
    },
    validateMessage: 'Run ps aux and top commands'
  },

  // ── L ─────────────────────────────────────────────────────────────────────
  {
    id: 'L',
    title: 'L — Links (Hard & Symbolic)',
    icon: '🔗',
    color: '#8be9fd',
    concept: `
<h3>Hard Links and Symbolic Links</h3>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">ln target linkname        # Create a hard link
ln -s target linkname     # Create a symbolic (soft) link</pre>
<h4>Difference</h4>
<ul>
  <li><strong>Hard link</strong> — Points to the same inode (data). Deleting original doesn't break it.</li>
  <li><strong>Symbolic link</strong> — Points to the path. Breaking if original is deleted.</li>
</ul>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin-top:8px">ln -s /home/user/projects ~/proj   # Quick shortcut to long path</pre>
    `,
    task: 'Create a symbolic link named <code>home_link</code> pointing to <code>/home/user</code>.',
    taskCommands: ['ln -s /home/user home_link'],
    hints: [
      'Use <code>ln -s /home/user home_link</code>',
      'The <code>-s</code> flag creates a symbolic (soft) link.',
    ],
    solution: 'ln -s /home/user home_link',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.includes('ln') && cmd.includes('-s'));
    },
    validateMessage: 'Create a symbolic link using ln -s'
  },

  // ── M ─────────────────────────────────────────────────────────────────────
  {
    id: 'M',
    title: 'M — Man Pages & Help',
    icon: '📖',
    color: '#f1fa8c',
    concept: `
<h3>Getting Help in Linux</h3>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">man command       # Full manual page
command --help    # Quick help summary
help              # Built-in shell help
type command      # Show where a command comes from
which command     # Show full path of command</pre>
<h4>Man Page Sections</h4>
<ul>
  <li><code>1</code> — User commands</li>
  <li><code>5</code> — Configuration files</li>
  <li><code>8</code> — Admin commands</li>
</ul>
    `,
    task: 'Read the man page for <code>grep</code> using <code>man grep</code>.',
    taskCommands: ['man grep'],
    hints: [
      'Type <code>man grep</code> to open the grep manual page.',
      'You can also try <code>man ls</code> or <code>man chmod</code>.',
    ],
    solution: 'man grep',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.includes('man'));
    },
    validateMessage: 'Use the man command to read a manual page'
  },

  // ── N ─────────────────────────────────────────────────────────────────────
  {
    id: 'N',
    title: 'N — Nano Text Editor',
    icon: '✏️',
    color: '#50fa7b',
    concept: `
<h3>Editing Files with Nano</h3>
<p>Nano is a beginner-friendly terminal text editor. Open a file with:</p>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">nano filename.txt</pre>
<h4>Nano Keybindings</h4>
<table style="width:100%;border-collapse:collapse;margin:8px 0">
  <tr><td style="padding:4px"><code>Ctrl+S</code></td><td style="padding:4px">Save</td></tr>
  <tr><td style="padding:4px"><code>Ctrl+X</code></td><td style="padding:4px">Exit</td></tr>
  <tr><td style="padding:4px"><code>Ctrl+G</code></td><td style="padding:4px">Show help</td></tr>
</table>
<p><strong>vim</strong> is also available — a more advanced modal editor.</p>
    `,
    task: 'Open <code>nano</code> to create or edit a file called <code>notes.txt</code>.',
    taskCommands: ['nano notes.txt'],
    hints: [
      'Type <code>nano notes.txt</code> to open the editor.',
      'Inside the editor, type your text, then press Ctrl+S to save and Ctrl+X to exit.',
    ],
    solution: 'nano notes.txt',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.includes('nano') || cmd.includes('vim'));
    },
    validateMessage: 'Open nano or vim to edit a file'
  },

  // ── O ─────────────────────────────────────────────────────────────────────
  {
    id: 'O',
    title: 'O — Ownership (chown, chmod)',
    icon: '🔐',
    color: '#ff79c6',
    concept: `
<h3>File Ownership and Permissions</h3>
<p>Every file in Linux has an <strong>owner</strong>, a <strong>group</strong>, and <strong>permission bits</strong>.</p>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">ls -l file      # See permissions
chmod 755 file  # Set permissions (rwxr-xr-x)
chmod +x file   # Add execute permission
chown user file # Change owner
chown user:group file  # Change owner and group</pre>
<h4>Permission Notation</h4>
<pre style="background:#282a36;padding:10px;border-radius:6px">-rwxr-xr-x
 ^^^   = owner (rwx = read, write, execute)
    ^^^= group (r-x = read, execute)
       ^^^= others (r-x)</pre>
    `,
    task: 'Create a file <code>script.sh</code> and make it executable using <code>chmod</code>.',
    taskCommands: ['touch script.sh', 'chmod 755 script.sh'],
    hints: [
      'First create the file: <code>touch script.sh</code>',
      'Then make it executable: <code>chmod 755 script.sh</code> or <code>chmod +x script.sh</code>',
    ],
    solution: 'touch script.sh\nchmod 755 script.sh',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.includes('chmod') && (cmd.includes('script.sh') || cmd.includes('+x')));
    },
    validateMessage: 'Create script.sh and chmod it to executable'
  },

  // ── P ─────────────────────────────────────────────────────────────────────
  {
    id: 'P',
    title: 'P — Pipes & Pipelines',
    icon: '🔧',
    color: '#8be9fd',
    concept: `
<h3>Building Command Pipelines</h3>
<p>Pipes (<code>|</code>) connect commands, passing output from one to the next.</p>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">ls -la | grep ".txt"            # Filter ls output
cat file.txt | wc -l            # Count lines in file
ps aux | grep "bash"            # Find bash processes
cat /etc/passwd | sort | uniq   # Sort unique users</pre>
<h4>Chain as many as you need:</h4>
<pre style="background:#282a36;padding:10px;border-radius:6px">ls /etc | sort | head -10   # First 10 sorted /etc entries</pre>
    `,
    task: 'List all files in <code>/etc</code> and pipe the output to <code>grep</code> to find only files containing the word "host".',
    taskCommands: ['ls /etc | grep "host"'],
    hints: [
      'Use <code>ls /etc | grep "host"</code>',
      'The output of <code>ls /etc</code> is piped as input to <code>grep</code>.',
    ],
    solution: 'ls /etc | grep "host"',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.includes('|') && cmd.includes('grep'));
    },
    validateMessage: 'Use a pipe with grep to filter output'
  },

  // ── Q ─────────────────────────────────────────────────────────────────────
  {
    id: 'Q',
    title: 'Q — Querying System Info (uname, date, df)',
    icon: '💻',
    color: '#bd93f9',
    concept: `
<h3>System Information Commands</h3>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">uname -a          # Full system info (kernel, arch)
date              # Current date and time
df -h             # Disk space (human-readable)
du -sh dir/       # Directory size
whoami            # Current user name
hostname          # Machine name
uptime            # How long the system's been running</pre>
    `,
    task: 'Run <code>uname -a</code> to see system info, then check disk space with <code>df -h</code>.',
    taskCommands: ['uname -a', 'df -h'],
    hints: [
      'Type <code>uname -a</code> for kernel and system information.',
      'Type <code>df -h</code> to view disk usage in human-readable format.',
    ],
    solution: 'uname -a\ndf -h',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.includes('uname')) && history.some(cmd => cmd.includes('df'));
    },
    validateMessage: 'Run uname -a and df -h'
  },

  // ── R ─────────────────────────────────────────────────────────────────────
  {
    id: 'R',
    title: 'R — Recursion in File Operations',
    icon: '🔄',
    color: '#ffb86c',
    concept: `
<h3>Recursive Operations</h3>
<p>The <code>-r</code> flag makes commands work recursively through directory trees.</p>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">cp -r src/ dest/        # Copy entire directory tree
rm -r olddir/           # Delete directory recursively
find . -type f          # Find all files recursively
grep -r "pattern" dir/  # Search all files in directory</pre>
<h4>Real-World Use Case</h4>
<pre style="background:#282a36;padding:10px;border-radius:6px">cp -r /var/www/html /var/backup/   # Backup a web directory</pre>
    `,
    task: 'Create a nested directory structure <code>project/src/utils</code> using <code>mkdir -p</code>, then copy it recursively.',
    taskCommands: ['mkdir -p project/src/utils', 'cp -r project/ project_backup/'],
    hints: [
      'Use <code>mkdir -p project/src/utils</code> to create nested directories.',
      'Use <code>cp -r project/ project_backup/</code> to recursively copy it.',
    ],
    solution: 'mkdir -p project/src/utils\ncp -r project/ project_backup/',
    validate: (vfs, history) => {
      return vfs.isDirectory('project/src/utils');
    },
    validateMessage: 'Create nested directories with mkdir -p'
  },

  // ── S ─────────────────────────────────────────────────────────────────────
  {
    id: 'S',
    title: 'S — Searching with find',
    icon: '🔎',
    color: '#50fa7b',
    concept: `
<h3>The find Command</h3>
<p><code>find</code> is the most powerful file search tool in Linux.</p>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">find . -name "*.txt"         # Find all .txt files
find / -type d -name "logs"  # Find directories named logs
find /home -type f           # Find all files in /home
find . -name "*.sh" -type f  # Find shell scripts</pre>
<h4>Real-World Use Case</h4>
<pre style="background:#282a36;padding:10px;border-radius:6px">find /var/log -name "*.log" | grep "error"  # Find error logs</pre>
    `,
    task: 'Use <code>find</code> to locate all files in <code>/etc</code> (use <code>-type f</code>).',
    taskCommands: ['find /etc -type f'],
    hints: [
      'Use <code>find /etc -type f</code>',
      'The <code>-type f</code> option filters for regular files only (not directories).',
    ],
    solution: 'find /etc -type f',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.includes('find') && cmd.includes('-type'));
    },
    validateMessage: 'Use find with -type flag'
  },

  // ── T ─────────────────────────────────────────────────────────────────────
  {
    id: 'T',
    title: 'T — Text Processing (wc, sort, cut)',
    icon: '📊',
    color: '#f1fa8c',
    concept: `
<h3>Text Processing Utilities</h3>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">wc -l file       # Count lines
wc -w file       # Count words
sort file        # Sort lines alphabetically
sort -n file     # Sort numerically
sort -r file     # Reverse sort
cut -d: -f1 /etc/passwd   # Extract field from delimited file</pre>
<h4>Pipeline Example</h4>
<pre style="background:#282a36;padding:10px;border-radius:6px">cat /etc/passwd | cut -d: -f1 | sort   # Sorted user list</pre>
    `,
    task: 'Count the lines in <code>/etc/passwd</code> using <code>wc -l</code>, then sort the file.',
    taskCommands: ['wc -l /etc/passwd', 'sort /etc/passwd'],
    hints: [
      'Use <code>wc -l /etc/passwd</code> to count lines.',
      'Use <code>sort /etc/passwd</code> to sort the content.',
    ],
    solution: 'wc -l /etc/passwd\nsort /etc/passwd',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.includes('wc') && cmd.includes('passwd'));
    },
    validateMessage: 'Use wc -l on /etc/passwd'
  },

  // ── U ─────────────────────────────────────────────────────────────────────
  {
    id: 'U',
    title: 'U — Users and Permissions',
    icon: '👤',
    color: '#ff79c6',
    concept: `
<h3>User Management Concepts</h3>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">whoami                # Print current username
id                    # User and group IDs
cat /etc/passwd       # User database
cat /etc/group        # Group database

# Permission bits (octal)
# 4 = read (r)
# 2 = write (w)
# 1 = execute (x)
# Combined: 7=rwx, 6=rw-, 5=r-x, 4=r--</pre>
    `,
    task: 'Check who you are with <code>whoami</code>, then look at your user entry in <code>/etc/passwd</code>.',
    taskCommands: ['whoami', 'grep "user" /etc/passwd'],
    hints: [
      'Run <code>whoami</code> to see the current user.',
      'Run <code>grep "user" /etc/passwd</code> to see the user record.',
    ],
    solution: 'whoami\ngrep "user" /etc/passwd',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.trim() === 'whoami');
    },
    validateMessage: 'Run whoami'
  },

  // ── V ─────────────────────────────────────────────────────────────────────
  {
    id: 'V',
    title: 'V — Vim Basics',
    icon: '📝',
    color: '#8be9fd',
    concept: `
<h3>Vim — The Programmer's Editor</h3>
<p>Vim is a powerful modal text editor used by developers worldwide.</p>
<h4>Modes</h4>
<ul>
  <li><strong>Normal Mode</strong> (default) — navigate and run commands</li>
  <li><strong>Insert Mode</strong> (<code>i</code>) — type text</li>
  <li><strong>Visual Mode</strong> (<code>v</code>) — select text</li>
</ul>
<h4>Essential Keybindings</h4>
<table style="width:100%;border-collapse:collapse;margin:8px 0">
  <tr><td style="padding:4px"><code>i</code></td><td style="padding:4px">Enter Insert mode</td></tr>
  <tr><td style="padding:4px"><code>Esc</code></td><td style="padding:4px">Return to Normal mode</td></tr>
  <tr><td style="padding:4px"><code>:w</code></td><td style="padding:4px">Save (write)</td></tr>
  <tr><td style="padding:4px"><code>:q</code></td><td style="padding:4px">Quit</td></tr>
  <tr><td style="padding:4px"><code>:wq</code></td><td style="padding:4px">Save and quit</td></tr>
</table>
    `,
    task: 'Open <code>vim</code> and create a file called <code>vimtest.txt</code>.',
    taskCommands: ['vim vimtest.txt'],
    hints: [
      'Type <code>vim vimtest.txt</code> to open the editor.',
      'Press <code>i</code> to enter Insert mode, type text, press Esc, then <code>:wq</code> to save and quit.',
    ],
    solution: 'vim vimtest.txt',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.includes('vim'));
    },
    validateMessage: 'Open vim editor'
  },

  // ── W ─────────────────────────────────────────────────────────────────────
  {
    id: 'W',
    title: 'W — Writing & Appending to Files',
    icon: '📤',
    color: '#50fa7b',
    concept: `
<h3>Writing to Files</h3>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">echo "text" > file.txt     # Overwrite file with text
echo "more" >> file.txt    # Append text to file
printf "line1\nline2\n" > file.txt  # Write formatted text</pre>
<h4>Practical Example — Creating a Script</h4>
<pre style="background:#282a36;padding:10px;border-radius:6px">echo "#!/bin/bash" > deploy.sh
echo "echo Deploying..." >> deploy.sh
echo "cp -r . /opt/app" >> deploy.sh
chmod +x deploy.sh</pre>
    `,
    task: 'Create a file <code>log.txt</code> and write three lines to it using echo with <code>></code> and <code>>></code>.',
    taskCommands: ['echo "Line 1" > log.txt', 'echo "Line 2" >> log.txt', 'echo "Line 3" >> log.txt'],
    hints: [
      'Use <code>echo "Line 1" > log.txt</code> to create and write.',
      'Use <code>echo "Line 2" >> log.txt</code> to append.',
      'Verify with <code>cat log.txt</code>.',
    ],
    solution: 'echo "Line 1" > log.txt\necho "Line 2" >> log.txt\necho "Line 3" >> log.txt',
    validate: (vfs, history) => {
      const r = vfs.cat('log.txt');
      return r.success && r.content.includes('Line');
    },
    validateMessage: 'Create log.txt and write multiple lines to it'
  },

  // ── X ─────────────────────────────────────────────────────────────────────
  {
    id: 'X',
    title: 'X — Executing Scripts & Permissions',
    icon: '🚀',
    color: '#ffb86c',
    concept: `
<h3>Creating and Running Shell Scripts</h3>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0"># Create a script
echo "#!/bin/bash" > myscript.sh
echo "echo Hello from script!" >> myscript.sh

# Make it executable
chmod +x myscript.sh

# Run it
./myscript.sh
bash myscript.sh</pre>
<h4>Shebang Line</h4>
<p><code>#!/bin/bash</code> — tells the OS which interpreter to use.</p>
    `,
    task: 'Create a script <code>hello.sh</code> with a shebang and an echo, then make it executable.',
    taskCommands: ['echo "#!/bin/bash" > hello.sh', 'echo "echo Hello World" >> hello.sh', 'chmod +x hello.sh'],
    hints: [
      'Write: <code>echo "#!/bin/bash" > hello.sh</code>',
      'Add content: <code>echo \'echo Hello World\' >> hello.sh</code>',
      'Make executable: <code>chmod +x hello.sh</code>',
    ],
    solution: 'echo "#!/bin/bash" > hello.sh\necho "echo Hello World" >> hello.sh\nchmod +x hello.sh',
    validate: (vfs, history) => {
      return vfs.nodeExists('hello.sh') && history.some(cmd => cmd.includes('chmod') && cmd.includes('hello.sh'));
    },
    validateMessage: 'Create hello.sh and make it executable'
  },

  // ── Y ─────────────────────────────────────────────────────────────────────
  {
    id: 'Y',
    title: 'Y — Your Shell Environment',
    icon: '🌍',
    color: '#ff79c6',
    concept: `
<h3>Customizing Your Shell Environment</h3>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">echo $PATH                    # Show executable path
export VAR="value"            # Set environment variable
alias ll='ls -la'             # Create command alias
cat ~/.bashrc                 # View bash config
echo "alias gs='git status'" >> ~/.bashrc  # Persist alias</pre>
<h4>Key Files</h4>
<ul>
  <li><code>~/.bashrc</code> — Runs for each interactive shell</li>
  <li><code>~/.profile</code> — Runs at login</li>
  <li><code>/etc/environment</code> — System-wide variables</li>
</ul>
    `,
    task: 'View your <code>.bashrc</code> file and add a new alias.',
    taskCommands: ['cat ~/.bashrc', 'alias ll=\'ls -la\''],
    hints: [
      'Run <code>cat ~/.bashrc</code> to view the file.',
      'Run <code>alias ll=\'ls -la\'</code> to set an alias.',
    ],
    solution: 'cat ~/.bashrc\nalias ll=\'ls -la\'',
    validate: (vfs, history) => {
      return history.some(cmd => cmd.includes('.bashrc'));
    },
    validateMessage: 'View .bashrc and create an alias'
  },

  // ── Z ─────────────────────────────────────────────────────────────────────
  {
    id: 'Z',
    title: 'Z — Zipping it all: Shell Scripting',
    icon: '🏆',
    color: '#f1fa8c',
    concept: `
<h3>Shell Scripting — Bringing it All Together</h3>
<p>You've learned all the fundamentals. Now combine them into powerful scripts!</p>
<pre style="background:#282a36;padding:10px;border-radius:6px;margin:8px 0">#!/bin/bash
# Backup script

BACKUP_DIR="/home/user/backups"
SOURCE="/home/user/Documents"
DATE=$(date +%Y-%m-%d)

mkdir -p $BACKUP_DIR
cp -r $SOURCE $BACKUP_DIR/docs_$DATE
echo "Backup completed: $BACKUP_DIR/docs_$DATE"</pre>
<h4>Script Features</h4>
<ul>
  <li>Variables: <code>NAME="value"</code></li>
  <li>Conditionals: <code>if [ condition ]; then ... fi</code></li>
  <li>Loops: <code>for i in list; do ... done</code></li>
  <li>Functions: <code>function_name() { ... }</code></li>
</ul>
    `,
    task: 'Create a comprehensive script that creates a backup directory structure. Combine everything you\'ve learned!',
    taskCommands: [
      'mkdir -p backups/docs',
      'echo "#!/bin/bash" > backup.sh',
      'echo "echo Backup created!" >> backup.sh',
      'chmod +x backup.sh'
    ],
    hints: [
      'Use <code>mkdir -p backups/docs</code> to create the structure.',
      'Create <code>backup.sh</code> with echo redirections.',
      'Make it executable with <code>chmod +x backup.sh</code>.',
    ],
    solution: 'mkdir -p backups/docs\necho "#!/bin/bash" > backup.sh\necho "echo Backup created!" >> backup.sh\nchmod +x backup.sh',
    validate: (vfs, history) => {
      return vfs.isDirectory('backups') && vfs.nodeExists('backup.sh');
    },
    validateMessage: 'Create backups/ directory and backup.sh script'
  },
];

window.CURRICULUM = CURRICULUM;
