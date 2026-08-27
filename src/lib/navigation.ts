export interface NavItem {
  label: string;
  to: string;
}

export interface NavGroup {
  section: string;
  items: NavItem[];
}

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    section: "Utama",
    items: [
      { label: "Dashboard", to: "/admin" },
      { label: "Pesanan", to: "/admin/pesanan" },
    ],
  },
  {
    section: "Toko & Katalog",
    items: [
      { label: "Produk", to: "/admin/produk" },
      { label: "Kategori", to: "/admin/kategori" },
      { label: "Pelanggan", to: "/admin/pelanggan" },
    ],
  },
  {
    section: "Finansial & Laporan",
    items: [
      { label: "Keuangan", to: "/admin/keuangan" },
      { label: "Laporan", to: "/admin/laporan" },
    ],
  },
  {
    section: "Pemasaran",
    items: [
      { label: "Voucher", to: "/admin/voucher" },
      { label: "Ulasan", to: "/admin/ulasan" },
    ],
  },
  {
    section: "Pengaturan",
    items: [
      { label: "Pengaturan Toko", to: "/admin/pengaturan" },
      { label: "Profil Admin", to: "/admin/profil" },
    ],
  },
];

export const ADMIN_NAV: NavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

export const CUSTOMER_NAV: NavItem[] = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Pesanan Saya", to: "/dashboard/pesanan" },
  { label: "Wishlist", to: "/dashboard/wishlist" },
  { label: "Profil Saya", to: "/dashboard/profil" },
];
