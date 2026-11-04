"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

const SYMPTOM_OPTIONS = [
  "Chest pressure/pain",
  "Numbness in face/arm",
  "Breathlessness",
  "Dizziness/Fainting",
  "Weakness",
  "Sudden confusion",
  "Pain in jaw/back",
  "Cold sweats",
  "Headache",
  "Fever",
  "Nausea",
  "None"
]

export default function DailyCheckin() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [requiredVitals, setRequiredVitals] = useState<string[]>(["BP", "SUGAR", "SPO2", "PULSE", "TEMP", "WEIGHT"])
  const [askSymptoms, setAskSymptoms] = useState(true)
  const [data, setData] = useState({
    feeling: "",
    sleep: "",
    morningMedicine: "",
    bp: "",
    sugar: "",
    spo2: "",
    pulse: "",
    temperature: "",
    weight: "",
    symptoms: [] as string[],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/elder/preferences")
      .then(res => res.json())
            .then(resData => {
        if (resData.requiredVitals) {
          setRequiredVitals(resData.requiredVitals.split(","))
        }
        if (resData.askSymptoms === false) {
          setAskSymptoms(false)
          setStep(4)
        }
      })
      .catch(() => {})
  }, [])

  const totalSteps = 6
  const handleNext = () => setStep((s) => {
    if (s === 4 && !askSymptoms) return 6;
    return Math.min(s + 1, totalSteps);
  })
  const handlePrev = () => setStep((s) => {
    if (s === 6 && !askSymptoms) return 4;
    return Math.max(s - 1, askSymptoms ? 1 : 4);
  })

  const toggleSymptom = (symptom: string) => {
    if (symptom === "None") {
      setData({ ...data, symptoms: ["None"] })
      return
    }
    const updated = data.symptoms.filter(s => s !== "None")
    if (updated.includes(symptom)) {
      setData({ ...data, symptoms: updated.filter(s => s !== symptom) })
    } else {
      setData({ ...data, symptoms: [...updated, symptom] })
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.message || "Failed to save")
      }

      // Sync Native Android Health Check Widget
      try {
        const cap = (window as any).Capacitor
        const AlarmSyncPlugin = cap?.Plugins?.AlarmSyncPlugin
        if (AlarmSyncPlugin && typeof AlarmSyncPlugin.syncHealthPreferences === "function") {
          const todayStr = new Date().toISOString().split("T")[0]
          await AlarmSyncPlugin.syncHealthPreferences({
            requiredVitals: requiredVitals.join(","),
            healthCheckDone: true,
            bp: data.bp || "",
            sugar: data.sugar || "",
            spo2: data.spo2 || "",
            pulse: data.pulse || "",
            temp: data.temperature || "",
            weight: data.weight || "",
            date: todayStr
          })
        }
      } catch (widgetErr) {
        console.warn("Failed to sync widget after checkin:", widgetErr)
      }

      router.push("/elder/home")
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col justify-between">
      {/* Top Navigation & Progress Bar */}
      <div className="max-w-md mx-auto w-full mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (step > (askSymptoms ? 1 : 4)) {
              handlePrev()
            } else {
              router.push("/elder/home")
            }
          }}
          className="p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition shadow-sm text-slate-700 shrink-0"
          title={step > (askSymptoms ? 1 : 4) ? "Previous Step" : "Back to Home"}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>Step {step} of {totalSteps}</span>
          <span>{Math.round((step / totalSteps) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex-1 flex flex-col justify-center">
        
        {/* STEP 1: How are you feeling? */}
        {step === 1 && (
          <div className="space-y-6 text-center">
            <h1 className="text-3xl font-bold text-gray-800">How are you feeling today?</h1>
            <div className="grid gap-4 mt-8">
              {[
                { label: "Good 😊", value: "Good" },
                { label: "Okay 😐", value: "Okay" },
                { label: "Not Well 😔", value: "Not Well" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setData({ ...data, feeling: opt.value }); handleNext() }}
                  className={`p-6 text-2xl font-semibold rounded-2xl transition border-2 ${
                    data.feeling === opt.value ? 'bg-blue-100 border-blue-400 text-blue-900' : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-transparent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Sleep */}
        {step === 2 && (
          <div className="space-y-6 text-center">
            <h1 className="text-3xl font-bold text-gray-800">Did you sleep well?</h1>
            <div className="grid gap-4 mt-8">
              {["Yes, slept well", "No, could not sleep"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => { setData({ ...data, sleep: opt }); handleNext() }}
                  className={`p-6 text-2xl font-semibold rounded-2xl transition border-2 ${
                    data.sleep === opt ? 'bg-emerald-100 border-emerald-400 text-emerald-900' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-transparent'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Morning Medicine */}
        {step === 3 && (
          <div className="space-y-6 text-center">
            <h1 className="text-3xl font-bold text-gray-800">Did you take your morning medicine?</h1>
            <div className="grid gap-4 mt-8">
              {[
                { label: "Yes ✅", value: "Yes" },
                { label: "Not yet ⏰", value: "Not yet" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setData({ ...data, morningMedicine: opt.value }); handleNext() }}
                  className={`p-6 text-2xl font-semibold rounded-2xl transition border-2 ${
                    data.morningMedicine === opt.value ? 'bg-purple-100 border-purple-400 text-purple-900' : 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-transparent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: Health Measurements */}
        {step === 4 && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800 text-center">Health Measurements</h1>
            <p className="text-center text-gray-500">Enter manually or tap the camera to scan your monitor.</p>
            
            <div className="space-y-4 mt-6">
              {requiredVitals.includes("BP") && (
                <div>
                  <div className="flex justify-between items-end mb-1">
                    <label className="block text-lg font-semibold text-gray-700">Blood Pressure</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      id="ocr-upload"
                      onChange={async (e) => {
                        if (!e.target.files || e.target.files.length === 0) return;
                        const file = e.target.files[0];
                        const originalBp = data.bp;
                        setData({ ...data, bp: "Scanning image..." });
                        
                        try {
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const base64data = reader.result;
                            const res = await fetch("/api/ocr", { 
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ imageBase64: base64data })
                            });
                            const result = await res.json();
                            if (result.extractedData?.bp) {
                              setData(prev => ({ 
                                  ...prev, 
                                  bp: result.extractedData.bp,
                                  pulse: result.extractedData.pulse || prev.pulse 
                              }));
                            } else {
                              setData({ ...data, bp: originalBp });
                            }
                          };
                          reader.readAsDataURL(file);
                        } catch {
                          setData({ ...data, bp: originalBp });
                        }
                      }}
                    />
                    <label htmlFor="ocr-upload" className="text-blue-600 bg-blue-50 px-3 py-1 rounded-lg font-bold text-sm cursor-pointer flex items-center gap-1 hover:bg-blue-100 transition">
                      📸 Scan
                    </label>
                  </div>
                  <input type="text" placeholder="e.g. 138/86" className="text-gray-900 font-bold w-full text-xl p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none" value={data.bp} onChange={(e) => setData({ ...data, bp: e.target.value })} />
                </div>
              )}
              
              {requiredVitals.includes("SUGAR") && (
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-1">Blood Sugar (mg/dL)</label>
                  <input type="text" placeholder="e.g. 112" className="text-gray-900 font-bold w-full text-xl p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none" value={data.sugar} onChange={(e) => setData({ ...data, sugar: e.target.value })} />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                {requiredVitals.includes("SPO2") && (
                  <div>
                    <label className="block text-lg font-semibold text-gray-700 mb-1">SpO2 (%)</label>
                    <input type="text" placeholder="e.g. 97" className="text-gray-900 font-bold w-full text-xl p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none" value={data.spo2} onChange={(e) => setData({ ...data, spo2: e.target.value })} />
                  </div>
                )}
                {requiredVitals.includes("PULSE") && (
                  <div>
                    <label className="block text-lg font-semibold text-gray-700 mb-1">Pulse (BPM)</label>
                    <input type="text" placeholder="e.g. 78" className="text-gray-900 font-bold w-full text-xl p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none" value={data.pulse} onChange={(e) => setData({ ...data, pulse: e.target.value })} />
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {requiredVitals.includes("TEMP") && (
                  <div>
                    <label className="block text-lg font-semibold text-gray-700 mb-1">Temp (°F)</label>
                    <input type="text" placeholder="e.g. 98.6" className="text-gray-900 font-bold w-full text-xl p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none" value={data.temperature} onChange={(e) => setData({ ...data, temperature: e.target.value })} />
                  </div>
                )}
                {requiredVitals.includes("WEIGHT") && (
                  <div>
                    <label className="block text-lg font-semibold text-gray-700 mb-1">Weight (kg)</label>
                    <input type="text" placeholder="e.g. 72" className="text-gray-900 font-bold w-full text-xl p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none" value={data.weight} onChange={(e) => setData({ ...data, weight: e.target.value })} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Symptoms */}
        {step === 5 && askSymptoms && (
          <div className="space-y-6 text-center">
            <h1 className="text-3xl font-bold text-gray-800">Any symptoms today?</h1>
            <p className="text-gray-500">Checking for these helps your family spot early warning signs of illness, heart issues, or stroke.</p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              {SYMPTOM_OPTIONS.map((symptom) => (
                <button
                  key={symptom}
                  onClick={() => toggleSymptom(symptom)}
                  className={`p-4 text-lg font-medium rounded-xl transition border-2 ${
                    data.symptoms.includes(symptom)
                      ? 'bg-red-100 border-red-400 text-red-800'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {symptom}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 6: Complete */}
        {step === 6 && (
          <div className="space-y-6 text-center">
            <div className="text-6xl">✅</div>
            <h1 className="text-3xl font-bold text-gray-800">Health check is complete!</h1>
            <p className="text-lg text-gray-500">Your family has been notified of today's check-in.</p>
            {error && <p className="text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>}
          </div>
        )}

      </div>

      {/* Navigation buttons */}
      <div className="max-w-md mx-auto w-full pt-6 flex gap-4">
        {step > (askSymptoms ? 1 : 4) && (
          <button onClick={handlePrev} className="flex-1 py-4 bg-gray-200 text-gray-700 font-bold rounded-2xl text-xl">
            Back
          </button>
        )}
        {step >= 4 && step < 6 && (
          <button onClick={handleNext} className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl text-xl">
            Next
          </button>
        )}
        {step === 6 && (
          <button 
            onClick={handleSubmit} 
            disabled={loading}
            className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl text-xl disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save & Go Home"}
          </button>
        )}
      </div>
    </div>
  )
}
