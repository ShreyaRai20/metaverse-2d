import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { CreateSpaceSchema } from "@/lib/schemas";
import { readJson, requireUser, unauthorized } from "@/lib/auth";

export async function POST(req: Request) {
    const auth = requireUser(req);
    if (!auth) return unauthorized();

    const parsed = CreateSpaceSchema.safeParse(await readJson(req));
    if (!parsed.success) {
        return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const [width, height] = parsed.data.dimensions.split("x").map(Number);

    const map = await prisma.map.findUnique({
        where: { id: parsed.data.mapId },
        include: { mapElements: true },
    });
    if (!map) {
        return NextResponse.json({ message: "Map not found" }, { status: 400 });
    }

    const space = await prisma.$transaction(async (tx) => {
        const created = await tx.space.create({
            data: {
                name: parsed.data.name,
                width: width!,
                height: height!,
                thumbnail: map.thumbnail,
                creatorId: auth.userId,
            },
        });
        await tx.spaceElements.createMany({
            data: map.mapElements.map((e) => ({
                spaceId: created.id,
                elementId: e.elementId,
                x: e.x,
                y: e.y,
            })),
        });
        return created;
    });

    return NextResponse.json({ spaceId: space.id });
}
