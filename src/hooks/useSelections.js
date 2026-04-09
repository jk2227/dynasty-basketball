import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

export function useSelections(user, myTeam) {
  const [keepers, setKeepers] = useState([]);
  const [rfas, setRfas] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);

  const fetchSelections = useCallback(async () => {
    if (!user || !myTeam) {
      setLoading(false);
      return;
    }

    const [selRes, wlRes] = await Promise.all([
      supabase
        .from("offseason_selections")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("wishlists")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (selRes.data) {
      setKeepers(selRes.data.keepers || []);
      setRfas(selRes.data.rfas || []);
    }
    if (wlRes.data) {
      setWishlist(wlRes.data.players || []);
    }
    setLoading(false);
  }, [user, myTeam]);

  useEffect(() => {
    // Fetch selections from Supabase when user/team changes
    void fetchSelections(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchSelections]);

  const flashSave = () => {
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const saveKeepers = async (players) => {
    setKeepers(players);
    const { error } = await supabase.from("offseason_selections").upsert(
      { user_id: user.id, team_name: myTeam, keepers: players, rfas, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (!error) flashSave();
    return error;
  };

  const saveRfas = async (players) => {
    setRfas(players);
    const { error } = await supabase.from("offseason_selections").upsert(
      { user_id: user.id, team_name: myTeam, keepers, rfas: players, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (!error) flashSave();
    return error;
  };

  const saveWishlist = async (players) => {
    setWishlist(players);
    const { error } = await supabase.from("wishlists").upsert(
      { user_id: user.id, team_name: myTeam, players, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (!error) flashSave();
    return error;
  };

  return {
    keepers,
    rfas,
    wishlist,
    saveKeepers,
    saveRfas,
    saveWishlist,
    loading,
    saveStatus,
  };
}
