import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

export function useTeamClaim(user) {
  const [claimedTeams, setClaimedTeams] = useState(new Map());
  const [loading, setLoading] = useState(true);

  const fetchClaims = useCallback(async () => {
    const { data, error } = await supabase.from("team_claims").select("*");
    if (error) {
      console.error("fetchClaims error:", error);
    }
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
    // Refetch when the user changes so we get the authenticated view once Supabase hydrates the session
    void fetchClaims(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchClaims, user]);

  const myTeam = user
    ? [...claimedTeams.entries()].find(([, v]) => v.userId === user.id)?.[0] ?? null
    : null;

  const claimTeam = async (teamName) => {
    if (!user) {
      alert("Please sign in before claiming a team.");
      return;
    }
    const { error } = await supabase.from("team_claims").insert({
      user_id: user.id,
      team_name: teamName,
      user_email: user.email,
    });
    if (error) {
      console.error("claimTeam error:", error);
      alert(`Could not claim ${teamName}: ${error.message}`);
      return error;
    }
    await fetchClaims();
    return null;
  };

  const unclaimTeam = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("team_claims")
      .delete()
      .eq("user_id", user.id);
    if (error) {
      console.error("unclaimTeam error:", error);
      alert(`Could not unclaim team: ${error.message}`);
      return error;
    }
    await fetchClaims();
    return null;
  };

  return { claimedTeams, myTeam, claimTeam, unclaimTeam, loading };
}
