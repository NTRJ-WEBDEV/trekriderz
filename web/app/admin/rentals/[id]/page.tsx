"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAdminPermissions } from "@/lib/adminPermissions";
import { getListingById, approveListing, rejectListing, setFeatured, setSuspended, deleteListing } from "@/lib/services/ApprovalService";
import { getActivityForEntity, logAdminAction, type ActivityLogRow } from "@/lib/services/AuditService";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EditModal from "@/components/admin/review/EditModal";
import DetailField from "@/components/admin/review/DetailField";
import ImageGallery from "@/components/admin/review/ImageGallery";
import ReviewActionsPanel from "@/components/admin/review/ReviewActionsPanel";
import ReviewSkeleton from "@/components/admin/review/ReviewSkeleton";
import ActivityTimeline from "@/components/admin/dashboard/ActivityTimeline";
import ChangeRequestPanel from "@/components/admin/review/ChangeRequestPanel";
import InternalNotesPanel from "@/components/admin/review/InternalNotesPanel";
import {
  fetchChangeRequests, createChangeRequests, resolveChangeRequest,
  fetchInternalNotes, addInternalNote,
  type ChangeRequest, type InternalNote,
} from "@/lib/services/ReviewWorkspaceService";

interface RentalVehicle {
  id: string; owner_id: string;
  vehicle_type: string; make: string | null; model: string | null; year: number | null;
  description: string | null; price_per_day: number | null; location: string | null;
  photos: string[] | null; images: string[] | null;
  contact_phone: string | null; contact_whatsapp: string | null;
  features: string[] | null; fuel_included: boolean; seats: number | null;
  status: string; is_available: boolean; is_featured: boolean; is_suspended: boolean;
  local_enabled: boolean; local_base_price: number | null; local_included_km: number | null; local_unlimited_km: boolean;
  outstation_enabled: boolean; outstation_base_price: number | null; outstation_included_km: number | null; outstation_unlimited_km: boolean; outstation_min_days: number | null;
  driver_option: string | null; driver_price_per_day: number | null;
  pickup_state: string | null; pickup_district: string | null;
  created_at: string;
}

export default function RentalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { hasPermission } = useAdminPermissions();

  const [vehicle, setVehicle] = useState<RentalVehicle | null>(null);
  const [activity, setActivity] = useState<ActivityLogRow[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await getListingById("vehicles", id);
    if (err) { setError(err.message); setLoading(false); return; }
    if (!data) { setNotFound(true); setLoading(false); return; }
    setVehicle(data as unknown as RentalVehicle);
    const [activityRows, crRows, noteRows] = await Promise.all([
      getActivityForEntity("vehicles", id),
      fetchChangeRequests("vehicles", id),
      fetchInternalNotes("vehicles", id),
    ]);
    setActivity(activityRows);
    setChangeRequests(crRows);
    setNotes(noteRows);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async () => {
    if (!vehicle) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try { await approveListing("vehicles", vehicle.id, vehicle.owner_id, user.id); showToast("Vehicle approved."); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleReject = async (reason?: string) => {
    if (!vehicle || !reason) return;
    try { await rejectListing("vehicles", vehicle.id, vehicle.owner_id, reason); showToast("Vehicle rejected."); setRejectOpen(false); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleToggleSuspend = async () => {
    if (!vehicle) return;
    try { await setSuspended("vehicles", vehicle.id, !vehicle.is_suspended); showToast(vehicle.is_suspended ? "Restored." : "Suspended."); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleToggleFeature = async () => {
    if (!vehicle) return;
    try { await setFeatured("vehicles", vehicle.id, !vehicle.is_featured); showToast(vehicle.is_featured ? "Unfeatured." : "Featured."); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleDelete = async () => {
    if (!vehicle) return;
    try { await deleteListing("vehicles", vehicle.id, vehicle); showToast("Vehicle deleted."); router.push("/admin/rentals"); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleRequestChanges = async (items: { issue: string; instructions: string }[]) => {
    if (!vehicle) return;
    try { await createChangeRequests("vehicles", vehicle.id, items); showToast("Changes requested."); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleResolveChange = async (crId: string) => {
    try { await resolveChangeRequest(crId); load(); } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleAddNote = async (note: string) => {
    if (!vehicle) return;
    await addInternalNote("vehicles", vehicle.id, note);
    load();
  };

  const handleEditSave = async (values: Record<string, string | number>) => {
    if (!vehicle) return;
    const { error: err } = await supabase.from("rental_vehicles").update(values).eq("id", vehicle.id);
    if (err) { showToast(`Failed: ${err.message}`); return; }
    await logAdminAction({ action: "vehicles.edited", entityType: "vehicles", entityId: vehicle.id, newValue: values });
    showToast("Changes saved.");
    setEditOpen(false);
    load();
  };

  if (loading) return <ReviewSkeleton />;

  if (notFound || error) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <p className="text-white/40 mb-4">{error ? `Couldn't load this vehicle: ${error}` : "This vehicle listing doesn't exist or was removed."}</p>
        <Link href="/admin/rentals" className="text-sm font-medium" style={{ color: "#F97316" }}>← Back to Rentals</Link>
      </div>
    );
  }
  if (!vehicle) return null;

  const images = [...(vehicle.photos || []), ...(vehicle.images || [])].filter(Boolean) as string[];
  const title = [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "Untitled Vehicle";
  const location = [vehicle.location, vehicle.pickup_district, vehicle.pickup_state].filter(Boolean).join(", ");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>{toast}</div>}

      <Link href="/admin/rentals" className="inline-flex items-center gap-1 text-white/40 hover:text-white text-sm mb-6">
        <ChevronLeft size={16} /> Back to Rentals
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ImageGallery images={images} />

          <div>
            <h1 className="text-white text-2xl font-bold mb-1">{title}</h1>
            <p className="text-white/40 text-sm capitalize">{vehicle.vehicle_type} · {location || "Location not provided"}</p>
          </div>

          <section className="grid grid-cols-2 gap-4">
            <DetailField label="Phone" value={vehicle.contact_phone} />
            <DetailField label="WhatsApp" value={vehicle.contact_whatsapp} />
            <DetailField label="Seats" value={vehicle.seats} />
            <DetailField label="Fuel Included" value={vehicle.fuel_included ? "Yes" : "No"} />
            <DetailField label="Availability" value={vehicle.is_available ? "Available" : "Not available"} />
            <DetailField label="Driver Option" value={vehicle.driver_option ? `${vehicle.driver_option}${vehicle.driver_price_per_day ? ` (₹${vehicle.driver_price_per_day}/day)` : ""}` : null} />
          </section>

          <section>
            <DetailField label="Description" value={vehicle.description} />
          </section>

          {vehicle.features && vehicle.features.length > 0 && (
            <section>
              <div className="text-white/35 text-xs uppercase tracking-wide mb-2">Included Equipment</div>
              <div className="flex flex-wrap gap-2">
                {vehicle.features.map((f) => (
                  <span key={f} className="text-xs px-3 py-1.5 rounded-full text-white/70" style={{ background: "rgba(255,255,255,0.05)" }}>{f}</span>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="text-white/35 text-xs uppercase tracking-wide mb-2">Pricing & Mileage</div>
            <div className="grid grid-cols-2 gap-4">
              <DetailField
                label="Local"
                value={vehicle.local_enabled ? `₹${vehicle.local_base_price || 0}/day · ${vehicle.local_unlimited_km ? "Unlimited km" : `${vehicle.local_included_km || 0} km included`}` : "Not offered"}
              />
              <DetailField
                label="Outstation"
                value={vehicle.outstation_enabled ? `₹${vehicle.outstation_base_price || 0}/day · ${vehicle.outstation_unlimited_km ? "Unlimited km" : `${vehicle.outstation_included_km || 0} km included`}${vehicle.outstation_min_days ? ` · min ${vehicle.outstation_min_days} days` : ""}` : "Not offered"}
              />
            </div>
          </section>

          <section className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)" }}>
            <p className="text-white/30 text-xs">
              No registration number, insurance/RC, or verification documents are captured for rental listings in the current data model.
            </p>
          </section>

          <ChangeRequestPanel
            requests={changeRequests}
            onSubmit={handleRequestChanges}
            onResolve={handleResolveChange}
            canManage={hasPermission("rentals.approve")}
          />

          {activity.length > 0 && (
            <section className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="text-white font-semibold text-sm mb-3">Activity</h3>
              <ActivityTimeline rows={activity} />
            </section>
          )}
        </div>

        <div>
          <ReviewActionsPanel
            status={vehicle.status}
            isSuspended={vehicle.is_suspended}
            isFeatured={vehicle.is_featured}
            canApprove={hasPermission("rentals.approve")}
            canEdit={hasPermission("rentals.edit")}
            canDelete={hasPermission("rentals.delete")}
            canFeature={hasPermission("featured.manage")}
            submittedAt={vehicle.created_at}
            onApprove={handleApprove}
            onReject={() => setRejectOpen(true)}
            onToggleSuspend={handleToggleSuspend}
            onToggleFeature={handleToggleFeature}
            onEdit={() => setEditOpen(true)}
            onDelete={() => setDeleteOpen(true)}
          />
          <div className="mt-4">
            <InternalNotesPanel notes={notes} onAddNote={handleAddNote} canManage={hasPermission("rentals.approve")} />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={rejectOpen}
        title={`Reject ${title}?`}
        description="Rentals have no stored rejection-reason field — this reason is sent to the owner as a notification only."
        requireReason
        reasonLabel="Reason"
        confirmLabel="Reject"
        danger
        onConfirm={handleReject}
        onCancel={() => setRejectOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={`Permanently delete ${title}?`}
        description="This cannot be undone."
        confirmLabel="Delete Permanently"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
      <EditModal
        open={editOpen}
        title={`Edit ${title}`}
        fields={[
          { key: "make", label: "Make", type: "text", value: vehicle.make },
          { key: "model", label: "Model", type: "text", value: vehicle.model },
          { key: "location", label: "Location", type: "text", value: vehicle.location },
          { key: "price_per_day", label: "Price per Day", type: "number", value: vehicle.price_per_day },
          { key: "description", label: "Description", type: "textarea", value: vehicle.description },
        ]}
        onSave={handleEditSave}
        onCancel={() => setEditOpen(false)}
      />
    </div>
  );
}
