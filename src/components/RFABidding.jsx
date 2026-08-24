import { useState, useMemo, useEffect } from "react";
import { rfas2026, playerStats, rookieContracts } from "../data.js";

const ROUND_COUNT = 3;

// Build round -> [{player, owner}] from the official RFA designations
function getRounds() {
  const teams = Object.keys(rfas2026);
  return Array.from({ length: ROUND_COUNT }, (_, i) =>
    teams
      .map((t) => ({ player: rfas2026[t][i], owner: t }))
      .filter((r) => r.player)
  );
}

const matchDiscount = (name) => (rookieContracts[name] === 2026 ? 85 : 90);

function BidRow({ player, owner, isMine, value, onChange }) {
  const stats = playerStats[player];
  return (
    <div className="sel-player sel-player-readonly bid-row">
      <span className="sel-player-name">{player}</span>
      <span className="bid-owner">{isMine ? "your RFA" : owner}</span>
      {isMine && (
        <span className="badge badge-orange">match at {matchDiscount(player)}%</span>
      )}
      {stats && stats.pts != null && (
        <span className="sel-player-stats">
          {stats.pts} pts / {stats.reb} reb / {stats.ast} ast
        </span>
      )}
      <span className="bid-input-wrap">
        <span className="bid-label">{isMine ? "match up to $" : "bid $"}</span>
        <input
          className="bid-input"
          type="number"
          min="0"
          placeholder="-"
          value={value ?? ""}
          onChange={(e) => onChange(player, e.target.value)}
        />
      </span>
    </div>
  );
}

function RoundSection({ roundNum, entries, myTeam, draft, setDraft, saved, onSave }) {
  const changed = entries.some(({ player }) => {
    const d = draft[player];
    const s = saved[player];
    return (d ?? null) !== (s ?? null);
  });

  const handleChange = (player, raw) => {
    const num = raw === "" ? null : Math.max(0, Math.floor(Number(raw)));
    setDraft((prev) => {
      const next = { ...prev };
      if (num == null || Number.isNaN(num) || num === 0) delete next[player];
      else next[player] = num;
      return next;
    });
  };

  return (
    <div className="sel-section">
      <div className="sel-section-header">
        <div className="section-dot dot-red" />
        <span className="sel-section-title">RFA Round {roundNum}</span>
        <span className="sel-count">
          {entries.filter(({ player }) => draft[player] != null).length} bids
        </span>
      </div>
      <p className="sel-description">
        Enter sealed bids on other teams&apos; round {roundNum} RFAs, and the max price you&apos;d
        match on your own. Leave blank to pass. Bids are private to you until emailed.
      </p>
      <div className="sel-player-list">
        {entries.map(({ player, owner }) => (
          <BidRow
            key={player}
            player={player}
            owner={owner}
            isMine={owner === myTeam}
            value={draft[player]}
            onChange={handleChange}
          />
        ))}
      </div>
      <button className="sel-save-btn" disabled={!changed} onClick={onSave}>
        Save Round {roundNum} Bids
      </button>
    </div>
  );
}

function EmailBids({ teamName, rounds, myTeam, bids, matchLimits }) {
  const lines = [];
  rounds.forEach((entries, i) => {
    const bidLines = entries
      .filter(({ player, owner }) => owner !== myTeam && bids[player] != null)
      .map(({ player, owner }) => `  ${player} (${owner}): $${bids[player]}`);
    const matchLines = entries
      .filter(({ player, owner }) => owner === myTeam && matchLimits[player] != null)
      .map(({ player }) => `  ${player}: match up to $${matchLimits[player]}`);
    lines.push(`ROUND ${i + 1} BIDS:`);
    lines.push(bidLines.length ? bidLines.join("\n") : "  (no bids)");
    if (matchLines.length) {
      lines.push(`ROUND ${i + 1} MATCH LIMITS:`);
      lines.push(matchLines.join("\n"));
    }
    lines.push("");
  });

  const subject = encodeURIComponent(`${teamName} — 2026 RFA Bids`);
  const body = encodeURIComponent(`${teamName} — 2026 RFA Bids\n\n${lines.join("\n")}`);
  const mailto = `mailto:championsleaguecommissioner@gmail.com?subject=${subject}&body=${body}`;

  return (
    <div className="sel-section submit-section">
      <div className="sel-section-header">
        <div className="section-dot dot-blue" />
        <span className="sel-section-title">Submit Bids to Commissioner</span>
      </div>
      <p className="sel-description">Email your saved bids and match limits for all three rounds.</p>
      <a href={mailto} className="sel-save-btn submit-btn">
        Email My Bids
      </a>
    </div>
  );
}

export function RFABidding({ myTeam, budgetAfterFees, freeSlots, bids, matchLimits, saveBids, saveMatchLimits, saveStatus }) {
  const rounds = useMemo(() => getRounds(), []);

  // draft = saved values + unsaved edits, keyed by player
  const [draft, setDraft] = useState({ ...bids, ...matchLimits });
  useEffect(() => {
    setDraft({ ...bids, ...matchLimits }); // eslint-disable-line react-hooks/set-state-in-effect
  }, [bids, matchLimits]);

  const myPlayers = useMemo(() => new Set(rfas2026[myTeam] || []), [myTeam]);

  const totalCommitted = Object.entries(draft).reduce((sum, [player, amt]) => {
    // matches cost the bird-discounted price; bids cost face value
    return sum + (myPlayers.has(player) ? Math.ceil((amt * matchDiscount(player)) / 100) : amt);
  }, 0);
  const bidCount = Object.keys(draft).filter((p) => !myPlayers.has(p)).length;
  const matchCount = Object.keys(draft).filter((p) => myPlayers.has(p)).length;
  const overBudget = totalCommitted > budgetAfterFees;
  const overSlots = bidCount + matchCount > freeSlots;

  const saveRound = (entries) => {
    const nextBids = { ...bids };
    const nextLimits = { ...matchLimits };
    for (const { player, owner } of entries) {
      const target = owner === myTeam ? nextLimits : nextBids;
      if (draft[player] != null) target[player] = draft[player];
      else delete target[player];
    }
    // persist both maps in one row; saveBids writes bids with current limits, so chain
    void saveBids(nextBids).then(() => saveMatchLimits(nextLimits));
  };

  return (
    <div>
      <div className="summary-bar">
        <div className="summary-item">
          <span className="summary-value muted">${budgetAfterFees}</span>
          <span className="summary-label">Budget After Rookie Fees</span>
        </div>
        <div className="summary-item">
          <span className={`summary-value ${overBudget ? "red" : "green"}`}>${totalCommitted}</span>
          <span className="summary-label">Committed If All Bids/Matches Hit</span>
        </div>
        <div className="summary-item">
          <span className={`summary-value ${overSlots ? "red" : "cyan"}`}>{bidCount + matchCount} / {freeSlots}</span>
          <span className="summary-label">Bids+Matches vs Open Slots</span>
        </div>
        {saveStatus === "saved" && <div className="save-flash">Saved!</div>}
        {saveStatus === "error" && <div className="save-flash" style={{ color: "#ff4444" }}>Save failed!</div>}
      </div>
      {overBudget && (
        <p className="bid-warning">
          Warning: if every bid wins and every match triggers, you&apos;d spend ${totalCommitted} of your ${budgetAfterFees} budget.
        </p>
      )}
      {overSlots && (
        <p className="bid-warning">
          Warning: you have {freeSlots} open roster slot{freeSlots !== 1 ? "s" : ""} but {bidCount + matchCount} bids/matches entered — you can&apos;t roster them all.
        </p>
      )}

      {rounds.map((entries, i) => (
        <RoundSection
          key={i}
          roundNum={i + 1}
          entries={entries}
          myTeam={myTeam}
          draft={draft}
          setDraft={setDraft}
          saved={{ ...bids, ...matchLimits }}
          onSave={() => saveRound(entries)}
        />
      ))}

      <EmailBids teamName={myTeam} rounds={rounds} myTeam={myTeam} bids={bids} matchLimits={matchLimits} />
    </div>
  );
}
