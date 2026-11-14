import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Code2,
  Users,
  Zap,
  MessageCircle,
  Play,
  Share2,
  ArrowRight,
  Terminal,
  Sparkles,
} from 'lucide-react';

function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const features = [
    {
      icon: <Users size={24} />,
      title: 'Real-Time Collaboration',
      description: 'Code together with multiple developers. See cursors, edits, and changes instantly.',
    },
    {
      icon: <Zap size={24} />,
      title: 'Instant Sync',
      description: 'Powered by Socket.io for low-latency synchronization across all connected users.',
    },
    {
      icon: <Terminal size={24} />,
      title: 'Multi-Language Support',
      description: 'Write and execute code in JavaScript, Python, Java, C++, and many more languages.',
    },
    {
      icon: <MessageCircle size={24} />,
      title: 'Built-in Chat',
      description: 'Discuss ideas without leaving the editor. Seamless communication in real-time.',
    },
    {
      icon: <Play size={24} />,
      title: 'Sandboxed Execution',
      description: 'Run your code safely with integrated Judge0 API for instant results.',
    },
    {
      icon: <Share2 size={24} />,
      title: 'Easy Sharing',
      description: 'Share your room with a simple Room ID and collaborate instantly.',
    },
  ];

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="nav-brand">
          <div className="nav-brand-icon">
            <Code2 size={22} color="white" />
          </div>
          <span className="nav-brand-text">DevCollab</span>
        </div>
        <div className="nav-actions">
          <button className="btn btn-ghost" onClick={() => navigate('/login')}>
            Sign In
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/register')}>
            Get Started <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-badge">
          <Sparkles size={14} />
          <span>Real-Time Code Collaboration</span>
        </div>
          <h1 className="hero-title">
            Code Together,
            <br />
            <span className="hero-gradient">Ship Faster</span>
          </h1>
        <p className="hero-subtitle">
          A powerful real-time collaborative code editor. Write, run, and debug code
          together with your team in a seamless, VS Code-like environment.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
            Start Collaborating <ArrowRight size={18} />
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => navigate('/login')}>
            Sign In to Continue
          </button>
        </div>
      </section>

      <section className="features-section">
        <div className="section-header-center">
          <h2 className="section-title">Everything you need to collaborate</h2>
          <p className="section-subtitle">
            Powerful features to make remote pair programming effortless
          </p>
        </div>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card glass-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-card glass-card">
          <h2 className="cta-title">Ready to start coding together?</h2>
          <p className="cta-subtitle">
            Join DevCollab and experience seamless real-time collaboration
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
            Create Free Account <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="nav-brand-icon">
              <Code2 size={18} color="white" />
            </div>
            <span>DevCollab</span>
          </div>
          <p className="footer-text">© 2026 DevCollab. Built for real-time collaboration.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
