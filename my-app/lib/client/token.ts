const KEY = "token";

// localStorage only exists in the browser, and can throw in private mode, so guard every access.
export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    try {
        return localStorage.getItem(KEY);
    } catch {
        return null;
    }
}

export function setToken(token: string) {
    try {
        localStorage.setItem(KEY, token);
    } catch {}
}

export function clearToken() {
    try {
        localStorage.removeItem(KEY);
    } catch {}
}