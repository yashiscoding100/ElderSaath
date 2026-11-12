"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  NotebookPen,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Stethoscope,
  CalendarDays,
  Loader2,
  X,
  Search
} from "lucide-react"

export interface MedicationNoteItem {
  id: string
  elderId: string
  authorName: string | null
  authorRole: string | null
  medicineName: string | null
  timingText: string | null
  doctorName: string | null
  durationText: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

function formatNoteDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  } catch {
    return ""
  }
}

export function MedicationNotepad({
  elderId,
  elderName,
  initialNotes,
  variant,
  id
}: {
  elderId: string
  elderName?: string | null
  initialNotes: MedicationNoteItem[]
  variant: "child" | "elder"
  id?: string
}) {
  const router = useRouter()
  const isElderView = variant === "elder"

  const [notesList, setNotesList] = useState<MedicationNoteItem[]>(initialNotes)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const [medicineName, setMedicineName] = useState("")
  const [timingText, setTimingText] = useState("")
  const [doctorName, setDoctorName] = useState("")
  const [durationText, setDurationText] = useState("")
  const [notesBody, setNotesBody] = useState("")

  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState("")

  const resetForm = () => {
    setEditingId(null)
    setMedicineName("")
    setTimingText("")
    setDoctorName("")
    setDurationText("")
    setNotesBody("")
    setErrorMsg("")
  }

  const openAddForm = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEditForm = (item: MedicationNoteItem) => {
    setEditingId(item.id)
    setMedicineName(item.medicineName || "")
    setTimingText(item.timingText || "")
    setDoctorName(item.doctorName || "")
    setDurationText(item.durationText || "")
    setNotesBody(item.notes || "")
    setErrorMsg("")
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    resetForm()
  }

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return notesList
    return notesList.filter((item) => {
      return (
        (item.medicineName || "").toLowerCase().includes(q) ||
        (item.timingText || "").toLowerCase().includes(q) ||
        (item.doctorName || "").toLowerCase().includes(q) ||
        (item.durationText || "").toLowerCase().includes(q) ||
        (item.notes || "").toLowerCase().includes(q)
      )
    })
  }, [notesList, search])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !medicineName.trim() &&
      !timingText.trim() &&
      !doctorName.trim() &&
      !durationText.trim() &&
      !notesBody.trim()
    ) {
      setErrorMsg("Please write at least a medicine name or note details before saving.")
      return
    }

    setSaving(true)
    setErrorMsg("")
    try {
      const isEdit = Boolean(editingId)
      const res = await fetch("/api/medications/notes", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit ? { id: editingId } : { elderId }),
          medicineName,
          timingText,
          doctorName,
          durationText,
          notes: notesBody
        })
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.message || "Could not save note")
      }

      const savedNote = data.note as MedicationNoteItem
      if (isEdit) {
        setNotesList((prev) => [savedNote, ...prev.filter((n) => n.id !== savedNote.id)])
      } else {
        setNotesList((prev) => [savedNote, ...prev])
      }
      closeForm()
      router.refresh()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save note")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId)
    setErrorMsg("")
    try {
      const res = await fetch(`/api/medications/notes?id=${encodeURIComponent(noteId)}`, {
        method: "DELETE"
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.message || "Could not delete note")
      }
      setNotesList((prev) => prev.filter((n) => n.id !== noteId))
      setConfirmDeleteId(null)
      router.refresh()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete note")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section
      id={id}
      className={`rounded-2xl border border-amber-200 bg-amber-50/60 shadow-sm overflow-hidden ${
        isElderView ? "p-5 rounded-3xl" : "p-6"
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 ${
              isElderView ? "w-12 h-12" : "w-10 h-10"
            }`}
          >
            <NotebookPen className={isElderView ? "w-6 h-6" : "w-5 h-5"} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className={`font-black text-slate-900 tracking-tight ${
                  isElderView ? "text-2xl" : "text-lg"
                }`}
              >
                {isElderView ? "My Medicine Notepad" : "Medicine Notepad & Current Details"}
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                Notes Only • No Alarm
              </span>
            </div>
            <p className={`text-slate-600 mt-1 ${isElderView ? "text-sm leading-snug" : "text-xs"}`}>
              {isElderView
                ? "Keep personal & family notes of ongoing medicines, when to take them, which doctor advised them, and for how long."
                : `Shared medicine notepad for ${elderName || "your elder"} — record ongoing medicines, timing, prescribing doctor, and duration (separate from alarms).`}
            </p>
          </div>
        </div>

        {!formOpen && (
          <button
            type="button"
            onClick={openAddForm}
            className={`inline-flex items-center justify-center gap-2 font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition shrink-0 ${
              isElderView
                ? "w-full sm:w-auto px-5 py-3.5 rounded-2xl text-base"
                : "px-4 py-2 rounded-xl text-sm"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Add Note</span>
          </button>
        )}
      </div>

      {/* Add / Edit Note Form */}
      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mb-5 bg-white rounded-2xl border border-amber-300 p-4 sm:p-5 shadow-xs space-y-3.5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className={`font-extrabold text-slate-900 ${isElderView ? "text-lg" : "text-sm"}`}>
              {editingId ? "Edit Medicine Note" : "Add to Medicine Notepad"}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              title="Close form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Medicine Name (Optional)
              </label>
              <input
                type="text"
                maxLength={160}
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
                placeholder="e.g. Metformin 500mg, Vitamin D3"
                className={`w-full px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none ${
                  isElderView ? "py-3 text-base" : "py-2 text-sm"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                When / Time to Take (Optional)
              </label>
              <input
                type="text"
                maxLength={200}
                value={timingText}
                onChange={(e) => setTimingText(e.target.value)}
                placeholder="e.g. Morning after breakfast & 9 PM"
                className={`w-full px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none ${
                  isElderView ? "py-3 text-base" : "py-2 text-sm"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Doctor Name / Prescribed By (Optional)
              </label>
              <input
                type="text"
                maxLength={160}
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="e.g. Dr. Mehta (Cardiologist)"
                className={`w-full px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none ${
                  isElderView ? "py-3 text-base" : "py-2 text-sm"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                How Long / Course Duration (Optional)
              </label>
              <input
                type="text"
                maxLength={160}
                value={durationText}
                onChange={(e) => setDurationText(e.target.value)}
                placeholder="e.g. 15 days / Until Nov 30 / Ongoing"
                className={`w-full px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none ${
                  isElderView ? "py-3 text-base" : "py-2 text-sm"
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Notepad Description / Extra Details
            </label>
            <textarea
              rows={isElderView ? 4 : 3}
              maxLength={4000}
              value={notesBody}
              onChange={(e) => setNotesBody(e.target.value)}
              placeholder="Write anything helpful here — current ongoing medicines, why it was prescribed, with or after food, doctor instructions..."
              className={`w-full px-3.5 py-2.5 bg-amber-50/40 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none ${
                isElderView ? "text-base" : "text-sm"
              }`}
            />
          </div>

          {errorMsg && (
            <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={closeForm}
              className={`font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition ${
                isElderView ? "px-4 py-2.5 text-base" : "px-3.5 py-2 text-sm"
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`inline-flex items-center gap-2 font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs disabled:opacity-50 transition ${
                isElderView ? "px-5 py-2.5 text-base" : "px-4 py-2 text-sm"
              }`}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{saving ? "Saving..." : editingId ? "Update Note" : "Save Note"}</span>
            </button>
          </div>
        </form>
      )}

      {/* Search bar when there are several notes */}
      {notesList.length >= 4 && (
        <div className="relative mb-3.5">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes by medicine, doctor, timing..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-amber-200 rounded-xl text-sm text-slate-900 font-medium focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>
      )}

      {!formOpen && errorMsg && (
        <p className="mb-3 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {errorMsg}
        </p>
      )}

      {/* Saved Notes List */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white/90 rounded-2xl border border-dashed border-amber-300 p-6 text-center">
          <p className={`font-bold text-slate-700 ${isElderView ? "text-lg" : "text-sm"}`}>
            {notesList.length === 0
              ? "No medicine notes saved yet."
              : "No notes match your search."}
          </p>
          <p className={`text-slate-500 mt-1 ${isElderView ? "text-sm" : "text-xs"}`}>
            {notesList.length === 0
              ? "Tap \"Add Note\" above to keep a shared written record of ongoing medicines, timing, doctor name, or course length."
              : "Try clearing the search box to see all saved notes."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotes.map((item) => {
            const isConfirmingDelete = confirmDeleteId === item.id
            const isDeletingThis = deletingId === item.id

            return (
              <article
                key={item.id}
                className="bg-white rounded-2xl border border-amber-200/90 p-4 shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3
                      className={`font-black text-slate-900 leading-snug ${
                        isElderView ? "text-xl" : "text-base"
                      }`}
                    >
                      {item.medicineName || "Medicine Note"}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditForm(item)}
                      className="p-2 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition"
                      title="Edit note"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {!isConfirmingDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete note"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                        <button
                          type="button"
                          disabled={isDeletingThis}
                          onClick={() => handleDelete(item.id)}
                          className="text-xs font-extrabold text-rose-700 hover:text-rose-800 px-1.5 disabled:opacity-50"
                        >
                          {isDeletingThis ? "..." : "Delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs font-bold text-slate-500 hover:text-slate-700 px-1"
                        >
                          No
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata Pills: Timing, Doctor, Duration */}
                {(item.timingText || item.doctorName || item.durationText) && (
                  <div className="flex flex-wrap gap-2">
                    {item.timingText && (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-semibold ${
                          isElderView ? "text-sm" : "text-xs"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.timingText}</span>
                      </span>
                    )}
                    {item.doctorName && (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold ${
                          isElderView ? "text-sm" : "text-xs"
                        }`}
                      >
                        <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.doctorName}</span>
                      </span>
                    )}
                    {item.durationText && (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 font-semibold ${
                          isElderView ? "text-sm" : "text-xs"
                        }`}
                      >
                        <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.durationText}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Freeform Notes Content */}
                {item.notes && (
                  <div
                    className={`bg-amber-50/50 border border-amber-100 rounded-xl px-3.5 py-2.5 text-slate-800 whitespace-pre-wrap leading-relaxed ${
                      isElderView ? "text-base font-medium" : "text-sm"
                    }`}
                  >
                    {item.notes}
                  </div>
                )}

                {/* Attribution Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-medium text-slate-400">
                  <span>
                    Updated by {item.authorName || (item.authorRole === "ELDER" ? "Elder" : "Family")} (
                    {item.authorRole === "ELDER" ? "Elder" : "Family"})
                  </span>
                  <span suppressHydrationWarning>{formatNoteDate(item.updatedAt)}</span>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
