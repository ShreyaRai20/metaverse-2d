import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { User } from "./User.js";

// Hosts like Render give the port in PORT.
const port = Number(process.env.PORT) || Number(process.env.WS_PORT) || 3001;

// Plain HTTP endpoint: used by the host's health check, and by the browser to
// "wake" a sleeping free-tier server before opening the WebSocket.
const server = createServer((req, res) => {
    res.writeHead(200, { "Access-Control-Allow-Origin": "*" });
    res.end("ok");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
    new User(ws); // the User attaches its own message/close handlers
    ws.on("error", console.error);
});

server.listen(port, () => {
    console.log(`ws server listening on port ${port}`);
});