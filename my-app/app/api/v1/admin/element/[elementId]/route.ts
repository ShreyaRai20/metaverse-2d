import { NextResponse } from "next/server";
import { UpdateElementSchema } from "@/lib/schemas";
import { readJson, requireAdmin, unauthorized } from "@/lib/auth";
import prisma from "@/lib/prisma";

// In Next.js 15+ `params` is a Promise.
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ elementId: string }> }
) {
    if (!requireAdmin(req)) return unauthorized();

    const parsed = UpdateElementSchema.safeParse(await readJson(req));
    if (!parsed.success) {
        return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const { elementId } = await params;
    try {
        await prisma.element.update({
            where: { id: elementId },
            data: { imageUrl: parsed.data.imageUrl },
        });
        return NextResponse.json({ message: "Element updated" });
    } catch {
        return NextResponse.json({ message: "Element not found" }, { status: 400 });
    }
}
