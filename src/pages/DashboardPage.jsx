import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getProjects,
  createProject,
  deleteProject,
  joinProjectByRoomId,
} from '../services/api';
import {
  Code2,
  Plus,
  LogOut,
  Trash2,
  FolderOpen,
  Link as LinkIcon,
  Users,
  Moon,
  Sun,
} from 'lucide-react';

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c',
  'csharp', 'go', 'rust', 'html', 'css', 'json', 'markdown', 'sql', 'php', 'ruby', 'swift',
];

function DashboardPage({ theme, toggleTheme }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectLang, setNewProjectLang] = useState('javascript');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const res = await getProjects();
      setProjects(res.data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setCreating(true);
    setError('');

    try {
      const res = await createProject(newProjectName.trim(), newProjectLang);
      setProjects((prev) => [res.data, ...prev]);
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectLang('javascript');

      // Navigate directly to the editor
      navigate(`/editor/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinProject = async (e) => {
    e.preventDefault();
    if (!joinRoomId.trim()) return;

    setError('');

    try {
      const res = await joinProjectByRoomId(joinRoomId.trim());
      setShowJoinModal(false);
      setJoinRoomId('');
      navigate(`/editor/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join project');
    }
  };

  const handleDeleteProject = async (e, projectId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="brand">
          <div className="brand-icon">
            <Code2 size={18} color="white" />
          </div>
          <h2>DevCollab</h2>
        </div>

        <div className="user-section">
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          <div className="user-info">
            <div
              className="avatar"
              style={{ background: user?.avatarColor || '#38bdf8' }}
            >
              {getInitials(user?.username)}
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {user?.username}
            </span>
          </div>
          <button
            id="logout-btn"
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="dashboard-content">
        {/* Welcome Banner */}
        <div className="dashboard-welcome">
          <h1>
            <span className="wave">👋</span> Welcome back, {user?.username || 'Developer'}
          </h1>
          <p className="welcome-sub">
            Manage your coding sessions or start a new collaboration.
          </p>
        </div>

        {/* Stats Row */}
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon blue">
              <FolderOpen size={20} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{projects.length}</div>
              <div className="stat-label">Total Projects</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">
              <Users size={20} />
            </div>
            <div className="stat-info">
              <div className="stat-value">
                {projects.reduce((acc, p) => acc + (p.collaborators?.length || 0), 0)}
              </div>
              <div className="stat-label">Collaborators</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">
              <Code2 size={20} />
            </div>
            <div className="stat-info">
              <div className="stat-value">
                {projects.filter(p => {
                  const diff = Date.now() - new Date(p.updatedAt).getTime();
                  return diff < 86400000; // last 24h
                }).length}
              </div>
              <div className="stat-label">Active Today</div>
            </div>
          </div>
        </div>

        {/* Projects Section */}
        <div className="section-header">
          <h2>Your Projects</h2>
          <div className="dashboard-actions">
            <button
              id="join-project-btn"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setError('');
                setShowJoinModal(true);
              }}
            >
              <LinkIcon size={14} />
              Join Room
            </button>
            <button
              id="create-project-btn"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setError('');
                setShowCreateModal(true);
              }}
            >
              <Plus size={14} />
              New Project
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="loader-spinner" />
            <p className="loader-text">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <FolderOpen size={36} />
            </div>
            <h3>No Projects Yet</h3>
            <p>
              Create your first project or join an existing one with a Room ID
              to start collaborating in real time.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus size={16} />
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((project) => (
              <div
                key={project._id}
                className="project-card glass-card"
                onClick={() => navigate(`/editor/${project._id}`)}
              >
                <h3 className="project-name">{project.name}</h3>
                <div className="project-meta">
                  <span className="language-badge">{project.language}</span>
                  <span className="project-time">
                    {formatDate(project.updatedAt)}
                  </span>
                </div>
                <div className="project-footer">
                  <div className="collaborators">
                    {(project.collaborators || []).slice(0, 4).map((collab, i) => (
                      <div
                        key={collab._id || i}
                        className="avatar"
                        style={{
                          background: collab.avatarColor || '#6366f1',
                        }}
                        title={collab.username || 'User'}
                      >
                        {getInitials(collab.username)}
                      </div>
                    ))}
                    {(project.collaborators || []).length > 4 && (
                      <div
                        className="avatar"
                        style={{ background: '#475569' }}
                      >
                        +{project.collaborators.length - 4}
                      </div>
                    )}
                  </div>
                  <span className="room-id">{project.roomId}</span>
                </div>

                <button
                  className="delete-btn"
                  onClick={(e) => handleDeleteProject(e, project._id)}
                  title="Delete project"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="modal glass-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Create New Project</h2>

            {error && <div className="error-message">{error}</div>}

            <form className="modal-form" onSubmit={handleCreateProject}>
              <div className="input-group">
                <label htmlFor="project-name">Project Name</label>
                <input
                  id="project-name"
                  type="text"
                  className="input-field"
                  placeholder="My awesome project"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="input-group">
                <label htmlFor="project-language">Language</label>
                <select
                  id="project-language"
                  className="input-field"
                  value={newProjectLang}
                  onChange={(e) => setNewProjectLang(e.target.value)}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  id="create-project-submit"
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Project Modal */}
      {showJoinModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowJoinModal(false)}
        >
          <div
            className="modal glass-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Join a Project</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '0.9rem' }}>
              Enter the Room ID shared by a collaborator to join their project.
            </p>

            {error && <div className="error-message">{error}</div>}

            <form className="modal-form" onSubmit={handleJoinProject}>
              <div className="input-group">
                <label htmlFor="join-room-id">Room ID</label>
                <input
                  id="join-room-id"
                  type="text"
                  className="input-field"
                  placeholder="e.g. a1b2c3d4e5f6"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  required
                  autoFocus
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowJoinModal(false)}
                >
                  Cancel
                </button>
                <button
                  id="join-project-submit"
                  type="submit"
                  className="btn btn-primary"
                >
                  <Users size={16} />
                  Join Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
