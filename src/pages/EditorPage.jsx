import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { getProject, executeCode, updateProject } from '../services/api';
import {
  ArrowLeft,
  Copy,
  Check,
  Users,
  Wifi,
  WifiOff,
  Play,
  Square,
  MessageCircle,
  Send,
  Download,
  Share2,
  Settings,
  X,
  CheckCircle2,
  RefreshCw,
  Moon,
  Sun,
} from 'lucide-react';
import Loader from '../components/Loader';
import OutputPanel from '../components/OutputPanel';

const LANGUAGES = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C',
  'C#', 'Go', 'Rust', 'HTML', 'CSS', 'JSON', 'Markdown', 'SQL', 'PHP', 'Ruby', 'Swift',
];

const FILE_EXTENSIONS = {
  JavaScript: 'js',
  TypeScript: 'ts',
  Python: 'py',
  Java: 'java',
  Cpp: 'cpp',
  C: 'c',
  Csharp: 'cs',
  Go: 'go',
  Rust: 'rs',
  HTML: 'html',
  CSS: 'css',
  JSON: 'json',
  Markdown: 'md',
  SQL: 'sql',
  PHP: 'php',
  Ruby: 'rb',
  Swift: 'swift',
};

function EditorPage({ theme, toggleTheme }) {
  const { projectId } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [code, setCode] = useState('// Loading...\n');
  const [language, setLanguage] = useState('javascript');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Day 2 Modal & Customization States
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [fontSize, setFontSize] = useState(14);
  const [wordWrap, setWordWrap] = useState('on');
  const [tabSize, setTabSize] = useState(2);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving'

  // Live Cursors state
  const [remoteCursors, setRemoteCursors] = useState({});
  const decorationsRef = useRef([]);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sidebarTab, setSidebarTab] = useState('online');
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef(null);

  // Code execution state
  const [output, setOutput] = useState([]);
  const [stdin, setStdin] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [executionTime, setExecutionTime] = useState(null);
  const iframeRef = useRef(null);

  const socketRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const isRemoteChange = useRef(false);
  const codeRef = useRef(code);

  // Keep codeRef in sync
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current && sidebarTab === 'chat') {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sidebarTab]);

  // Reset unread when switching to chat tab
  useEffect(() => {
    if (sidebarTab === 'chat') {
      setUnreadCount(0);
    }
  }, [sidebarTab]);

  // Load project data on mount
  useEffect(() => {
    const loadProject = async () => {
      try {
        const res = await getProject(projectId);
        setProject(res.data);
        setCode(res.data.code || '// Start collaborating here!\n');
        setLanguage(res.data.language || 'javascript');
      } catch (err) {
        console.error('Failed to load project:', err);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, navigate]);

  // Connect to Socket.IO when project is loaded
  useEffect(() => {
    if (!project || !token) return;

    const socket = io(window.location.origin.replace(':5173', ':5000'), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    const joinRoom = () => {
      socket.emit('join-room', project.roomId);
    };

    socket.on('connect', () => {
      setConnected(true);
      joinRoom();
    });

    socket.on('reconnect', (attemptNumber) => {
      setConnected(true);
      showToast(`Reconnected after ${attemptNumber} attempt(s)`, 'info');
      joinRoom();
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      setConnected(false);
      showToast(`Reconnecting... (attempt ${attemptNumber})`, 'info');
    });

    socket.on('reconnect_failed', () => {
      setConnected(false);
      showToast('Failed to reconnect. Please refresh the page.', 'error');
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      if (reason !== 'io client disconnect') {
        showToast('Connection lost. Attempting to reconnect...', 'warn');
      }
    });

    socket.on('room-joined', ({ users, code: roomCode, language: roomLang, messages: roomMessages }) => {
      setOnlineUsers(users);
      if (roomCode !== null && roomCode !== undefined) {
        isRemoteChange.current = true;
        setCode(roomCode);
        if (editorRef.current) {
          editorRef.current.setValue(roomCode);
        }
        isRemoteChange.current = false;
      }
      if (roomLang) {
        setLanguage(roomLang);
      }
      // Load chat history
      if (roomMessages && roomMessages.length > 0) {
        setMessages(roomMessages);
      }
    });

    socket.on('user-joined', ({ user: joinedUser, users }) => {
      setOnlineUsers(users);
      showToast(`${joinedUser.username} joined the room`, 'info');
    });

    socket.on('user-left', ({ user: leftUser, users }) => {
      setOnlineUsers(users);
      showToast(`${leftUser.username} left the room`, 'info');
      // Remove their cursor
      setRemoteCursors((prev) => {
        const updated = { ...prev };
        delete updated[leftUser._id];
        return updated;
      });
    });

    socket.on('code-update', ({ code: newCode }) => {
      isRemoteChange.current = true;
      setCode(newCode);

      if (editorRef.current) {
        const editor = editorRef.current;
        const position = editor.getPosition();
        editor.setValue(newCode);
        if (position) {
          editor.setPosition(position);
        }
      }

      isRemoteChange.current = false;
    });

    socket.on('language-update', ({ language: newLang }) => {
      setLanguage(newLang);
    });

    // Live cursor updates from other users
    socket.on('cursor-update', ({ user: remoteUser, cursor }) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [remoteUser._id]: {
          ...cursor,
          username: remoteUser.username,
          avatarColor: remoteUser.avatarColor,
        },
      }));
    });

    // Chat messages
    socket.on('chat-update', (message) => {
      setMessages((prev) => [...prev, message]);
      // Increment unread if not on chat tab
      if (sidebarTab !== 'chat') {
        setUnreadCount((prev) => prev + 1);
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket Error]:', err.message);
      setConnected(false);
    });

    return () => {
      socket.emit('leave-room', project.roomId);
      socket.disconnect();
    };
  }, [project, token]);

  // Render remote cursors as Monaco decorations
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const newDecorations = [];

    Object.entries(remoteCursors).forEach(([userId, cursor]) => {
      if (userId === user?._id) return; // Don't show own cursor

      const color = cursor.avatarColor || '#6366f1';
      const className = `remote-cursor-${userId.replace(/[^a-zA-Z0-9]/g, '')}`;

      // Inject dynamic CSS for this user's cursor color
      let styleEl = document.getElementById(`cursor-style-${userId}`);
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = `cursor-style-${userId}`;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        .${className} {
          background: ${color} !important;
          width: 2px !important;
          margin-left: -1px;
        }
        .${className}-label::after {
          content: '${cursor.username}';
          position: absolute;
          top: -18px;
          left: 0;
          background: ${color};
          color: white;
          padding: 1px 6px;
          border-radius: 3px 3px 3px 0;
          font-size: 11px;
          font-weight: 600;
          font-family: var(--font-sans);
          white-space: nowrap;
          z-index: 100;
          line-height: 16px;
          pointer-events: none;
        }
      `;

      // Cursor line decoration
      newDecorations.push({
        range: new monaco.Range(
          cursor.lineNumber || 1,
          cursor.column || 1,
          cursor.lineNumber || 1,
          cursor.column || 1
        ),
        options: {
          className: `${className}`,
          beforeContentClassName: `${className}-label`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });

      // Selection highlight (if present)
      if (cursor.selection) {
        const sel = cursor.selection;
        let selStyleEl = document.getElementById(`cursor-sel-style-${userId}`);
        if (!selStyleEl) {
          selStyleEl = document.createElement('style');
          selStyleEl.id = `cursor-sel-style-${userId}`;
          document.head.appendChild(selStyleEl);
        }
        selStyleEl.textContent = `
          .${className}-selection {
            background: ${color}22 !important;
            border: 1px solid ${color}44;
            border-radius: 2px;
          }
        `;

        newDecorations.push({
          range: new monaco.Range(
            sel.startLineNumber,
            sel.startColumn,
            sel.endLineNumber,
            sel.endColumn
          ),
          options: {
            className: `${className}-selection`,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });
      }
    });

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations
    );
  }, [remoteCursors, user]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Emit cursor position on cursor change
    editor.onDidChangeCursorPosition((e) => {
      if (socketRef.current && project) {
        const selection = editor.getSelection();
        const cursorData = {
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        };

        // Include selection if user is selecting text
        if (
          selection &&
          (selection.startLineNumber !== selection.endLineNumber ||
            selection.startColumn !== selection.endColumn)
        ) {
          cursorData.selection = {
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.endColumn,
          };
        }

        socketRef.current.emit('cursor-move', {
          roomId: project.roomId,
          cursor: cursorData,
        });
      }
    });

    // Keyboard shortcut: Ctrl+Enter to run code
    editor.addAction({
      id: 'run-code',
      label: 'Run Code',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        runCode();
      },
    });
  };

  const saveTimeoutRef = useRef(null);
  const restSaveTimeoutRef = useRef(null);

  const handleCodeChange = useCallback(
    (value) => {
      if (isRemoteChange.current) return;

      setCode(value);
      setSaveStatus('saving');

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('saved');
      }, 800);

      // Debounced REST API save (every 3 seconds)
      if (restSaveTimeoutRef.current) clearTimeout(restSaveTimeoutRef.current);
      restSaveTimeoutRef.current = setTimeout(() => {
        if (project && project._id) {
          updateProject(project._id, { code: value }).catch((err) => {
            console.warn('[REST Save] Failed to save code:', err.message);
          });
        }
      }, 3000);

      if (socketRef.current && project) {
        socketRef.current.emit('code-change', {
          roomId: project.roomId,
          code: value,
        });
      }
    },
    [project]
  );

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    if (socketRef.current && project) {
      socketRef.current.emit('language-change', {
        roomId: project.roomId,
        language: newLang,
      });
    }
  };

  const handleDownloadCode = () => {
    const ext = FILE_EXTENSIONS[language] || 'txt';
    const filename = `${project?.name ? project.name.toLowerCase().replace(/\s+/g, '_') : 'code'}.${ext}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`, 'info');
  };

  const handleCopyRoomId = async () => {
    if (!project) return;
    try {
      await navigator.clipboard.writeText(project.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS
      const el = document.createElement('textarea');
      el.value = project.roomId;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ---- Chat ----
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current || !project) return;

    socketRef.current.emit('chat-message', {
      roomId: project.roomId,
      text: newMessage.trim(),
    });

    setNewMessage('');
  };

  const formatChatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ---- Code Execution ----
  const runCode = async () => {
    const currentCode = codeRef.current;
    if (!currentCode.trim() || isRunning) return;

    setIsRunning(true);
    setOutput([]);
    setShowOutput(true);
    setExecutionTime(null);

    const startTime = Date.now();

    try {
      setOutput([{ type: 'system', text: `Running ${language.toUpperCase()} code...` }]);

      const res = await executeCode(language, currentCode, stdin);
      const elapsed = Date.now() - startTime;
      setExecutionTime(elapsed);

      const logs = [];

      if (res.data.type === 'compile_error') {
        logs.push({ type: 'error', text: `Compilation Error (Exit code ${res.data.exitCode}):` });
        logs.push({ type: 'error', text: res.data.stderr || res.data.stdout });
      } else {
        if (res.data.stdout) {
          logs.push({ type: 'log', text: res.data.stdout });
        }
        if (res.data.stderr) {
          logs.push({ type: 'warn', text: res.data.stderr });
        }
        if (!res.data.stdout && !res.data.stderr) {
          logs.push({ type: 'system', text: 'Program executed successfully with no output.' });
        }
        logs.push({
          type: res.data.success ? 'system' : 'error',
          text: `Process finished with exit code ${res.data.exitCode} (${elapsed}ms)`,
        });
      }

      setOutput(logs);
      setIsRunning(false);
    } catch (err) {
      console.warn('Server execution failed, trying local fallback:', err?.message);

      // Client-side fallback for JS and Python
      if (language === 'javascript' || language === 'typescript') {
        runJavaScript(currentCode, startTime);
      } else if (language === 'python') {
        runPython(currentCode, startTime);
      } else {
        setOutput([
          {
            type: 'error',
            text: `Execution failed: ${err.response?.data?.message || err.message}`,
          },
          {
            type: 'system',
            text: `Ensure server is connected. Local fallback is available for JavaScript & Python.`,
          },
        ]);
        setIsRunning(false);
        setExecutionTime(Date.now() - startTime);
      }
    }
  };

  const runJavaScript = (code, startTime) => {
    // Create a sandboxed iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.sandbox = 'allow-scripts';
    document.body.appendChild(iframe);
    iframeRef.current = iframe;

    const results = [];

    const handleMessage = (event) => {
      if (event.source !== iframe.contentWindow) return;

      const { type, args, error, done } = event.data;

      if (done) {
        window.removeEventListener('message', handleMessage);
        document.body.removeChild(iframe);
        iframeRef.current = null;
        setOutput([...results]);
        setIsRunning(false);
        setExecutionTime(Date.now() - startTime);
        return;
      }

      if (error) {
        results.push({ type: 'error', text: error });
      } else if (type && args) {
        results.push({
          type: type === 'warn' ? 'warn' : type === 'error' ? 'error' : 'log',
          text: args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '),
        });
      }

      setOutput([...results]);
    };

    window.addEventListener('message', handleMessage);

    const wrappedCode = `
      <script>
        const _origLog = console.log;
        const _send = (type, args) => parent.postMessage({ type, args: Array.from(args).map(a => {
          try { return typeof a === 'object' ? JSON.parse(JSON.stringify(a)) : a; } catch { return String(a); }
        }) }, '*');

        console.log = function() { _send('log', arguments); };
        console.warn = function() { _send('warn', arguments); };
        console.error = function() { _send('error', arguments); };
        console.info = function() { _send('info', arguments); };

        try {
          ${code}
          parent.postMessage({ done: true }, '*');
        } catch (e) {
          parent.postMessage({ error: e.name + ': ' + e.message }, '*');
          parent.postMessage({ done: true }, '*');
        }
      <\/script>
    `;

    iframe.srcdoc = wrappedCode;

    // Timeout safety
    setTimeout(() => {
      if (iframeRef.current === iframe) {
        results.push({ type: 'error', text: 'Execution timed out (10s limit)' });
        window.removeEventListener('message', handleMessage);
        try { document.body.removeChild(iframe); } catch { }
        iframeRef.current = null;
        setOutput([...results]);
        setIsRunning(false);
        setExecutionTime(Date.now() - startTime);
      }
    }, 10000);
  };

  const runPython = (code, startTime) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.sandbox = 'allow-scripts allow-same-origin';
    document.body.appendChild(iframe);
    iframeRef.current = iframe;

    const results = [];
    results.push({ type: 'system', text: 'Loading Python runtime (Pyodide)...' });
    setOutput([...results]);

    const handleMessage = (event) => {
      if (event.source !== iframe.contentWindow) return;

      const { type, text, done } = event.data;

      if (done) {
        window.removeEventListener('message', handleMessage);
        try { document.body.removeChild(iframe); } catch { }
        iframeRef.current = null;
        setIsRunning(false);
        setExecutionTime(Date.now() - startTime);
        return;
      }

      if (type && text !== undefined) {
        results.push({ type, text });
        setOutput([...results]);
      }
    };

    window.addEventListener('message', handleMessage);

    const escapedCode = code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');

    const wrappedPython = `
      <script src="https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"><\/script>
      <script>
        async function main() {
          try {
            parent.postMessage({ type: 'system', text: 'Python runtime loaded. Executing...' }, '*');
            const pyodide = await loadPyodide();

            // Redirect stdout
            pyodide.runPython(\`
import sys
from io import StringIO

class OutputCapture:
    def __init__(self):
        self.outputs = []
    def write(self, text):
        if text.strip():
            self.outputs.append(text)
            import js
            js.parent.postMessage(js.Object.fromEntries([['type', 'log'], ['text', text]]), '*')
    def flush(self):
        pass

sys.stdout = OutputCapture()
sys.stderr = OutputCapture()
\`);

            pyodide.runPython(\`${escapedCode}\`);
            parent.postMessage({ done: true }, '*');
          } catch (e) {
            parent.postMessage({ type: 'error', text: e.message }, '*');
            parent.postMessage({ done: true }, '*');
          }
        }
        main();
      <\/script>
    `;

    iframe.srcdoc = wrappedPython;

    // Timeout safety — Python/Pyodide may take longer to load
    setTimeout(() => {
      if (iframeRef.current === iframe) {
        results.push({ type: 'error', text: 'Execution timed out (30s limit)' });
        window.removeEventListener('message', handleMessage);
        try { document.body.removeChild(iframe); } catch { }
        iframeRef.current = null;
        setOutput([...results]);
        setIsRunning(false);
        setExecutionTime(Date.now() - startTime);
      }
    }, 30000);
  };

  const stopExecution = () => {
    if (iframeRef.current) {
      try { document.body.removeChild(iframeRef.current); } catch { }
      iframeRef.current = null;
    }
    setIsRunning(false);
    setOutput((prev) => [...prev, { type: 'system', text: '⛔ Execution stopped by user' }]);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return <Loader text="Loading project..." />;
  }

  return (
    <div className="editor-page">
      {/* Editor Header */}
      <header className="editor-header">
        <div className="left-section">
          <button
            id="back-to-dashboard"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={16} />
            Dashboard
          </button>

          <div className="project-info">
            <h2>{project?.name || 'Untitled'}</h2>
            <select
              id="language-selector"
              className="input-field"
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              style={{
                padding: '4px 28px 4px 10px',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                color: 'var(--text-accent)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
              }}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="right-section">
          {/* Run Code Button */}
          <button
            id="run-code-btn"
            className={`btn btn-sm run-btn ${isRunning ? 'running' : ''}`}
            onClick={isRunning ? stopExecution : runCode}
            title={isRunning ? 'Stop execution' : 'Run code (Ctrl+Enter)'}
          >
            {isRunning ? <Square size={13} /> : <Play size={13} />}
            {isRunning ? 'Stop' : 'Run'}
          </button>

          {/* Download Code Button */}
          <button
            id="download-code-btn"
            className="btn btn-ghost btn-sm"
            onClick={handleDownloadCode}
            title="Download Code File"
          >
            <Download size={14} />
          </button>

          {/* Share Room Button */}
          <button
            id="share-room-btn"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowShareModal(true)}
            title="Share Room"
          >
            <Share2 size={14} />
            <span style={{ fontSize: '0.8rem' }}>Share</span>
          </button>

          {/* Settings Button */}
          <button
            id="editor-settings-btn"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSettingsModal(true)}
            title="Editor Settings"
          >
            <Settings size={14} />
          </button>

          {/* Theme Toggle */}
          <button
            id="theme-toggle-btn"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Save Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginLeft: '4px',
            }}
            title={saveStatus === 'saving' ? 'Saving changes...' : 'All changes saved to cloud'}
          >
            {saveStatus === 'saving' ? (
              <RefreshCw size={12} className="spin" color="var(--color-yellow)" />
            ) : (
              <CheckCircle2 size={12} color="var(--color-green)" />
            )}
            <span>{saveStatus === 'saving' ? 'Saving...' : 'Saved'}</span>
          </div>

          {/* Connection Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              color: connected ? 'var(--color-green)' : 'var(--color-red)',
            }}
          >
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {connected ? 'Live' : 'Offline'}
          </div>

          {/* Room ID Copy */}
          <button
            id="copy-room-id"
            className={`room-id-badge ${copied ? 'copied' : ''}`}
            onClick={handleCopyRoomId}
            title="Click to copy Room ID"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {project?.roomId || '...'}
          </button>

          {/* Online Users */}
          <div className="online-users">
            {onlineUsers.slice(0, 5).map((u) => (
              <div
                key={u.socketId}
                className="avatar"
                style={{ background: u.avatarColor || '#6366f1' }}
                title={u.username}
              >
                {getInitials(u.username)}
              </div>
            ))}
            {onlineUsers.length > 5 && (
              <div className="avatar" style={{ background: '#4b5563' }}>
                +{onlineUsers.length - 5}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Editor Body */}
      <div className="editor-body">
        <div className={`editor-main ${showOutput ? 'with-output' : ''}`}>
          <div className="editor-container">
            <Editor
              height="100%"
              language={language}
              value={code}
              theme={editorTheme}
              onChange={handleCodeChange}
              onMount={handleEditorDidMount}
              options={{
                fontSize: Number(fontSize),
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontLigatures: true,
                minimap: { enabled: true, scale: 1 },
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                padding: { top: 16 },
                renderLineHighlight: 'all',
                renderLineHighlightOnlyWhenFocus: false,
                bracketPairColorization: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: wordWrap,
                tabSize: Number(tabSize),
                automaticLayout: true,
              }}
            />
          </div>

          {/* Output Panel */}
          {showOutput && (
            <OutputPanel
              output={output}
              isRunning={isRunning}
              executionTime={executionTime}
              language={language}
              stdin={stdin}
              setStdin={setStdin}
              onClose={() => setShowOutput(false)}
              onClear={() => {
                setOutput([]);
                setExecutionTime(null);
              }}
            />
          )}
        </div>

        {/* Collaborator Sidebar with Tabs */}
        <aside className="collaborator-sidebar">
          {/* Tab Switcher */}
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${sidebarTab === 'online' ? 'active' : ''}`}
              onClick={() => setSidebarTab('online')}
            >
              <Users size={14} />
              Online ({onlineUsers.length})
            </button>
            <button
              className={`sidebar-tab ${sidebarTab === 'chat' ? 'active' : ''}`}
              onClick={() => setSidebarTab('chat')}
            >
              <MessageCircle size={14} />
              Chat
              {unreadCount > 0 && (
                <span className="unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>
          </div>

          {/* Online Users Tab */}
          {sidebarTab === 'online' && (
            <div className="user-list">
              {onlineUsers.map((u) => (
                <div key={u.socketId} className="user-item">
                  <div
                    className="avatar"
                    style={{
                      background: u.avatarColor || '#6366f1',
                      width: 28,
                      height: 28,
                      fontSize: '0.65rem',
                    }}
                  >
                    {getInitials(u.username)}
                  </div>
                  <div>
                    <div className="username">
                      {u.username}
                      {u._id === user?._id && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                          {' '}(you)
                        </span>
                      )}
                    </div>
                    <div className="status">Editing</div>
                  </div>
                </div>
              ))}

              {onlineUsers.length === 0 && (
                <div
                  style={{
                    padding: 'var(--space-lg)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.82rem',
                  }}
                >
                  Connecting...
                </div>
              )}
            </div>
          )}

          {/* Chat Tab */}
          {sidebarTab === 'chat' && (
            <div className="chat-container">
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div className="chat-empty">
                    <MessageCircle size={24} />
                    <p>No messages yet</p>
                    <span>Start the conversation!</span>
                  </div>
                )}

                {messages.map((msg) => {
                  const isOwn = msg.user._id === user?._id;
                  return (
                    <div
                      key={msg.id}
                      className={`chat-message ${isOwn ? 'own' : ''}`}
                    >
                      {!isOwn && (
                        <div
                          className="chat-avatar"
                          style={{ background: msg.user.avatarColor || '#6366f1' }}
                        >
                          {getInitials(msg.user.username)}
                        </div>
                      )}
                      <div className="chat-bubble">
                        {!isOwn && (
                          <div
                            className="chat-sender"
                            style={{ color: msg.user.avatarColor || '#6366f1' }}
                          >
                            {msg.user.username}
                          </div>
                        )}
                        <div className="chat-text">{msg.text}</div>
                        <div className="chat-time">{formatChatTime(msg.timestamp)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  maxLength={500}
                />
                <button
                  type="submit"
                  className="chat-send-btn"
                  disabled={!newMessage.trim()}
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          )}
        </aside>
      </div>

      {/* Share Room Modal */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal glass-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h2><Share2 size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />Share Room</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowShareModal(false)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 'var(--space-md)' }}>
              Invite teammates to collaborate in real-time on this project.
            </p>

            <div className="input-group">
              <label>Room ID</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-field"
                  readOnly
                  value={project?.roomId || ''}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleCopyRoomId}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy ID'}
                </button>
              </div>
            </div>

            <div className="input-group" style={{ marginTop: 'var(--space-md)' }}>
              <label>Direct Join Link</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input-field"
                  readOnly
                  value={`${window.location.origin}/editor/${projectId}`}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}/editor/${projectId}`);
                    showToast('Direct join link copied to clipboard!', 'info');
                  }}
                >
                  <Copy size={14} /> Link
                </button>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 'var(--space-lg)' }}>
              <button className="btn btn-primary" onClick={() => setShowShareModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal glass-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h2><Settings size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />Editor Settings</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSettingsModal(false)}><X size={16} /></button>
            </div>

            <div className="modal-form">
              <div className="input-group">
                <label>Theme</label>
                <select
                  className="input-field"
                  value={editorTheme}
                  onChange={(e) => setEditorTheme(e.target.value)}
                >
                  <option value="vs-dark">VS Dark (Default)</option>
                  <option value="light">VS Light</option>
                  <option value="hc-black">High Contrast Dark</option>
                </select>
              </div>

              <div className="input-group">
                <label>Font Size ({fontSize}px)</label>
                <input
                  type="range"
                  min="12"
                  max="24"
                  step="1"
                  className="input-field"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
              </div>

              <div className="input-group">
                <label>Word Wrap</label>
                <select
                  className="input-field"
                  value={wordWrap}
                  onChange={(e) => setWordWrap(e.target.value)}
                >
                  <option value="on">On</option>
                  <option value="off">Off</option>
                  <option value="wordWrapColumn">Wrap at Column</option>
                </select>
              </div>

              <div className="input-group">
                <label>Tab Size</label>
                <select
                  className="input-field"
                  value={tabSize}
                  onChange={(e) => setTabSize(Number(e.target.value))}
                >
                  <option value="2">2 Spaces</option>
                  <option value="4">4 Spaces</option>
                </select>
              </div>

              <div className="modal-actions" style={{ marginTop: 'var(--space-lg)' }}>
                <button className="btn btn-primary" onClick={() => setShowSettingsModal(false)}>Apply Settings</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default EditorPage;
