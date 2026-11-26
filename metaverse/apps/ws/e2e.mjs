// End-to-end test for the metaverse http + ws servers.
// Run from apps/ws with BOTH servers running:  node e2e.mjs
import WebSocket from "ws";

const HTTP = process.env.HTTP_URL || "http://localhost:3000/api/v1";
const WS_URL = process.env.WS_URL || "ws://localhost:3001";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
function check(name, cond, extra = "") {
    if (cond) {
        passed++;
        console.log(`  ✅ ${name}`);
    } else {
        failed++;
        console.log(`  ❌ ${name} ${extra}`);
    }
}
const section = (t) => console.log(`\n${t}`);
function must(cond, msg) {
    if (!cond) throw new Error(msg);
}

async function api(method, path, body, token) {
    const res = await fetch(HTTP + path, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
        data = await res.json();
    } catch {}
    return { status: res.status, data };
}

const clients = [];
class Client {
    constructor() {
        this.inbox = [];
        this.waiters = [];
        clients.push(this);
    }
    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(WS_URL);
            this.closedPromise = new Promise((r) => this.ws.on("close", r));
            this.ws.on("open", resolve);
            this.ws.on("error", reject);
            this.ws.on("message", (d) => {
                this.inbox.push(JSON.parse(d.toString()));
                this.flush();
            });
        });
    }
    flush() {
        for (const w of [...this.waiters]) {
            const i = this.inbox.findIndex((m) => m.type === w.type);
            if (i !== -1) {
                const [m] = this.inbox.splice(i, 1);
                clearTimeout(w.timer);
                this.waiters = this.waiters.filter((x) => x !== w);
                w.resolve(m);
            }
        }
    }
    send(obj) {
        this.ws.send(JSON.stringify(obj));
    }
    next(type, ms = 2000) {
        return new Promise((resolve, reject) => {
            const w = { type, resolve };
            w.timer = setTimeout(() => {
                this.waiters = this.waiters.filter((x) => x !== w);
                reject(new Error(`timed out waiting for "${type}"`));
            }, ms);
            this.waiters.push(w);
            this.flush();
        });
    }
    take(type) {
        const i = this.inbox.findIndex((m) => m.type === type);
        return i === -1 ? undefined : this.inbox.splice(i, 1)[0];
    }
    async waitClosed(ms) {
        return Promise.race([this.closedPromise.then(() => true), sleep(ms).then(() => false)]);
    }
    close() {
        this.ws?.close();
    }
}

async function join(client, spaceId, token) {
    client.send({ type: "join", payload: { spaceId, token } });
    const m = await client.next("space-joined");
    return m.payload;
}

async function main() {
    const stamp = Date.now();
    const pw = "password123";
    const adminName = `admin_${stamp}`;
    const userName = `user_${stamp}`;

    // ---------------------------------------------------------------- auth
    section("HTTP: auth");
    let r = await api("POST", "/signup", { username: adminName, email: `${adminName}@test.com`, password: pw, type: "admin" });
    check("admin signup → 200 + userId", r.status === 200 && !!r.data?.userId, JSON.stringify(r));
    must(r.data?.userId, "admin signup failed, cannot continue");
    const adminId = r.data.userId;

    r = await api("POST", "/signup", { username: userName, email: `${userName}@test.com`, password: pw, type: "user" });
    check("user signup → 200 + userId", r.status === 200 && !!r.data?.userId, JSON.stringify(r));
    must(r.data?.userId, "user signup failed, cannot continue");
    const userId = r.data.userId;

    r = await api("POST", "/signup", { username: userName, email: `${userName}@test.com`, password: pw, type: "user" });
    check("duplicate signup → 400", r.status === 400, `got ${r.status}`);

    r = await api("POST", "/signin", { username: userName, password: "wrongpass1" });
    check("signin with wrong password → 403", r.status === 403, `got ${r.status}`);

    r = await api("POST", "/signin", { username: adminName, password: pw });
    check("admin signin → token", r.status === 200 && !!r.data?.token, JSON.stringify(r));
    const adminToken = r.data?.token;
    r = await api("POST", "/signin", { username: userName, password: pw });
    check("user signin → token", r.status === 200 && !!r.data?.token, JSON.stringify(r));
    const userToken = r.data?.token;
    must(adminToken && userToken, "signin failed, cannot continue");

    r = await api("GET", "/elements");
    check("GET /elements without token → 403", r.status === 403, `got ${r.status}`);
    r = await api("POST", "/admin/element", { imageUrl: "x", width: 1, height: 1, static: true }, userToken);
    check("normal user hitting admin endpoint → 403", r.status === 403, `got ${r.status}`);

    // --------------------------------------------------------------- admin
    section("HTTP: admin creates avatar, elements, maps");
    r = await api("POST", "/admin/avatar", { name: "Timmy", imageUrl: "https://example.com/timmy.png" }, adminToken);
    check("create avatar → avatarId", r.status === 200 && !!r.data?.avatarId, JSON.stringify(r));
    const avatarId = r.data?.avatarId;

    r = await api("POST", "/admin/element", { imageUrl: "https://example.com/table.png", width: 1, height: 1, static: true }, adminToken);
    check("create static element (table)", r.status === 200 && !!r.data?.id, JSON.stringify(r));
    const tableId = r.data?.id;
    r = await api("POST", "/admin/element", { imageUrl: "https://example.com/chair.png", width: 1, height: 1, static: false }, adminToken);
    check("create non-static element (chair)", r.status === 200 && !!r.data?.id, JSON.stringify(r));
    const chairId = r.data?.id;
    must(tableId && chairId && avatarId, "admin setup failed, cannot continue");

    r = await api("PUT", `/admin/element/${chairId}`, { imageUrl: "https://example.com/chair2.png" }, adminToken);
    check("update element → 200", r.status === 200, `got ${r.status}`);

    const mapBase = { thumbnail: "https://example.com/thumb.png" };
    r = await api("POST", "/admin/map", { ...mapBase, name: "open-room", dimensions: "10x10", defaultElements: [{ elementId: chairId, x: 2, y: 2 }] }, adminToken);
    check("create map 10x10 (with chair)", r.status === 200 && !!r.data?.id, JSON.stringify(r));
    const map1 = r.data?.id;
    r = await api("POST", "/admin/map", { ...mapBase, name: "table-corridor", dimensions: "3x1", defaultElements: [{ elementId: tableId, x: 1, y: 0 }] }, adminToken);
    check("create map 3x1 (table in the middle)", r.status === 200 && !!r.data?.id, JSON.stringify(r));
    const map2 = r.data?.id;
    r = await api("POST", "/admin/map", { ...mapBase, name: "tiny", dimensions: "2x1", defaultElements: [] }, adminToken);
    check("create map 2x1 (empty)", r.status === 200 && !!r.data?.id, JSON.stringify(r));
    const map3 = r.data?.id;
    must(map1 && map2 && map3, "map setup failed, cannot continue");

    // ---------------------------------------------------------------- user
    section("HTTP: user endpoints");
    r = await api("POST", "/user/metadata", { avatarId }, userToken);
    check("update metadata → 200", r.status === 200, `got ${r.status}`);
    r = await api("POST", "/user/metadata", { avatarId: "does-not-exist" }, userToken);
    check("update metadata with bad avatar → 400", r.status === 400, `got ${r.status}`);
    r = await api("GET", `/user/metadata/bulk?ids=[${userId}]`, null, userToken);
    check("bulk metadata returns the avatar url", r.data?.avatars?.[0]?.imageUrl === "https://example.com/timmy.png", JSON.stringify(r.data));
    r = await api("GET", "/elements", null, userToken);
    check("GET /elements lists the table with static=true", r.data?.elements?.some((e) => e.id === tableId && e.static === true), JSON.stringify(r.data));
    r = await api("GET", "/avatars", null, userToken);
    check("GET /avatars lists the avatar", r.data?.avatars?.some((a) => a.id === avatarId), JSON.stringify(r.data));

    section("HTTP: spaces");
    r = await api("POST", "/space", { name: "open", dimensions: "10x10", mapId: map1 }, userToken);
    check("create space from 10x10 map", r.status === 200 && !!r.data?.spaceId, JSON.stringify(r));
    const s1 = r.data?.spaceId;
    r = await api("POST", "/space", { name: "corridor", dimensions: "3x1", mapId: map2 }, userToken);
    check("create space from 3x1 map", r.status === 200 && !!r.data?.spaceId, JSON.stringify(r));
    const s2 = r.data?.spaceId;
    r = await api("POST", "/space", { name: "tiny", dimensions: "2x1", mapId: map3 }, userToken);
    check("create space from 2x1 map", r.status === 200 && !!r.data?.spaceId, JSON.stringify(r));
    const s3 = r.data?.spaceId;
    must(s1 && s2 && s3, "space creation failed, cannot continue");

    r = await api("POST", "/space", { name: "bad", dimensions: "10x10", mapId: "nope" }, userToken);
    check("create space with bad mapId → 400", r.status === 400, `got ${r.status}`);

    r = await api("GET", `/space/${s1}`, null, userToken);
    check("GET space: dimensions + copied map elements", r.data?.dimensions === "10x10" && r.data?.elements?.length === 1, JSON.stringify(r.data));
    r = await api("GET", "/space/all", null, userToken);
    check("GET /space/all returns my 3 spaces", r.data?.spaces?.length === 3, JSON.stringify(r.data));

    r = await api("POST", "/space", { name: "scratch", dimensions: "2x1", mapId: map3 }, userToken);
    const s4 = r.data?.spaceId;
    r = await api("POST", "/space/element", { spaceId: s4, elementId: chairId, x: 5, y: 0 }, userToken);
    check("add element outside bounds → 400", r.status === 400, `got ${r.status}`);
    r = await api("POST", "/space/element", { spaceId: s4, elementId: chairId, x: 0, y: 0 }, userToken);
    check("add element inside bounds → 200", r.status === 200, `got ${r.status}`);
    r = await api("GET", `/space/${s4}`, null, userToken);
    check("space now has 1 element", r.data?.elements?.length === 1, JSON.stringify(r.data));
    const spaceElementId = r.data?.elements?.[0]?.id;
    r = await api("DELETE", "/space/element", { id: spaceElementId }, userToken);
    check("delete element → 200", r.status === 200, `got ${r.status}`);
    r = await api("DELETE", `/space/${s4}`, null, adminToken);
    check("another user deleting my space → 403", r.status === 403, `got ${r.status}`);
    r = await api("DELETE", `/space/${s4}`, null, userToken);
    check("delete own space → 200", r.status === 200, `got ${r.status}`);
    r = await api("GET", `/space/${s4}`, null, userToken);
    check("deleted space → 400", r.status === 400, `got ${r.status}`);

    // ----------------------------------------------------------- websocket
    section("WS: open room (10x10) – join, broadcast, move, leave");
    const A = new Client();
    await A.connect();
    const B = new Client();
    await B.connect();

    const aJoin = await join(A, s1, userToken);
    check("A: space-joined with spawn inside the room", aJoin.spawn.x >= 0 && aJoin.spawn.x < 10 && aJoin.spawn.y >= 0 && aJoin.spawn.y < 10, JSON.stringify(aJoin));
    check("A: users list is empty (alone)", aJoin.users.length === 0, JSON.stringify(aJoin.users));

    const bJoin = await join(B, s1, adminToken);
    check("B: users list contains A", bJoin.users.some((u) => u.id === userId), JSON.stringify(bJoin.users));
    const joinEv = await A.next("user-join");
    check("A: receives user-join for B with coordinates", joinEv.payload.userId === adminId && Number.isInteger(joinEv.payload.x), JSON.stringify(joinEv));

    A.send({ type: "move", payload: { x: aJoin.spawn.x + 3, y: aJoin.spawn.y } });
    const rej = await A.next("movement-rejected");
    check("3-tile jump rejected, A pushed back to spawn", rej.payload.x === aJoin.spawn.x && rej.payload.y === aJoin.spawn.y, JSON.stringify(rej));

    let moved = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        A.send({ type: "move", payload: { x: aJoin.spawn.x + dx, y: aJoin.spawn.y + dy } });
        await sleep(250);
        const ev = B.take("movement");
        A.take("movement-rejected");
        if (ev) {
            moved = ev;
            break;
        }
    }
    check("valid 1-tile move accepted and broadcast to B", !!moved && moved.payload.userId === userId, JSON.stringify(moved));

    B.close();
    const left = await A.next("user-left");
    check("A: receives user-left when B disconnects", left.payload.userId === adminId, JSON.stringify(left));
    A.close();

    section("WS: invalid token");
    const bad = new Client();
    await bad.connect();
    bad.send({ type: "join", payload: { spaceId: s1, token: "garbage" } });
    check("join with invalid token → connection closed", await bad.waitClosed(1500));

    section("WS: corridor (3x1) – static element + walls");
    const C = new Client();
    await C.connect();
    const cj = await join(C, s2, userToken);
    check("spawn is on a walkable tile (x=0 or x=2, y=0)", cj.spawn.y === 0 && (cj.spawn.x === 0 || cj.spawn.x === 2), JSON.stringify(cj.spawn));

    C.send({ type: "move", payload: { x: 1, y: 0 } });
    let m = await C.next("movement-rejected");
    check("walking onto the static table is rejected", m.payload.x === cj.spawn.x && m.payload.y === 0, JSON.stringify(m));

    C.send({ type: "move", payload: { x: cj.spawn.x === 0 ? -1 : 3, y: 0 } });
    m = await C.next("movement-rejected");
    check("walking through the side wall is rejected", m.payload.x === cj.spawn.x, JSON.stringify(m));

    C.send({ type: "move", payload: { x: cj.spawn.x, y: 1 } });
    m = await C.next("movement-rejected");
    check("walking through the bottom wall is rejected", m.payload.x === cj.spawn.x && m.payload.y === 0, JSON.stringify(m));
    C.close();

    section("WS: tiny room (2x1) – user collision");
    const X = new Client();
    await X.connect();
    const Y = new Client();
    await Y.connect();
    const xj = await join(X, s3, userToken);
    const yj = await join(Y, s3, adminToken);
    check("X and Y spawn on different tiles", !(xj.spawn.x === yj.spawn.x && xj.spawn.y === yj.spawn.y), JSON.stringify({ xj, yj }));
    X.send({ type: "move", payload: { x: yj.spawn.x, y: yj.spawn.y } });
    m = await X.next("movement-rejected");
    check("walking into another user is rejected", m.payload.x === xj.spawn.x && m.payload.y === xj.spawn.y, JSON.stringify(m));
    X.close();
    Y.close();
}

try {
    await main();
} catch (err) {
    failed++;
    console.log(`\n💥 ${err.message}`);
    if (String(err.cause?.code || err.message).includes("ECONNREFUSED") || err.message === "fetch failed") {
        console.log("   Can't reach a server. Are BOTH the http server (port 3000) and ws server (port 3001) running?");
    }
} finally {
    clients.forEach((c) => c.close());
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);