"use client";

import React, { useState, useEffect } from "react";

interface AddEditEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  event?: any;
}

const EVENT_TYPES = [
  { value: "appointment", label: "Appointment" },
  { value: "court_hearing", label: "Court Hearing" },
  { value: "deposition", label: "Deposition" },
  { value: "meeting", label: "Meeting" },
  { value: "personal", label: "Personal" },
];

export default function AddEditEventModal({
  isOpen,
  onClose,
  onSave,
  event,
}: AddEditEventModalProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [eventType, setEventType] = useState("appointment");
  const [matterLink, setMatterLink] = useState("");
  const [courtLink, setCourtLink] = useState("");

  useEffect(() => {
    if (event) {
      setTitle(event.title ?? "");
      setDate(event.date ?? "");
      setStartTime(event.startTime ?? "");
      setEndTime(event.endTime ?? "");
      setLocation(event.location ?? "");
      setEventType(event.eventType ?? "appointment");
      setMatterLink(event.matterLink ?? "");
      setCourtLink(event.courtLink ?? "");
    } else {
      setTitle("");
      setDate("");
      setStartTime("");
      setEndTime("");
      setLocation("");
      setEventType("appointment");
      setMatterLink("");
      setCourtLink("");
    }
  }, [event, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      title,
      date,
      startTime,
      endTime,
      location,
      eventType,
      matterLink,
      courtLink,
      ...(event?.id ? { id: event.id } : {}),
    });
  };

  const inputClass =
    "w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-md bg-slate-800 rounded-xl p-6 mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-white mb-5">
          {event ? "Edit Event" : "Add Event"}
        </h2>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            className={inputClass}
          />
        </div>

        {/* Date */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Start / End Time */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Location */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Enter location"
            className={inputClass}
          />
        </div>

        {/* Event Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Event Type
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className={inputClass}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Matter Link */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Matter Link
          </label>
          <input
            type="text"
            value={matterLink}
            onChange={(e) => setMatterLink(e.target.value)}
            placeholder="Matter name or ID"
            className={inputClass}
          />
        </div>

        {/* Court Link */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Court Link
          </label>
          <input
            type="text"
            value={courtLink}
            onChange={(e) => setCourtLink(e.target.value)}
            placeholder="Court name"
            className={inputClass}
          />
        </div>

        {/* Court hearing note */}
        {eventType === "court_hearing" && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600">
            <p className="text-sm text-slate-300">
              📍 Court events may have location check-in enabled
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-slate-700 text-slate-300 font-medium hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
