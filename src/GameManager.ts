import { redis } from "./config/redis.js";
import { Game } from "./Game.js";
import { INIT_GAME, JOIN_GAME_ROOM, MOVE, RECONNECT } from "./messages.js";
import { Server, Socket } from "socket.io";

export class GameManager {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  async addUser(id: string, socket: Socket) {
    const data = await redis.hgetall(`activePlayer:${id}`);

    const { gameId } = data;

    socket.data.userId = id;

    await redis.hset(`activePlayer:${id}`, {
      gameId: gameId || "",
      socketId: socket.id,
    });

    if (gameId) {
      await this.reconnect(gameId, id, socket);
    }

    this.addHandler({ id, socket });
  }

  async removeUser(socket: Socket) {
    const id = socket.data.userId;
    if (!id) {
      console.error("No id on socket");
      return;
    }

    await redis.hdel(`activePlayer:${id}`, "socketId");

    await redis.lrem("pendingPlayer", 0, id);
  }

  private async reconnect(gameId: string, id: string, socket: Socket) {
    const gameData = await redis.get(`game:${gameId}`);
    if (!gameData) return;

    const game = Game.fromJSON(gameData, this.io);

    const side =
      game?.player1.id === id ? game.player1.side : game?.player2.side;

    socket.join(gameId);
    socket.emit(RECONNECT, {
      payload: {
        fen: game.board.fen(),
        side,
      },
    });
  }

  private addHandler({ id, socket }: { id: string; socket: Socket }) {
    socket.on(INIT_GAME, async () => {
      const pendingData = await redis.rpop("pendingPlayer");
      if (!pendingData) {
        await redis.lpush(
          "pendingPlayer",
          JSON.stringify({ id, socketId: socket.id })
        );
        return;
      }

      let pending;
      try {
        pending = JSON.parse(pendingData);
      } catch (err) {
        console.error("Failed to parse pending player data", err);
        await redis.lpush(
          "pendingPlayer",
          JSON.stringify({ id, socketId: socket.id })
        );
        return;
      }

      const game = new Game(this.io, { id: pending.id }, { id });

      await Promise.all([
        redis.set(`game:${game.gameId}`, JSON.stringify(game.toJSON())),
        redis.hset(`activePlayer:${id}`, {
          gameId: game.gameId,
        }),
        redis.hset(`activePlayer:${pending.id}`, {
          gameId: game.gameId,
        }),
      ]);

      await game.createGameHandler();
    });

    socket.on(JOIN_GAME_ROOM, (gameId: string) => {
      socket.join(gameId);
    });

    socket.on(MOVE, async (data) => {
      const { gameId } = await redis.hgetall(`activePlayer:${id}`);
      if (!gameId) return;

      const gameData = await redis.get(`game:${gameId}`);
      if (!gameData) return;

      const game = Game.fromJSON(gameData, this.io);
      if (!game) return;

      const moveResult = await game.makeMove(data.payload.move, socket);
      if (moveResult) {
        await redis.set(`game:${game.gameId}`, JSON.stringify(game.toJSON()));
      }
    });
  }
}
