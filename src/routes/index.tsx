import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthForm } from "@/components/AuthForm";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Index,
  head: () => ({
    meta: [
      { title: "Career CRM — Sign In" },
      { name: "description", content: "Sign in to manage your professional contacts and job search." },
    ],
  }),
});

function Index() {
  return <AuthForm />;
}
