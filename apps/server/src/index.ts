import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import {
  mapDefinitions,
  prototypeGameConfig,
  tankDefinitions,
  weaponDefinitions
} from "@tank-battle/shared";

const port = Number(process.env.PORT ?? 3001);

const httpServer = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.url === "/api/bootstrap") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        config: prototypeGameConfig,
        maps: mapDefinitions,
        tanks: tankDefinitions,
        weapons: weaponDefinitions
      })
    );
    return;
  }

  response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: "Not Found" }));
});

const wsServer = new WebSocketServer({ noServer: true });

wsServer.on("connection", (socket) => {
  socket.send(
    JSON.stringify({
      type: "server.ready",
      message: "WebSocket scaffold is ready. Room sync is not implemented yet."
    })
  );
});

httpServer.on("upgrade", (request, socket, head) => {
  if (request.url !== "/ws") {
    socket.destroy();
    return;
  }

  wsServer.handleUpgrade(request, socket, head, (client) => {
    wsServer.emit("connection", client, request);
  });
});

httpServer.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
