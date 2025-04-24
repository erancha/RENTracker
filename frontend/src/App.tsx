import React from 'react';
import { bindActionCreators, Dispatch } from 'redux';
import { Provider, connect } from 'react-redux';
import store from './redux/store/store';
import { IAppState } from './redux/store/types';
import { loginWithGoogleAction, checkAuthStatusAction } from './redux/auth/actions';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { toggleOverviewAction, setMenuSelectedPageAction } from './redux/menu/actions';
import { createDocument, updateDocumentThunk, getDocumentThunk } from './redux/documents/thunks';
import Spinner from './components/Spinner';
import Apartments from './components/Apartments';
import Analytics from './components/Analytics';
import Users from './components/Users';
import WebSocketService from './components/WebSocketService';
import Menu from './components/Menu';
import appConfigData from './appConfig.json';
import { ToastContainer } from 'react-toastify';
import { Undo2 } from 'lucide-react';
import { DOCUMENTS_VIEW, ANALYTICS_VIEW, USERS_VIEW } from './redux/menu/types';
import { UserType } from './redux/auth/types';
import './App.css';
import { IApartment } from 'redux/apartments/types';
import TenantDocumentList from './components/TenantDocumentList';
import { IDocument } from 'redux/documents/types';

// Create the base component
class AppComponent extends React.Component<IAppProps> {
  async componentDidMount() {
    const { auth, checkAuthStatusAction } = this.props;
    checkAuthStatusAction(auth);

    window.addEventListener('beforeunload', this.handleBeforeUnload);

    setTimeout(() => {
      const { auth, toggleOverviewAction } = this.props;
      if (!auth.isAuthenticated) toggleOverviewAction(true);
    }, 12000);
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }

  handleBeforeUnload = () => {
    // event.preventDefault();
  };

  render() {
    const { auth, showConnections } = this.props;

    return (
      <div className='main-container'>
        <ToastContainer limit={3} pauseOnFocusLoss={false} />

        <div className='header-sticky-container'>
          <div className='header-container'>
            <div className='header-title-container'>
              <div className='header-title' title='AWS/React/WebSockets-based betting application.'>
                RENTracker
              </div>
              <img src='/favicon.ico' alt='Logo' width='32' height='32' />
              <span className='build'>{appConfigData.BUILD}</span>
              {auth.isAuthenticated && !showConnections && <WebSocketService />}
            </div>

            {auth.isAuthenticated && showConnections && <WebSocketService />}

            <div className={`menu-container${auth.isAuthenticated ? ' authenticated' : ''}`}>
              <Menu />
            </div>
          </div>
        </div>

        {auth.isAuthenticated ? this.renderMenuSelectedPage() : this.renderOverview()}
      </div>
    );
  }

  // Renders the selected page based on the menuSelectedPage prop
  private renderMenuSelectedPage() {
    const { menuSelectedPage, setMenuSelectedPageAction } = this.props;

    const handleUndo = () => {
      setMenuSelectedPageAction(DOCUMENTS_VIEW);
    };

    return menuSelectedPage === ANALYTICS_VIEW ? (
      <div className='chart-container'>
        <button onClick={handleUndo} className='action-button'>
          <Undo2 />
        </button>
        <Analytics />
      </div>
    ) : menuSelectedPage === USERS_VIEW ? (
      <div className='users-container'>
        <button onClick={handleUndo} className='action-button'>
          <Undo2 />
        </button>
        <Users />
      </div>
    ) : this.props.userType === UserType.Tenant ? (
      <TenantDocumentList />
    ) : (
      this.props.userType !== UserType.Unknown && <Apartments />
    );
  }

  // Renders the overview page
  private renderOverview() {
    const { menuOpen, showOverview, auth, loginWithGoogleAction, toggleOverviewAction } = this.props;

    return (
      <div className={`app-overview-container${menuOpen ? ' menu-is-opened' : ''}`}>
        <hr />
        <div className='header2'>
          <p>RENTracker is a property rent management app that streamlines rent agreements and activity (TBD).</p>
          <p>
            The app provides <span className='secure-authentication'>secure authentication</span> through Google:{' '}
            <span className='text-link sign-in-from-overview' onClick={() => loginWithGoogleAction(auth)}>
              Sign In
            </span>
          </p>
        </div>

        <div className={`header2 more ${showOverview ? 'visible' : 'hidden'}`}>
          {!showOverview && (
            <span>
              <span className='text-link toggle-overview' onClick={() => toggleOverviewAction(!showOverview)}>
                {`Show ${showOverview ? 'less' : 'more'}`}
              </span>
              ...
            </span>
          )}
          <ul>
            <li>
              The app supports two user roles: Landlords who manage properties, rental agreements, and financials (TBD), and Tenants who complete their details
              in the rental agreement, and manage their activity.
            </li>
            <li>The app is designed for scalability, utilizing serverless computing and storage, with global content delivery through CloudFront.</li>
            <li>
              It offers an intuitive, mobile-friendly UI/UX, and robust monitoring via AWS CloudWatch, built with AWS services, React, and WebSockets for
              real-time updates.
            </li>
          </ul>
          <div className='link-container'>
            <a href='http://www.linkedin.com/in/eran-hachmon' target='_blank' rel='noopener noreferrer'>
              LinkedIn
            </a>
            <a href='https://github.com/erancha' target='_blank' rel='noopener noreferrer'>
              GitHub
            </a>
          </div>

          <p className='diagram'>API Gateway + Lambda</p>
          <a href='https://lucid.app/publicSegments/view/11403d3e-caa3-4885-be91-b94764ebab83/image.jpeg' target='_blank' rel='noopener noreferrer'>
            <img src='https://lucid.app/publicSegments/view/11403d3e-caa3-4885-be91-b94764ebab83/image.jpeg' alt='**API Gateway + Lambda**' />
          </a>
        </div>
      </div>
    );
  }
}

// Props for the base component
interface IAppProps {
  menuOpen: boolean;
  showOverview: boolean;
  toggleOverviewAction: typeof toggleOverviewAction;
  menuSelectedPage: string | null;
  setMenuSelectedPageAction: typeof setMenuSelectedPageAction;
  checkAuthStatusAction: typeof checkAuthStatusAction;
  loginWithGoogleAction: typeof loginWithGoogleAction;
  apartments: IApartment[];
  userType: UserType;
  currentApartmentId: string | null;
  getDocumentThunk: typeof getDocumentThunk;
  createDocument: typeof createDocument;
  updateDocumentThunk: typeof updateDocumentThunk;
  selectedDocument: IDocument | null;
  JWT: string | null;
  auth: AuthContextProps;
  showConnections: boolean;
}

// Maps required state from Redux store to component props
const mapStateToProps = (state: IAppState) => ({
  menuOpen: state.menu.menuOpen,
  showOverview: state.menu.showOverview,
  menuSelectedPage: state.menu.menuSelectedPage,
  apartments: state.apartments.apartments,
  userType: state.auth.userType,
  currentApartmentId: state.apartments.currentApartmentId,
  JWT: state.auth.JWT,
  showConnections: state.websockets.showConnections,
  selectedDocument: state.documents.selectedDocument,
});

// Map Redux actions to component props
const mapDispatchToProps = (dispatch: Dispatch) =>
  bindActionCreators(
    {
      toggleOverviewAction,
      setMenuSelectedPageAction,
      checkAuthStatusAction,
      loginWithGoogleAction,
      getDocumentThunk,
      createDocument,
      updateDocumentThunk,
    },
    dispatch
  );

const ConnectedApp = connect(mapStateToProps, mapDispatchToProps)(AppComponent);

// Create the root component that provides the store
export const App = () => {
  const auth = useAuth();

  // render
  return auth.isLoading ? (
    <Spinner />
  ) : (
    <Provider store={store}>
      <ConnectedApp auth={auth} />
    </Provider>
  );
};

export default App;
