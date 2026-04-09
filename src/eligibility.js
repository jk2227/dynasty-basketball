import {
  currentRosters,
  keepers2025,
  keepers2024,
  keepers2023,
  rfas2025,
  rfas2024,
  rookieDrafts,
  rookieContracts,
  allNBAPlayers,
  soonToBeSophomores,
} from "./data.js";

function normalizeName(name) {
  const aliases = {
    "Derek Lively II": "Dereck Lively II",
    "Jamie Jaquez Jr.": "Jaime Jaquez Jr.",
    "P.J. Washington": "PJ Washington",
    "PJ Washington": "PJ Washington",
    "Steph Curry": "Stephen Curry",
    "Ronald Holland II": "Ron Holland",
    "Ron Holland": "Ron Holland",
    "Carlton Carrington": "Bub Carrington",
  };
  return aliases[name] || name;
}

// Build a lookup: player -> { draftYear, pick, originalTeam }
function buildRookieLookup() {
  const lookup = {};
  for (const [year, picks] of Object.entries(rookieDrafts)) {
    for (const { pick, player, team } of picks) {
      const normalizedName = normalizeName(player);
      if (!lookup[normalizedName] || parseInt(year) > parseInt(lookup[normalizedName].draftYear)) {
        lookup[normalizedName] = { draftYear: parseInt(year), pick, originalTeam: team };
      }
    }
  }
  return lookup;
}

function wasKeptInYear(player, keepersData) {
  const norm = normalizeName(player);
  for (const team of Object.keys(keepersData)) {
    if (keepersData[team].some((p) => normalizeName(p) === norm)) {
      return true;
    }
  }
  return false;
}

function wasRFAdInYear(player, rfaData) {
  const norm = normalizeName(player);
  for (const team of Object.keys(rfaData)) {
    if (rfaData[team].some((p) => normalizeName(p) === norm)) {
      return true;
    }
  }
  return false;
}

function keeperTeamInYear(player, keepersData) {
  const norm = normalizeName(player);
  for (const [team, players] of Object.entries(keepersData)) {
    if (players.some((p) => normalizeName(p) === norm)) {
      return team;
    }
  }
  return null;
}

function rfaTeamInYear(player, rfaData) {
  const norm = normalizeName(player);
  for (const [team, players] of Object.entries(rfaData)) {
    if (players.some((p) => normalizeName(p) === norm)) {
      return team;
    }
  }
  return null;
}

// Get rookie salary based on draft pick info
function getRookieSalary(player, rookieLookup) {
  const norm = normalizeName(player);
  const info = rookieLookup[norm];
  if (!info) return 2; // FA/waiver rookies: $2 to keep

  const { pick } = info;
  // 1st round picks 1-4: $5 first season, $3 keeper seasons after
  // 1st round picks 5-10: $3 first season, $3 keeper seasons after
  // 2nd round picks (11+): Free when drafted, $2 keeper seasons after
  if (pick <= 4) return 3; // keeper season salary (not first season)
  if (pick <= 10) return 3;
  return 2; // 2nd round
}

// Check if a player has ever been RFA'd (which ends their rookie deal)
function wasEverRFAd(player) {
  const allRfaData = [rfas2024, rfas2025];
  const norm = normalizeName(player);
  for (const rfaData of allRfaData) {
    for (const team of Object.keys(rfaData)) {
      if (rfaData[team].some((p) => normalizeName(p) === norm)) {
        return true;
      }
    }
  }
  return false;
}

// Check if a player's rookie contract is expiring this offseason (2026)
function isComingOffRookieDeal(player) {
  const expiryYear = rookieContracts[player] || rookieContracts[normalizeName(player)];
  if (!expiryYear || expiryYear !== 2026) return false;
  if (wasEverRFAd(player)) return false;
  return true;
}

// Determine rookie deal status using authoritative rookieContracts data
function getRookieDealStatus(player, rookieLookup) {
  const expiryYear = rookieContracts[player] || rookieContracts[normalizeName(player)];
  // Expiry <= 2026 means deal has expired or expires this offseason (no longer on deal)
  if (!expiryYear || expiryYear <= 2026) return null;

  // If the player went through RFA at any point, their rookie deal is over
  if (wasEverRFAd(player)) return null;

  const yearsRemaining = expiryYear - 2026;
  const salary = getRookieSalary(player, rookieLookup);

  return {
    onRookieDeal: true,
    yearsRemaining,
    salary,
    expiryYear,
  };
}

// Main function: compute eligibility for all players on a team
export function computeTeamEligibility(teamName) {
  const roster = currentRosters[teamName] || [];
  const rookieLookup = buildRookieLookup();

  const results = [];

  for (const player of roster) {
    const norm = normalizeName(player);
    const rookieStatus = getRookieDealStatus(player, rookieLookup);

    const kept2025 = wasKeptInYear(player, keepers2025);
    const kept2024 = wasKeptInYear(player, keepers2024);
    const kept2023 = wasKeptInYear(player, keepers2023);

    const rfa2025 = wasRFAdInYear(player, rfas2025);
    const rfa2024 = wasRFAdInYear(player, rfas2024);

    let consecutiveKeeperYears = 0;
    if (kept2025 && !rfa2025) {
      consecutiveKeeperYears = 1;
      if (kept2024 && !rfa2024) {
        consecutiveKeeperYears = 2;
      }
    }

    let keeperEligible = consecutiveKeeperYears < 2;
    let keeperYearsRemaining = 2 - consecutiveKeeperYears;

    const onRookieDeal = rookieStatus !== null && rookieStatus.onRookieDeal;
    const comingOffRookie = isComingOffRookieDeal(player);

    // Players coming off an expiring rookie deal MUST be RFA'd
    if (comingOffRookie) {
      keeperEligible = false;
      keeperYearsRemaining = 0;
    }

    let birdRights = null;

    const keptBy2025 = keeperTeamInYear(player, keepers2025);
    const rfaBy2025 = rfaTeamInYear(player, rfas2025);
    const acquiredIn2025Offseason = keptBy2025 === teamName || rfaBy2025 === teamName;

    if (comingOffRookie) {
      birdRights = { discount: 85, reason: "Coming off Rookie Deal" };
    } else if (acquiredIn2025Offseason) {
      const wasMaxKept = kept2024 && kept2025;
      if (wasMaxKept) {
        birdRights = { discount: 95, reason: "Coming off Max Contract" };
      } else {
        birdRights = { discount: 90, reason: "Added during 2025 offseason" };
      }
    }

    let acquisitionMethod = "";
    if (kept2025 && kept2024) {
      acquisitionMethod = "Kept 2024, 2025";
    } else if (kept2025) {
      acquisitionMethod = "Kept 2025";
    } else if (kept2024) {
      acquisitionMethod = "Kept 2024";
    }
    if (rfa2025) {
      acquisitionMethod = acquisitionMethod ? acquisitionMethod + " | RFA'd 2025" : "RFA'd 2025";
    } else if (rfa2024) {
      acquisitionMethod = acquisitionMethod ? acquisitionMethod + " | RFA'd 2024" : "RFA'd 2024";
    }
    if (onRookieDeal) {
      const rookieInfo = rookieLookup[norm];
      if (rookieInfo) {
        acquisitionMethod = `Rookie Draft (${rookieInfo.draftYear}, Pick ${rookieInfo.pick})`;
      }
    }

    // Check if player is a 2025 NBA draft class rookie without a fantasy rookie contract
    // (eligible to be drafted in the upcoming rookie draft as a sophomore)
    const soonToBeSophSet = new Set(soonToBeSophomores.map(normalizeName));
    const eligibleForRookieDraft = soonToBeSophSet.has(norm);

    // Special cases: players with unique situations
    let specialNote = null;
    if (norm === "Kristaps Porzingis") {
      // Porzingis was kept but dropped mid-season and re-picked up, resetting his keeper streak
      consecutiveKeeperYears = 0;
      keeperEligible = true;
      keeperYearsRemaining = 2;
      specialNote = "Reset due to being dropped middle of season";
    }

    results.push({
      name: player,
      onRookieDeal,
      rookieStatus,
      eligibleForRookieDraft,
      keeperEligible: onRookieDeal ? true : keeperEligible,
      keeperYearsRemaining: onRookieDeal
        ? rookieStatus.yearsRemaining
        : keeperEligible
          ? keeperYearsRemaining
          : 0,
      consecutiveKeeperYears,
      birdRights,
      specialNote,
      acquisitionMethod,
      kept2025,
      kept2024,
      kept2023,
      rfa2025,
      rfa2024,
    });
  }

  return results;
}

// Get free agents (NBA players not on any fantasy roster)
export function getFreeAgents() {
  const rosteredPlayers = new Set();
  for (const team of Object.keys(currentRosters)) {
    for (const player of currentRosters[team]) {
      rosteredPlayers.add(normalizeName(player));
    }
  }

  return allNBAPlayers
    .filter((p) => !rosteredPlayers.has(normalizeName(p)))
    .sort((a, b) => a.localeCompare(b));
}

// Get soon-to-be sophomores not on any roster (2025 draft class rookies without fantasy rookie contracts)
export function getSoonToBeSophomores() {
  const rosteredPlayers = new Set();
  for (const team of Object.keys(currentRosters)) {
    for (const player of currentRosters[team]) {
      rosteredPlayers.add(normalizeName(player));
    }
  }

  return soonToBeSophomores
    .filter((p) => !rosteredPlayers.has(normalizeName(p)))
    .sort((a, b) => a.localeCompare(b));
}

// Get team names
export function getTeamNames() {
  return Object.keys(currentRosters).sort();
}
