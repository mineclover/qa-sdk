type CloseReason = string;

export interface ManagedStreamConnection {
  close: (reason: CloseReason) => void | Promise<void>;
}

export interface StreamConnectionRegistry {
  getConnectionCount(): number;
  isShuttingDown(): boolean;
  register(connection: ManagedStreamConnection): (() => void) | null;
  shutdown(reason?: CloseReason): Promise<void>;
}

export function createStreamConnectionRegistry(): StreamConnectionRegistry {
  let shuttingDown = false;
  let shutdownPromise: Promise<void> | null = null;
  const connections = new Set<ManagedStreamConnection>();

  return {
    getConnectionCount() {
      return connections.size;
    },
    isShuttingDown() {
      return shuttingDown;
    },
    register(connection) {
      if (shuttingDown) {
        return null;
      }

      connections.add(connection);
      let released = false;

      return () => {
        if (released) {
          return;
        }

        released = true;
        connections.delete(connection);
      };
    },
    shutdown(reason = "server_shutdown") {
      if (shutdownPromise) {
        return shutdownPromise;
      }

      shuttingDown = true;
      const activeConnections = Array.from(connections);
      connections.clear();

      shutdownPromise = Promise.allSettled(
        activeConnections.map(async (connection) => {
          try {
            await connection.close(reason);
          } catch {
            // Shutdown should continue even if a client socket is already gone.
          }
        }),
      ).then(() => {});

      return shutdownPromise;
    },
  };
}
