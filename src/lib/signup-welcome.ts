const FLAG = "thalvo:signup-welcome";

/** Mark a fresh signup so MissionShell can show a soft email-confirm banner. */
export function markSignupWelcome(): void {
  try {
    sessionStorage.setItem(FLAG, "1");
  } catch {
    /* private mode / SSR */
  }
}

export function consumeSignupWelcome(): boolean {
  try {
    if (sessionStorage.getItem(FLAG) !== "1") return false;
    sessionStorage.removeItem(FLAG);
    return true;
  } catch {
    return false;
  }
}
