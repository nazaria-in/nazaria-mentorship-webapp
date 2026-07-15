// /app/dashboard/page.tsx

"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { NAV_BY_PERMISSION } from "@/components/shell/NavConfig";
import { useRole } from "@/providers/role-provider";
import { useSessionStore } from "@/store/session-store";
import { fetchAssignments } from "@/lib/api/assignments";
import { AssignmentCard } from "@/components/assignments/AssignmentCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { redirect } from "next/navigation";

export default function DashboardPage() {
  const { permissionLevel } = useRole();

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["assignments", "dashboard"],
    queryFn: () => fetchAssignments({ isActive: true }),
  });



  //until a better dashboard page is made
  let redriect_to_assiments: boolean = false;
  redriect_to_assiments = true
  if (redriect_to_assiments){
    return redirect("/assignments")
  }

  return (
    <AppShell navItems={NAV_BY_PERMISSION[permissionLevel]} pageTitle="Dashboard">
      <div className="flex flex-col gap-5 p-4">
        <DashboardGreeting />

        <section>
          <h2 className="mb-2 font-heading text-sm font-semibold text-text-primary">
            {permissionLevel === "mentee" ? "Your assignments" : "Active assignments"}
          </h2>

          {isLoading ? (
            <div className="text-sm text-text-primary/50">Loading…</div>
          ) : !assignments || assignments.length === 0 ? (
            <EmptyState title="No active assignments" description="Check back once one is created." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {assignments.map((a) => (
                <AssignmentCard key={a.id} assignment={a} href={`/assignments/${a.id}`} />
              ))}
            </div>
          )}
        </section>

        {permissionLevel === "staff" && (
          <section className="rounded-2xl border border-dashed border-border p-4">
            <p className="text-sm text-text-primary/70">
              Mentor approvals waiting for review live at{" "}
              <a href="/admin/users" className="text-text-accent hover:underline">
                /admin/users
              </a>
              .
            </p>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function DashboardGreeting() {
  const { role } = useRole();
  const fullName = useSessionStore((s) => s.fullName);
  return (
    <div>
      <h1 className="font-heading text-xl font-semibold text-text-primary">
        Welcome{fullName ? `, ${fullName}` : ""}
      </h1>
      <p className="text-sm text-text-primary/60">Viewing as {role}.</p>
    </div>
  );
}