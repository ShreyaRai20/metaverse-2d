import { z } from "zod";

// ---------- Client -> Server ----------
export const ClientMessageSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("join"),
        payload: z.object({
            spaceId: z.string(),
            token: z.string(),
        }),
    }),
    z.object({
        type: z.literal("move"),
        payload: z.object({
            x: z.number().int(),
            y: z.number().int(),
        }),
    }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ---------- Server -> Client ----------
export type ServerMessage =
    | {
          type: "space-joined";
          payload: {
              spawn: { x: number; y: number };
              users: { id: string }[];
          };
      }
    | { type: "movement-rejected"; payload: { x: number; y: number } }
    | { type: "movement"; payload: { x: number; y: number; userId: string } }
    | { type: "user-join"; payload: { userId: string; x: number; y: number } }
    | { type: "user-left"; payload: { userId: string } };