import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "crm-vynka" },
      { name: "description", content: "crm-vynka" },
      { property: "og:title", content: "crm-vynka" },
      { property: "og:description", content: "crm-vynka" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-foreground">crm-vynka</p>
    </div>
  );
}
