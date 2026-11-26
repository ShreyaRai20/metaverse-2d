
import { z } from "zod";

// Dimensions format: 100x200
const dimensions = z.string().regex(
    /^[0-9]{1,5}x[0-9]{1,5}$/,
    "Dimensions must be in widthxheight format"
);

// Authentication
export const SignupSchema = z.object({
    username: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    type: z.enum(["user", "admin"]),
});

export const SigninSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(8),
});

// User metadata
export const UpdateMetadataSchema = z.object({
    avatarId: z.string().min(1),
});

// Spaces
export const CreateSpaceSchema = z.object({
    name: z.string().min(1),
    dimensions,
    mapId: z.string().min(1),
});

// Space elements
export const AddElementSchema = z.object({
    spaceId: z.string().min(1),
    elementId: z.string().min(1),
    x: z.number(),
    y: z.number(),
});

export const DeleteElementSchema = z.object({
    id: z.string().min(1),
});

// Elements
export const CreateElementSchema = z.object({
    imageUrl: z.string().url(),
    width: z.number().positive(),
    height: z.number().positive(),
    static: z.boolean(),
});

export const UpdateElementSchema = z.object({
    imageUrl: z.string().url(),
});

// Avatars
export const CreateAvatarSchema = z.object({
    name: z.string().min(1),
    imageUrl: z.string().url(),
});

// Maps
export const CreateMapSchema = z.object({
    thumbnail: z.string(),
    dimensions,
    name: z.string().min(1),
    defaultElements: z.array(
        z.object({
            elementId: z.string().min(1),
            x: z.number(),
            y: z.number(),
        })
    ),
});
