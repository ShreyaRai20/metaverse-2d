import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/auth";

type Ctx = { params: Promise<{ spaceId: string }> };

export async function GET(req: Request, { params }: Ctx) {
    if (!requireUser(req)) return unauthorized();

    const { spaceId } = await params;
    const space = await prisma.space.findUnique({
        where: { id: spaceId },
        include: { elements: { include: { element: true } } },
    });
    if (!space) {
        return NextResponse.json({ message: "Space not found" }, { status: 400 });
    }

    return NextResponse.json({
        dimensions: `${space.width}x${space.height}`,
        elements: space.elements.map((e) => ({
            id: e.id,
            x: e.x,
            y: e.y,
            element: {
                id: e.element.id,
                imageUrl: e.element.imageUrl,
                static: e.element.static,
                height: e.element.height,
                width: e.element.width,
            },
        })),
    });
}

export async function DELETE(req: Request, { params }: Ctx) {
    const auth = requireUser(req);
    if (!auth) return unauthorized();

    const { spaceId } = await params;
    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) {
        return NextResponse.json({ message: "Space not found" }, { status: 400 });
    }
    if (space.creatorId !== auth.userId) {
        return NextResponse.json({ message: "Not your space" }, { status: 403 });
    }

    await prisma.$transaction([
        prisma.spaceElements.deleteMany({ where: { spaceId: space.id } }),
        prisma.space.delete({ where: { id: space.id } }),
    ]);
    return NextResponse.json({ message: "Space deleted" });
}
