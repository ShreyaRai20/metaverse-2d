import Link from "next/link";

export const inputClass =
    "h-[52px] w-full rounded-[10px] border-2 border-[#2C3250] bg-[#181C30] px-4 text-base text-[#F3F1EA] placeholder:text-[#7C82A3] focus:border-[#FF7A59] focus:outline-none";

export const buttonClass =
    "h-[54px] w-full rounded-xl bg-[#FF7A59] text-[17px] font-bold text-[#14161F] shadow-[0_4px_0_#B54A2D] transition active:translate-y-[2px] active:shadow-[0_2px_0_#B54A2D] disabled:opacity-60";

export default function AuthShell({
    title,
    subtitle,
    children,
    footer,
}: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
    footer: React.ReactNode;
}) {
    return (
        <main className="flex min-h-screen flex-col bg-[#0F1220] text-[#F3F1EA] lg:flex-row">
            <section className="flex flex-1 flex-col justify-between gap-10 px-6 py-10 sm:px-14">
                <Link href="/" className="flex items-center gap-3 font-mono text-sm tracking-wide">
                    <span className="h-7 w-7 bg-[#FF7A59]" aria-hidden="true" />
                    metaverse
                </Link>

                <div className="mx-auto flex w-full max-w-[420px] flex-col gap-7">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-[40px] font-bold leading-tight tracking-tight">{title}</h1>
                        <p className="text-base text-[#A3A8C3]">{subtitle}</p>
                    </div>
                    {children}
                    <p className="text-[15px] text-[#A3A8C3]">{footer}</p>
                </div>

                <span className="text-[13px] text-[#A3A8C3]">By continuing you agree to the terms of use.</span>
            </section>

            <aside
                aria-hidden="true"
                className="relative hidden min-h-[420px] flex-1 lg:block"
                style={{
                    backgroundColor: "#E6D3A8",
                    backgroundImage:
                        "linear-gradient(45deg,#DCC796 25%,transparent 25%,transparent 75%,#DCC796 75%),linear-gradient(45deg,#DCC796 25%,transparent 25%,transparent 75%,#DCC796 75%)",
                    backgroundSize: "80px 80px",
                    backgroundPosition: "0 0,40px 40px",
                }}
            >
                <div className="absolute inset-x-0 top-0 h-10 border-b-[6px] border-[#4C5282] bg-[#3A3F63]" />
                <div className="absolute inset-x-10 bottom-10 rounded-[14px] bg-[#14161F] p-6 text-[22px] font-semibold leading-snug text-[#F3F1EA]">
                    Walk in. Say hi. Get back to work together.
                </div>
            </aside>
        </main>
    );
}