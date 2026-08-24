import { useState, useMemo } from "react";
import { computeTeamEligibility, getFreeAgents, getEligibleForRookieDraft, getTeamNames } from "./eligibility.js";
import { playerStats, teamBudgets, keepers2026, rfas2026, ROSTER_SIZE } from "./data.js";
import { espnPlayerIds } from "./playerIds.js";
import { useAuth } from "./hooks/useAuth.js";
import { useTeamClaim } from "./hooks/useTeamClaim.js";
import { useSelections } from "./hooks/useSelections.js";
import { useBids } from "./hooks/useBids.js";
import { AuthBar } from "./components/AuthBar.jsx";
import { TeamClaimModal } from "./components/TeamClaimModal.jsx";
import { TeamPlanner } from "./components/MyTeamManager.jsx";
import { RFABidding } from "./components/RFABidding.jsx";

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

function TeamSectionTable({ players, extraColumn, defaultSortCol = "pts" }) {
  // defaultSortCol: null keeps the given player order until a column is clicked
  const [sortCol, setSortCol] = useState(defaultSortCol);
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
    if (!sortCol) return players;
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

  const keeperSet = new Set(keepers2026[teamName] || []);
  const rfaSet = new Set(rfas2026[teamName] || []);
  const keepers = players.filter((p) => keeperSet.has(p.name));
  // rfas2026 arrays are stored in the league sheet's bidding round order (Group 1, 2, 3)
  const rfaOrder = rfas2026[teamName] || [];
  const rfas = players
    .filter((p) => rfaSet.has(p.name))
    .sort((a, b) => rfaOrder.indexOf(a.name) - rfaOrder.indexOf(b.name));
  const rookies = players.filter((p) => p.onRookieDeal && !keeperSet.has(p.name) && !rfaSet.has(p.name));
  // RFAs don't count against the roster limit - only keepers + rookie contracts do
  const freeSpace = ROSTER_SIZE - keepers.length - rookies.length;

  const budget = teamBudgets[teamName];
  const rookieFees = rookies.reduce((sum, p) => sum + p.rookieStatus.salary, 0);

  return (
    <div className="content-area">
      {budget != null && (
        <div className="summary-bar">
          <div className="summary-item">
            <span className="summary-value muted">${budget}</span>
            <span className="summary-label">Budget</span>
          </div>
          <div className="summary-item">
            <span className="summary-value red">-${rookieFees}</span>
            <span className="summary-label">Rookie Fees</span>
          </div>
          <div className="summary-item">
            <span className="summary-value green">${budget - rookieFees}</span>
            <span className="summary-label">After Rookie Fees</span>
          </div>
        </div>
      )}
      <div className="summary-bar">
        <div className="summary-item">
          <span className="summary-value green">{keepers.length}</span>
          <span className="summary-label">Keepers</span>
        </div>
        <div className="summary-item">
          <span className="summary-value red">{rfas.length}</span>
          <span className="summary-label">RFAs</span>
        </div>
        <div className="summary-item">
          <span className="summary-value cyan">{rookies.length}</span>
          <span className="summary-label">Rookie Deals</span>
        </div>
        <div className="summary-item">
          <span className="summary-value muted">{freeSpace}</span>
          <span className="summary-label">Free Space (of {ROSTER_SIZE})</span>
        </div>
      </div>

      {keepers.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div className="section-dot dot-green" />
            <span className="section-title">2026 Keepers</span>
            <span className="section-count">{keepers.length}</span>
          </div>
          <TeamSectionTable players={keepers} extraColumn={(p) => (
            <>
              <span className="badge badge-green">2026 Keeper</span>
              {p.birdRights && <span className="badge badge-orange" style={{marginLeft: 4}}>Bird {p.birdRights.discount}%</span>}
              {p.consecutiveKeeperYears > 0 && <span className="badge badge-gray" style={{marginLeft: 4}}>Kept {p.consecutiveKeeperYears}x</span>}
              {p.specialNote && <span className="badge badge-gray" style={{marginLeft: 4}}>{p.specialNote}</span>}
            </>
          )} />
        </div>
      )}

      {rfas.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div className="section-dot dot-red" />
            <span className="section-title">2026 RFAs (don't count toward roster space)</span>
            <span className="section-count">{rfas.length}</span>
          </div>
          <TeamSectionTable players={rfas} defaultSortCol={null} extraColumn={(p) => (
            <>
              <span className="badge badge-red">Round {rfaOrder.indexOf(p.name) + 1} RFA - bidding pending</span>
              {p.birdRights && <span className="badge badge-orange" style={{marginLeft: 4}}>Bird {p.birdRights.discount}%</span>}
              {p.consecutiveKeeperYears > 0 && <span className="badge badge-gray" style={{marginLeft: 4}}>Kept {p.consecutiveKeeperYears}x</span>}
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

function EligibleDraftView() {
  const [search, setSearch] = useState("");
  const eligible = useMemo(() => getEligibleForRookieDraft(), []);

  const filtered = search
    ? eligible.filter((p) => p.toLowerCase().includes(search.toLowerCase()))
    : eligible;

  return (
    <div className="content-area">
      <div className="summary-bar">
        <div className="summary-item">
          <span className="summary-value cyan">{eligible.length}</span>
          <span className="summary-label">Eligible players to be drafted</span>
        </div>
      </div>

      <p className="info-text">
        2025 NBA draft class rookies not on any fantasy rookie contract (sophomores)
        and the full 2026 NBA draft class (freshmen). All are eligible to be drafted
        in the upcoming rookie draft.
      </p>

      <div className="search-container">
        <input
          className="search-input"
          type="text"
          placeholder="Search eligible players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <SortableTable players={filtered} />

      {filtered.length === 0 && (
        <div className="empty-state">No eligible players match your search.</div>
      )}
    </div>
  );
}

function BudgetsView() {
  const rows = useMemo(() => {
    return getTeamNames()
      .map((team) => {
        const budget = teamBudgets[team];
        const rookies = computeTeamEligibility(team).filter((p) => p.onRookieDeal);
        const fees = rookies.reduce((sum, p) => sum + p.rookieStatus.salary, 0);
        return {
          team,
          budget: budget ?? 0,
          fees,
          anticipated: (budget ?? 0) - fees,
          feePlayers: rookies.filter((p) => p.rookieStatus.salary > 0),
        };
      })
      .sort((a, b) => b.anticipated - a.anticipated);
  }, []);

  return (
    <div className="content-area">
      <p className="info-text">
        Each team&apos;s auction budget for the 2026 offseason, minus the rookie
        fees owed for players on rookie deals (1st round picks 1-4: $5 first
        season; picks 5-10: $3; 2nd round: free when drafted, $2 in keeper
        seasons; FA/waiver rookies: $2).
      </p>
      <table className="stats-table">
        <thead>
          <tr>
            <th className="col-name">Team</th>
            <th className="col-stat">Budget</th>
            <th className="col-stat">Rookie Fees</th>
            <th className="col-stat">After Rookie Fees</th>
            <th className="col-status">Fees Owed On</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team}>
              <td className="col-name">{r.team}</td>
              <td className="col-stat">${r.budget}</td>
              <td className="col-stat">{r.fees > 0 ? `-$${r.fees}` : "$0"}</td>
              <td className="col-stat"><strong>${r.anticipated}</strong></td>
              <td className="col-status">
                {r.feePlayers.length > 0
                  ? r.feePlayers.map((p) => `${p.name} ($${p.rookieStatus.salary})`).join(", ")
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const bidState = useBids(user, myTeam);

  const myBudgetInfo = useMemo(() => {
    if (!myTeam) return null;
    const players = computeTeamEligibility(myTeam);
    const keeperSet = new Set(keepers2026[myTeam] || []);
    const rfaSet = new Set(rfas2026[myTeam] || []);
    const rookies = players.filter((p) => p.onRookieDeal && !keeperSet.has(p.name) && !rfaSet.has(p.name));
    const fees = rookies.reduce((sum, p) => sum + p.rookieStatus.salary, 0);
    return {
      budgetAfterFees: (teamBudgets[myTeam] ?? 0) - fees,
      freeSlots: ROSTER_SIZE - keeperSet.size - rookies.length,
    };
  }, [myTeam]);

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

      <div className="other-teams-section">
        <h2 className="other-teams-heading">RFA Bidding</h2>
        <p className="other-teams-description">
          The official 2026 RFAs, grouped by bidding round. Enter your sealed bids and match limits, then email them to the commissioner.
        </p>
        <RFABidding
          myTeam={myTeam}
          budgetAfterFees={myBudgetInfo.budgetAfterFees}
          freeSlots={myBudgetInfo.freeSlots}
          bids={bidState.bids}
          matchLimits={bidState.matchLimits}
          saveBids={bidState.saveBids}
          saveMatchLimits={bidState.saveMatchLimits}
          saveStatus={bidState.saveStatus}
        />
      </div>

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
            className={`nav-tab nav-tab-special ${selectedTab === "__BUDGETS__" ? "active" : ""}`}
            onClick={() => setSelectedTab("__BUDGETS__")}
          >
            Budgets
          </button>
          <button
            className={`nav-tab nav-tab-special ${selectedTab === "__SOPH__" ? "active" : ""}`}
            onClick={() => setSelectedTab("__SOPH__")}
          >
            Eligible players to be drafted
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
        ) : selectedTab === "__BUDGETS__" ? (
          <BudgetsView />
        ) : selectedTab === "__FA__" ? (
          <FreeAgentsView />
        ) : selectedTab === "__SOPH__" ? (
          <EligibleDraftView />
        ) : (
          <TeamView teamName={selectedTab} />
        )}
      </div>
    </div>
  );
}

export default App;
