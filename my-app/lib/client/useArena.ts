"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import { getToken } from "./token";

export type Pos = { x: number; y: number };

export type ArenaElement = {
    id: string;
    x: number;
    y: number;
    element: { imageUrl: string; static: boolean; width: number; height: number };
};

export type Profile = {
    username?: string | undefined;
    avatarName?: string | null | undefined;
    imageUrl?: string | null | undefined;
};

export type World = {
    width: number;
    height: number;
    elements: ArenaElement[];
    blocked: Set<string>; // "x,y" of every tile covered by a static element
};

export type ArenaStatus = "loading" | "waking" | "connecting" | "connected" | "reconnecting" | "error";

type SpaceResponse = { name?: string; dimensions: string; elements: ArenaElement[] };

type BulkResponse = {
    avatars: { userId: string; username?: string; avatarName?: string | null; imageUrl?: string | null }[];
};

type ServerMessage =
    | { type: "space-joined"; payload: { spawn: Pos; users: { id: string; x: number; y: number }[] } }
    | { type: "movement-rejected"; payload: Pos }
    | { type: "movement"; payload: { x: number; y: number; userId: string } }
    | { type: "user-join"; payload: { userId: string; x: number; y: number } }
    | { type: "user-left"; payload: { userId: string } };

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";

// Reads the userId out of the JWT payload (no verification: the servers do that).
function userIdFromToken(token: string): string | null {
    try {
        const payload = (token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
        const data = JSON.parse(window.atob(payload)) as { userId?: string };
        return data.userId ?? null;
    } catch {
        return null;
    }
}

export function useArena(spaceId: string, enabled: boolean) {
    const [status, setStatus] = useState<ArenaStatus>("loading");
    const [message, setMessage] = useState("");
    const [spaceName, setSpaceName] = useState("");
    const [roster, setRoster] = useState<string[]>([]); // ids of the OTHER people here
    const [profiles, setProfiles] = useState<Record<string, Profile>>({});

    // Positions change many times a second, so they live in refs that the canvas loop reads.
    const world = useRef<World>({ width: 0, height: 0, elements: [], blocked: new Set() });
    const me = useRef<Pos | null>(null);
    const others = useRef<Map<string, Pos>>(new Map());
    const wsRef = useRef<WebSocket | null>(null);
    const myId = useRef<string | null>(null); // our own user id, read from the token

    useEffect(() => {
        if (!enabled) return;
        const token = getToken();
        const userId = token ? userIdFromToken(token) : null;
        if (!token || !userId) return; // useRequireAuth sends signed-out visitors to /sign-in
        myId.current = userId;

        let cancelled = false;
        let joined = false;
        let failures = 0;
        let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
        const requested = new Set<string>();

        const fail = (text: string) => {
            setMessage(text);
            setStatus("error");
        };

        const syncRoster = () => setRoster([...others.current.keys()]);

        // Look up names and avatars for ids we haven't seen yet.
        const loadProfiles = (ids: string[]) => {
            const fresh = ids.filter((id) => !requested.has(id));
            if (fresh.length === 0) return;
            fresh.forEach((id) => requested.add(id));
            api<BulkResponse>(`/user/metadata/bulk?ids=[${fresh.join(",")}]`)
                .then((data) => {
                    if (cancelled) return;
                    setProfiles((prev) => {
                        const next = { ...prev };
                        for (const a of data.avatars ?? []) {
                            next[a.userId] = {
                                username: a.username,
                                avatarName: a.avatarName,
                                imageUrl: a.imageUrl,
                            };
                        }
                        return next;
                    });
                })
                .catch(() => {
                    fresh.forEach((id) => requested.delete(id)); // allow a retry later
                });
        };

        // On a free host the server sleeps when idle. Hitting its HTTP endpoint wakes it up.
        async function wake() {
            const httpUrl = WS_URL.replace(/^ws/, "http");
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 70_000);
            try {
                await fetch(httpUrl, { mode: "no-cors", signal: ctrl.signal });
            } catch {
                // ignore: we still try to connect
            } finally {
                clearTimeout(timer);
            }
        }

        const handleMessage = (msg: ServerMessage) => {
            switch (msg.type) {
                case "space-joined": {
                    joined = true;
                    failures = 0;
                    me.current = { ...msg.payload.spawn };
                    const next = new Map<string, Pos>();
                    for (const u of msg.payload.users) {
                        if (u.id !== userId) next.set(u.id, { x: u.x, y: u.y });
                    }
                    others.current = next;
                    syncRoster();
                    loadProfiles([userId, ...next.keys()]);
                    setStatus("connected");
                    break;
                }
                case "user-join": {
                    if (msg.payload.userId === userId) break;
                    others.current.set(msg.payload.userId, { x: msg.payload.x, y: msg.payload.y });
                    syncRoster();
                    loadProfiles([msg.payload.userId]);
                    break;
                }
                case "movement": {
                    if (msg.payload.userId === userId) break;
                    const known = others.current.has(msg.payload.userId);
                    others.current.set(msg.payload.userId, { x: msg.payload.x, y: msg.payload.y });
                    if (!known) {
                        syncRoster();
                        loadProfiles([msg.payload.userId]);
                    }
                    break;
                }
                case "movement-rejected": {
                    me.current = { x: msg.payload.x, y: msg.payload.y }; // the server's position wins
                    break;
                }
                case "user-left": {
                    others.current.delete(msg.payload.userId);
                    syncRoster();
                    break;
                }
            }
        };

        async function connect(isRetry: boolean) {
            if (cancelled) return;
            setStatus(isRetry ? "reconnecting" : "waking");
            await wake();
            if (cancelled) return;
            if (!isRetry) setStatus("connecting");

            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                ws.send(JSON.stringify({ type: "join", payload: { spaceId, token } }));
            };
            ws.onmessage = (event) => {
                try {
                    handleMessage(JSON.parse(String(event.data)) as ServerMessage);
                } catch {
                    // ignore malformed messages
                }
            };
            ws.onclose = () => {
                if (cancelled) return;
                if (!joined) {
                    failures += 1;
                    if (failures >= 5) {
                        fail("Couldn't join this space. Try signing out and back in.");
                        return;
                    }
                }
                joined = false;
                setStatus("reconnecting");
                reconnectTimer = setTimeout(() => void connect(true), Math.min(1000 * (failures + 1), 5000));
            };
        }

        (async () => {
            try {
                const space = await api<SpaceResponse>(`/space/${encodeURIComponent(spaceId)}`);
                if (cancelled) return;

                const [w = NaN, h = NaN] = space.dimensions.split("x").map(Number);
                if (!Number.isFinite(w) || !Number.isFinite(h)) {
                    fail("This space doesn't have a valid size.");
                    return;
                }

                const blocked = new Set<string>();
                for (const el of space.elements) {
                    if (!el.element.static) continue;
                    for (let dx = 0; dx < el.element.width; dx++) {
                        for (let dy = 0; dy < el.element.height; dy++) {
                            blocked.add(`${el.x + dx},${el.y + dy}`);
                        }
                    }
                }

                world.current = { width: w, height: h, elements: space.elements, blocked };
                setSpaceName(space.name ?? "");
                void connect(false);
            } catch (err) {
                if (cancelled) return;
                fail(
                    err instanceof ApiError && err.status === 400
                        ? "This space doesn't exist, or the link is wrong."
                        : "Couldn't load this space. Try again in a moment."
                );
            }
        })();

        return () => {
            cancelled = true;
            clearTimeout(reconnectTimer);
            wsRef.current?.close();
            wsRef.current = null;
            me.current = null;
            others.current = new Map();
            setRoster([]);
        };
    }, [spaceId, enabled]);

    // Walk one tile. We move right away (so it feels instant) and the server corrects us
    // with "movement-rejected" if the step wasn't allowed.
    const move = useCallback((dx: number, dy: number) => {
        const ws = wsRef.current;
        const pos = me.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !pos) return;

        const { width, height, blocked } = world.current;
        const x = pos.x + dx;
        const y = pos.y + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        if (blocked.has(`${x},${y}`)) return;
        for (const p of others.current.values()) {
            if (p.x === x && p.y === y) return;
        }

        me.current = { x, y };
        ws.send(JSON.stringify({ type: "move", payload: { x, y } }));
    }, []);

    return { status, message, spaceName, roster, profiles, myId, world, me, others, move };
}