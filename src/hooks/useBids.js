import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

// Sealed RFA bids: one row per user holding
//   bids: { [playerName]: dollarAmount }   (bids on other teams' RFAs)
export function useBids(user, myTeam) {
  const [bids, setBids] = useState({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);

  const fetchBids = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("rfa_bids")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.error("fetchBids error:", error);
    }
    if (data) {
      setBids(data.bids || {});
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchBids(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchBids]);

  const flash = (status) => {
    setSaveStatus(status);
    setTimeout(() => setSaveStatus(null), status === "saved" ? 2000 : 3000);
  };

  const saveBids = async (next) => {
    setBids(next);
    const { error } = await supabase.from("rfa_bids").upsert(
      {
        user_id: user.id,
        team_name: myTeam,
        bids: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) {
      console.error("saveBids error:", error);
      flash("error");
    } else {
      flash("saved");
    }
    return error;
  };

  return { bids, saveBids, loading, saveStatus };
}
