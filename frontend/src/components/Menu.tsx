import React from 'react';
import { bindActionCreators, Dispatch } from 'redux';
import { connect } from 'react-redux';
import { IAppState } from '../redux/store/types';
import { SAAS_TENANTS_VIEW, ANALYTICS_VIEW } from '../redux/menu/types';
import { toggleMenuAction, setAnchorElAction, setMenuSelectedPageAction } from '../redux/menu/actions';
import { loginWithGoogleAction, checkAuthStatusAction, logoutUserAction } from '../redux/auth/actions';
import { UserType } from '../redux/auth/types';
import { Button, Menu as MuiMenu, MenuItem, Typography, ListItemIcon } from '@mui/material';
import { UserCircle, LogIn, ChartNoAxesCombined } from 'lucide-react';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { toast } from 'react-toastify';

// Wraps the connected menu component with auth context
const MenuWrapper = (props: IMenuProps) => {
  const auth = useAuth();
  return <ConnectedMenu {...props} auth={auth} />;
};

interface ConnectedMenuProps extends IMenuProps {
  auth: AuthContextProps;
}

const WEBSOCKETS_SESSION_ERROR_EVENT_NAME = 'websocket-session-error';

class ConnectedMenu extends React.Component<ConnectedMenuProps> {
  private buttonRef = React.createRef<HTMLButtonElement>();

  componentWillUnmount() {
    // Clean up event listener
    window.removeEventListener(WEBSOCKETS_SESSION_ERROR_EVENT_NAME, () => {});
  }

  // Updates auth status check when authentication state changes
  componentDidUpdate(prevProps: IMenuProps) {
    if (prevProps.isAuthenticated !== this.props.isAuthenticated) {
      this.props.checkAuthStatusAction(this.props.auth);

      // TODO: Verify that the listener is never registered more than once
      window.addEventListener(WEBSOCKETS_SESSION_ERROR_EVENT_NAME, () => {
        if (this.props.isAuthenticated) {
          toast.error(
            this.props.JWT && !this.isValidJWT(this.props.JWT)
              ? 'Your session has expired. Please sign in again.'
              : 'Connection error. Attempting to reconnect...'
          );
          setTimeout(() => {
            this.props.logoutUserAction(this.props.auth);
            this.props.loginWithGoogleAction(this.props.auth);
          }, 5000);
        }
      });
    }
  }

  // Helper method to check JWT validity
  private isValidJWT(token: string): boolean {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const { exp } = JSON.parse(jsonPayload);
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      return exp > currentTimeInSeconds;
    } catch (error) {
      console.error('Error parsing JWT:', error);
      return false;
    }
  }

  // Handles main menu button click event
  handleMenuTriggerClick = (event: React.MouseEvent<HTMLElement>) => {
    this.props.toggleMenuAction(!this.props.menuOpen);
    this.props.setAnchorElAction(event.currentTarget);
  };

  // Closes all menus and resets anchor elements
  handleMenuClose = () => {
    this.props.toggleMenuAction(false);
    this.props.setAnchorElAction(null);
  };

  // Renders the complete menu UI with all submenus and authentication options
  render() {
    const { auth, menuOpen, anchorEl, isAuthenticated, userType } = this.props;

    return (
      <div className='menu-trigger'>
        <Button
          ref={this.buttonRef}
          aria-controls={menuOpen ? 'menu' : undefined}
          aria-haspopup='true'
          aria-expanded={menuOpen ? 'true' : undefined}
          onClick={this.handleMenuTriggerClick}
        >
          <div className='icon' title={isAuthenticated ? auth.user?.profile.name : ''}>
            <div className='icon-line'></div>
            <div className='icon-line'></div>
            <div className='icon-line'></div>
          </div>
        </Button>
        <MuiMenu anchorEl={anchorEl ? anchorEl : this.buttonRef.current} open={menuOpen} onClose={this.handleMenuClose}>
          <div className='menu-content-inner'>
            {isAuthenticated && (
              <>
                <Typography variant='subtitle2' className='user-details'>
                  {auth.user?.profile.name} : {auth.user?.profile.email}
                </Typography>

                <hr />
                <MenuItem
                  onClick={() => {
                    this.props.setMenuSelectedPageAction(SAAS_TENANTS_VIEW);
                    this.handleMenuClose();
                  }}
                >
                  <ListItemIcon>
                    <UserCircle />
                  </ListItemIcon>
                  Landlord Settings
                </MenuItem>
                {userType === UserType.Admin && (
                  <MenuItem
                    onClick={() => {
                      this.props.setMenuSelectedPageAction(this.props.menuSelectedPage ? null : ANALYTICS_VIEW);
                      this.handleMenuClose();
                    }}
                  >
                    <ListItemIcon>
                      <ChartNoAxesCombined />
                    </ListItemIcon>
                    Apartments Analytics
                  </MenuItem>
                )}
              </>
            )}
            <div>
              {isAuthenticated ? (
                <MenuItem
                  onClick={() => {
                    this.props.logoutUserAction(auth);
                    this.handleMenuClose();
                  }}
                >
                  <ListItemIcon>
                    <UserCircle />
                  </ListItemIcon>
                  Sign Out
                </MenuItem>
              ) : (
                <>
                  <MenuItem
                    onClick={() => {
                      this.props.loginWithGoogleAction(auth);
                      this.handleMenuClose();
                    }}
                  >
                    <ListItemIcon>
                      <UserCircle />
                      <LogIn />
                    </ListItemIcon>
                    Sign In with Google
                  </MenuItem>
                </>
              )}
            </div>
          </div>
        </MuiMenu>
      </div>
    );
  }
}

interface IMenuProps {
  isAuthenticated: boolean;
  JWT: string | null;
  userType: string | null;
  showOverview: boolean;
  menuOpen: boolean;
  toggleMenuAction: typeof toggleMenuAction;
  menuSelectedPage: string | null;
  setMenuSelectedPageAction: typeof setMenuSelectedPageAction;
  anchorEl: HTMLElement | null;
  setAnchorElAction: typeof setAnchorElAction;
  loginWithGoogleAction: typeof loginWithGoogleAction;
  checkAuthStatusAction: typeof checkAuthStatusAction;
  logoutUserAction: typeof logoutUserAction;
}

// Maps required state from Redux store to component props
const mapStateToProps = (state: IAppState) => ({
  isAuthenticated: state.auth.isAuthenticated,
  JWT: state.auth.JWT,
  userType: state.auth.userType,
  showOverview: state.menu.showOverview,
  menuOpen: state.menu.menuOpen,
  menuSelectedPage: state.menu.menuSelectedPage,
  anchorEl: state.menu.anchorEl,
});

// Map Redux actions to component props
const mapDispatchToProps = (dispatch: Dispatch) =>
  bindActionCreators(
    {
      toggleMenuAction,
      setAnchorElAction,
      setMenuSelectedPageAction,
      loginWithGoogleAction,
      checkAuthStatusAction,
      logoutUserAction,
    },
    dispatch
  );

export default connect(mapStateToProps, mapDispatchToProps)(MenuWrapper);
