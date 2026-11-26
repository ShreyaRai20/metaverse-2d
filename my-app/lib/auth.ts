
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { JWT_SECRET } from "./config";

export type AuthPayload = {
    userId: string;
    role: string;
};

export function getAuth(req: Request): AuthPayload | null {
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return null;
    }

    const token = authHeader.slice(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (
            typeof decoded === "string" ||
            typeof decoded.userId !== "string" ||
            typeof decoded.role !== "string"
        ) {
            return null;
        }

        return {
            userId: decoded.userId,
            role: decoded.role,
        };
    } catch {
        return null;
    }
}

export const unauthorized = () =>
    NextResponse.json(
        { message: "Unauthorized" },
        { status: 403 }
    );

export function requireUser(req: Request): AuthPayload | null {
    return getAuth(req);
}

export function requireAdmin(req: Request): AuthPayload | null {
    const auth = getAuth(req);

    return auth?.role === "Admin" ? auth : null;
}

export async function readJson(req: Request): Promise<unknown> {
    try {
        return await req.json();
    } catch {
        return undefined;
    }
}
