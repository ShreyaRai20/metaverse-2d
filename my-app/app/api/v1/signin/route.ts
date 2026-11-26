import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";
import { SigninSchema } from "@/lib/schemas";
import { readJson } from "@/lib/auth";
import { JWT_SECRET } from "@/lib/config";

export async function POST(req: Request) {
    const parsed = SigninSchema.safeParse(await readJson(req));
    if (!parsed.success) {
        return NextResponse.json({ message: "Validation failed" }, { status: 403 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { username: parsed.data.username },
        });
        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 403 });
        }

        const isValid = await bcrypt.compare(parsed.data.password, user.password);
        if (!isValid) {
            return NextResponse.json({ message: "Invalid password" }, { status: 403 });
        }

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
            expiresIn: "7d",
        });
        return NextResponse.json({ token });
    } catch {
        return NextResponse.json({ message: "Internal error" }, { status: 400 });
    }
}
