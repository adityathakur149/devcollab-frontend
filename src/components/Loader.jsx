/**
 * Full-page loading spinner with animated pulse and optional text.
 */
function Loader({ text = 'Loading...' }) {
  return (
    <div className="loader-container">
      <div className="loader-spinner" />
      <p className="loader-text">{text}</p>
    </div>
  );
}

export default Loader;
