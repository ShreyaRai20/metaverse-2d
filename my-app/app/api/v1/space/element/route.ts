import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AddElementSchema, DeleteElementSchema } from "@/lib/schemas";
import { readJson, requireUser, unauthorized } from "@/lib/auth";

export async function POST(req: Request) {
    const auth = requireUser(req);
    if (!auth) return unauthorized();

    const parsed = AddElementSchema.safeParse(await readJson(req));
    if (!parsed.success) {
        return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const space = await prisma.space.findUnique({
        where: { id: parsed.data.spaceId },
    });
    if (!space) {
        return NextResponse.json({ message: "Space not found" }, { status: 400 });
    }
    if (space.creatorId !== auth.userId) {
        return NextResponse.json({ message: "Not your space" }, { status: 403 });
    }

    const { x, y } = parsed.data;
    if (x < 0 || y < 0 || x > space.width || (space.height != null && y > space.height)) {
        return NextResponse.json({ message: "Element outside space bounds" }, { status: 400 });
    }

    const element = await prisma.element.findUnique({
        where: { id: parsed.data.elementId },
    });
    if (!element) {
        return NextResponse.json({ message: "Element not found" }, { status: 400 });
    }

    await prisma.spaceElements.create({
        data: {
            spaceId: space.id,
            elementId: element.id,
            x,
            y,
        },
    });
    return NextResponse.json({ message: "Element added" });
}

export async function DELETE(req: Request) {
    const auth = requireUser(req);
    if (!auth) return unauthorized();

    const parsed = DeleteElementSchema.safeParse(await readJson(req));
    if (!parsed.success) {
        return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const spaceElement = await prisma.spaceElements.findUnique({
        where: { id: parsed.data.id },
        include: { space: true },
    });
    if (!spaceElement) {
        return NextResponse.json({ message: "Element not found" }, { status: 400 });
    }
    if (spaceElement.space.creatorId !== auth.userId) {
        return NextResponse.json({ message: "Not your space" }, { status: 403 });
    }

    await prisma.spaceElements.delete({ where: { id: spaceElement.id } });
    return NextResponse.json({ message: "Element deleted" });
}
