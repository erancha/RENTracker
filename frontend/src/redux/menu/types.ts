export interface IMenuState {
  showOverview: boolean;
  menuOpen: boolean;
  anchorEl: HTMLElement | null;
  menuSelectedPage: string | null;
}

export const DOCUMENTS_VIEW = 'Documents';
export const USERS_VIEW = 'Users';
export const ANALYTICS_VIEW = 'Analytics';
