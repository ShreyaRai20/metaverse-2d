import { NextResponse } from "next/server";
import { CreateAvatarSchema } from "@/lib/schemas";
import { readJson, requireAdmin, unauthorized } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    if (!requireAdmin(req)) return unauthorized();

    const parsed = CreateAvatarSchema.safeParse(await readJson(req));
    if (!parsed.success) {
        return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const avatar = await prisma.avatar.create({
        data: {
            name: parsed.data.name,
            imageUrl: parsed.data.imageUrl,
        },
    });
    return NextResponse.json({ avatarId: avatar.id });
}
