import type { ArenaElement, Pos, Profile } from "@/lib/client/useArena";

export const TILE = 40;
const U = TILE / 12; // one "pixel" of a character sprite

const COLORS = {
    backdrop: "#0B0D1A",
    dot: "#1A1E36",
    wall: "#3E4268",
    wallEdge: "#555B8F",
    window: "#8FD3FF",
    floorA: "#E8D5A8",
    floorB: "#DCC796",
    deskTop: "#B87A4B",
    deskEdge: "#8F5C36",
    rug: "#5C6BC0",
    rugEdge: "#8E9AE6",
    legs: "#2A2E4A",
    shadow: "rgba(0, 0, 0, 0.18)",
    pill: "#0E1020",
    pillText: "#F3F1EA",
    youPill: "#52E5CF",
};

type Look = { hair: string; skin: string; shirt: string };

// The eight avatars from the picker. Once avatars are seeded in the database with these
// names, everyone shows up with their chosen look. Until then the look comes from their id.
const LOOKS: Record<string, Look> = {
    ember: { hair: "#3B2A20", skin: "#F0C8A0", shirt: "#FF7A59" },
    sage: { hair: "#C8452D", skin: "#8A5A3E", shirt: "#2FB8A6" },
    indigo: { hair: "#15141F", skin: "#D9A880", shirt: "#5B6BC0" },
    plum: { hair: "#8E3A8E", skin: "#F0C8A0", shirt: "#FFD166" },
    sunny: { hair: "#E8B23A", skin: "#F0C8A0", shirt: "#14141C" },
    rose: { hair: "#3B2A20", skin: "#8A5A3E", shirt: "#E8708F" },
    mint: { hair: "#25253F", skin: "#D9A880", shirt: "#3FA66B" },
    slate: { hair: "#A9ADC9", skin: "#F0C8A0", shirt: "#8B96E0" },
};
const LOOK_LIST = Object.values(LOOKS);

function hash(text: string) {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return h;
}

function lookFor(id: string, profile: Profile | undefined): Look {
    const named = profile?.avatarName ? LOOKS[profile.avatarName.toLowerCase()] : undefined;
    return named ?? (LOOK_LIST[hash(id) % LOOK_LIST.length] as Look);
}

export function displayName(id: string, profile: Profile | undefined) {
    return profile?.username ?? `Guest ${id.slice(-4)}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export type Scene = {
    width: number;
    height: number;
    elements: ArenaElement[];
    me: Pos | null;
    myId: string | null;
    others: Map<string, Pos>;
    profiles: Record<string, Profile>;
};

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawLabel(ctx: CanvasRenderingContext2D, cx: number, y: number, text: string, isMe: boolean) {
    ctx.font = "700 12px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = Math.ceil(ctx.measureText(text).width) + 16;
    const h = 20;
    ctx.fillStyle = isMe ? COLORS.youPill : COLORS.pill;
    ctx.beginPath();
    ctx.roundRect(Math.round(cx - w / 2), Math.round(y - h / 2), w, h, 8);
    ctx.fill();
    ctx.fillStyle = isMe ? COLORS.pill : COLORS.pillText;
    ctx.fillText(text, Math.round(cx), Math.round(y) + 1);
}

export function createRenderer() {
    const visual = new Map<string, Pos>(); // where each person is drawn (glides toward the real tile)
    const images = new Map<string, HTMLImageElement>();
    let dots: CanvasPattern | null = null;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ease = reduceMotion ? 1 : 0.3;

    function smooth(key: string, target: Pos) {
        let cur = visual.get(key);
        if (!cur || Math.abs(cur.x - target.x) + Math.abs(cur.y - target.y) > 3) {
            cur = { x: target.x, y: target.y }; // first sighting or a teleport: don't glide
            visual.set(key, cur);
        } else {
            cur.x += (target.x - cur.x) * ease;
            cur.y += (target.y - cur.y) * ease;
        }
        const moving = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.05;
        return { x: cur.x, y: cur.y, moving };
    }

    // Returns the image once it has loaded; until then (or if it fails) we draw a plain block.
    function loadedImage(url: string): HTMLImageElement | null {
        let img = images.get(url);
        if (!img) {
            img = new Image();
            img.src = url;
            images.set(url, img);
        }
        return img.complete && img.naturalWidth > 0 ? img : null;
    }

    function drawElement(ctx: CanvasRenderingContext2D, el: ArenaElement) {
        const px = el.x * TILE;
        const py = el.y * TILE;
        const pw = el.element.width * TILE;
        const ph = el.element.height * TILE;

        const img = loadedImage(el.element.imageUrl);
        if (img) {
            ctx.drawImage(img, px, py, pw, ph);
            return;
        }

        if (el.element.static) {
            // solid furniture: a block with a darker front edge
            ctx.fillStyle = COLORS.deskTop;
            rect(ctx, px, py, pw, ph);
            ctx.fillStyle = COLORS.deskEdge;
            rect(ctx, px, py + ph - 8, pw, 8);
        } else {
            // walkable things (rugs): a block with a light border
            ctx.fillStyle = COLORS.rug;
            rect(ctx, px, py, pw, ph);
            ctx.strokeStyle = COLORS.rugEdge;
            ctx.lineWidth = 4;
            ctx.strokeRect(px + 2, py + 2, pw - 4, ph - 4);
        }
    }

    function drawCharacter(
        ctx: CanvasRenderingContext2D,
        pos: { x: number; y: number; moving: boolean },
        look: Look,
        now: number
    ) {
        const left = pos.x * TILE;
        const feet = (pos.y + 1) * TILE - 2;
        const bob = pos.moving && !reduceMotion ? Math.round(Math.abs(Math.sin(now / 90)) * 2) : 0;
        const top = feet - 18 * U - bob;

        ctx.fillStyle = COLORS.shadow;
        rect(ctx, left + 2 * U, feet - 2, 8 * U, 4);

        ctx.fillStyle = COLORS.legs;
        rect(ctx, left + 2 * U, top + 14 * U, 3 * U, 4 * U);
        rect(ctx, left + 7 * U, top + 14 * U, 3 * U, 4 * U);
        ctx.fillStyle = look.shirt;
        rect(ctx, left + 1 * U, top + 8 * U, 10 * U, 6 * U);
        ctx.fillStyle = look.skin;
        rect(ctx, left + 2 * U, top + 3 * U, 8 * U, 5 * U);
        ctx.fillStyle = look.hair;
        rect(ctx, left + 2 * U, top, 8 * U, 3 * U);

        return { cx: left + TILE / 2, top };
    }

    function draw(ctx: CanvasRenderingContext2D, W: number, H: number, scene: Scene, now: number) {
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = COLORS.backdrop;
        ctx.fillRect(0, 0, W, H);

        const { width, height } = scene;
        if (width === 0 || height === 0) return;

        const mapW = width * TILE;
        const mapH = height * TILE;
        // The wall is drawn around the floor: 1 tile on the sides and bottom, 1.5 on top.
        const minX = -TILE;
        const maxX = mapW + TILE;
        const minY = -1.5 * TILE;
        const maxY = mapH + TILE;

        const myVisual = scene.me ? smooth("me", scene.me) : null;
        const focusX = ((myVisual?.x ?? width / 2) + 0.5) * TILE;
        const focusY = ((myVisual?.y ?? height / 2) + 0.5) * TILE;
        const worldW = maxX - minX;
        const worldH = maxY - minY;
        const camX = worldW <= W ? minX - (W - worldW) / 2 : clamp(focusX - W / 2, minX, maxX - W);
        const camY = worldH <= H ? minY - (H - worldH) / 2 : clamp(focusY - H / 2, minY, maxY - H);

        // dotted backdrop
        if (!dots) {
            const tile = document.createElement("canvas");
            tile.width = 24;
            tile.height = 24;
            const tctx = tile.getContext("2d");
            if (tctx) {
                tctx.fillStyle = COLORS.dot;
                tctx.fillRect(11, 11, 2, 2);
                dots = ctx.createPattern(tile, "repeat");
            }
        }
        if (dots) {
            ctx.save();
            ctx.translate(-(camX % 24), -(camY % 24));
            ctx.fillStyle = dots;
            ctx.fillRect(-24, -24, W + 48, H + 48);
            ctx.restore();
        }

        ctx.save();
        ctx.translate(-Math.round(camX), -Math.round(camY));

        // walls and window
        ctx.fillStyle = COLORS.wall;
        rect(ctx, minX, minY, worldW, worldH);
        ctx.fillStyle = COLORS.wallEdge;
        rect(ctx, 0, -4, mapW, 4);
        if (width >= 6) {
            ctx.fillStyle = COLORS.window;
            rect(ctx, Math.floor(width / 2 - 1.5) * TILE, -1.1 * TILE, 3 * TILE, 0.8 * TILE);
        }

        // checkered floor (only the tiles on screen)
        const x0 = Math.max(0, Math.floor(camX / TILE));
        const x1 = Math.min(width, Math.ceil((camX + W) / TILE));
        const y0 = Math.max(0, Math.floor(camY / TILE));
        const y1 = Math.min(height, Math.ceil((camY + H) / TILE));
        for (let ty = y0; ty < y1; ty++) {
            for (let tx = x0; tx < x1; tx++) {
                ctx.fillStyle = (tx + ty) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
                rect(ctx, tx * TILE, ty * TILE, TILE, TILE);
            }
        }

        // rugs lie flat on the floor, under everything
        for (const el of scene.elements) {
            if (!el.element.static) drawElement(ctx, el);
        }

        // furniture and people share one list, sorted by how far down the screen they stand,
        // so someone standing in front of a desk is drawn over it
        const items: { depth: number; paint: () => void }[] = [];
        const labels: { cx: number; y: number; text: string; isMe: boolean }[] = [];

        for (const el of scene.elements) {
            if (el.element.static) {
                items.push({ depth: el.y + el.element.height, paint: () => drawElement(ctx, el) });
            }
        }
        for (const [id, pos] of scene.others) {
            const p = smooth(id, pos);
            const look = lookFor(id, scene.profiles[id]);
            const text = displayName(id, scene.profiles[id]);
            items.push({
                depth: p.y + 1,
                paint: () => {
                    const spot = drawCharacter(ctx, p, look, now);
                    labels.push({ cx: spot.cx, y: spot.top - 12, text, isMe: false });
                },
            });
        }
        if (scene.me && myVisual) {
            const look = lookFor(scene.myId ?? "me", scene.myId ? scene.profiles[scene.myId] : undefined);
            items.push({
                depth: myVisual.y + 1.001,
                paint: () => {
                    const spot = drawCharacter(ctx, myVisual, look, now);
                    labels.push({ cx: spot.cx, y: spot.top - 12, text: "You", isMe: true });
                },
            });
        }

        items.sort((a, b) => a.depth - b.depth);
        for (const item of items) item.paint();
        for (const label of labels) drawLabel(ctx, label.cx, label.y, label.text, label.isMe);

        ctx.restore();

        // forget people who left
        for (const key of [...visual.keys()]) {
            if (key !== "me" && !scene.others.has(key)) visual.delete(key);
        }
    }

    return { draw };
}