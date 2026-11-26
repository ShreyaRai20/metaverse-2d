import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/auth";

export async function GET(req: Request) {
    const auth = requireUser(req);
    if (!auth) return unauthorized();

    const spaces = await prisma.space.findMany({
        where: { creatorId: auth.userId },
    });
    return NextResponse.json({
        spaces: spaces.map((s) => ({
            id: s.id,
            name: s.name,
            thumbnail: s.thumbnail,
            dimensions: `${s.width}x${s.height}`,
        })),
    });
}
