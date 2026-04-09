export function AuthBar({ user, loading, onSignIn, onSignOut, myTeam }) {
  if (loading) return null;

  return (
    <div className="auth-bar">
      {user ? (
        <div className="auth-bar-user">
          {myTeam && <span className="auth-team-chip">{myTeam}</span>}
          <span className="auth-email">{user.email}</span>
          <button className="auth-btn auth-btn-signout" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      ) : (
        <button className="auth-btn auth-btn-signin" onClick={onSignIn}>
          Sign in with Google
        </button>
      )}
    </div>
  );
}
