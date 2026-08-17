import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/collections")({
  beforeLoad: () => {
    throw redirect({ to: "/shop" });
  },
  component: () => null,
});
