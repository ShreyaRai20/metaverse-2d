"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import { clearToken } from "@/lib/client/token";
import { useRequireAuth } from "@/lib/client/useRequireAuth";

type Space = { id: string; name: string; thumbnail: string | null; dimensions: string };

export default function DashboardPage() {
    const router = useRouter();
    const ready = useRequireAuth();
    const [spaces, setSpaces] = useState<Space[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!ready) return;
        api<{ spaces: Space[] }>("/space/all")
            .then((data) => setSpaces(data.spaces))
            .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load spaces"))
            .finally(() => setLoading(false));
    }, [ready]);

    async function deleteSpace(space: Space) {
        if (!confirm(`Delete "${space.name}"? This cannot be undone.`)) return;
        try {
            await api(`/space/${space.id}`, { method: "DELETE" });
            setSpaces((prev) => prev.filter((s) => s.id !== space.id));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not delete space");
        }
    }

    function signOut() {
        clearToken();
        router.push("/sign-in");
    }

    if (!ready) return null;

    return (
        <main className="min-h-screen bg-[#0F1220] px-6 py-10 text-[#F3F1EA] sm:px-12">
            <div className="mx-auto flex max-w-[1100px] flex-col gap-8">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 font-mono text-sm tracking-wide">
                        <span className="h-7 w-7 bg-[#FF7A59]" aria-hidden="true" />
                        metaverse
                    </div>
                    <button
                        onClick={signOut}
                        className="h-11 rounded-[10px] border-2 border-[#2C3250] px-5 text-sm font-semibold hover:border-[#FF7A59]"
                    >
                        Sign out
                    </button>
                </header>

                <div className="flex flex-col gap-1.5">
                    <h1 className="text-[40px] font-bold leading-tight tracking-tight">Your spaces</h1>
                    <p className="text-base text-[#A3A8C3]">Pick a space to walk into.</p>
                </div>

                {error && (
                    <p role="alert" className="rounded-[10px] bg-[#3A1F28] px-4 py-3 text-sm text-[#FF9AA2]">{error}</p>
                )}

                {loading ? (
                    <p className="text-[#A3A8C3]">Loading…</p>
                ) : spaces.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#3A4170] px-6 py-16 text-center">
                        <p className="text-lg font-semibold">No spaces yet</p>
                        <p className="text-[#A3A8C3]">Create your first space to get started.</p>
                    </div>
                ) : (
                    <ul className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
                        {spaces.map((space) => (
                            <li key={space.id} className="overflow-hidden rounded-2xl border-2 border-[#2C3250] bg-[#181C30]">
                                <div
                                    aria-hidden="true"
                                    className="h-[170px] bg-[#E6D3A8] bg-cover bg-center"
                                    style={space.thumbnail ? { backgroundImage: `url(${space.thumbnail})` } : undefined}
                                />
                                <div className="flex flex-col gap-3.5 p-5">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <h2 className="truncate text-xl font-semibold">{space.name}</h2>
                                        <span className="text-[13px] text-[#A3A8C3]">{space.dimensions}</span>
                                    </div>
                                    <div className="flex gap-2.5">
                                        <Link
                                            href={`/space/${space.id}`}
                                            className="flex-1 rounded-[10px] border-2 border-[#2C3250] bg-[#20253D] py-3 text-center text-[15px] font-semibold hover:border-[#FF7A59]"
                                        >
                                            Enter
                                        </Link>
                                        <button
                                            onClick={() => deleteSpace(space)}
                                            aria-label={`Delete ${space.name}`}
                                            className="w-[46px] rounded-[10px] border-2 border-[#2C3250] text-[#A3A8C3] hover:border-[#FF9AA2] hover:text-[#FF9AA2]"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </main>
    );
}