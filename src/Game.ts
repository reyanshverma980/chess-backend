import { WebSocket } from "ws";
import { Chess, Square } from "chess.js";
import { GAME_OVER, INIT_GAME, MOVE } from "./messages.js";
import { randomUUID } from "crypto";

export class Game {
  public gameId: string;
  public player1: { id: string; socket: WebSocket };
  public player2: { id: string; socket: WebSocket };
  private board: Chess;

  constructor(
    player1: { id: string; socket: WebSocket },
    player2: { id: string; socket: WebSocket }
  ) {
    this.player1 = player1;
    this.player2 = player2;
    this.board = new Chess();
    this.gameId = randomUUID();
  }

  async createGameHandler() {
    // add game to db

    if (this.player1) {
      this.player1.socket.send(
        JSON.stringify({
          type: INIT_GAME,
          payload: {
            color: "white",
            gameId: this.gameId,
          },
        })
      );
    }

    if (this.player2) {
      this.player2.socket.send(
        JSON.stringify({
          type: INIT_GAME,
          payload: {
            color: "black",
            gameId: this.gameId,
          },
        })
      );
    }
  }

  makeMove(move: { from: Square; to: Square }) {
    try {
      this.board.move(move);
    } catch (error) {
      console.log(error);
      return;
    }

    // add move to db

    if (this.board.turn() === "w") {
      this.player1.socket.send(
        JSON.stringify({
          type: MOVE,
          payload: { move },
        })
      );
    } else {
      this.player2.socket.send(
        JSON.stringify({
          type: MOVE,
          payload: { move },
        })
      );
    }

    if (this.board.isGameOver()) {
      const result = this.board.isCheckmate()
        ? this.board.turn() === "b"
          ? "white"
          : "black"
        : "draw";

      this.player1.socket.send(
        JSON.stringify({
          type: GAME_OVER,
          payload: {
            result,
          },
        })
      );

      this.player2.socket.send(
        JSON.stringify({
          type: GAME_OVER,
          payload: {
            result,
          },
        })
      );
      return;
    }
  }
}
