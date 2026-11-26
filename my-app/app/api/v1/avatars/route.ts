import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
    if (!requireUser(req)) return unauthorized();

    const avatars = await prisma.avatar.findMany();
    return NextResponse.json({
        avatars: avatars.map((a) => ({
            id: a.id,
            imageUrl: a.imageUrl,
            name: a.name,
        })),
    });
}
