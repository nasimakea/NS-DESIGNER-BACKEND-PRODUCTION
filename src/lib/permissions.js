// Role-based access control.
//
//  * super_admin  - everything, including Team and Settings. Cannot be limited.
//  * everyone else - gets an explicit list of permission keys chosen by a Super Admin.
//    "manager" and "staff" are only starting points (presets) in the Team screen;
//    "custom" means the Super Admin ticked individual permissions.
//
// Every admin API route names the permission it needs (see lib/route.js), so the
// check always happens on the server - hiding a menu item is only cosmetic.

export const ROLES = { SUPER: "super_admin", MANAGER: "manager", STAFF: "staff", CUSTOM: "custom" };
export const ADMIN_ROLES = Object.values(ROLES);

export const PERMISSIONS = [
  { key: "dashboard", label: "Dashboard", hint: "See sales, orders and customer overview" },
  { key: "orders", label: "Orders", hint: "View orders and change order status" },
  { key: "payments", label: "Payments", hint: "Record amounts received from customers" },
  { key: "products", label: "Products & categories", hint: "Add, edit, feature and hide products" },
  { key: "custom_orders", label: "Custom orders", hint: "Quote and process custom stitching requests" },
  { key: "franchise", label: "Franchise enquiries", hint: "View and update franchise leads" },
  { key: "customers", label: "Customers", hint: "View customer list and history" },
  { key: "messages", label: "Messages", hint: "Reply to contact-form messages" },
  { key: "chats", label: "Chat handovers", hint: "Answer customers the AI stylist passed to the team" },
  { key: "settings", label: "Store settings", hint: "Change store details and notifications" },
];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export const ROLE_PRESETS = {
  [ROLES.MANAGER]: PERMISSION_KEYS.filter((k) => k !== "settings"),
  [ROLES.STAFF]: ["dashboard", "orders", "products", "custom_orders", "franchise", "customers", "messages", "chats"],
  [ROLES.CUSTOM]: [],
};

export const SUPER_ONLY = [ROLES.SUPER];
export const isSuper = (user) => user?.role === ROLES.SUPER;

/** Permissions a signed-in admin really has (Super Admin = all). */
export function effectivePermissions(user) {
  if (!user) return [];
  if (user.role === ROLES.SUPER) return [...PERMISSION_KEYS];
  // Accounts created before permissions existed have no list yet: use their role preset.
  const list = Array.isArray(user.permissions) ? user.permissions : ROLE_PRESETS[user.role] || ROLE_PRESETS[ROLES.STAFF];
  return list.filter((key) => PERMISSION_KEYS.includes(key));
}

export const hasPermission = (user, key) => effectivePermissions(user).includes(key);
