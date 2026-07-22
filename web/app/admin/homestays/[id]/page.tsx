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
import DocumentStatusPanel from "@/components/admin/review/DocumentStatusPanel";
import InternalNotesPanel from "@/components/admin/review/InternalNotesPanel";
import {
  fetchChangeRequests, createChangeRequests, markChangeResolved, markChangeVerified, reopenChangeRequest,
  fetchDocumentStatuses, setDocumentStatus,
  fetchInternalNotes, addInternalNote,
  type ChangeRequest, type DocumentStatus, type InternalNote, type DocumentReviewStatus, type ChangeRequestPriority,
} from "@/lib/services/ReviewWorkspaceService";
import AuditHistoryPanel from "@/components/admin/review/AuditHistoryPanel";
import {
  fetchScheduleFor, fetchAuditHistory, recordAuditOutcome,
  type AuditSchedule, type AuditRecord, type AuditType, type AuditChecklist, type AuditOutcome,
} from "@/lib/services/AuditWorkspaceService";

interface RoomType {
  id: string; name: string; room_category: string | null; max_occupancy: number | null;
  total_units: number | null; base_price: number | null; is_available: boolean;
}

interface Property {
  id: string; owner_id: string; name: string; description: string | null;
  property_type: string[] | null; address: string; city: string; state: string; country: string | null; pincode: string | null;
  location_name: string | null; district: string | null;
  checkin_time: string | null; checkout_time: string | null;
  amenities: string[] | null;
  smoking_allowed: boolean; pets_allowed: boolean; parties_allowed: boolean; children_allowed: boolean;
  cancellation_policy: string | null;
  contact_phone: string | null; contact_whatsapp: string | null; contact_email: string | null;
  identity_doc_type: string | null; identity_doc_front_url: string | null; identity_doc_back_url: string | null;
  ownership_proof_type: string | null; ownership_proof_url: string | null;
  cover_photo_url: string | null; photos: string[] | null;
  commission_rate: number | null;
  status: string; rejection_reason: string | null;
  approved_at: string | null; is_featured: boolean; is_suspended: boolean; created_at: string;
}

export default function HomestayDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { hasPermission } = useAdminPermissions();

  const [property, setProperty] = useState<Property | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [activity, setActivity] = useState<ActivityLogRow[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [docStatuses, setDocStatuses] = useState<DocumentStatus[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [auditSchedule, setAuditSchedule] = useState<AuditSchedule | null>(null);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
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
    const { data, error: err } = await getListingById("homestays", id);
    if (err) { setError(err.message); setLoading(false); return; }
    if (!data) { setNotFound(true); setLoading(false); return; }
    setProperty(data as unknown as Property);
    const [{ data: rooms }, activityRows, crRows, docRows, noteRows, schedule, auditHistory] = await Promise.all([
      supabase.from("room_types").select("id, name, room_category, max_occupancy, total_units, base_price, is_available").eq("property_id", id),
      getActivityForEntity("homestays", id),
      fetchChangeRequests("homestays", id),
      fetchDocumentStatuses("homestays", id),
      fetchInternalNotes("homestays", id),
      fetchScheduleFor("homestays", id),
      fetchAuditHistory("homestays", id),
    ]);
    setRoomTypes((rooms as RoomType[]) || []);
    setActivity(activityRows);
    setChangeRequests(crRows);
    setDocStatuses(docRows);
    setNotes(noteRows);
    setAuditSchedule(schedule);
    setAuditRecords(auditHistory);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async () => {
    if (!property) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try { await approveListing("homestays", property.id, property.owner_id, user.id); showToast("Homestay approved."); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleReject = async (reason?: string) => {
    if (!property || !reason) return;
    try { await rejectListing("homestays", property.id, property.owner_id, reason); showToast("Homestay rejected."); setRejectOpen(false); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleToggleSuspend = async () => {
    if (!property) return;
    try { await setSuspended("homestays", property.id, !property.is_suspended); showToast(property.is_suspended ? "Restored." : "Suspended."); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleToggleFeature = async () => {
    if (!property) return;
    try { await setFeatured("homestays", property.id, !property.is_featured); showToast(property.is_featured ? "Unfeatured." : "Featured."); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleDelete = async () => {
    if (!property) return;
    try { await deleteListing("homestays", property.id, property); showToast("Property deleted."); router.push("/admin/homestays"); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleRequestChanges = async (items: { issue: string; instructions: string; priority: ChangeRequestPriority; field_key: string | null }[]) => {
    if (!property) return;
    try { await createChangeRequests("homestays", property.id, property.owner_id, items); showToast("Changes requested."); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleMarkResolved = async (crId: string) => {
    try { await markChangeResolved(crId); load(); } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleMarkVerified = async (crId: string) => {
    try { await markChangeVerified(crId); load(); } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleReopen = async (crId: string, note: string) => {
    try { await reopenChangeRequest(crId, note); load(); } catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleSetDocStatus = async (documentKey: string, status: DocumentReviewStatus) => {
    if (!property) return;
    try { await setDocumentStatus("homestays", property.id, documentKey, status); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleAddNote = async (note: string) => {
    if (!property) return;
    await addInternalNote("homestays", property.id, note);
    load();
  };

  const handleRecordAudit = async (input: { audit_type: AuditType; checklist: AuditChecklist; photo_set: string[]; outcome: AuditOutcome; notes?: string }) => {
    if (!property) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try { await recordAuditOutcome("homestays", property.id, property.owner_id, input, user.id); showToast("Audit recorded."); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleEditSave = async (values: Record<string, string | number>) => {
    if (!property) return;
    const { error: err } = await supabase.from("properties").update(values).eq("id", property.id);
    if (err) { showToast(`Failed: ${err.message}`); return; }
    await logAdminAction({ action: "homestays.edited", entityType: "homestays", entityId: property.id, newValue: values });
    showToast("Changes saved.");
    setEditOpen(false);
    load();
  };

  if (loading) return <ReviewSkeleton />;

  if (notFound || error) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <p className="text-white/40 mb-4">{error ? `Couldn't load this property: ${error}` : "This property doesn't exist or was removed."}</p>
        <Link href="/admin/homestays" className="text-sm font-medium" style={{ color: "#F97316" }}>← Back to Homestays</Link>
      </div>
    );
  }
  if (!property) return null;

  const images = [property.cover_photo_url, ...(property.photos || [])].filter(Boolean) as string[];
  const fullAddress = [property.address, property.city, property.district, property.state, property.pincode, property.country].filter(Boolean).join(", ");
  const policies = [
    property.smoking_allowed ? "Smoking allowed" : "No smoking",
    property.pets_allowed ? "Pets allowed" : "No pets",
    property.parties_allowed ? "Parties allowed" : "No parties",
    property.children_allowed ? "Children welcome" : "No children",
  ].join(" · ");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>{toast}</div>}

      <Link href="/admin/homestays" className="inline-flex items-center gap-1 text-white/40 hover:text-white text-sm mb-6">
        <ChevronLeft size={16} /> Back to Homestays
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ImageGallery images={images} />

          <div>
            <h1 className="text-white text-2xl font-bold mb-1">{property.name}</h1>
            <p className="text-white/40 text-sm">{fullAddress || "Address not provided"}</p>
          </div>

          <section className="grid grid-cols-2 gap-4">
            <DetailField label="Phone" value={property.contact_phone} />
            <DetailField label="Email" value={property.contact_email} />
            <DetailField label="WhatsApp" value={property.contact_whatsapp} />
            <DetailField label="Property Type" value={property.property_type?.join(", ") || null} />
            <DetailField label="Check-in / Check-out" value={property.checkin_time && property.checkout_time ? `${property.checkin_time} / ${property.checkout_time}` : null} />
            <DetailField label="Cancellation Policy" value={property.cancellation_policy} />
            <DetailField label="Commission Rate" value={property.commission_rate ? `${property.commission_rate}%` : null} />
          </section>

          <section>
            <DetailField label="Description" value={property.description} />
          </section>

          <section>
            <DetailField label="House Policies" value={policies} />
          </section>

          {property.amenities && property.amenities.length > 0 && (
            <section>
              <div className="text-white/35 text-xs uppercase tracking-wide mb-2">Amenities</div>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map((a) => (
                  <span key={a} className="text-xs px-3 py-1.5 rounded-full text-white/70" style={{ background: "rgba(255,255,255,0.05)" }}>{a}</span>
                ))}
              </div>
            </section>
          )}

          {roomTypes.length > 0 && (
            <section>
              <div className="text-white/35 text-xs uppercase tracking-wide mb-2">Room Types</div>
              <div className="space-y-2">
                {roomTypes.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm rounded-xl px-4 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <span className="text-white/80">{r.name}{r.room_category ? ` (${r.room_category})` : ""}</span>
                    <span className="text-white/50">{r.max_occupancy ? `${r.max_occupancy} guests · ` : ""}{r.base_price ? `₹${r.base_price}/night` : "—"}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="grid grid-cols-2 gap-4">
            <DetailField
              label="Owner Identity Document"
              value={property.identity_doc_front_url ? (
                <div className="flex gap-3">
                  <a href={property.identity_doc_front_url} target="_blank" rel="noopener noreferrer" style={{ color: "#F97316" }}>Front</a>
                  {property.identity_doc_back_url && <a href={property.identity_doc_back_url} target="_blank" rel="noopener noreferrer" style={{ color: "#F97316" }}>Back</a>}
                </div>
              ) : null}
            />
            <DetailField
              label="Ownership Proof"
              value={property.ownership_proof_url ? (
                <a href={property.ownership_proof_url} target="_blank" rel="noopener noreferrer" style={{ color: "#F97316" }}>
                  {property.ownership_proof_type || "View document"}
                </a>
              ) : null}
            />
          </section>

          <DocumentStatusPanel
            slots={[
              { key: "identity_doc_front", label: "Owner Identity — Front", url: property.identity_doc_front_url },
              { key: "identity_doc_back", label: "Owner Identity — Back", url: property.identity_doc_back_url },
              { key: "ownership_proof", label: property.ownership_proof_type || "Ownership Proof", url: property.ownership_proof_url },
            ]}
            statuses={docStatuses}
            onSetStatus={handleSetDocStatus}
            canManage={hasPermission("homestays.approve")}
          />

          <ChangeRequestPanel
            requests={changeRequests}
            onSubmit={handleRequestChanges}
            onMarkResolved={handleMarkResolved}
            onMarkVerified={handleMarkVerified}
            onReopen={handleReopen}
            canManage={hasPermission("homestays.approve")}
          />

          {property.status === "rejected" && property.rejection_reason && (
            <section className="rounded-xl p-4" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="text-red-400 text-xs uppercase tracking-wide mb-1">Rejection Reason</div>
              <p className="text-white/70 text-sm">{property.rejection_reason}</p>
            </section>
          )}

          {property.status === "approved" && (
            <AuditHistoryPanel
              schedule={auditSchedule}
              records={auditRecords}
              entityName={property.name}
              canManage={hasPermission("homestays.approve")}
              onRecordAudit={handleRecordAudit}
            />
          )}

          {activity.length > 0 && (
            <section className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="text-white font-semibold text-sm mb-3">Activity</h3>
              <ActivityTimeline rows={activity} />
            </section>
          )}
        </div>

        <div>
          <ReviewActionsPanel
            status={property.status}
            isSuspended={property.is_suspended}
            isFeatured={property.is_featured}
            canApprove={hasPermission("homestays.approve")}
            canEdit={hasPermission("homestays.edit")}
            canDelete={hasPermission("homestays.delete")}
            canFeature={hasPermission("featured.manage")}
            submittedAt={property.created_at}
            onApprove={handleApprove}
            onReject={() => setRejectOpen(true)}
            onToggleSuspend={handleToggleSuspend}
            onToggleFeature={handleToggleFeature}
            onEdit={() => setEditOpen(true)}
            onDelete={() => setDeleteOpen(true)}
          />
          <div className="mt-4">
            <InternalNotesPanel notes={notes} onAddNote={handleAddNote} canManage={hasPermission("homestays.approve")} />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={rejectOpen}
        title={`Reject ${property.name}?`}
        requireReason
        reasonLabel="Reason"
        confirmLabel="Reject"
        danger
        onConfirm={handleReject}
        onCancel={() => setRejectOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={`Permanently delete ${property.name}?`}
        description="This cannot be undone."
        confirmLabel="Delete Permanently"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
      <EditModal
        open={editOpen}
        title={`Edit ${property.name}`}
        fields={[
          { key: "name", label: "Property Name", type: "text", value: property.name },
          { key: "address", label: "Address", type: "text", value: property.address },
          { key: "commission_rate", label: "Commission Rate (%)", type: "number", value: property.commission_rate },
          { key: "description", label: "Description", type: "textarea", value: property.description },
        ]}
        onSave={handleEditSave}
        onCancel={() => setEditOpen(false)}
      />
    </div>
  );
}
