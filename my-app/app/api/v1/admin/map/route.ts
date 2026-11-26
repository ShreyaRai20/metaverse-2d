import { NextResponse } from "next/server";
import { CreateMapSchema } from "@/lib/schemas";
import { readJson, requireAdmin, unauthorized } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    if (!requireAdmin(req)) return unauthorized();

    const parsed = CreateMapSchema.safeParse(await readJson(req));
    if (!parsed.success) {
        return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const [width, height] = parsed.data.dimensions.split("x").map(Number);

    try {
        const map = await prisma.map.create({
            data: {
                name: parsed.data.name,
                thumbnail: parsed.data.thumbnail,
                width: width!,
                height: height!,
                mapElements: {
                    create: parsed.data.defaultElements.map((e) => ({
                        elementId: e.elementId,
                        x: e.x,
                        y: e.y,
                    })),
                },
            },
        });
        return NextResponse.json({ id: map.id });
    } catch {
        // e.g. an elementId that doesn't exist
        return NextResponse.json({ message: "Could not create map" }, { status: 400 });
    }
}
