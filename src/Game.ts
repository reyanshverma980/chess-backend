import { Chess, Square } from "chess.js";
import { GAME_OVER, INIT_GAME, MOVE } from "./messages.js";
import { randomUUID } from "crypto";
import { Server, Socket } from "socket.io";
import { redis } from "./config/redis.js";

type PromotionPieceOption =
  | "wQ"
  | "wR"
  | "wN"
  | "wB"
  | "bQ"
  | "bR"
  | "bN"
  | "bB";

type Player = {
  id: string;
  side: Side;
};

enum Side {
  WHITE = "white",
  BLACK = "black",
}

enum Status {
  Active = "active",
  Over = "over",
}

interface GameData {
  gameId: string;
  player1: { id: string; side: Side };
  player2: { id: string; side: Side };
  fen: string;
  status: Status;
}

export class Game {
  public gameId: string;
  public player1: Player;
  public player2: Player;
  public board: Chess;
  private status: Status;

  private io: Server;

  constructor(
    io: Server,
    player1: {
      id: string;
      side?: Side;
    },
    player2: {
      id: string;
      side?: Side;
    },
    gameId?: string
  ) {
    this.io = io;
    this.player1 = {
      id: player1.id,
      side: player1.side ?? (Math.random() < 0.5 ? Side.WHITE : Side.BLACK),
    };
    this.player2 = {
      id: player2.id,
      side:
        player2.side ??
        (this.player1.side === Side.WHITE ? Side.BLACK : Side.WHITE),
    };
    this.board = new Chess();
    this.status = Status.Active;
    this.gameId = gameId ?? randomUUID();
  }

  toJSON(): GameData {
    return {
      gameId: this.gameId,
      player1: { id: this.player1.id, side: this.player1.side },
      player2: { id: this.player2.id, side: this.player2.side },
      fen: this.board.fen(),
      status: this.status,
    };
  }

  static fromJSON(data: string, io: Server) {
    const parsed: GameData = JSON.parse(data);

    const player1 = {
      id: parsed.player1.id,
      side: parsed.player1.side,
    };
    const player2 = {
      id: parsed.player2.id,
      side: parsed.player2.side,
    };

    const game = new Game(io, player1, player2, parsed.gameId);
    game.board.load(parsed.fen);
    game.status = parsed.status;

    return game;
  }

  private async getSocketIdById(id: string) {
    const { socketId } = await redis.hgetall(`activePlayer:${id}`);
    return socketId;
  }

  async createGameHandler() {
    const player1SocketId = await this.getSocketIdById(this.player1.id);
    const player2SocketId = await this.getSocketIdById(this.player2.id);

    this.io.to(player1SocketId).emit(INIT_GAME, {
      payload: {
        side: this.player1.side,
        gameId: this.gameId,
      },
    });

    this.io.to(player2SocketId).emit(INIT_GAME, {
      payload: {
        side: this.player2.side,
        gameId: this.gameId,
      },
    });
  }

  async makeMove(
    move: {
      from: Square;
      to: Square;
      promotion?: PromotionPieceOption;
    },
    moverSocket: Socket
  ) {
    let moveResult;
    try {
      moveResult = this.board.move(move);
    } catch (error) {
      console.log(error);
      return;
    }

    moverSocket.to(this.gameId).emit(MOVE, { payload: { move } });

    if (this.board.isGameOver()) {
      const result = this.board.isCheckmate()
        ? this.board.turn() === "b"
          ? "white"
          : "black"
        : "draw";

      this.status = Status.Over;

      this.io.to(this.gameId).emit(GAME_OVER, {
        payload: {
          result,
        },
      });

      await Promise.all([
        redis.del(`game:${this.gameId}`),
        redis.hdel(`activePlayer:${this.player1.id}`, "gameId"),
        redis.hdel(`activePlayer:${this.player2.id}`, "gameId"),
      ]);
    }

    return moveResult;
  }
}
