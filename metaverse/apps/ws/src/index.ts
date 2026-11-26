import { WebSocketServer } from "ws";
import { User } from "./User.js";

const port = Number(process.env.WS_PORT) || 3001;
const wss = new WebSocketServer({ port });

wss.on("connection", (ws) => {
    new User(ws); // the User attaches its own message/close handlers
    ws.on("error", console.error);
});

console.log(`ws server listening on port ${port}`);