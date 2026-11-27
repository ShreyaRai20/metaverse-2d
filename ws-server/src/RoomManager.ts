import type { User } from "./User.js";
import type { ServerMessage } from "./types.js";

export class RoomManager {
    private rooms: Map<string, User[]> = new Map();
    private static instance: RoomManager | undefined;

    private constructor() {}

    static getInstance(): RoomManager {
        if (!RoomManager.instance) {
            RoomManager.instance = new RoomManager();
        }
        return RoomManager.instance;
    }

    addUser(spaceId: string, user: User) {
        const users = this.rooms.get(spaceId) ?? [];
        this.rooms.set(spaceId, [...users, user]);
    }

    removeUser(spaceId: string, user: User) {
        const users = (this.rooms.get(spaceId) ?? []).filter((u) => u.id !== user.id);
        if (users.length === 0) {
            this.rooms.delete(spaceId); // free memory for empty rooms
        } else {
            this.rooms.set(spaceId, users);
        }
    }

    getUsers(spaceId: string): User[] {
        return this.rooms.get(spaceId) ?? [];
    }

    // send to everyone in the room except the sender
    broadcast(spaceId: string, sender: User, message: ServerMessage) {
        for (const user of this.getUsers(spaceId)) {
            if (user.id !== sender.id) {
                user.send(message);
            }
        }
    }
}