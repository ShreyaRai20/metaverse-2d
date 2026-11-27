"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/client/useRequireAuth";
import { useArena } from "@/lib/client/useArena";
import { createRenderer, displayName } from "./render";

const STEP_MS = 120; // how often a held key moves you one tile

const KEYS: Record<string, [number, number]> = {
    arrowup: [0, -1],
    w: [0, -1],
    arrowdown: [0, 1],
    s: [0, 1],
    arrowleft: [-1, 0],
    a: [-1, 0],
    arrowright: [1, 0],
    d: [1, 0],
};

const OVERLAY_TEXT: Record<string, string> = {
    loading: "Loading the space…",
    waking: "Starting the game server. After a quiet spell this can take up to a minute.",
    connecting: "Connecting…",
    reconnecting: "Connection lost. Reconnecting…",
};

export default function Arena({ spaceId }: { spaceId: string }) {
    const ready = useRequireAuth();
    const arena = useArena(spaceId, ready);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [copied, setCopied] = useState(false);

    // The animation loop reads the latest values from this ref, so it never has to restart.
    const arenaRef = useRef(arena);
    useEffect(() => {
        arenaRef.current = arena;
    });

    useEffect(() => {
        if (!ready) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const renderer = createRenderer();
        const pressed: string[] = []; // keys currently held, most recent last
        let lastStep = 0;
        let raf = 0;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
            const key = e.key.toLowerCase();
            if (!KEYS[key]) return;
            e.preventDefault();
            if (!pressed.includes(key)) pressed.push(key);
        };
        const onKeyUp = (e: KeyboardEvent) => {
            const i = pressed.indexOf(e.key.toLowerCase());
            if (i !== -1) pressed.splice(i, 1);
        };
        const onBlur = () => {
            pressed.length = 0;
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("blur", onBlur);

        const frame = (now: number) => {
            const a = arenaRef.current;

            const held = pressed[pressed.length - 1];
            const dir = held ? KEYS[held] : undefined;
            if (dir && now - lastStep >= STEP_MS) {
                lastStep = now;
                a.move(dir[0], dir[1]);
            }

            const dpr = window.devicePixelRatio || 1;
            const W = canvas.clientWidth;
            const H = canvas.clientHeight;
            if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
                canvas.width = Math.round(W * dpr);
                canvas.height = Math.round(H * dpr);
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const world = a.world.current;
            renderer.draw(
                ctx,
                W,
                H,
                {
                    width: world.width,
                    height: world.height,
                    elements: world.elements,
                    me: a.me.current,
                    myId: a.myId.current,
                    others: a.others.current,
                    profiles: a.profiles,
                },
                now
            );
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", onBlur);
        };
    }, [ready]);

    async function invite() {
        const url = window.location.href;
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            window.prompt("Copy this link to invite someone", url);
            return;
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    if (!ready) return null;

    const connected = arena.status === "connected";
    const people = [
        { id: "you", label: "You" },
        ...arena.roster.map((id) => ({ id, label: displayName(id, arena.profiles[id]) })),
    ];

    return (
        <main className="flex h-dvh flex-col bg-[#0F1220] text-[#F3F1EA]">
            <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b-2 border-[#2C3250] bg-[#12162B] px-5">
                <div className="flex min-w-0 items-center gap-3">
                    <h1 className="truncate text-xl font-bold">{arena.spaceName || "Space"}</h1>
                    {connected ? (
                        <span className="flex shrink-0 items-center gap-2 rounded-full bg-[#5EEAD4]/10 px-3 py-1 text-sm font-semibold text-[#5EEAD4]">
                            <span className="h-2 w-2 rounded-full bg-[#5EEAD4]" aria-hidden="true" />
                            {people.length} online
                        </span>
                    ) : (
                        <span className="shrink-0 rounded-full bg-[#20253D] px-3 py-1 text-sm font-semibold text-[#A3A8C3]">
                            Not connected
                        </span>
                    )}
                </div>
                <div className="flex shrink-0 gap-2.5">
                    <button
                        onClick={invite}
                        className="h-10 rounded-[10px] border-2 border-[#2C3250] px-4 text-sm font-semibold hover:border-[#FF7A59]"
                    >
                        {copied ? "Link copied" : "Invite"}
                    </button>
                    <Link
                        href="/dashboard"
                        className="flex h-10 items-center rounded-[10px] bg-[#3A1F28] px-4 text-sm font-semibold text-[#FF9AA2] hover:bg-[#4A2530]"
                    >
                        Leave
                    </Link>
                </div>
            </header>

            <div className="flex min-h-0 flex-1">
                <div className="relative min-w-0 flex-1">
                    <canvas ref={canvasRef} className="block h-full w-full" />
                    {!connected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#0B0D1A]/70 p-6">
                            <p
                                role={arena.status === "error" ? "alert" : "status"}
                                className="max-w-sm rounded-2xl border-2 border-[#2C3250] bg-[#181C30] px-6 py-5 text-center text-base leading-relaxed"
                            >
                                {arena.status === "error" ? arena.message : (OVERLAY_TEXT[arena.status] ?? "")}
                            </p>
                        </div>
                    )}
                </div>

                <aside className="hidden w-[320px] shrink-0 flex-col border-l-2 border-[#2C3250] bg-[#12162B] lg:flex">
                    <section className="p-5">
                        <h2 className="mb-4 text-lg font-semibold">In this space</h2>
                        <ul className="flex flex-col gap-3">
                            {people.map((person) => (
                                <li key={person.id} className="flex items-center gap-3 text-[15px]">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#5EEAD4]" aria-hidden="true" />
                                    <span className="truncate">{person.label}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                </aside>
            </div>

            <footer className="flex h-14 shrink-0 items-center justify-center border-t-2 border-[#2C3250] bg-[#12162B] text-sm text-[#A3A8C3]">
                Move with the arrow keys or WASD
            </footer>
        </main>
    );
}