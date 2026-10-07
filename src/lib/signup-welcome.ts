const FLAG = "thalvo:signup-welcome";
const UNCONFIRMED = "thalvo:email-unconfirmed";
const SHOW_CONFIRMED = "thalvo:show-confirmed";

/** Mark a fresh signup so MissionShell can show a soft email-confirm banner. */
export function markSignupWelcome(): void {
  try {
    sessionStorage.setItem(FLAG, "1");
  } catch {
    /* private mode / SSR */
  }
}

export function markEmailUnconfirmed(): void {
  try {
    localStorage.setItem(UNCONFIRMED, "1");
  } catch {
    /* private mode */
  }
}

export function clearEmailUnconfirmed(): void {
  try {
    localStorage.removeItem(UNCONFIRMED);
  } catch {
    /* private mode */
  }
}

export function isEmailUnconfirmed(): boolean {
  try {
    return localStorage.getItem(UNCONFIRMED) === "1";
  } catch {
    return false;
  }
}

export function armEmailConfirmedNotice(): void {
  try {
    sessionStorage.setItem(SHOW_CONFIRMED, "1");
  } catch {
    /* private mode */
  }
}

export function consumeEmailConfirmedNotice(): boolean {
  try {
    if (sessionStorage.getItem(SHOW_CONFIRMED) !== "1") return false;
    sessionStorage.removeItem(SHOW_CONFIRMED);
    return true;
  } catch {
    return false;
  }
}

export function isEmailNotConfirmedMessage(message: string): boolean {
  return /email not confirmed/i.test(message);
}

export function confirmationRedirect(): string {
  if (typeof window === "undefined") return "https://thalvo.org/auth?confirmed=1";
  return `${window.location.origin}/auth?confirmed=1`;
}

export function urlLooksLikeEmailConfirm(): boolean {
  if (typeof window === "undefined") return false;
  const search = window.location.search;
  const hash = window.location.hash;
  return search.includes("confirmed=1") || /type=(signup|email|magiclink|invite)/.test(hash);
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
