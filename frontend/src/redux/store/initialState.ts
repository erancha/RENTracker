import { UserType } from 'redux/auth/types';
import { IAppState } from './types';

const initialState: IAppState = {
  menu: {
    showOverview: false,
    menuOpen: false,
    anchorEl: null,
    menuSelectedPage: null,
  },
  auth: {
    isAuthenticated: false,
    userType: UserType.Initial,
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
      is_housing_unit: false,
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
  saasTenants: {
    saasTenants: [],
  },
  documents: {
    documents: [],
    loading: false,
    error: null,
    selectedDocument: null,
  },
};

export default initialState;
