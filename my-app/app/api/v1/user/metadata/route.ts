import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { UpdateMetadataSchema } from "@/lib/schemas";
import { readJson, requireUser, unauthorized } from "@/lib/auth";

export async function POST(req: Request) {
    const auth = requireUser(req);
    if (!auth) return unauthorized();

    const parsed = UpdateMetadataSchema.safeParse(await readJson(req));
    if (!parsed.success) {
        return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    try {
        const avatar = await prisma.avatar.findUnique({
            where: { id: parsed.data.avatarId },
        });
        if (!avatar) {
            return NextResponse.json({ message: "Avatar not found" }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: auth.userId },
            data: { avatarId: parsed.data.avatarId },
        });
        return NextResponse.json({ message: "Metadata updated" });
    } catch {
        return NextResponse.json({ message: "Internal error" }, { status: 400 });
    }
}
