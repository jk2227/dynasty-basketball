import { useState, useMemo } from "react";
import { computeTeamEligibility, getFreeAgents, getSoonToBeSophomores } from "../eligibility.js";
import { playerStats } from "../data.js";
/* eslint-disable react/prop-types */

function PlayerCheckbox({ name, checked, onChange, disabled }) {
  const stats = playerStats[name];
  return (
    <label className={`sel-player ${checked ? "sel-player-checked" : ""} ${disabled && !checked ? "sel-player-disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(name)}
        disabled={disabled && !checked}
      />
      <span className="sel-player-name">{name}</span>
      {stats && (
        <span className="sel-player-stats">
          {stats.pts} pts / {stats.reb} reb / {stats.ast} ast
        </span>
      )}
    </label>
  );
}

function KeeperSelector({ players, keepers, onSave }) {
  const [selected, setSelected] = useState(keepers);

  const toggle = (name) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const atLimit = selected.length >= 4;
  const changed = JSON.stringify([...selected].sort()) !== JSON.stringify([...keepers].sort());

  return (
    <div className="sel-section">
      <div className="sel-section-header">
        <div className="section-dot dot-green" />
        <span className="sel-section-title">Keeper Selections</span>
        <span className="sel-count">{selected.length} / 4</span>
      </div>
      <p className="sel-description">Select exactly 4 keeper-eligible players to keep.</p>
      <div className="sel-player-list">
        {players.map((p) => (
          <PlayerCheckbox
            key={p.name}
            name={p.name}
            checked={selected.includes(p.name)}
            onChange={toggle}
            disabled={atLimit}
          />
        ))}
      </div>
      <button
        className="sel-save-btn"
        disabled={selected.length !== 4 || !changed}
        onClick={() => onSave(selected)}
      >
        Save Keepers
      </button>
    </div>
  );
}

function RFASelector({ players, rfas, onSave }) {
  const [selected, setSelected] = useState(rfas);

  const toggle = (name) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const atLimit = selected.length >= 3;
  const changed = JSON.stringify([...selected].sort()) !== JSON.stringify([...rfas].sort());

  return (
    <div className="sel-section">
      <div className="sel-section-header">
        <div className="section-dot dot-red" />
        <span className="sel-section-title">RFA Selections</span>
        <span className="sel-count">{selected.length} / 3</span>
      </div>
      <p className="sel-description">Select exactly 3 players for your RFA slots.</p>
      <div className="sel-player-list">
        {players.map((p) => (
          <PlayerCheckbox
            key={p.name}
            name={p.name}
            checked={selected.includes(p.name)}
            onChange={toggle}
            disabled={atLimit}
          />
        ))}
      </div>
      <button
        className="sel-save-btn"
        disabled={selected.length !== 3 || !changed}
        onClick={() => onSave(selected)}
      >
        Save RFAs
      </button>
    </div>
  );
}

function WishlistBuilder({ wishlist, onSave, remainingSlots, predictedAvailable }) {
  const [search, setSearch] = useState("");
  const [current, setCurrent] = useState(wishlist);

  const freeAgents = useMemo(() => getFreeAgents(), []);
  const sophomores = useMemo(() => getSoonToBeSophomores(), []);

  // Build a map of player name -> source team for predicted available players
  const predictedMap = useMemo(() => {
    const map = new Map();
    for (const p of predictedAvailable || []) {
      map.set(p.name, p.fromTeam);
    }
    return map;
  }, [predictedAvailable]);

  const allAvailable = useMemo(() => {
    const set = new Set([...freeAgents, ...sophomores]);
    for (const p of predictedAvailable || []) {
      set.add(p.name);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [freeAgents, sophomores, predictedAvailable]);

  const filtered = search.length >= 2
    ? allAvailable
        .filter((p) => p.toLowerCase().includes(search.toLowerCase()))
        .filter((p) => !current.includes(p))
        .slice(0, 20)
    : [];

  const addPlayer = (name) => {
    const next = [...current, name];
    setCurrent(next);
    onSave(next);
    setSearch("");
  };

  const removePlayer = (name) => {
    const next = current.filter((n) => n !== name);
    setCurrent(next);
    onSave(next);
  };

  return (
    <div className="sel-section">
      <div className="sel-section-header">
        <div className="section-dot dot-cyan" />
        <span className="sel-section-title">Wishlist / Target Players</span>
        <span className="sel-count">{current.length} / {remainingSlots}</span>
      </div>
      <p className="sel-description">
        Build a target list of free agents, upcoming sophomores, and predicted drops for RFA and free agency.
        You have <strong>{remainingSlots}</strong> roster slot{remainingSlots !== 1 ? "s" : ""} to fill.
      </p>

      <div className="wl-search-container">
        <input
          className="search-input"
          type="text"
          placeholder="Search players to add..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {filtered.length > 0 && (
          <div className="wl-dropdown">
            {filtered.map((name) => (
              <button
                key={name}
                className="wl-dropdown-item"
                onClick={() => addPlayer(name)}
              >
                <span>{name}</span>
                <span className="wl-dropdown-meta">
                  {predictedMap.has(name) && (
                    <span className="wl-from-team">from {predictedMap.get(name)}</span>
                  )}
                  {playerStats[name] && (
                    <span className="sel-player-stats">
                      {playerStats[name].pts} pts
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {current.length > 0 && (
        <div className="wl-chips">
          {current.map((name) => (
            <span key={name} className="wl-chip">
              {name}
              {predictedMap.has(name) && (
                <span className="wl-chip-source"> ({predictedMap.get(name)})</span>
              )}
              <button className="wl-chip-remove" onClick={() => removePlayer(name)}>
                x
              </button>
            </span>
          ))}
        </div>
      )}

      {current.length === 0 && (
        <div className="empty-state">No players on your wishlist yet. Search above to add.</div>
      )}
    </div>
  );
}

function RookieContracts({ players }) {
  if (players.length === 0) return null;

  return (
    <div className="sel-section">
      <div className="sel-section-header">
        <div className="section-dot dot-cyan" />
        <span className="sel-section-title">Rookie Contracts</span>
        <span className="sel-count">{players.length}</span>
      </div>
      <p className="sel-description">These players are on rookie deals and don't count toward the 4 keeper slots.</p>
      <div className="sel-player-list">
        {players.map((p) => (
          <div key={p.name} className="sel-player sel-player-readonly">
            <span className="sel-player-name">{p.name}</span>
            <span className="badge badge-cyan">
              Rookie - expires {p.rookieStatus.expiryYear} - ${p.rookieStatus.salary}
            </span>
            {playerStats[p.name] && (
              <span className="sel-player-stats">
                {playerStats[p.name].pts} pts / {playerStats[p.name].reb} reb / {playerStats[p.name].ast} ast
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamPlanner({ teamName, isMyTeam, keepers, rfas, wishlist, saveKeepers, saveRfas, saveWishlist, saveStatus, predictedAvailable }) {
  const [localKeepers, setLocalKeepers] = useState(keepers);
  const players = useMemo(() => computeTeamEligibility(teamName), [teamName]);

  const keeperEligible = players.filter((p) => !p.onRookieDeal && p.keeperEligible);
  const mustRFA = players.filter((p) => !p.onRookieDeal && !p.keeperEligible);
  const rookies = players.filter((p) => p.onRookieDeal);

  // Unselected keeper-eligible players flow into the RFA pool
  const unkeptPlayers = keeperEligible.filter((p) => !localKeepers.includes(p.name));
  const rfaCandidates = [...mustRFA, ...unkeptPlayers];

  const handleSaveKeepers = (selected) => {
    setLocalKeepers(selected);
    saveKeepers(selected);
  };

  return (
    <div className={isMyTeam ? "content-area" : ""}>
      {isMyTeam && (
        <div className="summary-bar">
          <div className="summary-item">
            <span className="summary-value" style={{ color: "var(--accent-orange)" }}>{teamName}</span>
            <span className="summary-label">Your Team</span>
          </div>
          {saveStatus === "saved" && (
            <div className="save-flash">Saved!</div>
          )}
        </div>
      )}

      <KeeperSelector
        players={keeperEligible}
        keepers={keepers}
        onSave={handleSaveKeepers}
      />

      <RookieContracts players={rookies} />

      <RFASelector
        players={rfaCandidates}
        rfas={rfas}
        onSave={saveRfas}
      />

      {isMyTeam && (
        <WishlistBuilder
          wishlist={wishlist}
          onSave={saveWishlist}
          remainingSlots={15 - 4 - 3 - rookies.length}
          predictedAvailable={predictedAvailable}
        />
      )}
    </div>
  );
}

// Keep backward-compatible export name
export const MyTeamManager = TeamPlanner;
