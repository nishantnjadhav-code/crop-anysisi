import { useState, useRef, useCallback, useEffect } from "react";
import Head from "next/head";

const CROPS = [
  "Rice / Paddy",
  "Wheat",
  "Maize / Corn",
  "Cotton",
  "Soybean",
  "Sugarcane",
  "Tomato",
  "Potato",
  "Onion",
  "Chilli / Pepper",
  "Groundnut",
  "Sunflower",
  "Banana",
  "Mango",
  "Grapes",
  "Other",
];

const LANGUAGES = [
  { code: "English", label: "English" },
  { code: "Hindi", label: "हिंदी" },
  { code: "Marathi", label: "मराठी" },
];

const LOADING_STEPS = [
  "Uploading image securely...",
  "Analyzing plant structure...",
  "Identifying crop and condition...",
  "Generating agricultural guidance...",
];

function getHealthBadgeClass(status) {
  if (!status) return "health-undetermined";
  const s = status.toLowerCase();
  if (s.includes("healthy")) return "health-healthy";
  if (s.includes("mild")) return "health-mild";
  if (s.includes("moderate")) return "health-moderate";
  if (s.includes("severe")) return "health-severe";
  return "health-undetermined";
}

function ResultSection({ emoji, title, children, delay = 0 }) {
  return (
    <div className={`detail-section animate-in animate-in-delay-${delay}`}>
      <div className="section-header">
        <span className="section-emoji">{emoji}</span>
        <span className="section-title">{title}</span>
      </div>
      <div className="section-body">{children}</div>
    </div>
  );
}

function ListItems({ items }) {
  if (!items || items.length === 0)
    return <p className="section-text" style={{ color: "var(--text-muted)" }}>No information available.</p>;
  return (
    <ul className="section-list">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

/* ─────────────────────────────────────────────
   Camera Modal Component
───────────────────────────────────────────── */
function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState("environment"); // environment = back camera
  const [captured, setCaptured] = useState(null); // base64 preview after snap

  const startCamera = useCallback(async (mode) => {
    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setCameraReady(false);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setCameraReady(true);
        };
      }
    } catch (err) {
      setCameraError("Camera access denied or not available. Please allow camera permission and try again.");
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode, startCamera]);

  const flipCamera = () => {
    setCaptured(null);
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const snap = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCaptured(dataUrl);
  };

  const retake = () => setCaptured(null);

  const usePhoto = () => {
    if (!captured) return;
    // Convert base64 dataURL → File
    const arr = captured.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    const file = new File([u8arr], `camera_capture_${Date.now()}.jpg`, { type: mime });
    onCapture(file, captured);
  };

  return (
    <div className="camera-modal-overlay" role="dialog" aria-modal="true" aria-label="Camera capture">
      <div className="camera-modal">
        {/* Header */}
        <div className="camera-modal-header">
          <span className="camera-modal-title">📸 Camera Capture</span>
          <button className="camera-close-btn" onClick={onClose} aria-label="Close camera">✕</button>
        </div>

        {/* Viewfinder / Preview */}
        <div className="camera-viewfinder">
          {cameraError ? (
            <div className="camera-error-state">
              <span style={{ fontSize: 40 }}>📵</span>
              <p className="camera-error-text">{cameraError}</p>
            </div>
          ) : captured ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={captured} alt="Captured crop photo" className="camera-captured-img" />
          ) : (
            <>
              {!cameraReady && (
                <div className="camera-loading-state">
                  <div className="camera-spinner" />
                  <p>Starting camera…</p>
                </div>
              )}
              <video
                ref={videoRef}
                className="camera-video"
                autoPlay
                playsInline
                muted
                style={{ opacity: cameraReady ? 1 : 0 }}
              />
              {/* Corner guides */}
              {cameraReady && (
                <div className="camera-guides" aria-hidden="true">
                  <div className="guide-corner tl" />
                  <div className="guide-corner tr" />
                  <div className="guide-corner bl" />
                  <div className="guide-corner br" />
                  <div className="guide-hint">Point at the affected leaf or crop area</div>
                </div>
              )}
            </>
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        {/* Controls */}
        <div className="camera-controls">
          {captured ? (
            <>
              <button className="cam-btn cam-btn-secondary" onClick={retake}>
                🔄 Retake
              </button>
              <button className="cam-btn cam-btn-primary" onClick={usePhoto}>
                ✅ Use This Photo
              </button>
            </>
          ) : (
            <>
              <button
                className="cam-btn cam-btn-secondary"
                onClick={flipCamera}
                disabled={!cameraReady}
                title="Flip camera"
              >
                🔃 Flip
              </button>
              <button
                id="snap-btn"
                className="cam-btn cam-btn-capture"
                onClick={snap}
                disabled={!cameraReady}
                aria-label="Capture photo"
              >
                <span className="shutter-ring">
                  <span className="shutter-dot" />
                </span>
              </button>
              <div style={{ width: 80 }} /> {/* spacer to center shutter */}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   History Panel Component
───────────────────────────────────────────── */
function HistoryPanel({ history, onSelect, onClear, onClose }) {
  if (history.length === 0) {
    return (
      <div className="hist-empty">
        <span style={{ fontSize: 36 }}>📂</span>
        <p>No analysis history yet.</p>
        <p style={{ fontSize: 11 }}>Your past analyses will appear here.</p>
      </div>
    );
  }
  return (
    <div className="hist-list">
      {history.map((item, i) => (
        <button key={item.id} className="hist-item" onClick={() => onSelect(item)}>
          <div className="hist-item-top">
            <span className="hist-plant">🌱 {item.plant || "Unknown Plant"}</span>
            <span className={`hist-badge ${getHealthBadgeClass(item.health_status)}`}>
              {item.health_status || "—"}
            </span>
          </div>
          <div className="hist-item-mid">🦠 {item.condition || "—"}</div>
          <div className="hist-item-bot">
            <span>📍 {item.region || "—"}</span>
            <span className="hist-time">{new Date(item.id).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
          </div>
        </button>
      ))}
      <button className="hist-clear-btn" onClick={onClear}>🗑️ Clear All History</button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   History Detail Modal
───────────────────────────────────────────── */
function HistoryDetail({ item, onClose }) {
  return (
    <div className="camera-modal-overlay" role="dialog" aria-modal="true">
      <div className="camera-modal hist-detail-modal">
        <div className="camera-modal-header">
          <span className="camera-modal-title">📋 Analysis Record</span>
          <button className="camera-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="hist-detail-body">
          <div className="summary-grid" style={{ marginBottom: 16 }}>
            <div className="summary-card"><span className="summary-emoji">🌱</span><span className="summary-label">Plant</span><span className="summary-value">{item.plant || "—"}</span></div>
            <div className="summary-card"><span className="summary-emoji">🦠</span><span className="summary-label">Condition</span><span className="summary-value">{item.condition || "—"}</span></div>
            <div className="summary-card"><span className="summary-emoji">📊</span><span className="summary-label">Confidence</span><span className="summary-value">{item.confidence || "—"}</span></div>
            <div className="summary-card"><span className="summary-emoji">❤️</span><span className="summary-label">Health</span><span className="summary-value"><span className={`health-badge ${getHealthBadgeClass(item.health_status)}`}>{item.health_status || "—"}</span></span></div>
          </div>
          {item.what_happened && <div className="hist-field"><span className="hist-field-label">🔍 What Happened</span><p>{item.what_happened}</p></div>}
          {item.possible_causes?.length > 0 && <div className="hist-field"><span className="hist-field-label">❓ Possible Causes</span><ul className="section-list">{item.possible_causes.map((c,i)=><li key={i}>{c}</li>)}</ul></div>}
          {item.symptoms?.length > 0 && <div className="hist-field"><span className="hist-field-label">🩺 Symptoms</span><ul className="section-list">{item.symptoms.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
          {item.treatment?.length > 0 && <div className="hist-field"><span className="hist-field-label">💊 Treatment</span><ul className="section-list">{item.treatment.map((t,i)=><li key={i}>{t}</li>)}</ul></div>}
          {item.fertilizer_guidance?.length > 0 && <div className="hist-field"><span className="hist-field-label">🧪 Fertilizer</span><ul className="section-list">{item.fertilizer_guidance.map((f,i)=><li key={i}>{f}</li>)}</ul></div>}
          {item.irrigation_guidance?.length > 0 && <div className="hist-field"><span className="hist-field-label">💧 Irrigation</span><ul className="section-list">{item.irrigation_guidance.map((g,i)=><li key={i}>{g}</li>)}</ul></div>}
          {item.prevention?.length > 0 && <div className="hist-field"><span className="hist-field-label">🛡️ Prevention</span><ul className="section-list">{item.prevention.map((p,i)=><li key={i}>{p}</li>)}</ul></div>}
          {item.monitoring && <div className="hist-field"><span className="hist-field-label">⏱️ Monitoring</span><p>{item.monitoring}</p></div>}
          <div className="hist-field" style={{ marginTop: 8 }}>
            <span className="hist-field-label" style={{ fontSize: 10 }}>🌐 {item.language} &nbsp;|&nbsp; 📍 {item.region || "—"} &nbsp;|&nbsp; 🌾 {item.cropSelected || "—"}</span>
            <span className="hist-field-label" style={{ fontSize: 10, display: "block", marginTop: 4 }}>🕒 {new Date(item.id).toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [image, setImage] = useState(null);
  const [crop, setCrop] = useState("");
  const [region, setRegion] = useState("");
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  /* ── History State ── */
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDetail, setHistoryDetail] = useState(null);

  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);

  /* Load history from localStorage on mount */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("agrisense_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WEBP, etc.).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be smaller than 10 MB.");
      return;
    }
    setError(null);
    setResult(null);
    const previewUrl = URL.createObjectURL(file);
    setImage({ file, previewUrl, name: file.name });
  }, []);

  const handleCameraCapture = useCallback((file, previewUrl) => {
    setError(null);
    setResult(null);
    setImage({ file, previewUrl, name: file.name });
    setShowCamera(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer?.files?.[0]);
  }, [handleFile]);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const removeImage = () => {
    setImage(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Close camera on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") setShowCamera(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const analyze = async () => {
    if (!image) {
      setError("Please upload or capture a crop / plant image first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingStep(0);

    const stepIntervals = [];
    LOADING_STEPS.forEach((_, i) => {
      if (i === 0) return;
      const t = setTimeout(() => setLoadingStep(i), i * 1800);
      stepIntervals.push(t);
    });

    try {
      const formData = new FormData();
      formData.append("image", image.file);
      formData.append("crop", crop);
      formData.append("region", region);
      formData.append("language", language);

      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "AI analysis is currently unavailable. Please try again.");
      }

      setResult(data);
      /* ── Save to history ── */
      try {
        const entry = {
          ...data,
          id: Date.now(),
          cropSelected: crop,
          region,
          language,
        };
        setHistory((prev) => {
          const updated = [entry, ...prev].slice(0, 50); // keep last 50
          localStorage.setItem("agrisense_history", JSON.stringify(updated));
          return updated;
        });
      } catch {}
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    } catch (err) {
      setError(err.message || "AI analysis is currently unavailable. Please try again.");
    } finally {
      stepIntervals.forEach(clearTimeout);
      setLoading(false);
      setLoadingStep(0);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("agrisense_history");
  };

  return (
    <>
      <Head>
        <title>AgriSense AI — Crop Image Analysis</title>
        <meta
          name="description"
          content="AI-powered crop and plant disease analysis for farmers. Upload or capture a crop image and get instant agricultural guidance in English, Hindi, or Marathi."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Camera Modal */}
      {showCamera && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* History Detail Modal */}
      {historyDetail && (
        <HistoryDetail
          item={historyDetail}
          onClose={() => setHistoryDetail(null)}
        />
      )}

      <div className="app-wrapper">
        {/* ── Header ── */}
        <header className="header">
          <div className="header-badge">
            <span className="dot" />
            AI-Powered
          </div>
          <h1 className="app-title">🌿 AgriSense AI</h1>
          <p className="app-subtitle">Crop Image Analysis &amp; Agricultural Guidance</p>
        </header>

        <main className="container">

          {/* ── Upload Card ── */}
          <div className="card mb-16">
            <p className="section-label">Step 1 — Add Image</p>

            {!image ? (
              <>
                {/* Two source buttons */}
                <div className="image-source-row">
                  <button
                    id="open-file-btn"
                    className="source-btn"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Upload image from device"
                  >
                    <span className="source-btn-icon">📁</span>
                    <span className="source-btn-label">Upload File</span>
                    <span className="source-btn-sub">JPG, PNG, WEBP</span>
                  </button>
                  <button
                    id="open-camera-btn"
                    className="source-btn source-btn-camera"
                    onClick={() => setShowCamera(true)}
                    aria-label="Take photo with camera"
                  >
                    <span className="source-btn-icon">📷</span>
                    <span className="source-btn-label">Use Camera</span>
                    <span className="source-btn-sub">Take live photo</span>
                  </button>
                </div>

                {/* Drop zone */}
                <div
                  id="upload-zone"
                  className={`upload-zone upload-zone-small${dragOver ? " drag-over" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  role="button"
                  tabIndex={0}
                  aria-label="Or drag and drop an image here"
                  onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                >
                  <p className="upload-text-secondary" style={{ fontSize: 13 }}>
                    or drag &amp; drop an image here
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  id="file-input"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </>
            ) : (
              <div className="preview-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.previewUrl}
                  alt="Crop preview"
                  className="preview-img"
                />
                <div className="preview-overlay">
                  <span className="preview-filename">
                    {image.name.startsWith("camera_capture") ? "📷 Camera capture" : `📎 ${image.name}`}
                  </span>
                </div>
                <button
                  id="remove-image-btn"
                  className="preview-remove-btn"
                  onClick={removeImage}
                  aria-label="Remove image"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* ── Context Card ── */}
          <div className="card mb-16">
            <p className="section-label">Step 2 — Provide Context (Optional)</p>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="crop-select">
                  🌾 Crop / Plant Type
                </label>
                <div className="select-wrap">
                  <select
                    id="crop-select"
                    className="form-select"
                    value={crop}
                    onChange={(e) => setCrop(e.target.value)}
                  >
                    <option value="">— Select crop (optional) —</option>
                    {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="region-input">
                  📍 Region / Location
                </label>
                <input
                  id="region-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Maharashtra, Punjab…"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ── Language Card ── */}
          <div className="card mb-16">
            <p className="section-label">Step 3 — Select Language</p>
            <div className="lang-selector" role="group" aria-label="Language selection">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  id={`lang-btn-${lang.code.toLowerCase()}`}
                  className={`lang-btn${language === lang.code ? " active" : ""}`}
                  onClick={() => setLanguage(lang.code)}
                  aria-pressed={language === lang.code}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Error Box ── */}
          {error && (
            <div className="error-box mb-16" role="alert">
              <span className="error-icon">⚠️</span>
              <div>
                <p className="error-title">Analysis Error</p>
                <p className="error-message">{error}</p>
              </div>
            </div>
          )}

          {/* ── Analyze Button ── */}
          <button
            id="analyze-btn"
            className="analyze-btn"
            onClick={analyze}
            disabled={loading || !image}
            aria-label="Analyze crop image"
          >
            {loading ? (
              <><span className="spinner" /> Analyzing…</>
            ) : (
              <>🔍 Analyze Crop Image</>
            )}
          </button>

          {/* ── Loading Animation ── */}
          {loading && (
            <div className="card mt-24 animate-in">
              <div className="loading-container">
                <div className="loading-orb">
                  <div className="loading-orb-inner" />
                  <div className="loading-orb-ring" />
                  <div className="loading-orb-ring-2" />
                  <div className="loading-orb-icon">🌱</div>
                </div>
                <div className="loading-text">
                  <p className="loading-title">Analyzing your crop…</p>
                  <p className="loading-subtitle">Powered by Gemini AI Vision</p>
                </div>
                <div className="loading-steps">
                  {LOADING_STEPS.map((step, i) => (
                    <div
                      key={i}
                      className={`loading-step${i === loadingStep ? " active" : i < loadingStep ? " done" : ""}`}
                      style={{ animationDelay: `${i * 0.15}s` }}
                    >
                      <span className="step-dot" />
                      {i < loadingStep ? "✓ " : ""}{step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Results ── */}
          {result && !loading && (
            <div ref={resultsRef} className="card mt-24 animate-in">
              <div className="results-header">
                <span style={{ fontSize: "28px" }}>🌾</span>
                <div>
                  <p className="results-title">Analysis Complete</p>
                  <p className="results-subtitle">
                    {result.language && `Response in ${result.language}`}
                  </p>
                </div>
              </div>

              {/* Summary Quick Cards */}
              <div className="summary-grid">
                <div className="summary-card">
                  <span className="summary-emoji">🌱</span>
                  <span className="summary-label">Plant / Crop</span>
                  <span className="summary-value">{result.plant || "—"}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-emoji">🦠</span>
                  <span className="summary-label">Condition</span>
                  <span className="summary-value">{result.condition || "—"}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-emoji">📊</span>
                  <span className="summary-label">Confidence</span>
                  <span className="summary-value">{result.confidence || "—"}</span>
                </div>
                <div className="summary-card">
                  <span className="summary-emoji">❤️</span>
                  <span className="summary-label">Health Status</span>
                  <span className="summary-value">
                    <span className={`health-badge ${getHealthBadgeClass(result.health_status)}`}>
                      {result.health_status || "—"}
                    </span>
                  </span>
                </div>
              </div>

              {/* Detail Sections */}
              <div className="detail-sections">
                <ResultSection emoji="🔍" title="What Happened" delay={1}>
                  <p className="section-text">{result.what_happened || "No information available."}</p>
                </ResultSection>
                <ResultSection emoji="❓" title="Possible Causes" delay={2}>
                  <ListItems items={result.possible_causes} />
                </ResultSection>
                <ResultSection emoji="🩺" title="Visible Symptoms" delay={3}>
                  <ListItems items={result.symptoms} />
                </ResultSection>
                <ResultSection emoji="💊" title="Treatment / Action" delay={4}>
                  <ListItems items={result.treatment} />
                </ResultSection>
                <ResultSection emoji="🧪" title="Fertilizer Guidance" delay={5}>
                  <ListItems items={result.fertilizer_guidance} />
                </ResultSection>
                <ResultSection emoji="💧" title="Irrigation Guidance" delay={6}>
                  <ListItems items={result.irrigation_guidance} />
                </ResultSection>
                <ResultSection emoji="🛡️" title="Prevention" delay={7}>
                  <ListItems items={result.prevention} />
                </ResultSection>
                <ResultSection emoji="⏱️" title="Monitoring / Expected Progress" delay={8}>
                  <p className="section-text">{result.monitoring || "No information available."}</p>
                </ResultSection>
              </div>

              {/* Disclaimer */}
              <div className="disclaimer">
                <span>⚠️</span>
                <span>
                  This analysis is generated by AI and is for guidance only. It is not a certified
                  agricultural diagnosis. Please consult a local agricultural expert or Krishi Vigyan
                  Kendra (KVK) before applying treatments, chemicals, or fertilizers.
                </span>
              </div>
            </div>
          )}

        </main>

        <footer className="footer">
          AgriSense AI · Powered by Google Gemini · For informational use only
        </footer>

        {/* ── Floating History Button (always on screen) ── */}
        <button
          id="history-fab"
          className="hist-fab"
          onClick={() => setShowHistory((v) => !v)}
          aria-label="View analysis history"
          title="Analysis History"
        >
          <span className="hist-fab-icon">📃</span>
          {history.length > 0 && (
            <span className="hist-fab-badge">{history.length > 99 ? "99+" : history.length}</span>
          )}
        </button>

        {/* ── History Slide-in Panel ── */}
        <div className={`hist-panel${showHistory ? " hist-panel-open" : ""}`} aria-hidden={!showHistory}>
          <div className="hist-panel-header">
            <span className="hist-panel-title">📃 Analysis History</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="hist-count-badge">{history.length} record{history.length !== 1 ? "s" : ""}</span>
              <button className="camera-close-btn" onClick={() => setShowHistory(false)} aria-label="Close history">✕</button>
            </div>
          </div>
          <div className="hist-panel-body">
            <HistoryPanel
              history={history}
              onSelect={(item) => { setHistoryDetail(item); }}
              onClear={clearHistory}
              onClose={() => setShowHistory(false)}
            />
          </div>
        </div>

        {/* Backdrop for panel */}
        {showHistory && (
          <div className="hist-backdrop" onClick={() => setShowHistory(false)} aria-hidden="true" />
        )}
      </div>
    </>
  );
}
