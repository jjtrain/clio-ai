"use client";

import React, { useState, useEffect } from "react";
import { X, Car, Train, Footprints, RefreshCw } from "lucide-react";

interface Preferences {
  defaultMode: string;
  bufferMinutes: number;
  alertThreshold: number;
  geofenceBuffer: number;
  autoSyncMatters: boolean;
  autoSyncCourt: boolean;
  homeAddress: string;
  officeAddress: string;
}

interface TravelPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: Preferences;
  onSave: (prefs: Preferences) => void;
  lastSyncTime?: Date | string | null;
}

const TRAVEL_MODES = [
  { key: "drive", label: "Drive", icon: Car },
  { key: "transit", label: "Transit", icon: Train },
  { key: "walk", label: "Walk", icon: Footprints },
] as const;

export default function TravelPreferencesModal({
  isOpen,
  onClose,
  preferences,
  onSave,
  lastSyncTime,
}: TravelPreferencesModalProps) {
  const [prefs, setPrefs] = useState<Preferences>(preferences);

  useEffect(() => {
    setPrefs(preferences);
  }, [preferences]);

  if (!isOpen) return null;

  const update = <K extends keyof Preferences>(
    key: K,
    value: Preferences[K]
  ) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const formatSyncTime = () => {
    if (!lastSyncTime) return "Never";
    const d =
      typeof lastSyncTime === "string" ? new Date(lastSyncTime) : lastSyncTime;
    return d.toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-slate-800 rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <h2 className="text-lg font-semibold text-white mb-6">
          Travel Preferences
        </h2>

        {/* Travel Mode */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Travel Mode
          </label>
          <div className="flex gap-2">
            {TRAVEL_MODES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => update("defaultMode", key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                  prefs.defaultMode === key
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Buffer Time */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Buffer Time: {prefs.bufferMinutes} min
          </label>
          <input
            type="range"
            min={5}
            max={60}
            value={prefs.bufferMinutes}
            onChange={(e) => update("bufferMinutes", Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Geofence Buffer */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Geofence Buffer: {prefs.geofenceBuffer} min
          </label>
          <p className="text-xs text-slate-400 mb-2">
            Extra time for court check-in
          </p>
          <input
            type="range"
            min={5}
            max={30}
            value={prefs.geofenceBuffer}
            onChange={(e) => update("geofenceBuffer", Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Home Address */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Home Address
          </label>
          <input
            type="text"
            value={prefs.homeAddress}
            onChange={(e) => update("homeAddress", e.target.value)}
            placeholder="Enter home address"
            className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Office Address */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Office Address
          </label>
          <input
            type="text"
            value={prefs.officeAddress}
            onChange={(e) => update("officeAddress", e.target.value)}
            placeholder="Enter office address"
            className="w-full px-3 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Alert Threshold */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Alert Threshold: {prefs.alertThreshold} min
          </label>
          <input
            type="range"
            min={15}
            max={60}
            value={prefs.alertThreshold}
            onChange={(e) => update("alertThreshold", Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Sync Settings */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Sync Settings
          </h3>

          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-300">
              Auto-sync matter deadlines
            </span>
            <button
              onClick={() => update("autoSyncMatters", !prefs.autoSyncMatters)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                prefs.autoSyncMatters ? "bg-blue-600" : "bg-slate-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  prefs.autoSyncMatters ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-300">
              Auto-sync court filing deadlines
            </span>
            <button
              onClick={() => update("autoSyncCourt", !prefs.autoSyncCourt)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                prefs.autoSyncCourt ? "bg-blue-600" : "bg-slate-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  prefs.autoSyncCourt ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors text-sm">
            <RefreshCw size={14} />
            Sync Now
          </button>

          <p className="text-xs text-slate-400 mt-2">
            Last sync: {formatSyncTime()}
          </p>
        </div>

        {/* Save */}
        <button
          onClick={() => onSave(prefs)}
          className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
