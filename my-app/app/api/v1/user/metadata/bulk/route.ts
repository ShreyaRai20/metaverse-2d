import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/auth";

// GET /api/v1/user/metadata/bulk?ids=[1,3,55]
export async function GET(req: Request) {
    if (!requireUser(req)) return unauthorized();

    const idsString = (new URL(req.url).searchParams.get("ids") ?? "[]").trim();
    const ids = idsString
        .slice(1, idsString.length - 1) // strip [ ]
        .split(",")
        .map((id) => id.trim().replace(/["']/g, ""))
        .filter(Boolean);

    const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, username: true, avatar: true },
    });

    return NextResponse.json({
        avatars: users.map((u) => ({
            userId: u.id,
            username: u.username,
            avatarName: u.avatar?.name ?? null,
            imageUrl: u.avatar?.imageUrl ?? null,
        })),
    });
}