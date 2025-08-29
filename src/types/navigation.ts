// Navigation-specific type definitions
import * as React from 'react'

// Core navigation types
export interface NavigationItem {
  href: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  requiresAuth?: boolean
  badge?: string | number
  children?: NavigationItem[]
  external?: boolean
  disabled?: boolean
  description?: string
}

export interface NavigationState {
  currentPath: string
  isAuthenticated: boolean
  userRole?: string
  breadcrumbs: BreadcrumbItem[]
  sidebarOpen: boolean
  mobileMenuOpen: boolean
}

export interface BreadcrumbItem {
  label: string
  href?: string
  isActive?: boolean
  icon?: React.ComponentType<{ className?: string }>
}

// Navigation configuration
export interface NavigationConfig {
  mainItems: NavigationItem[]
  userMenuItems: NavigationItem[]
  footerItems?: NavigationItem[]
  quickActions?: NavigationItem[]
  settings: NavigationSettings
}

export interface NavigationSettings {
  showBreadcrumbs: boolean
  showUserMenu: boolean
  showQuickActions: boolean
  collapsible: boolean
  defaultCollapsed: boolean
  position: 'top' | 'left' | 'right'
  variant: 'default' | 'compact' | 'minimal'
}

// Navigation component props
export interface NavigationProps {
  config: NavigationConfig
  currentPath: string
  isAuthenticated: boolean
  user?: UserInfo
  onNavigate?: (href: string) => void
  onAuthAction?: (action: 'login' | 'logout') => void
  className?: string
}

export interface UserInfo {
  id: string
  email: string
  name?: string
  avatar?: string
  role?: string
}

export interface SidebarProps {
  items: NavigationItem[]
  currentPath: string
  isOpen: boolean
  onToggle: () => void
  onItemClick?: (item: NavigationItem) => void
  className?: string
}

export interface TopBarProps {
  title?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
  userMenu?: React.ReactNode
  onMenuToggle?: () => void
  className?: string
}

export interface UserMenuProps {
  user: UserInfo
  items: NavigationItem[]
  onItemClick?: (item: NavigationItem) => void
  onLogout?: () => void
  className?: string
}

// Navigation context types
export interface NavigationContextValue {
  state: NavigationState
  config: NavigationConfig
  navigate: (href: string) => void
  updateBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void
  toggleSidebar: () => void
  toggleMobileMenu: () => void
  setCurrentPath: (path: string) => void
}

export interface NavigationAction {
  type: 'SET_CURRENT_PATH' | 'SET_AUTHENTICATED' | 'UPDATE_BREADCRUMBS' | 
        'TOGGLE_SIDEBAR' | 'TOGGLE_MOBILE_MENU' | 'SET_USER_ROLE'
  payload?: any
}

// Navigation analytics types
export interface NavigationAnalytics {
  pageViews: Record<string, number>
  clickEvents: NavigationClickEvent[]
  sessionDuration: number
  bounceRate: number
  popularPaths: string[]
  lastActivity: Date
}

export interface NavigationClickEvent {
  href: string
  label: string
  timestamp: Date
  userId?: string
  sessionId: string
}

// Navigation accessibility types
export interface NavigationAccessibility {
  skipLinks: SkipLink[]
  landmarks: boolean
  keyboardNavigation: boolean
  screenReaderSupport: boolean
  focusManagement: boolean
  announceRouteChanges: boolean
}

export interface SkipLink {
  href: string
  label: string
  target: string
}

// Navigation responsive types
export interface ResponsiveConfig {
  breakpoints: {
    mobile: number
    tablet: number
    desktop: number
  }
  behavior: {
    mobile: 'drawer' | 'bottom' | 'overlay'
    tablet: 'sidebar' | 'top' | 'hybrid'
    desktop: 'sidebar' | 'top' | 'full'
  }
  collapsible: boolean
  autoCollapse: boolean
}

// Navigation theme types
export interface NavigationTheme {
  variant: 'default' | 'minimal' | 'compact' | 'sidebar'
  colors: {
    background: string
    foreground: string
    accent: string
    hover: string
    active: string
    border: string
  }
  spacing: {
    padding: string
    margin: string
    gap: string
  }
  typography: {
    fontSize: string
    fontWeight: string
    lineHeight: string
  }
  animations: {
    enabled: boolean
    duration: string
    easing: string
  }
}

// Navigation search types
export interface NavigationSearch {
  enabled: boolean
  placeholder: string
  shortcuts: SearchShortcut[]
  results: SearchResult[]
  onSearch: (query: string) => void
  onSelect: (result: SearchResult) => void
}

export interface SearchShortcut {
  key: string
  label: string
  action: () => void
}

export interface SearchResult {
  id: string
  title: string
  description?: string
  href: string
  category?: string
  icon?: React.ComponentType<{ className?: string }>
  relevance: number
}

// Navigation performance types
export interface NavigationPerformance {
  renderTime: number
  interactionTime: number
  memoryUsage: number
  bundleSize: number
  lazyLoadingEnabled: boolean
  cacheStrategy: 'memory' | 'localStorage' | 'sessionStorage' | 'none'
}

// Navigation security types
export interface NavigationSecurity {
  csrfProtection: boolean
  sanitizeUrls: boolean
  allowedDomains: string[]
  blockExternalLinks: boolean
  auditNavigation: boolean
}

// Navigation state management
export interface NavigationStore {
  state: NavigationState
  actions: {
    navigate: (href: string) => void
    goBack: () => void
    goForward: () => void
    refresh: () => void
    updateBreadcrumbs: (breadcrumbs: BreadcrumbItem[]) => void
    setAuthenticated: (authenticated: boolean) => void
    setUserRole: (role: string) => void
  }
  selectors: {
    getCurrentPath: () => string
    getBreadcrumbs: () => BreadcrumbItem[]
    getIsAuthenticated: () => boolean
    getUserRole: () => string | undefined
  }
}