import { useState, useMemo } from "react";
import { computeTeamEligibility, getFreeAgents, getSoonToBeSophomores, getTeamNames } from "./eligibility.js";
import { playerStats } from "./data.js";
import { espnPlayerIds } from "./playerIds.js";
import { useAuth } from "./hooks/useAuth.js";
import { useTeamClaim } from "./hooks/useTeamClaim.js";
import { useSelections } from "./hooks/useSelections.js";
import { AuthBar } from "./components/AuthBar.jsx";
import { TeamClaimModal } from "./components/TeamClaimModal.jsx";
import { TeamPlanner } from "./components/MyTeamManager.jsx";

function getEspnHeadshotUrl(name) {
  const id = espnPlayerIds[name];
  if (!id) return null;
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${id}.png&w=96&h=70`;
}

function getInitials(name) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PlayerPhoto({ name }) {
  const [imgFailed, setImgFailed] = useState(false);
  const url = getEspnHeadshotUrl(name);

  if (!url || imgFailed) {
    return (
      <div className="player-photo-fallback">
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      className="player-photo"
      onError={() => setImgFailed(true)}
    />
  );
}

function StatsRow({ name }) {
  const stats = playerStats[name];
  if (!stats) return null;

  return (
    <div className="stats-row">
      <span className="stat-item"><span className="stat-label">PTS</span>{stats.pts}</span>
      <span className="stat-item"><span className="stat-label">REB</span>{stats.reb}</span>
      <span className="stat-item"><span className="stat-label">AST</span>{stats.ast}</span>
      <span className="stat-item"><span className="stat-label">STL</span>{stats.stl}</span>
      <span className="stat-item"><span className="stat-label">BLK</span>{stats.blk}</span>
      <span className="stat-item"><span className="stat-label">3PM</span>{stats.tpm}</span>
      <span className="stat-item"><span className="stat-label">FG%</span>{stats.fg}</span>
      <span className="stat-item"><span className="stat-label">FT%</span>{stats.ft}</span>
      <span className="stat-item"><span className="stat-label">TO</span>{stats.to}</span>
    </div>
  );
}

function PlayerRow({ player }) {
  return (
    <div className="player-row">
      <div className="player-row-main">
        <PlayerPhoto name={player.name} />
        <div className="player-row-info">
          <div className="player-row-name">{player.name}</div>
          {player.acquisitionMethod && (
            <div className="player-row-meta">{player.acquisitionMethod}</div>
          )}
        </div>
        <div className="player-row-badges">
          {player.onRookieDeal && (
            <span className="badge badge-cyan">
              Rookie Deal - {player.rookieStatus.yearsRemaining}yr - ${player.rookieStatus.salary}
            </span>
          )}
          {!player.onRookieDeal && player.keeperEligible && (
            <span className="badge badge-green">
              Keeper Eligible - {player.keeperYearsRemaining}yr
            </span>
          )}
          {!player.onRookieDeal && !player.keeperEligible && (
            <span className="badge badge-red">Must RFA/Release</span>
          )}
          {player.birdRights && (
            <span className="badge badge-orange">
              Bird Rights {player.birdRights.discount}%
            </span>
          )}
          {player.consecutiveKeeperYears > 0 && !player.onRookieDeal && (
            <span className="badge badge-gray">
              Kept {player.consecutiveKeeperYears}x
            </span>
          )}
        </div>
      </div>
      <StatsRow name={player.name} />
    </div>
  );
}

function TeamSectionTable({ players, extraColumn }) {
  const [sortCol, setSortCol] = useState("pts");
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    return [...players].sort((a, b) => {
      if (sortCol === "name") {
        return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      const statsA = playerStats[a.name] || {};
      const statsB = playerStats[b.name] || {};
      const valA = statsA[sortCol] || 0;
      const valB = statsB[sortCol] || 0;
      return sortDir === "asc" ? valA - valB : valB - valA;
    });
  }, [players, sortCol, sortDir]);

  return (
    <table className="stats-table">
      <thead>
        <tr>
          <th className={`col-name${sortCol === "name" ? " active" : ""}`} onClick={() => handleSort("name")}>
            Player{sortCol === "name" && <span className="sort-arrow">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>}
          </th>
          <th className="col-status">Info</th>
          {STAT_COLUMNS.map((col) => (
            <th key={col.key} className={`col-stat${sortCol === col.key ? " active" : ""}`} onClick={() => handleSort(col.key)}>
              {col.label}{sortCol === col.key && <span className="sort-arrow">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((p) => {
          const stats = playerStats[p.name] || {};
          return (
            <tr key={p.name}>
              <td className="col-name">
                <div className="player-cell">
                  <PlayerPhoto name={p.name} />
                  <div>
                    <div>{p.name}</div>
                    {p.acquisitionMethod && <div className="player-row-meta">{p.acquisitionMethod}</div>}
                  </div>
                </div>
              </td>
              <td className="col-status">
                {extraColumn(p)}
              </td>
              {STAT_COLUMNS.map((col) => (
                <td key={col.key} className="col-stat">
                  {stats[col.key] != null ? stats[col.key] : "-"}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TeamView({ teamName }) {
  const players = useMemo(() => computeTeamEligibility(teamName), [teamName]);

  const rookies = players.filter((p) => p.onRookieDeal);
  const keeperEligible = players.filter((p) => !p.onRookieDeal && p.keeperEligible);
  const mustRFA = players.filter((p) => !p.onRookieDeal && !p.keeperEligible);

  return (
    <div className="content-area">
      <div className="summary-bar">
        <div className="summary-item">
          <span className="summary-value green">{keeperEligible.length}</span>
          <span className="summary-label">Keeper Eligible</span>
        </div>
        <div className="summary-item">
          <span className="summary-value cyan">{rookies.length}</span>
          <span className="summary-label">Rookie Deals</span>
        </div>
        <div className="summary-item">
          <span className="summary-value red">{mustRFA.length}</span>
          <span className="summary-label">Must RFA/Release</span>
        </div>
        <div className="summary-item">
          <span className="summary-value muted">{players.length}</span>
          <span className="summary-label">Total Roster</span>
        </div>
      </div>

      {keeperEligible.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div className="section-dot dot-green" />
            <span className="section-title">Keeper Eligible</span>
            <span className="section-count">{keeperEligible.length}</span>
          </div>
          <TeamSectionTable players={keeperEligible} extraColumn={(p) => (
            <>
              <span className="badge badge-green">Keeper - expires {2026 + p.keeperYearsRemaining}</span>
              {p.birdRights && <span className="badge badge-orange" style={{marginLeft: 4}}>Bird {p.birdRights.discount}%</span>}
              {p.consecutiveKeeperYears > 0 && <span className="badge badge-gray" style={{marginLeft: 4}}>Kept {p.consecutiveKeeperYears}x</span>}
              {p.specialNote && <span className="badge badge-gray" style={{marginLeft: 4}}>{p.specialNote}</span>}
              {p.eligibleForRookieDraft && <span className="badge badge-purple" style={{marginLeft: 4}}>Eligible for upcoming rookie draft</span>}
            </>
          )} />
        </div>
      )}

      {rookies.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div className="section-dot dot-cyan" />
            <span className="section-title">Rookie Deals (don't count toward 4 keeper limit)</span>
            <span className="section-count">{rookies.length}</span>
          </div>
          <TeamSectionTable players={rookies} extraColumn={(p) => (
            <>
              <span className="badge badge-cyan">Rookie - expires {p.rookieStatus.expiryYear} - ${p.rookieStatus.salary}</span>
              {p.birdRights && <span className="badge badge-orange" style={{marginLeft: 4}}>Bird {p.birdRights.discount}%</span>}
            </>
          )} />
        </div>
      )}

      {mustRFA.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div className="section-dot dot-red" />
            <span className="section-title">Must be RFA'd or Released</span>
            <span className="section-count">{mustRFA.length}</span>
          </div>
          <TeamSectionTable players={mustRFA} extraColumn={(p) => (
            <>
              <span className="badge badge-red">Must RFA/Release</span>
              {p.birdRights && <span className="badge badge-orange" style={{marginLeft: 4}}>Bird {p.birdRights.discount}%</span>}
              {p.consecutiveKeeperYears > 0 && <span className="badge badge-gray" style={{marginLeft: 4}}>Kept {p.consecutiveKeeperYears}x</span>}
              {p.eligibleForRookieDraft && <span className="badge badge-purple" style={{marginLeft: 4}}>Eligible for upcoming rookie draft</span>}
            </>
          )} />
        </div>
      )}
    </div>
  );
}

const STAT_COLUMNS = [
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tpm", label: "3PM" },
  { key: "fg", label: "FG%" },
  { key: "ft", label: "FT%" },
  { key: "to", label: "TO" },
];

function SortableTable({ players, nameKey = "name" }) {
  const [sortCol, setSortCol] = useState("pts");
  const [sortDir, setSortDir] = useState("desc");

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    return [...players].sort((a, b) => {
      const nameA = typeof a === "string" ? a : a[nameKey];
      const nameB = typeof b === "string" ? b : b[nameKey];
      const statsA = playerStats[nameA] || {};
      const statsB = playerStats[nameB] || {};

      if (sortCol === "name") {
        return sortDir === "asc"
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }

      const valA = statsA[sortCol] || 0;
      const valB = statsB[sortCol] || 0;
      return sortDir === "asc" ? valA - valB : valB - valA;
    });
  }, [players, sortCol, sortDir, nameKey]);

  return (
    <table className="stats-table">
      <thead>
        <tr>
          <th
            className={`col-name${sortCol === "name" ? " active" : ""}`}
            onClick={() => handleSort("name")}
          >
            Player
            {sortCol === "name" && (
              <span className="sort-arrow">
                {sortDir === "asc" ? "\u25B2" : "\u25BC"}
              </span>
            )}
          </th>
          {STAT_COLUMNS.map((col) => (
            <th
              key={col.key}
              className={`col-stat${sortCol === col.key ? " active" : ""}`}
              onClick={() => handleSort(col.key)}
            >
              {col.label}
              {sortCol === col.key && (
                <span className="sort-arrow">
                  {sortDir === "asc" ? "\u25B2" : "\u25BC"}
                </span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((p) => {
          const name = typeof p === "string" ? p : p[nameKey];
          const stats = playerStats[name] || {};
          return (
            <tr key={name}>
              <td className="col-name">
                <div className="player-cell">
                  <PlayerPhoto name={name} />
                  <span>{name}</span>
                </div>
              </td>
              {STAT_COLUMNS.map((col) => (
                <td key={col.key} className="col-stat">
                  {stats[col.key] != null ? stats[col.key] : "-"}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FreeAgentsView() {
  const [search, setSearch] = useState("");
  const freeAgents = useMemo(() => getFreeAgents(), []);

  const filtered = search
    ? freeAgents.filter((p) => p.toLowerCase().includes(search.toLowerCase()))
    : freeAgents;

  return (
    <div className="content-area">
      <div className="summary-bar">
        <div className="summary-item">
          <span className="summary-value muted">{freeAgents.length}</span>
          <span className="summary-label">Total Free Agents</span>
        </div>
      </div>

      <div className="search-container">
        <input
          className="search-input"
          type="text"
          placeholder="Search free agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <SortableTable players={filtered} />

      {filtered.length === 0 && (
        <div className="empty-state">No free agents match your search.</div>
      )}
    </div>
  );
}

function SophomoresView() {
  const [search, setSearch] = useState("");
  const sophFreeAgents = useMemo(() => getSoonToBeSophomores(), []);

  const filtered = search
    ? sophFreeAgents.filter((p) => p.toLowerCase().includes(search.toLowerCase()))
    : sophFreeAgents;

  return (
    <div className="content-area">
      <div className="summary-bar">
        <div className="summary-item">
          <span className="summary-value cyan">{sophFreeAgents.length}</span>
          <span className="summary-label">Available Soon-to-be Sophomores</span>
        </div>
      </div>

      <p className="info-text">
        Current NBA rookies (2025 draft class) not on any fantasy rookie contract.
        These players are eligible to be drafted in the upcoming rookie draft as sophomores.
      </p>

      <div className="search-container">
        <input
          className="search-input"
          type="text"
          placeholder="Search sophomores..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <SortableTable players={filtered} />

      {filtered.length === 0 && (
        <div className="empty-state">No sophomores match your search.</div>
      )}
    </div>
  );
}

function CollapsibleTeam({ teamName, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`collapsible-team ${open ? "collapsible-team-open" : ""}`}>
      <button className="collapsible-team-header" onClick={() => setOpen(!open)}>
        <span className="collapsible-team-arrow">{open ? "\u25BC" : "\u25B6"}</span>
        <span className="collapsible-team-name">{teamName}</span>
      </button>
      {open && <div className="collapsible-team-body">{children}</div>}
    </div>
  );
}

function isInAppBrowser() {
  const ua = navigator.userAgent || navigator.vendor || "";
  return /FBAN|FBAV|Instagram|Twitter|Snapchat|Line\/|WhatsApp|MicroMessenger|LinkedIn/i.test(ua);
}

function OffseasonPlanView({ user, authLoading, signIn, signOut, myTeam, claimedTeams, claimTeam, unclaimTeam, teamNames, selections }) {
  const {
    getTeamSelections,
    wishlist,
    saveKeepers,
    saveRfas,
    saveWishlist,
    predictedAvailable,
    saveStatus,
    loading,
  } = selections;

  if (!user) {
    return (
      <div className="content-area">
        <div className="plan-login-prompt">
          <h2>Plan My Offseason</h2>
          <p>Sign in to claim your team and manage your keepers, RFAs, and wishlist.</p>
          {isInAppBrowser() ? (
            <div className="inapp-warning">
              <p><strong>Google sign-in is blocked in this browser.</strong></p>
              <p>Tap the menu (⋯) and select <strong>&quot;Open in Safari&quot;</strong> or <strong>&quot;Open in Chrome&quot;</strong> to sign in.</p>
            </div>
          ) : (
            <button className="auth-btn auth-btn-signin-large" onClick={signIn}>
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!myTeam) {
    return (
      <div className="content-area">
        <AuthBar user={user} loading={authLoading} onSignIn={signIn} onSignOut={signOut} myTeam={myTeam} />
        <TeamClaimModal claimedTeams={claimedTeams} myTeam={myTeam} onClaim={claimTeam} onUnclaim={unclaimTeam} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="content-area">
        <AuthBar user={user} loading={authLoading} onSignIn={signIn} onSignOut={signOut} myTeam={myTeam} />
        <div className="empty-state">Loading selections...</div>
      </div>
    );
  }

  const otherTeams = teamNames.filter((t) => t !== myTeam);
  const mySelections = getTeamSelections(myTeam);

  return (
    <div className="content-area">
      <AuthBar user={user} loading={authLoading} onSignIn={signIn} onSignOut={signOut} myTeam={myTeam} />

      <TeamPlanner
        teamName={myTeam}
        isMyTeam={true}
        keepers={mySelections.keepers}
        rfas={mySelections.rfas}
        wishlist={wishlist}
        saveKeepers={(players) => saveKeepers(myTeam, players)}
        saveRfas={(players) => saveRfas(myTeam, players)}
        saveWishlist={saveWishlist}
        saveStatus={saveStatus}
        predictedAvailable={predictedAvailable}
      />

      {otherTeams.length > 0 && (
        <div className="other-teams-section">
          <h2 className="other-teams-heading">Other Teams</h2>
          <p className="other-teams-description">
            Predict what other teams will do. Unselected players become available in your wishlist search.
          </p>
          {otherTeams.map((team) => {
            const sel = getTeamSelections(team);
            return (
              <CollapsibleTeam key={team} teamName={team} defaultOpen={false}>
                <TeamPlanner
                  teamName={team}
                  isMyTeam={false}
                  keepers={sel.keepers}
                  rfas={sel.rfas}
                  wishlist={[]}
                  saveKeepers={(players) => saveKeepers(team, players)}
                  saveRfas={(players) => saveRfas(team, players)}
                  saveWishlist={() => {}}
                  saveStatus={saveStatus}
                  predictedAvailable={[]}
                />
              </CollapsibleTeam>
            );
          })}
        </div>
      )}
    </div>
  );
}

function App() {
  const teamNames = useMemo(() => getTeamNames(), []);
  const [selectedTab, setSelectedTab] = useState("__PLAN__");

  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const { claimedTeams, myTeam, claimTeam, unclaimTeam } = useTeamClaim(user);
  const selections = useSelections(user, myTeam);

  return (
    <div className="app">
      <div className="header">
        <div className="header-inner">
          <div className="header-title-row">
            <img src="/champions-league.png" alt="Champions League" className="header-logo" />
            <h1>Champions League</h1>
          </div>
          <p className="subtitle">2026 Offseason Keeper Eligibility Tool</p>
        </div>
      </div>

      <div className="nav-bar">
        <div className="nav-inner">
          <button
            className={`nav-tab nav-tab-plan ${selectedTab === "__PLAN__" ? "active" : ""}`}
            onClick={() => setSelectedTab("__PLAN__")}
          >
            Plan My Offseason
          </button>
          {teamNames.map((name) => (
            <button
              key={name}
              className={`nav-tab ${selectedTab === name ? "active" : ""}`}
              onClick={() => setSelectedTab(name)}
            >
              {name === "Team Droptop" && <span className="crown-icon">👑 </span>}
              {name}
            </button>
          ))}
          <button
            className={`nav-tab nav-tab-special ${selectedTab === "__SOPH__" ? "active" : ""}`}
            onClick={() => setSelectedTab("__SOPH__")}
          >
            Soon-to-be Sophs
          </button>
          <button
            className={`nav-tab nav-tab-special ${selectedTab === "__FA__" ? "active" : ""}`}
            onClick={() => setSelectedTab("__FA__")}
          >
            Free Agents
          </button>
        </div>
      </div>

      <div className="main-content">
        {selectedTab === "__PLAN__" ? (
          <OffseasonPlanView
            user={user}
            authLoading={authLoading}
            signIn={signIn}
            signOut={signOut}
            myTeam={myTeam}
            claimedTeams={claimedTeams}
            claimTeam={claimTeam}
            unclaimTeam={unclaimTeam}
            teamNames={teamNames}
            selections={selections}
          />
        ) : selectedTab === "__FA__" ? (
          <FreeAgentsView />
        ) : selectedTab === "__SOPH__" ? (
          <SophomoresView />
        ) : (
          <TeamView teamName={selectedTab} />
        )}
      </div>
    </div>
  );
}

export default App;
