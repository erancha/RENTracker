import React from 'react';
import { bindActionCreators, Dispatch } from 'redux';
import { Provider, connect } from 'react-redux';
import { withTranslation } from 'react-i18next';
import type { i18n } from 'i18next';
import { FirstTimeLanding } from './components/FirstTimeLanding';
import store from './redux/store/store';
import { IAppState } from './redux/store/types';
import { loginWithGoogleAction, checkAuthStatusAction, setUserTypeAction } from './redux/auth/actions';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { toggleOverviewAction, setMenuSelectedPageAction } from './redux/menu/actions';
import Spinner from './components/Spinner';
import SaaSTenants from './components/SaaSTenants';
import Apartments from './components/Apartments';
import TenantDocumentList from './components/TenantDocumentList';
import Analytics from './components/Analytics';
import WebSocketService from './components/WebSocketService';
import Menu from './components/Menu';
import { ToastContainer } from 'react-toastify';
import { Undo2 } from 'lucide-react';
import { DOCUMENTS_VIEW, ANALYTICS_VIEW, SAAS_TENANTS_VIEW } from './redux/menu/types';
import { UserType } from './redux/auth/types';
import { IApartment } from './redux/apartments/types';
import { IDocument } from './redux/documents/types';

import appConfigData from './appConfig.json';
import 'react-toastify/dist/ReactToastify.css';

import { useTranslation } from 'react-i18next';
import './App.css';
import './i18n';
import LanguageSwitcher from 'components/LanguageSwitcher';

// Create the base component
class AppComponent extends React.Component<IAppProps, Record<string, never>> {
  private t = (key: string, options?: any) => {
    return this.props.t(key, options);
  };

  componentDidMount(): void {
    const { auth, checkAuthStatusAction } = this.props;
    checkAuthStatusAction(auth);

    window.addEventListener('beforeunload', this.handleBeforeUnload);

    setTimeout(() => {
      const { auth, toggleOverviewAction } = this.props;
      if (!auth.isAuthenticated) toggleOverviewAction(true);
    }, 8000);
  }

  componentDidUpdate(prevProps: Readonly<IAppProps>): void {
    // Redirect admin users to SaaS tenants view
    const { userType } = this.props;
    if (userType !== prevProps.userType && userType === UserType.Admin) this.props.setMenuSelectedPageAction(SAAS_TENANTS_VIEW);
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }

  handleBeforeUnload = () => {
    // event.preventDefault();
  };

  render() {
    const { auth, showConnections, t } = this.props;

    return (
      <div className='main-container'>
        <ToastContainer limit={3} pauseOnFocusLoss={false} />

        <div className='header-sticky-container'>
          <div className='header-container'>
            <div className='header-title-container'>
              <div className='header-title' title={t('welcome.subtitle')}>
                <span className='app-name'>RENTracker</span>
              </div>
              <img src='/favicon.ico' alt='Logo' width='32' height='32' />
              <span className='build'>{appConfigData.BUILD}</span>
              {auth.isAuthenticated && !showConnections && <WebSocketService />}
            </div>

            {showConnections && <WebSocketService />}

            <div className={`menu-container${auth.isAuthenticated ? ' authenticated' : ''}`}>
              <Menu />
            </div>
          </div>
        </div>

        {auth.isAuthenticated ? this.renderSelectedAuthenticatedView() : this.renderOverview()}
      </div>
    );
  }

  // Renders the selected page based on the menuSelectedPage prop
  private renderSelectedAuthenticatedView() {
    const { menuSelectedPage, setMenuSelectedPageAction, userType, t } = this.props;

    const switchToDefaultMenuSelectedPage = () => {
      setMenuSelectedPageAction(DOCUMENTS_VIEW);
    };

    return menuSelectedPage === SAAS_TENANTS_VIEW ? (
      <div className='saas-tenants-container'>
        <SaaSTenants onSave={switchToDefaultMenuSelectedPage} />
        {userType !== UserType.Pending && (
          <button onClick={switchToDefaultMenuSelectedPage} className='action-button cancel' title={t('common.back')}>
            <Undo2 />
          </button>
        )}
      </div>
    ) : menuSelectedPage === ANALYTICS_VIEW ? (
      <div className='analytics-container'>
        <Analytics />
        <button onClick={switchToDefaultMenuSelectedPage} className='action-button cancel' title={t('common.back')}>
          <Undo2 />
        </button>
      </div>
    ) : userType === UserType.Pending ? (
      <FirstTimeLanding userId={this.props.userId} setUserTypeAction={this.props.setUserTypeAction} setMenuSelectedPageAction={setMenuSelectedPageAction} />
    ) : userType === UserType.Tenant ? (
      <TenantDocumentList />
    ) : (
      userType === UserType.Landlord && <Apartments />
    );
  }

  // Renders the overview page
  private renderOverview() {
    const { menuOpen, showOverview, auth, loginWithGoogleAction, toggleOverviewAction } = this.props;

    return (
      <div className={`app-overview-container${menuOpen ? ' menu-is-opened' : ''}`}>
        <hr />
        <div className='header2'>
          <p>
            <span className='app-name'>RENTracker</span> {this.t('overview.description')}
          </p>
          <p className='subtext'>
            {this.t('overview.roles.title')} <span className='role'>{this.t('overview.roles.landlords')}</span> {this.t('overview.roles.landlordsDesc')},{' '}
            {this.t('common.and')}
            <span className='role'>{this.t('overview.roles.tenants')}</span> {this.t('overview.roles.tenantsDesc')}.
          </p>
          <span className='may-switch-language'>{this.t('overview.maySwitchLanguage')}</span>
          <LanguageSwitcher className='language-switcher' />
          <hr />
          <div className='signin'>
            <div>
              {this.t('overview.authDescription')} <span className='secure-authentication'>{this.t('overview.secureAuth')}</span>{' '}
              {this.t('overview.throughGoogle')}
            </div>
            <div className='text-link sign-in-from-overview draw-attention-during-overview' onClick={() => loginWithGoogleAction(auth)}>
              {this.t('auth.signIn')}
            </div>
          </div>

          <div className={`header3 ${showOverview ? 'visible' : 'hidden'}`}>
            {!showOverview && (
              <span>
                <span className='text-link toggle-overview' onClick={() => toggleOverviewAction(!showOverview)}>
                  {showOverview ? this.t('overview.showLess') : this.t('overview.showMore')}
                </span>
                ...
              </span>
            )}
            <ul>
              <li>{this.t('overview.techStack')}.</li>
              <li>{this.t('overview.saas')}.</li>
              <li>{this.t('overview.ui')}.</li>
              <li>
                <div className='link-container'>
                  {this.t('overview.additionalDetails')}:
                  <a href='https://github.com/erancha' target='_blank' rel='noopener noreferrer'>
                    GitHub
                  </a>
                  <a href='http://www.linkedin.com/in/eran-hachmon' target='_blank' rel='noopener noreferrer'>
                    LinkedIn
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className={`header2 more ${showOverview ? 'visible' : 'hidden'}`}>
          <p className='diagram-caption'>{this.t('overview.architecture')}</p>
          <a href='https://lucid.app/publicSegments/view/3c5a66a2-7a1d-4ca0-9c1b-f79361f76804/image.jpeg' target='_blank' rel='noopener noreferrer'>
            <img src='https://lucid.app/publicSegments/view/3c5a66a2-7a1d-4ca0-9c1b-f79361f76804/image.jpeg' alt='**API Gateway + Lambda**' />
          </a>
        </div>
      </div>
    );
  }
}

// Props for the base component
interface IAppProps {
  t: (key: string, options?: any) => string;
  i18n: i18n;
  menuOpen: boolean;
  showOverview: boolean;
  toggleOverviewAction: typeof toggleOverviewAction;
  menuSelectedPage: string | null;
  setMenuSelectedPageAction: typeof setMenuSelectedPageAction;
  checkAuthStatusAction: typeof checkAuthStatusAction;
  loginWithGoogleAction: typeof loginWithGoogleAction;
  setUserTypeAction: typeof setUserTypeAction;
  apartments: IApartment[];
  userId: string | null;
  userType: UserType | undefined;
  currentApartmentId: string | null;
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
  userId: state.auth.userId,
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
      setUserTypeAction,
    },
    dispatch
  );

// Connect the component to Redux
const ConnectedApp = withTranslation()(connect(mapStateToProps, mapDispatchToProps)(AppComponent));

// Create the root component that provides the store
export const App = () => {
  const auth = useAuth();
  const { i18n } = useTranslation();

  React.useEffect(() => {
    document.documentElement.dir = i18n.language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // render
  return auth.isLoading ? (
    <Spinner className='center-screen' />
  ) : (
    <Provider store={store}>
      <ConnectedApp auth={auth} />
    </Provider>
  );
};

export default App;
