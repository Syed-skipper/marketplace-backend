export const PERMISSIONS = {
  PRODUCT_CREATE: 'product:create',
  PRODUCT_UPDATE: 'product:update',
  PRODUCT_DELETE: 'product:delete',
  PRODUCT_VIEW: 'product:view',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_VIEW: 'inventory:view',
  SELLER_CREATE: 'seller:create',
  SELLER_APPROVE: 'seller:approve',
  SELLER_VIEW: 'seller:view',
  ORDER_VIEW: 'order:view',
  ORDER_UPDATE: 'order:update',
  ORDER_CREATE: 'order:create',
  ORDER_CANCEL: 'order:cancel',
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_PROCESS: 'payment:process',
  ADMIN_DASHBOARD: 'admin:dashboard',
  ADMIN_USERS: 'admin:users',
  ADMIN_AUDIT: 'admin:audit',
} as const;

export const ROLES = {
  CUSTOMER: 'customer',
  SELLER: 'seller',
  ADMIN: 'admin',
} as const;
