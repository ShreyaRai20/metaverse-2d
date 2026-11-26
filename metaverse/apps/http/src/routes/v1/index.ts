import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { SignupSchema, SigninSchema } from "../../types/index.js";
import prisma from "../../../../../packages/db/dist/index.js";
import { userRouter } from "../../middleware/user.js";
import { adminRouter } from "../../middleware/admin.js";
import { spaceRouter } from "./space.js";
import { userMiddleware } from "./user.js";
import { JWT_SECRET } from "../../config.js";

export const router = Router();

router.post("/signup", async (req, res) => {
    const parsedData = SignupSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({ message: "Validation failed" });
    }

    try {
        const hashedPassword = await bcrypt.hash(parsedData.data.password, 10);
        const user = await prisma.user.create({
            data: {
                username: parsedData.data.username,
                email: parsedData.data.email,
                password: hashedPassword,
                role: parsedData.data.type === "admin" ? "Admin" : "User",
            },
        });
        return res.json({ userId: user.id });
    } catch (error) {
        // most likely a unique constraint violation (username/email taken)
        return res.status(400).json({ message: "User already exists" });
    }
});

router.post("/signin", async (req, res) => {
    const parsedData = SigninSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(403).json({ message: "Validation failed" });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { username: parsedData.data.username },
        });
        if (!user) {
            return res.status(403).json({ message: "User not found" });
        }

        const isValid = await bcrypt.compare(parsedData.data.password, user.password);
        if (!isValid) {
            return res.status(403).json({ message: "Invalid password" });
        }

        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
            expiresIn: "7d",
        });
        return res.json({ token });
    } catch (error) {
        return res.status(400).json({ message: "Internal error" });
    }
});

router.get("/elements", userMiddleware, async (req, res) => {
    const elements = await prisma.element.findMany();
    res.json({
        elements: elements.map((e) => ({
            id: e.id,
            imageUrl: e.imageUrl,
            width: e.width,
            height: e.height,
            static: e.static,
        })),
    });
});

router.get("/avatars", userMiddleware, async (req, res) => {
    const avatars = await prisma.avatar.findMany();
    res.json({
        avatars: avatars.map((a) => ({
            id: a.id,
            imageUrl: a.imageUrl,
            name: a.name,
        })),
    });
});

router.use("/user", userRouter);
router.use("/admin", adminRouter);
router.use("/space", spaceRouter);
