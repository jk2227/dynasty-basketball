import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

export function useTeamClaim(user) {
  const [claimedTeams, setClaimedTeams] = useState(new Map());
  const [loading, setLoading] = useState(true);

  const fetchClaims = useCallback(async () => {
    const { data } = await supabase.from("team_claims").select("*");
    if (data) {
      const map = new Map();
      for (const row of data) {
        map.set(row.team_name, { userId: row.user_id, email: row.user_email });
      }
      setClaimedTeams(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Fetch claims from Supabase on mount
    void fetchClaims(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchClaims]);

  const myTeam = user
    ? [...claimedTeams.entries()].find(([, v]) => v.userId === user.id)?.[0] ?? null
    : null;

  const claimTeam = async (teamName) => {
    if (!user) return;
    const { error } = await supabase.from("team_claims").insert({
      user_id: user.id,
      team_name: teamName,
      user_email: user.email,
    });
    if (!error) await fetchClaims();
    return error;
  };

  const unclaimTeam = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("team_claims")
      .delete()
      .eq("user_id", user.id);
    if (!error) await fetchClaims();
    return error;
  };

  return { claimedTeams, myTeam, claimTeam, unclaimTeam, loading };
}
