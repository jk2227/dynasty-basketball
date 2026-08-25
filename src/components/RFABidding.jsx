import { useState, useMemo, useEffect } from "react";
import { rfas2026, playerStats, rookieContracts, teamBudgets } from "../data.js";
import { computeTeamEligibility, getTeamNames } from "../eligibility.js";

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

// team -> { budget, afterFees } using the same rookie-fee math as the Budgets tab
function getTeamCash() {
  const cash = {};
  for (const team of getTeamNames()) {
    const budget = teamBudgets[team] ?? 0;
    const fees = computeTeamEligibility(team)
      .filter((p) => p.onRookieDeal)
      .reduce((sum, p) => sum + p.rookieStatus.salary, 0);
    cash[team] = { budget, afterFees: budget - fees };
  }
  return cash;
}

function TeamCashPanel({ teamCash, myTeam }) {
  const rows = Object.entries(teamCash).sort((a, b) => b[1].afterFees - a[1].afterFees);
  return (
    <div className="sel-section">
      <div className="sel-section-header">
        <div className="section-dot dot-green" />
        <span className="sel-section-title">Team Budgets</span>
      </div>
      <p className="sel-description">
        What every team has to spend: current budget, and what&apos;s left after rookie
        contract fees pay out.
      </p>
      <div className="team-cash-grid">
        {rows.map(([team, { budget, afterFees }]) => (
          <div key={team} className={`team-cash-row${team === myTeam ? " team-cash-mine" : ""}`}>
            <span className="team-cash-name">{team}</span>
            <span className="team-cash-amounts">
              ${budget} <span className="team-cash-arrow">→</span> <strong>${afterFees}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BidRow({ player, owner, ownerCash, isMine, value, onChange }) {
  const stats = playerStats[player];
  return (
    <div className="sel-player sel-player-readonly bid-row">
      <span className="sel-player-name">{player}</span>
      <span className="bid-owner">
        {isMine ? "your RFA" : owner}
        {!isMine && ownerCash && (
          <span className="bid-owner-cash"> · ${ownerCash.budget} / ${ownerCash.afterFees} after fees</span>
        )}
      </span>
      {isMine && (
        <span className="badge badge-orange">you match at {matchDiscount(player)}%</span>
      )}
      {stats && stats.pts != null && (
        <span className="sel-player-stats">
          {stats.pts} pts / {stats.reb} reb / {stats.ast} ast
        </span>
      )}
      {!isMine && (
        <span className="bid-input-wrap">
          <span className="bid-label">bid $</span>
          <input
            className="bid-input"
            type="number"
            min="0"
            placeholder="-"
            value={value ?? ""}
            onChange={(e) => onChange(player, e.target.value)}
          />
        </span>
      )}
    </div>
  );
}

function roundMailto(teamName, entries, roundNum, bids) {
  const bidLines = entries
    .filter(({ player, owner }) => owner !== teamName && bids[player] != null)
    .map(({ player, owner }) => `  ${player} (${owner}): $${bids[player]}`);
  const title = `${teamName} — 2026 RFA Bids — Round ${roundNum}`;
  const body = `${title}\n\nROUND ${roundNum} BIDS:\n${bidLines.length ? bidLines.join("\n") : "  (no bids)"}\n`;
  return `mailto:championsleaguecommissioner@gmail.com?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function RoundSection({ roundNum, entries, myTeam, teamCash, draft, setDraft, saved, onSave }) {
  const biddable = entries.filter(({ owner }) => owner !== myTeam);
  const changed = biddable.some(({ player }) => (draft[player] ?? null) !== (saved[player] ?? null));

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
          {biddable.filter(({ player }) => draft[player] != null).length} bids
        </span>
      </div>
      <p className="sel-description">
        Enter sealed bids on other teams&apos; round {roundNum} RFAs. Leave blank to pass.
        Bids are private to you until emailed. You can&apos;t bid on your own RFA — you match
        the winning bid instead.
      </p>
      <div className="sel-player-list">
        {entries.map(({ player, owner }) => (
          <BidRow
            key={player}
            player={player}
            owner={owner}
            ownerCash={teamCash[owner]}
            isMine={owner === myTeam}
            value={draft[player]}
            onChange={handleChange}
          />
        ))}
      </div>
      <div className="sel-btn-row">
        <button className="sel-save-btn" disabled={!changed} onClick={onSave}>
          Save Round {roundNum} Bids
        </button>
        <a
          href={roundMailto(myTeam, entries, roundNum, draft)}
          className="sel-save-btn submit-btn"
          onClick={() => {
            if (changed) onSave();
          }}
        >
          Email Round {roundNum} Bids
        </a>
      </div>
      {changed && (
        <p className="sel-description bid-unsaved-note">
          Unsaved changes — emailing will save them for you.
        </p>
      )}
    </div>
  );
}

export function RFABidding({ myTeam, budgetAfterFees, freeSlots, bids, saveBids, saveStatus }) {
  const rounds = useMemo(() => getRounds(), []);
  const teamCash = useMemo(() => getTeamCash(), []);

  // draft = saved bids + unsaved edits, keyed by player
  const [draft, setDraft] = useState({ ...bids });
  useEffect(() => {
    setDraft({ ...bids }); // eslint-disable-line react-hooks/set-state-in-effect
  }, [bids]);

  const myPlayers = useMemo(() => new Set(rfas2026[myTeam] || []), [myTeam]);

  const entries = Object.entries(draft).filter(([p]) => !myPlayers.has(p));
  const totalCommitted = entries.reduce((sum, [, amt]) => sum + amt, 0);
  const bidCount = entries.length;
  const overBudget = totalCommitted > budgetAfterFees;
  const overSlots = bidCount > freeSlots;

  const saveRound = (roundEntries) => {
    const nextBids = { ...bids };
    for (const { player, owner } of roundEntries) {
      if (owner === myTeam) continue;
      if (draft[player] != null) nextBids[player] = draft[player];
      else delete nextBids[player];
    }
    void saveBids(nextBids);
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
          <span className="summary-label">Committed If All Bids Win</span>
        </div>
        <div className="summary-item">
          <span className={`summary-value ${overSlots ? "red" : "cyan"}`}>{bidCount} / {freeSlots}</span>
          <span className="summary-label">Bids vs Open Slots</span>
        </div>
        {saveStatus === "saved" && <div className="save-flash">Saved!</div>}
        {saveStatus === "error" && <div className="save-flash" style={{ color: "#ff4444" }}>Save failed!</div>}
      </div>
      {overBudget && (
        <p className="bid-warning">
          Warning: if every bid wins, you&apos;d spend ${totalCommitted} of your ${budgetAfterFees} budget.
        </p>
      )}
      {overSlots && (
        <p className="bid-warning">
          Warning: you have {freeSlots} open roster slot{freeSlots !== 1 ? "s" : ""} but {bidCount} bids entered — you can&apos;t roster them all.
        </p>
      )}

      <TeamCashPanel teamCash={teamCash} myTeam={myTeam} />

      {rounds.map((roundEntries, i) => (
        <RoundSection
          key={i}
          roundNum={i + 1}
          entries={roundEntries}
          myTeam={myTeam}
          teamCash={teamCash}
          draft={draft}
          setDraft={setDraft}
          saved={bids}
          onSave={() => saveRound(roundEntries)}
        />
      ))}
    </div>
  );
}
