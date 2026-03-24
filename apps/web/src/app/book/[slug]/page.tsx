"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Calendar, Clock, MapPin, Video, Phone, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [step, setStep] = useState(1);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [locationType, setLocationType] = useState("virtual");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [booked, setBooked] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: config } = trpc.appointmentScheduling.getBookingPageConfig.useQuery({ slug });
  const { data: types } = trpc.appointmentScheduling.getAppointmentTypes.useQuery({ isPublic: true, isActive: true });
  const { data: slots } = trpc.appointmentScheduling.getAvailableSlots.useQuery(
    { appointmentTypeId: selectedTypeId || "", month, year },
    { enabled: !!selectedTypeId }
  );
  const bookMutation = trpc.appointmentScheduling.bookAppointment.useMutation({
    onSuccess: () => setBooked(true),
  });

  if (booked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Appointment Confirmed!</h1>
          <p className="text-sm text-gray-600 mb-4">
            {selectedSlot && new Date(selectedSlot).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="text-xs text-gray-500">A confirmation email has been sent to {email}.</p>
        </Card>
      </div>
    );
  }

  const locationIcons: Record<string, any> = { in_person: MapPin, virtual: Video, phone: Phone };
  const selectedDateSlots = slots?.find((s) => s.date === selectedDate)?.slots || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{config?.title || "Schedule a Consultation"}</h1>
          {config?.subtitle && <p className="text-sm text-gray-500 mt-1">{config.subtitle}</p>}
        </div>

        {/* Step 1: Type Selection */}
        {step === 1 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Choose an appointment type</h2>
            {types?.map((type) => (
              <Card key={type.id} className={cn("p-4 cursor-pointer hover:shadow-md transition-all", selectedTypeId === type.id && "ring-2 ring-blue-500")}
                onClick={() => { setSelectedTypeId(type.id); setStep(2); }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{type.name}</p>
                    {type.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{type.description}</p>}
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <Badge variant="secondary" className="text-xs">{type.duration} min</Badge>
                    {type.price ? <p className="text-xs text-gray-500 mt-1">${type.price}</p> : <p className="text-xs text-green-600 mt-1">Free</p>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <div className="space-y-4">
            <Button variant="ghost" onClick={() => setStep(1)} className="gap-1 text-xs"><ChevronLeft className="h-3 w-3" />Back</Button>
            <h2 className="text-sm font-semibold text-gray-700">Choose a date and time</h2>

            {/* Month navigation */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
              <Button variant="ghost" size="sm" onClick={() => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Available dates */}
            <div className="flex flex-wrap gap-2">
              {slots?.map((daySlots) => (
                <button key={daySlots.date} onClick={() => setSelectedDate(daySlots.date)}
                  className={cn("px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    selectedDate === daySlots.date ? "bg-blue-600 text-white" : "bg-white border hover:bg-blue-50")}>
                  {new Date(daySlots.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </button>
              ))}
              {(!slots || slots.length === 0) && <p className="text-sm text-gray-500">No available dates this month</p>}
            </div>

            {/* Time slots */}
            {selectedDate && selectedDateSlots.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-gray-500">Available times</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {selectedDateSlots.map((slot, i) => (
                    <button key={i} onClick={() => { setSelectedSlot(slot.startTime); setStep(3); }}
                      className={cn("px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                        selectedSlot?.getTime() === new Date(slot.startTime).getTime() ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-blue-50 hover:border-blue-300")}>
                      {new Date(slot.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Info */}
        {step === 3 && (
          <div className="space-y-4">
            <Button variant="ghost" onClick={() => setStep(2)} className="gap-1 text-xs"><ChevronLeft className="h-3 w-3" />Back</Button>
            <h2 className="text-sm font-semibold text-gray-700">Your information</h2>

            {/* Location type */}
            <div className="flex gap-2">
              {["virtual", "in_person", "phone"].map((loc) => {
                const Icon = locationIcons[loc] || Video;
                return (
                  <button key={loc} onClick={() => setLocationType(loc)}
                    className={cn("flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border text-sm transition-colors",
                      locationType === loc ? "bg-blue-50 border-blue-500 text-blue-700" : "hover:bg-gray-50")}>
                    <Icon className="h-4 w-4" />
                    {loc === "virtual" ? "Video" : loc === "in_person" ? "In-Person" : "Phone"}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <Input placeholder="Full Name *" value={name} onChange={(e) => setName(e.target.value)} />
              <Input type="email" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <textarea placeholder="What would you like to discuss?" value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm resize-none" rows={3} />
            </div>

            <Button className="w-full" disabled={!name || !email || bookMutation.isLoading}
              onClick={() => bookMutation.mutate({
                appointmentTypeId: selectedTypeId!, startTime: selectedSlot!, locationType,
                clientName: name, clientEmail: email, clientPhone: phone || undefined,
                clientNotes: notes || undefined, bookingSource: "public_page",
              })}>
              {bookMutation.isLoading ? "Booking..." : "Confirm Appointment"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
