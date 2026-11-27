"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "./token";

// Re-render if the token changes in another tab (e.g. signing out there).
function subscribe(onChange: () => void) {
    window.addEventListener("storage", onChange);
    return () => window.removeEventListener("storage", onChange);
}

// Redirects to /sign-in when there is no token. Returns true once the user is allowed to see the page.
export function useRequireAuth() {
    const router = useRouter();

    // On the server there is no localStorage, so the server value is always null.
    const token = useSyncExternalStore(subscribe, getToken, () => null);

    useEffect(() => {
        // Read storage directly: during hydration `token` is still null for one render,
        // and we don't want to redirect a signed-in user because of that.
        if (!getToken()) router.replace("/sign-in");
    }, [router, token]);

    return token !== null;
}