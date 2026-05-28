import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Download, Car, CalendarDays, Home, ClipboardList } from "lucide-react";
function Button({ children, className = "", disabled = false, ...props }) {
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white ${className}`}>{children}</div>;
}

function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

const STORAGE_KEY = "airbnb-mileage-logger-v1";

// Replace this with your Google Apps Script Web App URL after setup
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyswOwtRz_rt1KMjoVlSoDk7Zb6kD9jIMZgk58BOg8eBZRJsTJ3UxV3fvgIRSAipG8m/exec";

const today = new Date().toISOString().slice(0, 10);

const starterProperties = [];

export default function AirbnbMileageLogger() {
  const [entries, setEntries] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    date: today,
    property: "",
    purpose: "Inspection",
    startOdometer: "",
    endOdometer: "",
    miles: "",
    notes: "",
  });
  const [filterProperty, setFilterProperty] = useState("All");
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setEntries(JSON.parse(saved));
      } catch {
        setEntries([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const calculatedMiles = useMemo(() => {
    const start = parseFloat(form.startOdometer);
    const end = parseFloat(form.endOdometer);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      return +(end - start).toFixed(1);
    }
    const manual = parseFloat(form.miles);
    return Number.isNaN(manual) ? 0 : +manual.toFixed(1);
  }, [form.startOdometer, form.endOdometer, form.miles]);

  const years = useMemo(() => {
    const allYears = new Set(entries.map((entry) => entry.date.slice(0, 4)));
    allYears.add(new Date().getFullYear().toString());
    return Array.from(allYears).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const properties = useMemo(() => {
  const allProperties = new Set([
    ...starterProperties,
    ...entries.map((entry) => entry.property).filter(Boolean),
  ]);
  return Array.from(allProperties).sort((a, b) => a.localeCompare(b));
}, [entries]);

  const filteredEntries = useMemo(() => {
    return entries
      .filter((entry) => filterProperty === "All" || entry.property === filterProperty)
      .filter((entry) => filterYear === "All" || entry.date.startsWith(filterYear))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, filterProperty, filterYear]);

  const totalMiles = filteredEntries.reduce((sum, entry) => sum + Number(entry.miles || 0), 0);
  const estimatedDeduction = totalMiles * 0.67;

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function addEntry(event) {
    event.preventDefault();
    const milesToSave = calculatedMiles;

    if (!form.date || !form.property || !form.purpose || milesToSave <= 0) {
      alert("Please enter a date, property, purpose, and mileage greater than 0.");
      return;
    }

    const newEntry = {
      id: editingId || crypto.randomUUID(),
      date: form.date,
      property: form.property.trim(),
      purpose: form.purpose.trim(),
      startOdometer: form.startOdometer,
      endOdometer: form.endOdometer,
      miles: milesToSave,
      notes: form.notes.trim(),
    };

    if (editingId) {
  setEntries((current) =>
    current.map((entry) => (entry.id === editingId ? newEntry : entry))
  );
  setEditingId(null);
} else {
  setEntries((current) => [newEntry, ...current]);
  syncToGoogleSheets(newEntry);
}
    setForm({
      date: today,
      property: "",
      purpose: "Inspection",
      startOdometer: "",
      endOdometer: "",
      miles: "",
      notes: "",
    });
  }

  async function syncToGoogleSheets(entry) {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === "PASTE_YOUR_GOOGLE_SCRIPT_URL_HERE") {
      return;
    }

    try {
      setSyncing(true);

      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.error("Google Sheets sync failed", error);
    } finally {
      setSyncing(false);
    }
  }

  function deleteEntry(id) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  function exportCsv() {
    const headers = ["Date", "Property", "Purpose", "Start Odometer", "End Odometer", "Miles", "Notes"];
    const rows = filteredEntries.map((entry) => [
      entry.date,
      entry.property,
      entry.purpose,
      entry.startOdometer || "",
      entry.endOdometer || "",
      entry.miles,
      entry.notes || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `airbnb-mileage-${filterYear}-${filterProperty}.csv`.replaceAll(" ", "-").toLowerCase();
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-4 md:px-10 md:py-8">
      <div className="app-shell mx-auto max-w-6xl space-y-3">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>

<div className="title-banner">
  <h1 className="title-heading">MILEAGE LOGGER</h1>
</div>
 <div className="mb-2 text-center text-sm font-medium text-slate-500">
  Airbnb Inspection Mileage
</div>
            
          </div>

          
        </div>

        <div className="stats-row">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Filtered Miles</p>
                <Car className="h-5 w-5 text-slate-400" />
              </div>
              <p className="mt-3 text-xl font-bold text-slate-900">{totalMiles.toFixed(1)}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Estimated Deduction</p>
                <ClipboardList className="h-5 w-5 text-slate-400" />
              </div>
              <p className="mt-3 text-xl font-bold text-slate-900">${estimatedDeduction.toFixed(2)}</p>
              <p className="text-xs text-slate-400">$0.67/mile</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Logged Trips</p>
                <CalendarDays className="h-5 w-5 text-slate-400" />
              </div>
              <p className="mt-3 text-xl font-bold text-slate-900">{filteredEntries.length}</p>
            </CardContent>
          </Card>
        </div>
<hr className="my-3 border-slate-300" />
        
        <div className="grid gap-6 lg:grid-cols-[520px_1fr]">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-3">
              <div className="section-banner">
  <h2 className="section-heading text-3xl font-bold text-center">ADD A TRIP</h2>
</div>

              <form onSubmit={addEntry} className="trip-form">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => updateForm("date", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none ring-slate-300 focus:ring-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Property</label>
                  <input
                    list="property-options"
                    value={form.property}
                    onChange={(event) => updateForm("property", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none ring-slate-300 focus:ring-2"
                    placeholder="Enter property name"
                  />
                  <datalist id="property-options">
                    {properties.map((property) => (
                      <option value={property} key={property} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Purpose</label>
                  <select
                    value={form.purpose}
                    onChange={(event) => updateForm("purpose", event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none ring-slate-300 focus:ring-2"
                  >
                    <option>Inspection</option>
                    <option>Supply run</option>
                    <option>Cleaner check</option>
                    <option>Maintenance visit</option>
                    <option>Guest issue</option>
                    <option>Other business trip</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Start odometer</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.startOdometer}
                      onChange={(event) => updateForm("startOdometer", event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none ring-slate-300 focus:ring-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">End odometer</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.endOdometer}
                      onChange={(event) => updateForm("endOdometer", event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none ring-slate-300 focus:ring-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Miles</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.miles}
                    onChange={(event) => updateForm("miles", event.target.value)}
                    disabled={form.startOdometer && form.endOdometer}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none ring-slate-300 focus:ring-2 disabled:bg-slate-100"
                    placeholder={calculatedMiles ? `${calculatedMiles} calculated` : "Enter miles manually"}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Enter odometer readings or type miles manually.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(event) => updateForm("notes", event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none ring-slate-300 focus:ring-2"
                    placeholder="Example: checked hot tub, restocked paper goods, inspected after checkout"
                  />
                </div>

                <Button type="submit" className="w-full rounded-2xl shadow-sm">
                  {syncing ? "Saving..." : null}
                  <Plus className="mr-2 h-4 w-4" /> Add Mileage Entry
                </Button>
<hr className="mt-5 border-slate-300" />
                
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-3">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="section-banner">
  <h2 className="section-heading text-xl font-semibold text-center">MILEAGE LOG</h2>
</div>
                <div className="flex gap-2">
                  <select
                    value={filterProperty}
                    onChange={(event) => setFilterProperty(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2"
                  >
                    <option>All</option>
                    {properties.map((property) => (
                      <option key={property}>{property}</option>
                    ))}
                  </select>
                  <select
                    value={filterYear}
                    onChange={(event) => setFilterYear(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-300 focus:ring-2"
                  >
                    <option>All</option>
                    {years.map((year) => (
                      <option key={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                  <Home className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                  <p className="font-medium text-slate-700">No mileage logged yet.</p>
                  <p className="mt-1 text-sm text-slate-500">Add your first inspection or supply run to get started.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="hidden grid-cols-[110px_1fr_130px_90px_50px] gap-3 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600 md:grid">
                    <div>Date</div>
                    <div>Property / Notes</div>
                    <div>Purpose</div>
                    <div>Miles</div>
                    <div></div>
                  </div>

                  <div className="divide-y divide-slate-200 bg-white">
                    {filteredEntries.map((entry) => (
                      <div key={entry.id} className="grid gap-2 px-4 py-4 md:grid-cols-[110px_1fr_130px_90px_50px] md:items-center md:gap-3">
                        <div className="text-sm font-medium text-slate-700">{entry.date}</div>
                        <div>
                          <div className="font-semibold text-slate-900">{entry.property}</div>
                          {entry.notes && <div className="mt-1 text-sm text-slate-500">{entry.notes}</div>}
                          {(entry.startOdometer || entry.endOdometer) && (
                            <div className="mt-1 text-xs text-slate-400">
                              Odometer: {entry.startOdometer || "—"} to {entry.endOdometer || "—"}
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-slate-600">{entry.purpose}</div>
                        <div className="font-semibold text-slate-900">{Number(entry.miles).toFixed(1)}</div>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Delete entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
  <Button onClick={exportCsv} className="rounded-2xl shadow-sm" disabled={filteredEntries.length === 0}>
    <Download className="mr-2 h-4 w-4" /> Export CSV
  </Button>
  <p className="text-xs text-slate-500">
    Entries save in this browser using local storage. For tax records, export CSV periodically and keep a backup.
  </p>
</div>
      </div>
    </div>
  );
}

