import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_admin/admin/koleksi")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/produk" });
  },
  component: () => null,
});
