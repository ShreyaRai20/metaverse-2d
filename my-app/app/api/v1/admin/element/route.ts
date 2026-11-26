import { NextResponse } from "next/server";
import { CreateElementSchema } from "@/lib/schemas";
import { readJson, requireAdmin, unauthorized } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    if (!requireAdmin(req)) return unauthorized();

    const parsed = CreateElementSchema.safeParse(await readJson(req));
    if (!parsed.success) {
        return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const element = await prisma.element.create({
        data: {
            imageUrl: parsed.data.imageUrl,
            width: parsed.data.width,
            height: parsed.data.height,
            static: parsed.data.static,
        },
    });
    return NextResponse.json({ id: element.id });
}
