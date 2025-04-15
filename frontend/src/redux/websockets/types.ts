export interface IWebsocketsState {
  isConnected: boolean;
  isAppVisible: boolean;
  connectionsAndUsernames: IConnectionAndUsername[];
  showConnections: boolean;
  lastConnectionsTimestamp: string;
  lastConnectionsTimestampISO: string;
}

export interface IConnectionAndUsername {
  connectionId: string;
  username: string | null;
}
