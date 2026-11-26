import { Router } from "express";
import {
    CreateSpaceSchema,
    AddElementSchema,
    DeleteElementSchema,
} from "../../types/index.js";
import prisma from "../../../../../packages/db/dist/index.js";
import { userMiddleware } from "./user.js";

export const spaceRouter = Router();

// NOTE: static paths (/all, /element) must be declared before "/:spaceId",
// otherwise Express treats "all" and "element" as a spaceId.

spaceRouter.post("/", userMiddleware, async (req, res) => {
    const parsedData = CreateSpaceSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({ message: "Validation failed" });
    }

    const [width, height] = parsedData.data.dimensions.split("x").map(Number);

    const map = await prisma.map.findUnique({
        where: { id: parsedData.data.mapId },
        include: { mapElements: true },
    });
    if (!map) {
        return res.status(400).json({ message: "Map not found" });
    }

    const space = await prisma.$transaction(async (tx) => {
        const created = await tx.space.create({
            data: {
                name: parsedData.data.name,
                width: width!,
                height: height!,
                thumbnail: map.thumbnail,
                creatorId: res.locals.userId,
            },
        });
        await tx.spaceElements.createMany({
            data: map.mapElements.map((e) => ({
                spaceId: created.id,
                elementId: e.elementId,
                x: e.x,
                y: e.y,
            })),
        });
        return created;
    });

    res.json({ spaceId: space.id });
});

spaceRouter.get("/all", userMiddleware, async (req, res) => {
    const spaces = await prisma.space.findMany({
        where: { creatorId: res.locals.userId },
    });
    res.json({
        spaces: spaces.map((s) => ({
            id: s.id,
            name: s.name,
            thumbnail: s.thumbnail,
            dimensions: `${s.width}x${s.height}`,
        })),
    });
});

spaceRouter.post("/element", userMiddleware, async (req, res) => {
    const parsedData = AddElementSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({ message: "Validation failed" });
    }

    const space = await prisma.space.findUnique({
        where: { id: parsedData.data.spaceId },
    });
    if (!space) {
        return res.status(400).json({ message: "Space not found" });
    }
    if (space.creatorId !== res.locals.userId) {
        return res.status(403).json({ message: "Not your space" });
    }

    const { x, y } = parsedData.data;
    if (x < 0 || y < 0 || x > space.width || (space.height != null && y > space.height)) {
        return res.status(400).json({ message: "Element outside space bounds" });
    }

    const element = await prisma.element.findUnique({
        where: { id: parsedData.data.elementId },
    });
    if (!element) {
        return res.status(400).json({ message: "Element not found" });
    }

    await prisma.spaceElements.create({
        data: {
            spaceId: space.id,
            elementId: element.id,
            x,
            y,
        },
    });
    res.json({ message: "Element added" });
});

spaceRouter.delete("/element", userMiddleware, async (req, res) => {
    const parsedData = DeleteElementSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({ message: "Validation failed" });
    }

    const spaceElement = await prisma.spaceElements.findUnique({
        where: { id: parsedData.data.id },
        include: { space: true },
    });
    if (!spaceElement) {
        return res.status(400).json({ message: "Element not found" });
    }
    if (spaceElement.space.creatorId !== res.locals.userId) {
        return res.status(403).json({ message: "Not your space" });
    }

    await prisma.spaceElements.delete({ where: { id: spaceElement.id } });
    res.json({ message: "Element deleted" });
});

spaceRouter.get("/:spaceId", userMiddleware, async (req, res) => {
    const space = await prisma.space.findUnique({
        where: { id: req.params.spaceId },
        include: { elements: { include: { element: true } } },
    });
    if (!space) {
        return res.status(400).json({ message: "Space not found" });
    }

    res.json({
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
});

spaceRouter.delete("/:spaceId", userMiddleware, async (req, res) => {
    const space = await prisma.space.findUnique({
        where: { id: req.params.spaceId },
    });
    if (!space) {
        return res.status(400).json({ message: "Space not found" });
    }
    if (space.creatorId !== res.locals.userId) {
        return res.status(403).json({ message: "Not your space" });
    }

    await prisma.$transaction([
        prisma.spaceElements.deleteMany({ where: { spaceId: space.id } }),
        prisma.space.delete({ where: { id: space.id } }),
    ]);
    res.json({ message: "Space deleted" });
});