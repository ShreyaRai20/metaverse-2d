import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { WebSocket } from "ws";
import prisma from "../../../packages/db/dist/index.js";
import { ClientMessageSchema, type ServerMessage } from "./types.js";
import { JWT_SECRET } from "./config.js";
import { RoomManager } from "./RoomManager.js";

const key = (x: number, y: number) => `${x},${y}`;

export class User {
    public id: string; // unique per connection
    public userId: string | undefined; // DB user id (set after join)
    public spaceId: string | undefined;
    public x = 0;
    public y = 0;

    private ws: WebSocket;
    private joining = false;
    private width = 0;
    private height = 0;
    private blocked = new Set<string>(); // tiles covered by static elements

    constructor(ws: WebSocket) {
        this.ws = ws;
        this.id = randomUUID();
        this.initHandlers();
    }

    send(message: ServerMessage) {
        if (this.ws.readyState === this.ws.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    private initHandlers() {
        this.ws.on("message", async (data) => {
            let raw: unknown;
            try {
                raw = JSON.parse(data.toString());
            } catch {
                return; // ignore non-JSON
            }

            const parsed = ClientMessageSchema.safeParse(raw);
            if (!parsed.success) return;

            try {
                switch (parsed.data.type) {
                    case "join":
                        await this.handleJoin(parsed.data.payload);
                        break;
                    case "move":
                        this.handleMove(parsed.data.payload);
                        break;
                }
            } catch (error) {
                console.error("ws handler error:", error);
                this.ws.close();
            }
        });

        this.ws.on("close", () => this.destroy());
    }

    private async handleJoin(payload: { spaceId: string; token: string }) {
        if (this.spaceId || this.joining) return; // already in a space
        this.joining = true;

        // 1. verify the JWT from login
        let userId: string;
        try {
            const decoded = jwt.verify(payload.token, JWT_SECRET) as { userId: string };
            userId = decoded.userId;
        } catch {
            this.ws.close();
            return;
        }

        // 2. load the space and its elements
        const space = await prisma.space.findUnique({
            where: { id: payload.spaceId },
            include: { elements: { include: { element: true } } },
        });
        if (!space) {
            this.ws.close();
            return;
        }
        if (this.ws.readyState !== this.ws.OPEN) return; // left while we were loading

        this.userId = userId;
        this.spaceId = space.id;
        this.width = space.width;
        this.height = space.height ?? Number.MAX_SAFE_INTEGER;

        // 3. remember every tile covered by a static element
        for (const se of space.elements) {
            if (!se.element.static) continue;
            for (let dx = 0; dx < se.element.width; dx++) {
                for (let dy = 0; dy < se.element.height; dy++) {
                    this.blocked.add(key(se.x + dx, se.y + dy));
                }
            }
        }

        // 4. pick a spawn point and enter the room
        const room = RoomManager.getInstance();
        const spawn = this.findSpawn();
        this.x = spawn.x;
        this.y = spawn.y;

        const others = room.getUsers(space.id).filter((u) => u.userId !== undefined);
        room.addUser(space.id, this);

        this.send({
            type: "space-joined",
            payload: {
                spawn: { x: this.x, y: this.y },
                users: others.map((u) => ({ id: u.userId as string })),
            },
        });

        room.broadcast(space.id, this, {
            type: "user-join",
            payload: { userId, x: this.x, y: this.y },
        });
    }

    private handleMove(payload: { x: number; y: number }) {
        if (!this.spaceId || !this.userId) return; // must join first

        const { x, y } = payload;
        const oneStep = Math.abs(x - this.x) + Math.abs(y - this.y) === 1;

        if (!oneStep || !this.isWalkable(x, y)) {
            // push the client back to where we think it is
            this.send({ type: "movement-rejected", payload: { x: this.x, y: this.y } });
            return;
        }

        this.x = x;
        this.y = y;

        RoomManager.getInstance().broadcast(this.spaceId, this, {
            type: "movement",
            payload: { x, y, userId: this.userId },
        });
    }

    private isWalkable(x: number, y: number): boolean {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false; // wall
        if (this.blocked.has(key(x, y))) return false; // static element
        if (this.spaceId) {
            const occupied = RoomManager.getInstance()
                .getUsers(this.spaceId)
                .some((u) => u.id !== this.id && u.x === x && u.y === y);
            if (occupied) return false; // another user
        }
        return true;
    }

    private findSpawn(): { x: number; y: number } {
        const maxY = Math.min(this.height, 1000);
        for (let i = 0; i < 200; i++) {
            const x = Math.floor(Math.random() * this.width);
            const y = Math.floor(Math.random() * maxY);
            if (this.isWalkable(x, y)) return { x, y };
        }
        return { x: 0, y: 0 };
    }

    destroy() {
        if (!this.spaceId || !this.userId) return;
        const room = RoomManager.getInstance();
        room.broadcast(this.spaceId, this, {
            type: "user-left",
            payload: { userId: this.userId },
        });
        room.removeUser(this.spaceId, this);
        this.spaceId = undefined;
    }
}