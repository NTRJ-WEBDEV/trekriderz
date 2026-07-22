"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAdminPermissions } from "@/lib/adminPermissions";
import { getListingById, approveListing, rejectListing, setFeatured, setGuideActive, deleteListing } from "@/lib/services/ApprovalService";
import { getActivityForEntity, type ActivityLogRow } from "@/lib/services/AuditService";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import EditModal from "@/components/admin/review/EditModal";
import DetailField from "@/components/admin/review/DetailField";
import ImageGallery from "@/components/admin/review/ImageGallery";
import ReviewActionsPanel from "@/components/admin/review/ReviewActionsPanel";
import ReviewSkeleton from "@/components/admin/review/ReviewSkeleton";
import ActivityTimeline from "@/components/admin/dashboard/ActivityTimeline";
import { logAdminAction } from "@/lib/services/AuditService";
import ChangeRequestPanel from "@/components/admin/review/ChangeRequestPanel";
import DocumentStatusPanel from "@/components/admin/review/DocumentStatusPanel";
import InternalNotesPanel from "@/components/admin/review/InternalNotesPanel";
import {
  fetchChangeRequests, createChangeRequests, markChangeResolved, markChangeVerified, reopenChangeRequest,
  fetchDocumentStatuses, setDocumentStatus,
  fetchInternalNotes, addInternalNote,
  type ChangeRequest, type DocumentStatus, type InternalNote, type DocumentReviewStatus, type ChangeRequestPriority,
} from "@/lib/services/ReviewWorkspaceService";

interface Guide {
  id: string; user_id: string;
  full_name: string | null; name: string | null;
  profile_photo_url: string | null; photo_url: string | null; photos: string[] | null;
  contact_phone: string | null; location: string | null; locations: any[] | null;
  languages: string[] | null; experience: string | null; experience_years: number | null;
  specializations: string[] | null; specialties: string[] | null;
  certificates: { name: string; authority?: string; url?: string }[] | null;
  certifications: string[] | null;
  identity_doc_type: string | null; identity_doc_front_url: string | null; identity_doc_back_url: string | null;
  about: string | null; bio: string | null;
  rate_per_day: number | null; rating: number | null; total_reviews: number | null;
  status: string; rejection_reason: string | null;
  verified_at: string | null; is_active: boolean; is_featured: boolean; created_at: string;
  users: { email: string | null; phone: string | null } | null;
}

export default function GuideDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { hasPermission } = useAdminPermissions();

  const [guide, setGuide] = useState<Guide | null>(null);
  const [activity, setActivity] = useState<ActivityLogRow[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [docStatuses, setDocStatuses] = useState<DocumentStatus[]>([]);
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
    const { data, error: err } = await getListingById("guides", id, "*, users:user_id(email, phone)");
    if (err) { setError(err.message); setLoading(false); return; }
    if (!data) { setNotFound(true); setLoading(false); return; }
    setGuide(data as unknown as Guide);
    const [activityRows, crRows, docRows, noteRows] = await Promise.all([
      getActivityForEntity("guides", id),
      fetchChangeRequests("guides", id),
      fetchDocumentStatuses("guides", id),
      fetchInternalNotes("guides", id),
    ]);
    setActivity(activityRows);
    setChangeRequests(crRows);
    setDocStatuses(docRows);
    setNotes(noteRows);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async () => {
    if (!guide) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try { await approveListing("guides", guide.id, guide.user_id, user.id); showToast("Guide approved."); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleReject = async (reason?: string) => {
    if (!guide || !reason) return;
    try { await rejectListing("guides", guide.id, guide.user_id, reason); showToast("Guide rejected."); setRejectOpen(false); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleToggleSuspend = async () => {
    if (!guide) return;
    try { await setGuideActive(guide.id, !guide.is_active); showToast(guide.is_active ? "Guide suspended." : "Guide restored."); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleToggleFeature = async () => {
    if (!guide) return;
    try { await setFeatured("guides", guide.id, !guide.is_featured); showToast(guide.is_featured ? "Unfeatured." : "Featured."); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleDelete = async () => {
    if (!guide) return;
    try { await deleteListing("guides", guide.id, guide); showToast("Guide deleted."); router.push("/admin/guides"); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleRequestChanges = async (items: { issue: string; instructions: string; priority: ChangeRequestPriority; field_key: string | null }[]) => {
    if (!guide) return;
    try { await createChangeRequests("guides", guide.id, guide.user_id, items); showToast("Changes requested."); load(); }
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
    if (!guide) return;
    try { await setDocumentStatus("guides", guide.id, documentKey, status); load(); }
    catch (e: any) { showToast(`Failed: ${e.message}`); }
  };

  const handleAddNote = async (note: string) => {
    if (!guide) return;
    await addInternalNote("guides", guide.id, note);
    load();
  };

  const handleEditSave = async (values: Record<string, string | number>) => {
    if (!guide) return;
    const { error: err } = await supabase.from("guides").update(values).eq("id", guide.id);
    if (err) { showToast(`Failed: ${err.message}`); return; }
    await logAdminAction({ action: "guides.edited", entityType: "guides", entityId: guide.id, newValue: values });
    showToast("Changes saved.");
    setEditOpen(false);
    load();
  };

  if (loading) return <ReviewSkeleton />;

  if (notFound || error) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <p className="text-white/40 mb-4">{error ? `Couldn't load this guide: ${error}` : "This guide profile doesn't exist or was removed."}</p>
        <Link href="/admin/guides" className="text-sm font-medium" style={{ color: "#F97316" }}>← Back to Guides</Link>
      </div>
    );
  }
  if (!guide) return null;

  const images = [guide.profile_photo_url, guide.photo_url, ...(guide.photos || [])].filter(Boolean) as string[];
  const displayName = guide.full_name || guide.name || "Unnamed Guide";
  const languages = guide.languages && guide.languages.length > 0 ? guide.languages.join(", ") : null;
  const specializations = (guide.specializations?.length ? guide.specializations : guide.specialties) || null;
  const certificates = guide.certificates && guide.certificates.length > 0 ? guide.certificates : null;
  const legacyCertifications = !certificates && guide.certifications?.length ? guide.certifications : null;
  const experience = guide.experience || (guide.experience_years ? `${guide.experience_years} years` : null);
  const email = guide.users?.email ?? null;
  const phone = guide.contact_phone || guide.users?.phone || null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>{toast}</div>}

      <Link href="/admin/guides" className="inline-flex items-center gap-1 text-white/40 hover:text-white text-sm mb-6">
        <ChevronLeft size={16} /> Back to Guides
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <ImageGallery images={images} />
          </div>

          <div>
            <h1 className="text-white text-2xl font-bold mb-1">{displayName}</h1>
            <p className="text-white/40 text-sm">{guide.location || "Location not provided"}</p>
          </div>

          <section className="grid grid-cols-2 gap-4">
            <DetailField label="Phone" value={phone} />
            <DetailField label="Email" value={email} />
            <DetailField label="Experience" value={experience} />
            <DetailField label="Rate per Day" value={guide.rate_per_day ? `₹${guide.rate_per_day}` : null} />
            <DetailField label="Languages" value={languages} />
            <DetailField label="Specializations" value={specializations?.join(", ") || null} />
            <DetailField label="Rating" value={guide.rating ? `${guide.rating} (${guide.total_reviews || 0} reviews)` : null} />
          </section>

          <section>
            <DetailField label="About" value={guide.about || guide.bio} />
          </section>

          {guide.locations && guide.locations.length > 0 && (
            <section>
              <div className="text-white/35 text-xs uppercase tracking-wide mb-2">Service Areas</div>
              <div className="flex flex-wrap gap-2">
                {guide.locations.map((loc: any, i: number) => (
                  <span key={i} className="text-xs px-3 py-1.5 rounded-full text-white/70" style={{ background: "rgba(255,255,255,0.05)" }}>
                    {loc.name}{loc.rate_per_day ? ` · ₹${loc.rate_per_day}/day` : ""}
                  </span>
                ))}
              </div>
            </section>
          )}

          {(certificates || legacyCertifications) && (
            <section>
              <div className="text-white/35 text-xs uppercase tracking-wide mb-2">Certifications</div>
              <div className="space-y-1.5">
                {certificates?.map((c, i) => (
                  <div key={i} className="text-sm text-white/70">
                    {c.name}{c.authority ? ` — ${c.authority}` : ""}
                    {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs" style={{ color: "#F97316" }}>View</a>}
                  </div>
                ))}
                {legacyCertifications?.map((c, i) => <div key={i} className="text-sm text-white/70">{c}</div>)}
              </div>
            </section>
          )}

          <section className="grid grid-cols-2 gap-4">
            <DetailField
              label="Identity Document"
              value={guide.identity_doc_front_url ? (
                <div className="flex gap-3">
                  <a href={guide.identity_doc_front_url} target="_blank" rel="noopener noreferrer" style={{ color: "#F97316" }}>Front</a>
                  {guide.identity_doc_back_url && <a href={guide.identity_doc_back_url} target="_blank" rel="noopener noreferrer" style={{ color: "#F97316" }}>Back</a>}
                </div>
              ) : null}
            />
            <DetailField label="Document Type" value={guide.identity_doc_type} />
          </section>

          <DocumentStatusPanel
            slots={[
              { key: "identity_doc_front", label: "Identity Document — Front", url: guide.identity_doc_front_url },
              { key: "identity_doc_back", label: "Identity Document — Back", url: guide.identity_doc_back_url },
            ]}
            statuses={docStatuses}
            onSetStatus={handleSetDocStatus}
            canManage={hasPermission("guides.approve")}
          />

          <ChangeRequestPanel
            requests={changeRequests}
            onSubmit={handleRequestChanges}
            onMarkResolved={handleMarkResolved}
            onMarkVerified={handleMarkVerified}
            onReopen={handleReopen}
            canManage={hasPermission("guides.approve")}
          />

          {guide.status === "rejected" && guide.rejection_reason && (
            <section className="rounded-xl p-4" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="text-red-400 text-xs uppercase tracking-wide mb-1">Rejection Reason</div>
              <p className="text-white/70 text-sm">{guide.rejection_reason}</p>
            </section>
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
            status={guide.status}
            isSuspended={!guide.is_active}
            isFeatured={guide.is_featured}
            canApprove={hasPermission("guides.approve")}
            canEdit={hasPermission("guides.edit")}
            canDelete={hasPermission("guides.delete")}
            canFeature={hasPermission("featured.manage")}
            submittedAt={guide.created_at}
            onApprove={handleApprove}
            onReject={() => setRejectOpen(true)}
            onToggleSuspend={handleToggleSuspend}
            onToggleFeature={handleToggleFeature}
            onEdit={() => setEditOpen(true)}
            onDelete={() => setDeleteOpen(true)}
          />
          <div className="mt-4">
            <InternalNotesPanel notes={notes} onAddNote={handleAddNote} canManage={hasPermission("guides.approve")} />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={rejectOpen}
        title={`Reject ${displayName}?`}
        requireReason
        reasonLabel="Reason"
        confirmLabel="Reject"
        danger
        onConfirm={handleReject}
        onCancel={() => setRejectOpen(false)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={`Permanently delete ${displayName}?`}
        description="This cannot be undone."
        confirmLabel="Delete Permanently"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
      <EditModal
        open={editOpen}
        title={`Edit ${displayName}`}
        fields={[
          { key: "full_name", label: "Full Name", type: "text", value: guide.full_name },
          { key: "location", label: "Location", type: "text", value: guide.location },
          { key: "rate_per_day", label: "Rate per Day", type: "number", value: guide.rate_per_day },
          { key: "about", label: "About", type: "textarea", value: guide.about || guide.bio },
        ]}
        onSave={handleEditSave}
        onCancel={() => setEditOpen(false)}
      />
    </div>
  );
}
