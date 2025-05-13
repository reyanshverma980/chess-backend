import { Chess, Square } from "chess.js";
import { GAME_OVER, INIT_GAME, MOVE } from "./messages.js";
import { randomUUID } from "crypto";
import { Socket } from "socket.io";

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
  socket: Socket;
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

  constructor(
    player1: {
      id: string;
      socket: Socket;
      side?: Side;
    },
    player2: {
      id: string;
      socket: Socket;
      side?: Side;
    },
    gameId?: string
  ) {
    this.player1 = {
      ...player1,
      side: player1.side ?? (Math.random() < 0.5 ? Side.WHITE : Side.BLACK),
    };
    this.player2 = {
      ...player2,
      side:
        player2.side ??
        (this.player1.side === Side.WHITE ? Side.BLACK : Side.WHITE),
    };
    this.board = new Chess();
    this.gameId = gameId ?? randomUUID();
    this.status = Status.Active;
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

  static fromJSON(
    data: string,
    getSocketById: (id: string) => Socket | undefined
  ) {
    const parsed: GameData = JSON.parse(data);

    const socket1 = getSocketById(parsed.player1.id);
    const socket2 = getSocketById(parsed.player2.id);

    if (!socket1 || !socket2) {
      throw new Error("Missing socket for one or both players");
    }

    const player1 = {
      id: parsed.player1.id,
      socket: socket1,
      side: parsed.player1.side,
    };
    const player2 = {
      id: parsed.player2.id,
      socket: socket2,
      side: parsed.player2.side,
    };

    const game = new Game(player1, player2, parsed.gameId);
    game.board.load(parsed.fen);
    game.status = parsed.status;

    return game;
  }

  createGameHandler() {
    if (this.player1) {
      this.player1.socket.emit(INIT_GAME, {
        payload: {
          side: this.player1.side,
          gameId: this.gameId,
        },
      });
    }

    if (this.player2) {
      this.player2.socket.emit(INIT_GAME, {
        payload: {
          side: this.player2.side,
          gameId: this.gameId,
        },
      });
    }
  }

  makeMove(move: {
    from: Square;
    to: Square;
    promotion?: PromotionPieceOption;
  }) {
    let moveResult;
    try {
      moveResult = this.board.move(move);
    } catch (error) {
      console.log(error);
      return;
    }

    if (this.board.turn() === this.player1.side[0]) {
      this.player1.socket.emit(MOVE, { payload: { move } });
    } else {
      this.player2.socket.emit(MOVE, { payload: { move } });
    }

    if (this.board.isGameOver()) {
      const result = this.board.isCheckmate()
        ? this.board.turn() === "b"
          ? "white"
          : "black"
        : "draw";

      this.player1.socket.emit(GAME_OVER, {
        payload: {
          result,
        },
      });

      this.player2.socket.emit(GAME_OVER, {
        payload: {
          result,
        },
      });
    }

    return moveResult;
  }
}
