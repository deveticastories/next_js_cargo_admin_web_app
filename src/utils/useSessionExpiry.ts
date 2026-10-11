import { useEffect } from "react";
import { expireSession, msUntilExpiry } from "@/services/AuthenticationServices";

/** Re-check this often too — timers are paused/delayed while a laptop sleeps or the tab is throttled. */
const CHECK_EVERY_MS = 60_000;

/**
 * Logs the user out the moment their cargo-backend token expires (1 day
 * after login, no refresh endpoint), even if they're just looking at a page
 * and never make another request. Also catches a logout in another tab,
 * since that removes the shared cookie.
 */
export function useSessionExpiry(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = () => {
      clearTimeout(timer);
      const remaining = msUntilExpiry();
      if (remaining <= 0) {
        expireSession();
        return;
      }
      timer = setTimeout(check, Math.min(remaining, CHECK_EVERY_MS));
    };

    const checkIfVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    check();
    document.addEventListener("visibilitychange", checkIfVisible);
    window.addEventListener("focus", check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkIfVisible);
      window.removeEventListener("focus", check);
    };
  }, []);
}
