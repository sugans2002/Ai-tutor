import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
  useRoomContext,
  useConnectionState,
} from '@livekit/components-react';
import '@livekit/components-styles';

// ─────────────────────────────────────────────────────────────
// TutorPanel: must live INSIDE <LiveKitRoom> to use room hooks
// ─────────────────────────────────────────────────────────────
function TutorPanel({ code }) {
  const room = useRoomContext();
  const connectionState = useConnectionState();

  // Send the student's code to the AI agent via LiveKit data channel.
  // Debounced 1.5s — waits until the student stops typing.
  useEffect(() => {
    if (!room?.localParticipant) return;

    const timer = setTimeout(() => {
      try {
        const payload = JSON.stringify({ type: 'code', content: code });
        room.localParticipant.publishData(
          new TextEncoder().encode(payload),
          { reliable: true }
        );
      } catch (err) {
        console.error('[Tutor] Failed to send code to agent:', err);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [code, room]);

  const isConnected = connectionState === 'connected';

  return (
    <div style={styles.panel}>
      {/* Status indicator */}
      <div style={styles.statusRow}>
        <div style={{ ...styles.dot, background: isConnected ? '#22c55e' : '#f59e0b' }} />
        <span style={{ ...styles.statusText, color: isConnected ? '#22c55e' : '#f59e0b' }}>
          {isConnected ? 'Tutor connected' : 'Connecting…'}
        </span>
      </div>

      <p style={styles.hint}>
        🎙️ Speak to your tutor.<br />It can see your code live.
      </p>

      {/* LiveKit renders the mic button here */}
      <RoomAudioRenderer />
      <VoiceAssistantControlBar />

      <p style={styles.tip}>
        Tip: ask things like<br />
        <em style={{ color: '#a3a3a3' }}>"Why is my loop not working?"</em>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [code, setCode]           = useState(DEFAULT_CODE);
  const [language, setLanguage]   = useState('python');
  const [token, setToken]         = useState(null);
  const [livekitUrl, setLivekitUrl] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError]         = useState(null);

  // Change starter code when language changes
  useEffect(() => {
    setCode(STARTER_CODE[language] || '// Start coding here');
  }, [language]);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  async function startSession() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/generate-token`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setToken(data.token);
      setLivekitUrl(data.url);
    } catch (err) {
      setError('Cannot reach server. Is your backend running?');
      console.error(err);
    } finally {
      setConnecting(false);
    }
  }

  function endSession() {
    setToken(null);
    setLivekitUrl(null);
    setError(null);
  }

  return (
    <div style={styles.root}>

      {/* ── Header ── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>🤖 AI Coding Tutor</span>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            style={styles.select}
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
        </div>

        <div style={styles.headerRight}>
          {error && <span style={styles.errorText}>{error}</span>}
          {!token ? (
            <button
              onClick={startSession}
              disabled={connecting}
              style={{ ...styles.btn, ...(connecting ? styles.btnDisabled : styles.btnGreen) }}
            >
              {connecting ? 'Connecting…' : '🎙 Start Session'}
            </button>
          ) : (
            <button onClick={endSession} style={{ ...styles.btn, ...styles.btnRed }}>
              ✕ End Session
            </button>
          )}
        </div>
      </header>

      {/* ── Main layout ── */}
      <div style={styles.main}>

        {/* Code editor */}
        <div style={styles.editorWrap}>
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            value={code}
            onChange={val => setCode(val ?? '')}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              padding: { top: 16 },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
            }}
          />
        </div>

        {/* AI Tutor side panel */}
        <div style={styles.sidePanel}>
          {token && livekitUrl ? (
            <LiveKitRoom
              serverUrl={livekitUrl}
              token={token}
              connect
              audio
              video={false}
              onDisconnected={endSession}
            >
              <TutorPanel code={code} />
            </LiveKitRoom>
          ) : (
            <div style={styles.idlePanel}>
              <div style={{ fontSize: '2.5rem' }}>🎙️</div>
              <p style={styles.idleText}>
                Press <strong style={{ color: '#ccc' }}>Start Session</strong> to talk to your AI tutor
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Starter code for each language
// ─────────────────────────────────────────────────────────────
const DEFAULT_CODE = `# Write your code here and speak to your tutor!
print("Hello, World!")`;

const STARTER_CODE = {
  python: `# Write your Python code here
def greet(name):
    return f"Hello, {name}!"

print(greet("World"))`,

  javascript: `// Write your JavaScript here
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));`,

  java: `// Write your Java here
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,

  cpp: `// Write your C++ here
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`,
};

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = {
  root: {
    display: 'flex', flexDirection: 'column',
    height: '100vh', background: '#1e1e1e',
    color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif',
    overflow: 'hidden',
  },
  header: {
    padding: '10px 20px', background: '#252526',
    borderBottom: '1px solid #3c3c3c',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  logo: { fontWeight: 600, fontSize: '15px' },
  select: {
    background: '#3c3c3c', color: '#ccc',
    border: 'none', borderRadius: '4px',
    padding: '5px 8px', fontSize: '12px', cursor: 'pointer',
  },
  btn: {
    padding: '7px 16px', border: 'none',
    borderRadius: '6px', fontWeight: 600,
    fontSize: '13px', cursor: 'pointer',
    transition: 'opacity .15s',
  },
  btnGreen: { background: '#22c55e', color: '#fff' },
  btnRed:   { background: '#ef4444', color: '#fff' },
  btnDisabled: { background: '#555', color: '#999', cursor: 'not-allowed' },
  errorText: { color: '#f87171', fontSize: '12px', maxWidth: '220px' },
  main: { flex: 1, display: 'flex', overflow: 'hidden' },
  editorWrap: { flex: 1, minWidth: 0 },
  sidePanel: {
    width: '260px', flexShrink: 0,
    background: '#252526', borderLeft: '1px solid #3c3c3c',
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
  },
  panel: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '14px',
    padding: '24px 20px',
  },
  statusRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  dot: { width: 9, height: 9, borderRadius: '50%' },
  statusText: { fontSize: '13px', fontWeight: 500 },
  hint: {
    fontSize: '13px', color: '#888',
    textAlign: 'center', lineHeight: 1.7, margin: 0,
  },
  tip: {
    fontSize: '12px', color: '#666',
    textAlign: 'center', lineHeight: 1.6, margin: 0,
  },
  idlePanel: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '12px',
    padding: '24px 20px', textAlign: 'center',
  },
  idleText: { fontSize: '13px', color: '#666', lineHeight: 1.6, margin: 0 },
};
