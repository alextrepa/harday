import { useLocalState, useLocalTeam } from "@/lib/local-hooks";

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
