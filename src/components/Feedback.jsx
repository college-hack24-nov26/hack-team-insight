export function Notice({ children, type = 'info', onClose }) { if (!children) return null; return <div className={`notice notice-${type}`} role="status">{children}{onClose && <button className="notice-close" onClick={onClose} aria-label="Dismiss">×</button>}</div>; }
export function Spinner() { return <span className="spinner" aria-label="Loading" />; }
