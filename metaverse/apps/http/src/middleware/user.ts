import { Router } from "express";
import { userMiddleware } from "../routes/v1/user.js";
import { UpdateMetadataSchema } from "../types/index.js";
import prisma from "@metaverse-2d/db";

export const userRouter = Router();

userRouter.post("/metadata", userMiddleware, async (req, res) => {
    const parsedData = UpdateMetadataSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({ message: "Validation failed" });
    }

    try {
        const avatar = await prisma.avatar.findUnique({
            where: { id: parsedData.data.avatarId },
        });
        if (!avatar) {
            return res.status(400).json({ message: "Avatar not found" });
        }

        await prisma.user.update({
            where: { id: res.locals.userId },
            data: { avatarId: parsedData.data.avatarId },
        });
        return res.json({ message: "Metadata updated" });
    } catch (error) {
        return res.status(400).json({ message: "Internal error" });
    }
});

// GET /metadata/bulk?ids=[1,3,55]
userRouter.get("/metadata/bulk", userMiddleware, async (req, res) => {
    const idsString = ((req.query.ids as string) ?? "[]").trim();
    const ids = idsString
        .slice(1, idsString.length - 1) // strip [ ]
        .split(",")
        .map((id) => id.trim().replace(/["']/g, ""))
        .filter(Boolean);

    const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, avatar: true },
    });

    res.json({
        avatars: users.map((u) => ({
            userId: u.id,
            imageUrl: u.avatar?.imageUrl ?? null,
        })),
    });
});