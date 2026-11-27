"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import { setToken } from "@/lib/client/token";
import AuthShell, { inputClass, buttonClass } from "@/components/auth/AuthShell";

export default function SignUpPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await api("/signup", {
                method: "POST",
                body: { username, email, password, type: "user" },
                auth: false,
            });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
            setLoading(false);
            return;
        }

        // /signup only returns a userId, so sign in right away to get a token.
        try {
            const { token } = await api<{ token: string }>("/signin", {
                method: "POST",
                body: { username, password },
                auth: false,
            });
            setToken(token);
            router.push("/dashboard");
        } catch {
            router.push("/signin"); // account exists; let them sign in manually
        }
    }

    return (
        <AuthShell
            title="Create your account"
            subtitle="It takes less than a minute. Then pick an avatar and make a space."
            footer={
                <>
                    Already have an account?{" "}
                    <Link href="/signin" className="font-semibold text-[#FF7A59] hover:text-[#FFB199]">
                        Sign in
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
                    <label htmlFor="email" className="text-sm font-semibold">Email</label>
                    <input id="email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
                </div>
                <div className="flex flex-col gap-2">
                    <label htmlFor="password" className="text-sm font-semibold">Password</label>
                    <input id="password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} required />
                    <span className="text-[13px] text-[#A3A8C3]">Minimum 8 characters.</span>
                </div>

                {error && (
                    <p role="alert" className="rounded-[10px] bg-[#3A1F28] px-4 py-3 text-sm text-[#FF9AA2]">{error}</p>
                )}

                <button type="submit" disabled={loading} className={buttonClass}>
                    {loading ? "Creating account…" : "Create account"}
                </button>
            </form>
        </AuthShell>
    );
}