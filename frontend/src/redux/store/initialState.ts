import { IAppState } from './types';
import { UserType } from '../auth/types';

const initialState: IAppState = {
  menu: {
    showOverview: false,
    menuOpen: false,
    anchorEl: null,
    menuSelectedPage: null,
  },
  auth: {
    isAuthenticated: false,
    userType: UserType.Unknown,
    JWT: null,
    userId: null,
    userName: null,
    email: null,
  },
  websockets: {
    isConnected: false,
    isAppVisible: true,
    connectionsAndUsernames: [],
    showConnections: false,
    lastConnectionsTimestamp: '',
    lastConnectionsTimestampISO: '',
  },
  crud: {
    createCommand: null,
    readCommand: null,
    updateCommand: null,
    deleteCommand: null,
  },
  apartments: {
    apartments: [],
    currentApartmentId: null,
    noApartmentsNotified: false,
    showApartmentForm: false,
    apartmentForm: {
      id: '',
      address: '',
      unit_number: '',
      rooms_count: 0,
      rent_amount: 0,
      is_disabled: false,
      errors: {},
    },
  },
  apartmentActivity: {
    activity: {},
  },
  // analyticsData: [],
  users: {
    list: [],
    loading: false,
    error: null,
  },
  documents: {
    documents: [],
    loading: false,
    error: null,
    selectedDocument: null,
  },
};

export default initialState;
