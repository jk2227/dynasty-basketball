export function AuthBar({ user, loading, onSignIn, onSignOut, myTeam }) {
  if (loading || !user) return null;

  return (
    <div className="auth-bar-inline">
      <div className="auth-bar-user">
        {myTeam && <span className="auth-team-chip">{myTeam}</span>}
        <span className="auth-email-dark">{user.email}</span>
        <button className="auth-btn auth-btn-signout-dark" onClick={onSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
