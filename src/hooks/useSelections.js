import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase.js";
import { computeTeamEligibility, getTeamNames } from "../eligibility.js";

export function useSelections(user, myTeam) {
  // allSelections: { [teamName]: { keepers: [], rfas: [] } }
  const [allSelections, setAllSelections] = useState({});
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);

  const fetchSelections = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const [selRes, wlRes] = await Promise.all([
      supabase
        .from("offseason_selections")
        .select("*")
        .eq("user_id", user.id),
      supabase
        .from("wishlists")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (selRes.data) {
      const map = {};
      for (const row of selRes.data) {
        map[row.team_name] = {
          keepers: row.keepers || [],
          rfas: row.rfas || [],
        };
      }
      setAllSelections(map);
    }
    if (wlRes.data) {
      setWishlist(wlRes.data.players || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchSelections(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchSelections]);

  const flashSave = () => {
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const getTeamSelections = useCallback(
    (teamName) => allSelections[teamName] || { keepers: [], rfas: [] },
    [allSelections]
  );

  const saveKeepers = async (teamName, players) => {
    const current = getTeamSelections(teamName);
    setAllSelections((prev) => ({
      ...prev,
      [teamName]: { ...current, keepers: players },
    }));
    const { error } = await supabase.from("offseason_selections").upsert(
      {
        user_id: user.id,
        team_name: teamName,
        keepers: players,
        rfas: current.rfas,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id, team_name" }
    );
    if (!error) flashSave();
    return error;
  };

  const saveRfas = async (teamName, players) => {
    const current = getTeamSelections(teamName);
    setAllSelections((prev) => ({
      ...prev,
      [teamName]: { ...current, rfas: players },
    }));
    const { error } = await supabase.from("offseason_selections").upsert(
      {
        user_id: user.id,
        team_name: teamName,
        keepers: current.keepers,
        rfas: players,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id, team_name" }
    );
    if (!error) flashSave();
    return error;
  };

  const saveWishlist = async (players) => {
    setWishlist(players);
    const { error } = await supabase.from("wishlists").upsert(
      {
        user_id: user.id,
        team_name: myTeam,
        players,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (!error) flashSave();
    return error;
  };

  // Compute players predicted to be available from other teams
  const predictedAvailable = useMemo(() => {
    if (!myTeam) return [];
    const teamNames = getTeamNames();
    const available = [];

    for (const team of teamNames) {
      if (team === myTeam) continue;
      const sel = allSelections[team];
      if (!sel || (sel.keepers.length === 0 && sel.rfas.length === 0)) continue;

      const players = computeTeamEligibility(team);
      const keptNames = new Set(sel.keepers);
      const rfaNames = new Set(sel.rfas);

      for (const p of players) {
        if (p.onRookieDeal) continue; // rookies are locked in
        if (keptNames.has(p.name)) continue;
        if (rfaNames.has(p.name)) continue;
        available.push({ name: p.name, fromTeam: team });
      }
    }

    return available;
  }, [myTeam, allSelections]);

  return {
    allSelections,
    getTeamSelections,
    wishlist,
    saveKeepers,
    saveRfas,
    saveWishlist,
    predictedAvailable,
    loading,
    saveStatus,
  };
}
