const translations = {
  nav: {
    home: 'Home',
    shop: 'Shop',
    events: 'Events',
    profile: 'Profile',
    admin: 'Admin',
  },
  brand: {
    name: 'Kalenski™ | The ONE AND ONLY Card Empire® ©',
    tagline: 'Official platform of Kalenski™ | The ONE AND ONLY Card Empire® ©',
  },
  home: {
    preTitle: 'Welcome back, {name}',
    title: 'Elite Trading Cards for the modern collector empire.',
    subtitle: 'Explore our premium store with exclusive editions, limited drops and VIP advantages.',
    ctaDiscover: 'Discover Now',
    ctaVault: 'My Collection',
    featuredDrops: 'Featured Drops',
    eventsTitle: 'Featured Events',
    vipAccess: 'VIP Access',
  },
  shop: {
    title: 'Premium Trading Cards & Collector Editions',
    description: 'Browse our exclusive selection and discover limited releases.',
    promoTitle: 'VIP Advantage',
    promoText: 'VIP members receive prepared discounts and early access.',
    vipButton: 'Activate VIP',
    shopAccess: 'Shop Access',
    vipAccess: 'VIP Access',
  },
  events: {
    title: 'Events',
    description: 'Upcoming and past events.',
    moreInfo: 'Learn More',
    participants: 'Participants',
    winner: 'Winner',
    prize: 'Prize',
  },
  profile: {
    title: 'Profile',
    description: 'Your account overview and roles.',
    memberSince: 'Member since',
    rewards: 'Rewards',
    role: 'Role',
    playerOfTheMonth: 'Player of the Month',
    premiumMember: 'Premium Member',
  },
  buttons: {
    discover: 'Discover Now',
    allCards: 'View all cards',
    more: 'Learn More',
    addToCollection: 'Add to Collection',
    activateVip: 'Activate VIP',
    vipPrice: 'VIP Price',
  },
  cards: {
    searchPlaceholder: 'Search cards by name',
    addCard: 'Add New Card',
    editCard: 'Edit Card',
    deleteCard: 'Delete Card',
    saveCard: 'Save Card',
    cancel: 'Cancel',
    detailTitle: 'Card Details',
    nameLabel: 'Name',
    priceLabel: 'Price',
    statusLabel: 'Status',
    available: 'Available',
    sold: 'Sold',
    viewDetails: 'View Details',
    noCardsFound: 'No cards found',
    noCardSelected: 'Select a card to view details.',
    adminIntro: 'Admin features: add, edit, delete and update prices.',
    contactSeller: 'Contact Seller',
  },
  admin: {
    title: 'Admin Dashboard',
    subtitle: 'Manage users, cards, offers, messages and events.',
    userManagement: 'User Management',
    cardManagement: 'Card Management',
    eventManagement: 'Event Management',
    chats: 'Conversations',
    users: 'Users',
    cards: 'Cards',
    events: 'Events',
    offers: 'Offers',
    messages: 'Messages',
    roleLabel: 'Role',
    changeRole: 'Change Role',
    addEvent: 'Add Event',
    editEvent: 'Edit Event',
    saveEvent: 'Save Event',
    addEvent: 'Add Event',
    noUsers: 'No users available',
    noCards: 'No cards defined',
    noEvents: 'No events available',
    accessDenied: 'Access denied. Admin rights required.',
    addEventBtn: 'Add Event',
  },
  auth: {
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
    password: 'Password',
  },
  roles: {
    ADMIN: 'Administrator',
    'V.I.P': 'V.I.P',
    POTM: 'Player of the Month',
    REGULAR: 'Regular Customer',
    CUSTOMER: 'Customer',
  },
}

function get(path) {
  const keys = path.split('.')
  let entry = translations
  for (const k of keys) {
    if (!entry || typeof entry !== 'object' || !(k in entry)) return undefined
    entry = entry[k]
  }
  return entry
}

export function translate(_, path, params = {}) {
  // ignore locale param, keep English only
  const raw = get(path)
  if (typeof raw !== 'string') return path
  return raw.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? '')
}

export { translations }
