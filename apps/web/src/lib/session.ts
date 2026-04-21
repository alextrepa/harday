import { useEffect } from "react";
import { useLocalState, useLocalTeam } from "@/lib/local-hooks";
import { localStore } from "@/lib/local-store";
import { bootstrapOutlookAuth } from "@/lib/outlook";
import { outlookIntegrationAvailable } from "@/lib/runtime";

export function useBootstrapSession() {
  useEffect(() => {
    if (!outlookIntegrationAvailable) {
      localStore.setOutlookIntegration({ configured: false, connected: false });
      return;
    }

    let cancelled = false;

    void bootstrapOutlookAuth().then((snapshot) => {
      if (!cancelled) {
        localStore.setOutlookIntegration(snapshot);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);
}

export function useCurrentUser() {
  const state = useLocalState();
  return {
    identity: {
      email: state.user.email,
      name: state.user.name,
    },
    user: state.user,
  };
}

export function useCurrentTeam() {
  return useLocalTeam();
}
