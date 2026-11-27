import { getToken, clearToken } from "./token";

const BASE = "/api/v1";

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

type Options = {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    auth?: boolean; // set false for /signup and /signin
};

export async function api<T = unknown>(
    path: string,
    { method = "GET", body, auth = true }: Options = {}
): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const token = auth ? getToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const message = data?.message ?? "Something went wrong";
        // Only an expired/invalid token should log the user out.
        // Your API also uses 403 for "Not your space" and bad passwords, so check the message.
        if (res.status === 403 && message === "Unauthorized" && token) {
            clearToken();
            if (typeof window !== "undefined") window.location.href = "/signin";
        }
        throw new ApiError(res.status, message);
    }

    return data as T;
}