import { useRef, useEffect, useState } from 'react';
import { X, Trash2, Terminal, Clock, AlertTriangle, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * OutputPanel — Displays code execution results in a slide-up panel.
 * Supports colored log lines, execution time, stdin input, and output copy.
 */
function OutputPanel({
  output,
  isRunning,
  executionTime,
  language,
  stdin,
  setStdin,
  onClose,
  onClear,
}) {
  const outputEndRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [showStdin, setShowStdin] = useState(false);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output]);

  const handleCopyOutput = async () => {
    const fullText = output.map((line) => line.text).join('\n');
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = fullText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="output-panel">
      <div className="output-header">
        <div className="output-title">
          <Terminal size={14} />
          <span>Output</span>
          {language && <span className="output-lang-badge">{language}</span>}
          {executionTime !== null && executionTime !== undefined && (
            <span className="output-time">
              <Clock size={11} />
              {executionTime}ms
            </span>
          )}
          {isRunning && <span className="output-running">Running...</span>}
        </div>

        <div className="output-actions">
          <button
            className={`output-action-btn ${showStdin ? 'active' : ''}`}
            onClick={() => setShowStdin(!showStdin)}
            title="Toggle Standard Input (stdin)"
            style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px' }}
          >
            Input (stdin)
            {showStdin ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            className="output-action-btn"
            onClick={handleCopyOutput}
            title="Copy output text"
            disabled={output.length === 0}
          >
            {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
          </button>
          <button
            className="output-action-btn"
            onClick={onClear}
            title="Clear output"
          >
            <Trash2 size={13} />
          </button>
          <button
            className="output-action-btn"
            onClick={onClose}
            title="Close panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {showStdin && (
        <div className="stdin-container" style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-color)' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            Standard Input (stdin):
          </label>
          <textarea
            value={stdin || ''}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Type input data here (e.g. values for Scanner or cin)..."
            rows={2}
            style={{
              width: '100%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-mono)',
              resize: 'vertical',
            }}
          />
        </div>
      )}

      <div className="output-body">
        {output.length === 0 && !isRunning && (
          <div className="output-empty">
            <Terminal size={20} />
            <span>Run your code to see output here</span>
          </div>
        )}

        {output.map((line, i) => (
          <div key={i} className={`output-line output-${line.type || 'log'}`}>
            {line.type === 'error' && <AlertTriangle size={12} />}
            <pre>{line.text}</pre>
          </div>
        ))}

        <div ref={outputEndRef} />
      </div>
    </div>
  );
}

export default OutputPanel;

