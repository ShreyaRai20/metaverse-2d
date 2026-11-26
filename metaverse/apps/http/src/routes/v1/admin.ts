import { Router } from "express";
import {
    CreateElementSchema,
    UpdateElementSchema,
    CreateAvatarSchema,
    CreateMapSchema,
} from "../../types/index.js";
import { adminMiddleware } from "../../middleware/admin.js";
import prisma from "../../../../../packages/db/dist/index.js";

export const adminRouter = Router();

adminRouter.use(adminMiddleware);

adminRouter.post("/element", async (req, res) => {
    const parsedData = CreateElementSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({ message: "Validation failed" });
    }

    const element = await prisma.element.create({
        data: {
            imageUrl: parsedData.data.imageUrl,
            width: parsedData.data.width,
            height: parsedData.data.height,
            static: parsedData.data.static,
        },
    });
    res.json({ id: element.id });
});

adminRouter.put("/element/:elementId", async (req, res) => {
    const parsedData = UpdateElementSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({ message: "Validation failed" });
    }

    try {
        await prisma.element.update({
            where: { id: req.params.elementId as string },
            data: { imageUrl: parsedData.data.imageUrl },
        });
        res.json({ message: "Element updated" });
    } catch (error) {
        res.status(400).json({ message: "Element not found" });
    }
});

adminRouter.post("/avatar", async (req, res) => {
    const parsedData = CreateAvatarSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({ message: "Validation failed" });
    }

    const avatar = await prisma.avatar.create({
        data: {
            name: parsedData.data.name,
            imageUrl: parsedData.data.imageUrl,
        },
    });
    res.json({ avatarId: avatar.id });
});

adminRouter.post("/map", async (req, res) => {
    const parsedData = CreateMapSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({ message: "Validation failed" });
    }

    const [width, height] = parsedData.data.dimensions.split("x").map(Number);

    try {
        const map = await prisma.map.create({
            data: {
                name: parsedData.data.name,
                thumbnail: parsedData.data.thumbnail,
                width: width!,
                height: height!,
                mapElements: {
                    create: parsedData.data.defaultElements.map((e) => ({
                        elementId: e.elementId,
                        x: e.x,
                        y: e.y,
                    })),
                },
            },
        });
        res.json({ id: map.id });
    } catch (error) {
        // e.g. an elementId that doesn't exist
        res.status(400).json({ message: "Could not create map" });
    }
});