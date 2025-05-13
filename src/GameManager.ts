import { Game } from "./Game.js";
import { INIT_GAME, MOVE, RECONNECT } from "./messages.js";
import { redis } from "./app.js";
import { Socket } from "socket.io";

export class GameManager {
  private games: Map<string, Game>;
  private socketByUserId: Map<string, Socket>;

  constructor() {
    this.games = new Map();
    this.socketByUserId = new Map();
  }

  private getIdFromSocket(socket: Socket): string | undefined {
    for (const [id, userSocket] of this.socketByUserId.entries()) {
      if (socket === userSocket) {
        return id;
      }
    }
  }

  async addUser(id: string, socket: Socket) {
    this.socketByUserId.set(id, socket);
    const { gameId } = await redis.hgetall(`activePlayer:${id}`);
    if (gameId) {
      this.reconnect(gameId, id, socket);
    } else {
      await redis.hset(`activePlayer:${id}`, { gameId: "" });
    }
    this.addHandler({ id, socket });
  }

  async removeUser(socket: Socket) {
    const id = this.getIdFromSocket(socket);
    if (!id) {
      console.error("No id associated with socket");
      return;
    }
    this.socketByUserId.delete(id);
    const { gameId } = await redis.hgetall(`activePlayer:${id}`);
    if (!gameId) {
      console.error(`No game found for user with ID ${id}`);
      return;
    }
    this.games.delete(gameId);
  }

  private async reconnect(gameId: string, id: string, socket: Socket) {
    let game = this.games.get(gameId);

    if (!game) {
      const gameData = await redis.get(`game:${gameId}`);
      if (gameData) {
        game = Game.fromJSON(gameData, (id: string) =>
          this.socketByUserId.get(id)
        );
        this.games.set(gameId, game);
      }
    }

    const playerSide =
      game?.player1.id === id ? game.player1.side : game?.player2.side;

    if (!playerSide) return;

    socket.emit(RECONNECT, {
      payload: {
        fen: game?.board.fen(),
        side: playerSide,
      },
    });
  }

  private addHandler({ id, socket }: { id: string; socket: Socket }) {
    socket.on(INIT_GAME, async () => {
      const pendingId = await redis.rpop("pendingPlayer");

      if (!pendingId) {
        await redis.lpush("pendingPlayer", id);
        return;
      }

      const pendingSocket = this.socketByUserId.get(pendingId);

      if (!pendingSocket) {
        await redis.lpush("pendingPlayer", id);
        return;
      }

      const game = new Game(
        { id: pendingId, socket: pendingSocket },
        { id, socket }
      );
      game.createGameHandler();

      await Promise.all([
        redis.set(`game:${game.gameId}`, JSON.stringify(game.toJSON())),
        redis.hset(`activePlayer:${id}`, { gameId: game.gameId }),
        redis.hset(`activePlayer:${pendingId}`, {
          gameId: game.gameId,
        }),
      ]);

      this.games.set(game.gameId, game);
    });

    socket.on(MOVE, async (data) => {
      const { gameId } = await redis.hgetall(`activePlayer:${id}`);
      let game = this.games.get(gameId);

      if (!game) {
        const gameData = await redis.get(`game:${gameId}`);
        if (gameData) {
          game = Game.fromJSON(gameData, (id: string) =>
            this.socketByUserId.get(id)
          );
          this.games.set(gameId, game);
        }
      }

      if (game) {
        const moveResult = game.makeMove(data.payload.move);

        if (moveResult) {
          await redis.set(`game:${game.gameId}`, JSON.stringify(game.toJSON()));
        }
      }
    });
  }
}
