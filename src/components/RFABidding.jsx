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

function RoundSection({ roundNum, entries, myTeam, draft, setDraft, saved, onSave }) {
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

function EmailBids({ teamName, rounds, myTeam, bids }) {
  const roundMailto = (entries, roundNum) => {
    const bidLines = entries
      .filter(({ player, owner }) => owner !== myTeam && bids[player] != null)
      .map(({ player, owner }) => `  ${player} (${owner}): $${bids[player]}`);
    const title = `${teamName} — 2026 RFA Bids — Round ${roundNum}`;
    const body = `${title}\n\nROUND ${roundNum} BIDS:\n${bidLines.length ? bidLines.join("\n") : "  (no bids)"}\n`;
    return `mailto:championsleaguecommissioner@gmail.com?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="sel-section submit-section">
      <div className="sel-section-header">
        <div className="section-dot dot-blue" />
        <span className="sel-section-title">Submit Bids to Commissioner</span>
      </div>
      <p className="sel-description">
        Email your saved bids to the commissioner one round at a time.
      </p>
      <div className="submit-btn-row">
        {rounds.map((entries, i) => (
          <a key={i} href={roundMailto(entries, i + 1)} className="sel-save-btn submit-btn">
            Email Round {i + 1} Bids
          </a>
        ))}
      </div>
    </div>
  );
}

export function RFABidding({ myTeam, budgetAfterFees, freeSlots, bids, saveBids, saveStatus }) {
  const rounds = useMemo(() => getRounds(), []);

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

      {rounds.map((roundEntries, i) => (
        <RoundSection
          key={i}
          roundNum={i + 1}
          entries={roundEntries}
          myTeam={myTeam}
          draft={draft}
          setDraft={setDraft}
          saved={bids}
          onSave={() => saveRound(roundEntries)}
        />
      ))}

      <EmailBids teamName={myTeam} rounds={rounds} myTeam={myTeam} bids={bids} />
    </div>
  );
}
