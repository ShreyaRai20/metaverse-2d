"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import { setToken } from "@/lib/client/token";
import AuthShell, { inputClass, buttonClass } from "@/components/auth/AuthShell";

export default function SignInPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const { token } = await api<{ token: string }>("/signin", {
                method: "POST",
                body: { username, password },
                auth: false,
            });
            setToken(token);
            router.push("/dashboard");
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
            setLoading(false);
        }
    }

    return (
        <AuthShell
            title="Welcome back"
            subtitle="Sign in to jump back into your spaces."
            footer={
                <>
                    New here?{" "}
                    <Link href="/signup" className="font-semibold text-[#FF7A59] hover:text-[#FFB199]">
                        Create an account
                    </Link>
                </>
            }
        >
            <form onSubmit={onSubmit} className="flex flex-col gap-[18px]">
                <div className="flex flex-col gap-2">
                    <label htmlFor="username" className="text-sm font-semibold">Username</label>
                    <input id="username" className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your_username" autoComplete="username" required />
                </div>
                <div className="flex flex-col gap-2">
                    <label htmlFor="password" className="text-sm font-semibold">Password</label>
                    <input id="password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" required />
                </div>

                {error && (
                    <p role="alert" className="rounded-[10px] bg-[#3A1F28] px-4 py-3 text-sm text-[#FF9AA2]">{error}</p>
                )}

                <button type="submit" disabled={loading} className={buttonClass}>
                    {loading ? "Signing in…" : "Sign in"}
                </button>
            </form>
        </AuthShell>
    );
}