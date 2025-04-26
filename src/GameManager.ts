import { WebSocket } from "ws";
import { Game } from "./Game.js";
import { INIT_GAME, MOVE, PLAYER_LEFT } from "./messages.js";

type Player = {
  id: string;
  socket: WebSocket;
};

export class GameManager {
  private games: Map<string, Game>;
  private players: Map<WebSocket, Player>;
  private guestPlayers: Map<WebSocket, Player>;
  private pendingPlayer: Player | null;
  private pendingGuest: Player | null;

  constructor() {
    this.games = new Map();
    this.players = new Map();
    this.guestPlayers = new Map();
    this.pendingPlayer = null;
    this.pendingGuest = null;
  }

  addUser(id: string, socket: WebSocket) {
    this.players.set(socket, { socket, id });
    this.addHandler({ id, socket });
  }

  addGuest(id: string, socket: WebSocket) {
    this.guestPlayers.set(socket, { id, socket });
    this.addHandlerGuest({ id, socket });
  }

  removeUser(socket: WebSocket) {
    if (!this.players.has(socket) && !this.guestPlayers.has(socket)) return;
    this.players.delete(socket);
    this.guestPlayers.delete(socket);

    if (this.pendingPlayer?.socket === socket) {
      this.pendingPlayer = null;
    }

    if (this.pendingGuest?.socket === socket) {
      this.pendingGuest = null;
    }

    // 🔍 Find and remove the game where the player was
    for (const [gameId, game] of this.games.entries()) {
      const { player1, player2 } = game;

      if (player1?.socket === socket) {
        player2?.socket.send(
          JSON.stringify({
            type: PLAYER_LEFT,
          })
        );
      } else if (player2?.socket === socket) {
        player1?.socket.send(
          JSON.stringify({
            type: PLAYER_LEFT,
          })
        );
      }

      // Delete the game immediately
      this.games.delete(gameId);
      break;
    }
  }

  private addHandler({ id, socket }: { id: string; socket: WebSocket }) {
    socket.on("message", async (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === INIT_GAME) {
        if (this.pendingPlayer) {
          // start the game
          const game = new Game(this.pendingPlayer, { id, socket });
          await game.createGameHandler();
          this.games.set(game.gameId, game);
          this.pendingPlayer = null;
        } else {
          this.pendingPlayer = { id, socket };
        }
      }

      if (message.type === MOVE) {
        let game: Game | undefined;
        for (const [gameId, currentGame] of this.games.entries()) {
          if (currentGame.player1.id === id || currentGame.player2.id === id) {
            game = currentGame;
            break;
          }
        }

        if (game) {
          game.makeMove(message.payload.move);
        }
      }
    });
  }

  private addHandlerGuest({ id, socket }: { id: string; socket: WebSocket }) {
    socket.on("message", async (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === INIT_GAME) {
        if (this.pendingGuest) {
          // Start guest vs guest game
          const game = new Game(this.pendingGuest, { id, socket });
          await game.createGameHandler();
          this.games.set(game.gameId, game);
          this.pendingGuest = null;
        } else {
          this.pendingGuest = { id, socket };
        }
      }

      if (message.type === MOVE) {
        let game: Game | undefined;
        for (const [gameId, currentGame] of this.games.entries()) {
          if (currentGame.player1.id === id || currentGame.player2.id === id) {
            game = currentGame;
            break;
          }
        }

        if (game) {
          game.makeMove(message.payload.move);
        }
      }
    });
  }
}
