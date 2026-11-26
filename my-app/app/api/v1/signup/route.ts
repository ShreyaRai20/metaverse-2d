import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import prisma from "@/lib/prisma";
import { SignupSchema } from "@/lib/schemas";
import { readJson } from "@/lib/auth";

export async function POST(req: Request) {
    const parsed = SignupSchema.safeParse(await readJson(req));
    if (!parsed.success) {
        return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    try {
        const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
        const user = await prisma.user.create({
            data: {
                username: parsed.data.username,
                email: parsed.data.email,
                password: hashedPassword,
                role: parsed.data.type === "admin" ? "Admin" : "User",
            },
        });
        return NextResponse.json({ userId: user.id });
    } catch {
        // most likely a unique constraint violation (username/email taken)
        return NextResponse.json({ message: "User already exists" }, { status: 400 });
    }
}
