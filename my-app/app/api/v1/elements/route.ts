import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser, unauthorized } from "@/lib/auth";

export async function GET(req: Request) {
    if (!requireUser(req)) return unauthorized();

    const elements = await prisma.element.findMany();
    return NextResponse.json({
        elements: elements.map((e) => ({
            id: e.id,
            imageUrl: e.imageUrl,
            width: e.width,
            height: e.height,
            static: e.static,
        })),
    });
}
