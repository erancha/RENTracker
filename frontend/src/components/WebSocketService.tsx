import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators, Dispatch } from 'redux';
import { IAppState } from '../redux/store/types';
import { ICreateCommand, IReadCommand, IUpdateCommand, IDeleteCommand, CommandType } from '../redux/crud/types';
import { IApartment, IUpdateApartmentParams } from '../redux/apartments/types';
import { IReadApartmentActivityParams } from '../redux/apartmentActivity/types';
import { IReadAnalyticsParams } from '../redux/analytics/types';
import { setMenuSelectedPageAction, toggleMenuAction } from '../redux/menu/actions';
import { setUserTypeAction, logoutUserAction, loginWithGoogleAction } from '../redux/auth/actions';
import { setWSConnectedAction, setAppVisibleAction, setConnectionsAndUsernamesAction, toggleConnectionsAction } from '../redux/websockets/actions';
import {
  addApartmentAction,
  setApartmentsAction,
  setCurrentApartmentAction,
  setApartmentStateAction,
  deleteApartmentAction,
  setApartmentConfirmedByBackendAction,
} from '../redux/apartments/actions';
import { setApartmentActivityAction, addApartmentActivityAction, setApartmentActivityConfirmedByBackendAction } from '../redux/apartmentActivity/actions';
import appConfigData from '../appConfig.json';
import { Network } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { IConnectionAndUsername } from 'redux/websockets/types';
import { UserType } from '../redux/auth/types';

class WebSocketService extends React.Component<IWebSocketProps, WebSocketState> {
  private webSocket: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private reconnectAttempts = 0;
  private reconnectDelay = 1000;

  constructor(props: IWebSocketProps) {
    super(props);
    this.state = {
      previousAnalyticsType: null,
    };
  }

  async componentDidMount() {
    try {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    } catch (err) {
      console.error('Error initializing WebSocket service:', err);
      this.props.setWSConnectedAction(false);
    }
  }

  // Handle change from hidden to visible:
  handleVisibilityChange = () => {
    const { setAppVisibleAction } = this.props;

    setAppVisibleAction(document.visibilityState === 'visible');
  };

  componentDidUpdate(prevProps: IWebSocketProps) {
    const { isWsConnected, JWT, isAppVisible, menuSelectedPage } = this.props;
    const { previousAnalyticsType } = this.state;

    // console.log(
    //   `isWsConnected: ${isWsConnected} (prev: ${prevProps.isWsConnected}), jwt: ${JWT?.substring(0, 10)}... (prev: ${prevProps.JWT?.substring(
    //     0,
    //     10
    //   )}...), isAppVisible: ${isAppVisible} (prev: ${prevProps.isAppVisible}), menuSelectedPage: ${menuSelectedPage} (prev: ${prevProps.menuSelectedPage})`
    // );

    if (!isWsConnected && JWT && isAppVisible) {
      // console.log('--> this.connect()');
      this.connect();

      // When reconnecting, set the analytics type to the previous one if it exists
      if (previousAnalyticsType) setTimeout(() => this.props.setMenuSelectedPageAction(previousAnalyticsType), 5000); //TODO: Look into this again - without setTimeout the client opens several connections !
    } else if (!isAppVisible && prevProps.isAppVisible) {
      this.setState({ previousAnalyticsType: menuSelectedPage });
      // Store the current analytics type before disconnecting
      if (menuSelectedPage) this.props.setMenuSelectedPageAction(null); // to trigger a refresh on reconnection.

      // console.log('--> this.disconnect()');
      this.disconnect();
    }

    this.compareAndUpload(prevProps);
  }

  // Compare the current props with the previous props, and upload to the backend via the websocket when applicable.
  private compareAndUpload(prevProps: IWebSocketProps) {
    const { createCommand, readCommand, updateCommand, deleteCommand } = this.props;

    const upload = (data: any) => {
      try {
        this.webSocket?.send(JSON.stringify({ action: 'CommandsHandlerKey', data }));
      } catch (error) {
        toast.error(`Failed to send a message to the websocket server: ${error}`);
      }
    };

    // CRUD: Commands to Create data:
    //-----------------------------------------
    if (createCommand && createCommand !== prevProps.createCommand) {
      switch (createCommand.type) {
        case 'apartments' as CommandType:
          upload({ command: { type: 'create', params: { apartments: createCommand.params } } });
          break;
        case 'apartmentActivity' as CommandType:
          upload({ command: { type: 'create', params: { activity: createCommand.params } } });
          break;
      }
    }

    // CRUD: Commands to Read data:
    //-----------------------------------------
    if (readCommand && readCommand !== prevProps.readCommand) {
      switch (readCommand.type) {
        case 'apartmentActivity' as CommandType:
          const activityParams = readCommand.params as IReadApartmentActivityParams;
          upload({ command: { type: 'read', params: { activity: { apartment_id: activityParams.apartment_id } } } });
          break;
        case 'analytics':
          const analyticsParams = readCommand.params as IReadAnalyticsParams;
          upload({ command: { type: 'read', params: { menuSelectedPage: analyticsParams.menuSelectedPage } } });
          break;
      }
    }

    // CRUD: Commands to Update data:
    //-----------------------------------------
    if (updateCommand && updateCommand !== prevProps.updateCommand) {
      switch (updateCommand.type) {
        case 'apartments' as CommandType: {
          const updateApartmentParams = updateCommand.params as IUpdateApartmentParams;
          upload({
            command: {
              type: 'update',
              params: { apartments: updateApartmentParams },
            },
          });
          break;
        }
        default: {
          console.warn(`Unknown update command type: ${updateCommand.type}`);
          break;
        }
      }
    }

    // CRUD: Commands to Delete data:
    //-----------------------------------------
    if (deleteCommand && deleteCommand !== prevProps.deleteCommand) {
      switch (deleteCommand.type) {
        case 'apartments' as CommandType: {
          upload({
            command: {
              type: 'delete',
              params: { apartments: { apartment_id: deleteCommand.params.apartment_id } },
            },
          });
          break;
        }
        case 'apartmentActivity' as CommandType: {
          upload({
            command: {
              type: 'delete',
              params: { activity: { activity_id: deleteCommand.params.activity_id } },
            },
          });
          break;
        }
        default: {
          console.warn(`Unknown delete command type: ${deleteCommand.type}`);
          break;
        }
      }
    }
  }

  componentWillUnmount() {
    this.disconnect();
  }

  // Component's rendering function:
  render() {
    const { isWsConnected, showConnections, connectionsAndUsernames, lastConnectionsTimestamp } = this.props;

    return (
      <div
        className='network-container'
        title={isWsConnected ? `Connected, last connections update on ${lastConnectionsTimestamp}` : 'Disconnected'}
        onClick={() => this.props.toggleConnectionsAction(!showConnections)}>
        <div className='left-column'>
          <Network size={20} className={`network-icon ${isWsConnected ? 'connected' : 'disconnected'}`} />
          <span className='last-connections-timestamp'>{lastConnectionsTimestamp}</span>
        </div>
        <ul className='right-column'>
          {showConnections &&
            connectionsAndUsernames &&
            connectionsAndUsernames.map((item: IConnectionAndUsername) => (
              <li key={item.connectionId} className='username'>
                {item.username}
              </li>
            ))}
        </ul>
      </div>
    );
  }

  // Open a connection to the backend's websocket api:
  private async connect(): Promise<void> {
    const { JWT } = this.props;

    // Reset the previous connection (if open):
    this.disconnect();

    // Introduce a delay of 100 milliseconds before proceeding with the next line of code
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Open the new connection:
    const url = `${appConfigData.WEBSOCKET_API_URL}?token=${JWT}`;
    // console.log(`Creating WebSocket connection with URL: ${url}`);
    this.webSocket = new WebSocket(url);

    this.webSocket.onopen = () => {
      console.log('** WebSocket connection opened **');
      this.props.setWSConnectedAction(true);
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    };

    this.webSocket.onclose = (event) => {
      console.log(`** WebSocket connection closed **: ${JSON.stringify(event)}`);

      if (event.code === 1006 && this.props.isAppVisible && ++this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        console.log(`Attempting to reconnect in ${this.reconnectDelay / 1000} seconds...`);
        this.reconnectTimeout = setTimeout(() => {
          this.reconnectDelay *= 2;
          this.props.setWSConnectedAction(false);
        }, this.reconnectDelay);
      } else {
        // console.warn('Maximum reconnection attempts reached or manual closure.');
      }
    };

    this.webSocket.onmessage = (event) => {
      this.handleWebsocketIncomingEvent(event.data);
    };

    this.webSocket.onerror = (error) => {
      console.error('** WebSocket error: **', error);
      this.props.setWSConnectedAction(false);

      // Trigger re-authentication flow through Menu component
      window.dispatchEvent(new Event('websocket-session-error'));
    };
  }

  // Close the connection to the backend's websocket api:
  private disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
      this.props.setWSConnectedAction(false);
    }
  }

  // Main handler for incoming WebSocket messages
  private handleWebsocketIncomingEvent(eventData: string) {
    const parsedEventData = JSON.parse(eventData);
    if (parsedEventData.userType) {
      this.props.setUserTypeAction(parsedEventData.userType);
      if (parsedEventData.userType === UserType.Admin) this.props.toggleConnectionsAction(true);
    }

    // CRUD: event containing Created data
    if (parsedEventData.dataCreated) {
      this.handleDataCreated(parsedEventData.dataCreated);
    }
    // CRUD: event containing Read data
    else if (parsedEventData.dataRead) {
      this.handleDataRead(parsedEventData.dataRead);
      if (parsedEventData.dataRead.apartments) this.handleIncomingConnectionsAndUsernames(parsedEventData.connectionsAndUsernames);
    }
    // CRUD: event containing Updated data
    else if (parsedEventData.dataUpdated) {
      this.handleDataUpdated(parsedEventData.dataUpdated);
    }
    // CRUD: event containing Deleted data
    else if (parsedEventData.dataDeleted) {
      this.handleDataDeleted(parsedEventData.dataDeleted);
    } else if (parsedEventData.connectionsAndUsernames) {
      this.handleIncomingConnectionsAndUsernames(parsedEventData.connectionsAndUsernames);
    } else if (parsedEventData.pong) {
      this.handleIncomingConnectionsAndUsernames(null); // only updates lastConnectionsTimestamp*
    } else if (parsedEventData.dbAccess?.MAX_TIME_TO_WAIT_FOR_DB_OPERATION_MS) {
      toast.error('The database is temporarily unavailable. Please contact webcharm.tech@gmail.com to start the database.', { autoClose: 20000 });
    } else {
      console.warn(eventData.substring(0, 500));
    }
  }

  // CRUD: event containing Created data
  private handleDataCreated(dataCreated: any) {
    if (dataCreated.apartments) {
      const newReceivedApartment: IApartment = { ...dataCreated.apartments };
      const isNewApartment = !this.props.apartments.find((apartment) => apartment.apartment_id === newReceivedApartment.apartment_id);
      if (isNewApartment) this.props.addApartmentAction({ ...newReceivedApartment });
      else this.props.setApartmentConfirmedByBackendAction(newReceivedApartment.apartment_id, newReceivedApartment.updated_at as string);
      // toast(`New apartment ${dataCreated.apartments.apartment_id} is pending confirmation`, { autoClose: this.props.isLandlord ? 10000 : 5000 });
    } else if (dataCreated.activity) {
      const newReceivedActivity = dataCreated.activity;
      const isNewActivity = !this.props.activity.find((activity) => activity.activity_id === newReceivedActivity.activity_id);
      if (isNewActivity) this.props.addApartmentActivityAction({ ...newReceivedActivity });
      else this.props.setApartmentActivityConfirmedByBackendAction(newReceivedActivity.activity_id);
    }
  }

  // CRUD: event containing Read data
  private handleDataRead(dataRead: any) {
    if (dataRead.apartments) this.props.setApartmentsAction(dataRead.apartments);
    if (dataRead.activity) this.props.setApartmentActivityAction(dataRead.activity);
  }

  // CRUD: event containing Updated data
  private handleDataUpdated(dataUpdated: any) {
    if (dataUpdated.apartments) {
      this.props.setApartmentStateAction(dataUpdated.apartments);
      this.props.setApartmentConfirmedByBackendAction(dataUpdated.apartments.apartment_id, dataUpdated.apartments.updated_at as string);
      if (!dataUpdated.apartments.is_disabled) this.props.setCurrentApartmentAction(dataUpdated.apartments.apartment_id);
    }
  }

  // CRUD: event containing Deleted data
  private handleDataDeleted(dataDeleted: any) {
    if (dataDeleted.apartments) {
      this.props.deleteApartmentAction(dataDeleted.apartments.apartment_id);
      toast(`Apartment ${dataDeleted.apartments.apartment_id} was deleted.`);
    }
  }

  // Sets the connections and usernames in the state
  private handleIncomingConnectionsAndUsernames(connections: IConnectionAndUsername[] | null) {
    this.props.setConnectionsAndUsernamesAction(connections);
    // Show the current connections whenever the backend informs this frontend about a change in the connected users:
    if (connections && this.props.userType === UserType.Admin) this.props.toggleConnectionsAction(true);
  }
}

interface IWebSocketProps {
  JWT: string | null;
  userType: UserType;
  setUserTypeAction: typeof setUserTypeAction;
  logoutUserAction: typeof logoutUserAction;
  loginWithGoogleAction: typeof loginWithGoogleAction;
  userId: string | null;
  isWsConnected: boolean;
  setWSConnectedAction: typeof setWSConnectedAction;
  isAppVisible: boolean;
  setAppVisibleAction: typeof setAppVisibleAction;
  connectionsAndUsernames: IConnectionAndUsername[];
  setConnectionsAndUsernamesAction: typeof setConnectionsAndUsernamesAction;
  showConnections: boolean;
  toggleConnectionsAction: typeof toggleConnectionsAction;
  lastConnectionsTimestamp: string;
  lastConnectionsTimestampISO: string;
  addApartmentAction: typeof addApartmentAction;
  createCommand: ICreateCommand | null;
  readCommand: IReadCommand | null;
  updateCommand: IUpdateCommand | null;
  deleteCommand: IDeleteCommand | null;
  apartments: IApartment[];
  setApartmentsAction: typeof setApartmentsAction;
  setCurrentApartmentAction: typeof setCurrentApartmentAction;
  setApartmentStateAction: typeof setApartmentStateAction;
  deleteApartmentAction: typeof deleteApartmentAction;
  setApartmentConfirmedByBackendAction: typeof setApartmentConfirmedByBackendAction;
  addApartmentActivityAction: typeof addApartmentActivityAction;
  setApartmentActivityAction: typeof setApartmentActivityAction;
  setApartmentActivityConfirmedByBackendAction: typeof setApartmentActivityConfirmedByBackendAction;
  activity: any[];
  menuSelectedPage: string | null;
  setMenuSelectedPageAction: typeof setMenuSelectedPageAction;
  currentApartmentId: string | null;
  toggleMenuAction: typeof toggleMenuAction;
}

interface WebSocketState {
  previousAnalyticsType: string | null;
}

// Maps required state from Redux store to component props
const mapStateToProps = (state: IAppState) => ({
  JWT: state.auth.JWT,
  userType: state.auth.userType,
  userId: state.auth.userId,
  isWsConnected: state.websockets.isConnected,
  isAppVisible: state.websockets.isAppVisible,
  connectionsAndUsernames: state.websockets.connectionsAndUsernames,
  showConnections: state.websockets.showConnections,
  lastConnectionsTimestamp: state.websockets.lastConnectionsTimestamp,
  lastConnectionsTimestampISO: state.websockets.lastConnectionsTimestampISO,
  createCommand: state.crud.createCommand,
  readCommand: state.crud.readCommand,
  updateCommand: state.crud.updateCommand,
  deleteCommand: state.crud.deleteCommand,
  apartments: state.apartments.apartments,
  currentApartmentId: state.apartments.currentApartmentId,
  activity: state.apartmentActivity.activity,
  menuSelectedPage: state.menu.menuSelectedPage, // TODO
});

// Map Redux actions to component props
const mapDispatchToProps = (dispatch: Dispatch) =>
  bindActionCreators(
    {
      setWSConnectedAction,
      setAppVisibleAction,
      setConnectionsAndUsernamesAction,
      toggleConnectionsAction,
      setApartmentsAction,
      setCurrentApartmentAction,
      addApartmentAction,
      setApartmentStateAction,
      deleteApartmentAction,
      setApartmentConfirmedByBackendAction,
      addApartmentActivityAction,
      setApartmentActivityAction,
      setApartmentActivityConfirmedByBackendAction,
      setUserTypeAction,
      logoutUserAction,
      loginWithGoogleAction,
      setMenuSelectedPageAction,
      toggleMenuAction,
    },
    dispatch
  );

export default connect(mapStateToProps, mapDispatchToProps)(WebSocketService);
