import { getTeamNames } from "../eligibility.js";

export function TeamClaimModal({ claimedTeams, myTeam, onClaim, onUnclaim }) {
  const teamNames = getTeamNames();

  return (
    <div className="claim-panel">
      <h2 className="claim-title">Claim Your Team</h2>
      <p className="claim-subtitle">Select which team you manage this offseason.</p>
      <div className="claim-list">
        {teamNames.map((name) => {
          const claimed = claimedTeams.get(name);
          const isMine = name === myTeam;

          return (
            <div key={name} className={`claim-row ${isMine ? "claim-row-mine" : ""}`}>
              <span className="claim-team-name">{name}</span>
              {isMine ? (
                <button className="claim-btn claim-btn-unclaim" onClick={onUnclaim}>
                  Unclaim
                </button>
              ) : claimed ? (
                <span className="claim-taken">Claimed</span>
              ) : (
                <button
                  className="claim-btn claim-btn-claim"
                  onClick={() => onClaim(name)}
                  disabled={!!myTeam}
                >
                  Claim
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
