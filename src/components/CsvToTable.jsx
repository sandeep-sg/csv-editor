import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 600;
const DEFAULT_COLUMN_WIDTH = 180;

const THEMES = [
  { id: "blue", label: "Blue", swatch: "#2563eb" },
  { id: "violet", label: "Violet", swatch: "#7c3aed" },
  { id: "emerald", label: "Emerald", swatch: "#059669" },
  { id: "rose", label: "Rose", swatch: "#e11d48" },
  { id: "amber", label: "Amber", swatch: "#d97706" },
];

const CsvToTable = () => {
  const [fileName, setFileName] = useState("No file selected");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const [error, setError] = useState("");
  const [columnWidths, setColumnWidths] = useState([]);
  const [resizingColumn, setResizingColumn] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // ==========================================
  // MANUAL ENTRY (MODAL) STATE
  // ==========================================
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualText, setManualText] = useState("");
  const [manualError, setManualError] = useState("");

  // ==========================================
  // THEME STATE
  // ==========================================
  const [darkMode, setDarkMode] = useState(false);
  const [themeColor, setThemeColor] = useState("blue");
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const fileInputRef = useRef(null);
  const resizeDataRef = useRef(null);
  const themeMenuRef = useRef(null);
  const manualTextareaRef = useRef(null);

  // ==========================================
  // APPLY THEME TO <html>
  // ==========================================
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add("dark");
    else root.classList.remove("dark");
    root.setAttribute("data-theme", themeColor);
  }, [darkMode, themeColor]);

  // Close theme dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        themeMenuRef.current &&
        !themeMenuRef.current.contains(event.target)
      ) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ==========================================
  // MODAL: ESCAPE + SCROLL LOCK + AUTOFOCUS
  // ==========================================
  useEffect(() => {
    if (!showManualModal) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeManualModal();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // autofocus textarea
    const timer = setTimeout(() => {
      manualTextareaRef.current?.focus();
    }, 50);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      clearTimeout(timer);
    };
  }, [showManualModal]);

  const openManualModal = () => {
    setManualError("");
    setShowManualModal(true);
  };

  const closeManualModal = () => {
    setShowManualModal(false);
    setManualError("");
  };

  // ==========================================
  // CSV FILE PROCESSOR
  // ==========================================

  const processFile = (file) => {
    if (!file) return;
    const isCsv =
      file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");

    if (!isCsv) {
      setError("Please upload a valid CSV file.");
      return;
    }

    setFileName(file.name);
    setError("");

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const csvText = event.target.result;
        loadFromText(csvText, file.name);
      } catch (err) {
        setError(`Error: ${err.message}`);
        setHeaders([]);
        setRows([]);
      }
    };

    reader.onerror = () => {
      setError("Unable to read the file.");
    };

    reader.readAsText(file);
  };

  // ==========================================
  // LOAD FROM TEXT (shared by file + manual entry)
  // ==========================================

  const loadFromText = (csvText, name = "manual_data.csv") => {
    const data = parseCSV(csvText);

    if (!data.length) {
      throw new Error("CSV data is empty.");
    }

    createTable(data);
    setFileName(name);
    setError("");
  };

  // ==========================================
  // FILE SELECT
  // ==========================================

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    processFile(file);
  };

  // ==========================================
  // DRAG & DROP
  // ==========================================

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(true);
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (!file) return;

    processFile(file);
  };

  // ==========================================
  // CSV PARSER
  // ==========================================

  const parseCSV = (text) => {
    const result = [];

    let row = [];
    let value = "";
    let insideQuotes = false;

    text = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          value += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        row.push(value);
        value = "";
      } else if ((char === "\n" || char === "\r") && !insideQuotes) {
        if (char === "\r" && nextChar === "\n") {
          i++;
        }

        row.push(value);
        value = "";

        if (row.some((cell) => cell.trim() !== "")) {
          result.push(row);
        }

        row = [];
      } else {
        value += char;
      }
    }

    row.push(value);

    if (row.some((cell) => cell.trim() !== "")) {
      result.push(row);
    }

    return result;
  };

  // ==========================================
  // CREATE TABLE
  // ==========================================

  const createTable = (data) => {
    const tableHeaders = data[0].map((header) => header.trim());

    const tableRows = data
      .slice(1)
      .map((row) => tableHeaders.map((_, index) => row[index] ?? ""));

    setHeaders(tableHeaders);
    setRows(tableRows);

    setColumnWidths(tableHeaders.map(() => DEFAULT_COLUMN_WIDTH));

    setSearchValue("");
    setError("");
  };

  // ==========================================
  // MANUAL ENTRY HANDLERS
  // ==========================================

  const handleManualSubmit = () => {
    setManualError("");

    const trimmed = manualText.trim();

    if (!trimmed) {
      setManualError("Please enter some CSV data first.");
      return;
    }

    try {
      loadFromText(trimmed, "manual_data.csv");
      // Close modal + reset after successful load
      setShowManualModal(false);
      setManualText("");
    } catch (err) {
      setManualError(`Error: ${err.message}`);
    }
  };

  const handleManualClear = () => {
    setManualText("");
    setManualError("");
    manualTextareaRef.current?.focus();
  };

  // ==========================================
  // UPDATE CELL
  // ==========================================

  const updateCell = (rowIndex, columnIndex, value) => {
    setRows((previousRows) => {
      const updatedRows = [...previousRows];

      updatedRows[rowIndex] = [...updatedRows[rowIndex]];

      updatedRows[rowIndex][columnIndex] = value;

      return updatedRows;
    });
  };

  // ==========================================
  // ADD ROW
  // ==========================================

  const addRow = () => {
    if (!headers.length) {
      setError("Please upload a CSV file first.");
      return;
    }

    const newRow = headers.map(() => "");

    setRows((previousRows) => [...previousRows, newRow]);

    setError("");
  };

  // ==========================================
  // DELETE ROW
  // ==========================================

  const deleteRow = (rowIndex) => {
    setRows((previousRows) =>
      previousRows.filter((_, index) => index !== rowIndex),
    );
  };

  // ==========================================
  // COLUMN RESIZE
  // ==========================================

  const startColumnResize = (event, columnIndex) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;

    const startWidth = columnWidths[columnIndex] || DEFAULT_COLUMN_WIDTH;

    resizeDataRef.current = {
      columnIndex,
      startX,
      startWidth,
    };

    setResizingColumn(columnIndex);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!resizeDataRef.current) return;

      const { columnIndex, startX, startWidth } = resizeDataRef.current;

      const difference = event.clientX - startX;

      const newWidth = Math.max(
        MIN_COLUMN_WIDTH,
        Math.min(MAX_COLUMN_WIDTH, startWidth + difference),
      );

      setColumnWidths((previous) => {
        const updated = [...previous];

        updated[columnIndex] = newWidth;

        return updated;
      });
    };

    const handleMouseUp = () => {
      resizeDataRef.current = null;
      setResizingColumn(null);

      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);

    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);

      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // ==========================================
  // SEARCH
  // ==========================================

  const filteredRows = rows
    .map((row, index) => ({
      row,
      originalIndex: index,
    }))
    .filter(({ row }) => {
      const search = searchValue.toLowerCase().trim();

      if (!search) return true;

      return row.join(" ").toLowerCase().includes(search);
    });

  // ==========================================
  // EXPORT CSV
  // ==========================================

  const escapeCSV = (value) => {
    const stringValue = String(value ?? "");

    if (
      stringValue.includes(",") ||
      stringValue.includes('"') ||
      stringValue.includes("\n")
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  };

  const exportCSV = () => {
    if (!headers.length) return;

    const csvRows = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ];

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = fileName.replace(/\.[^/.]+$/, "") + "_updated.csv";

    link.click();

    URL.revokeObjectURL(url);
  };

  // ==========================================
  // EXPORT PDF
  // ==========================================
  const getThemeRGB = () => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-theme-600")
      .trim();

    // Handle "#rrggbb"
    if (raw.startsWith("#")) {
      const hex = raw.slice(1);
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }

    // Handle "rgb(r, g, b)" or "r g b"
    const nums = raw.match(/\d+/g);
    if (nums && nums.length >= 3) {
      return nums.slice(0, 3).map(Number);
    }

    return [37, 99, 235]; // fallback: blue
  };

  const exportPDF = () => {
    if (!headers.length) return;

    const doc = new jsPDF({
      orientation: "landscape",
    });

    const headerColor = getThemeRGB();

    // Striped row fill: slightly tinted with theme, or neutral in dark mode
    const alternateRowFill = darkMode
      ? [30, 41, 59] // slate-800
      : [248, 250, 252]; // slate-50

    // Body text color: dark mode → light, light mode → dark
    const bodyTextColor = darkMode ? [226, 232, 240] : [15, 23, 42];
    const bodyFillColor = darkMode ? [15, 23, 42] : [255, 255, 255];

    autoTable(doc, {
      head: [headers],
      body: rows,
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: bodyTextColor,
        fillColor: bodyFillColor,
      },
      headStyles: {
        fillColor: headerColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: alternateRowFill,
      },
    });

    doc.save(fileName.replace(/\.[^/.]+$/, "") + "_updated.pdf");
  };

  // ==========================================
  // EXPORT HTML
  // ==========================================

  const exportHTML = () => {
    if (!headers.length) return;

    const tableHeader = headers
      .map((header) => `<th>${escapeHTML(header)}</th>`)
      .join("");

    const tableRows = rows
      .map(
        (row) => `
      <tr>
        ${row.map((cell) => `<td>${escapeHTML(cell)}</td>`).join("")}
      </tr>
    `,
      )
      .join("");

    const html = `


<!DOCTYPE html>

<html lang="en">
<head>
<meta charset="UTF-8">
<title>CSV Table</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 40px;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  background: #f8fafc;
  color: #0f172a;
}

h1 {
  margin-bottom: 24px;
  color: #1d4ed8;
}

.table-wrapper {
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  background: #2563eb;
  color: white;
  font-weight: 600;
}

th,
td {
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
}

tr:nth-child(even) {
  background: #f8fafc;
}

</style>

</head>

<body>

<h1>CSV Table</h1>

<div class="table-wrapper">
<table>

<thead>
<tr>
${tableHeader}
</tr>
</thead>

<tbody>
${tableRows}
</tbody>

</table>
</div>

</body>
</html>
`;

    const blob = new Blob([html], {
      type: "text/html",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = fileName.replace(/\.[^/.]+$/, "") + "_updated.html";

    link.click();

    URL.revokeObjectURL(url);
  };

  // ==========================================
  // ESCAPE HTML
  // ==========================================

  const escapeHTML = (value) => {
    return String(value ?? "")
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, "'")
      .replace(/'/g, "'");
  };

  // ==========================================
  // CLEAR
  // ==========================================

  const handleClear = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setFileName("No file selected");
    setHeaders([]);
    setRows([]);
    setSearchValue("");
    setError("");
    setColumnWidths([]);
    setIsDragging(false);
  };

  // ==========================================
  // BUTTON CLASS
  // ==========================================

  const outlineButton =
    "inline-flex items-center justify-center gap-2 rounded-lg border border-theme-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-theme-600 shadow-sm transition-all duration-200 hover:border-theme-600 hover:bg-theme-600 hover:text-white hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-theme-200 disabled:hover:bg-white disabled:hover:text-theme-600 disabled:hover:shadow-sm disabled:active:scale-100 dark:border-slate-700 dark:bg-slate-800 dark:text-theme-300 dark:hover:border-theme-600 dark:hover:bg-theme-600 dark:hover:text-white dark:disabled:hover:border-slate-700 dark:disabled:hover:bg-slate-800 dark:disabled:hover:text-theme-300";

  return (
    <div className="min-h-screen bg-slate-50 sm:py-5  text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      {" "}
      <div className="mx-auto max-w-[1500px]">
        {/* ======================================
        MAIN CARD
    ====================================== */}

        <div className="overflow-hidden sm:rounded-2xl border border-slate-200 bg-white shadow-[0_8px_40px_rgba(15,23,42,0.06)] transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
          {/* ======================================
          HEADER
      ====================================== */}

          <div className="border-b border-slate-200 px-3 py-5 dark:border-slate-800 sm:px-6">
            <div className="flex gap-4 flex-wrap items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-theme-50 text-theme-600 dark:bg-slate-800 dark:text-theme-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.8}
                    stroke="currentColor"
                    className="h-6 w-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                    />

                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14 3v5h5"
                    />

                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 13h8M8 17h5"
                    />
                  </svg>
                </div>

                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
                    CSV Editor
                  </h1>

                  <p className="mt-1 text-xs md:text-sm text-slate-500 dark:text-slate-400">
                    Upload, edit, search and export your CSV data.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {headers.length > 0 && (
                  <div className="flex items-center gap-2 rounded-full border border-theme-100 bg-theme-50 px-3 py-1.5 text-xs font-medium text-theme-700 dark:border-slate-700 dark:bg-slate-800 dark:text-theme-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-theme-500" />
                    {rows.length} rows
                    <span className="text-theme-300">•</span>
                    {headers.length} columns
                  </div>
                )}

                {/* ======================================
                    THEME CONTROLS
                ====================================== */}
                <div className="flex items-center gap-2">
                  {/* Theme color picker */}
                  <div className="relative" ref={themeMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowThemeMenu((prev) => !prev)}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      title="Change theme color"
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-black/10"
                        style={{ backgroundColor: "var(--color-theme-600)" }}
                      />
                      <span className="hidden sm:inline">Theme</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-3.5 w-3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m6 9 6 6 6-6"
                        />
                      </svg>
                    </button>

                    {showThemeMenu && (
                      <div className="absolute left-0 right-auto z-50 mt-2 w-48 overflow-hidden rounded-xl border      border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-800 md:left-auto md:right-0">
                        <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Accent Color
                        </p>
                        {THEMES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setThemeColor(t.id);
                              setShowThemeMenu(false);
                            }}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors ${
                              themeColor === t.id
                                ? "bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white"
                                : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/60"
                            }`}
                          >
                            <span
                              className="h-4 w-4 rounded-full border border-black/10"
                              style={{ backgroundColor: t.swatch }}
                            />
                            <span className="flex-1">{t.label}</span>
                            {themeColor === t.id && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2.5}
                                stroke="currentColor"
                                className="h-3.5 w-3.5"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m5 13 4 4L19 7"
                                />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Dark mode toggle */}
                  <button
                    type="button"
                    onClick={() => setDarkMode((prev) => !prev)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    title={
                      darkMode ? "Switch to light mode" : "Switch to dark mode"
                    }
                    aria-label="Toggle dark mode"
                  >
                    {darkMode ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.8}
                        stroke="currentColor"
                        className="h-5 w-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36 6.36-1.42-1.42M7.05 7.05 5.64 5.64m12.72 0-1.42 1.42M7.05 16.95l-1.41 1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.8}
                        stroke="currentColor"
                        className="h-5 w-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================
          UPLOAD AREA
      ====================================== */}

          <div className="px-3 pt-5 sm:px-6">
            <div
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative overflow-hidden rounded-xl border border-dashed transition-all duration-200 ${
                isDragging
                  ? "border-theme-500 bg-theme-50 ring-4 ring-theme-100 dark:bg-theme-600/10 dark:ring-theme-600/20"
                  : "border-slate-300 bg-slate-50/70 hover:border-theme-300 hover:bg-theme-50/30 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-theme-600 dark:hover:bg-theme-600/10"
              }`}
            >
              <div className="flex flex-col items-center justify-center px-5 py-7 text-center sm:py-8">
                <div
                  className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                    isDragging
                      ? "bg-theme-600 text-white"
                      : "bg-theme-50 text-theme-600 dark:bg-slate-800 dark:text-theme-300"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.8}
                    stroke="currentColor"
                    className="h-6 w-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 16V4m0 0L8 8m4-4 4 4"
                    />

                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16.5v1.25A2.25 2.25 0 0 0 6.25 20h11.5A2.25 2.25 0 0 0 20 17.75V16.5"
                    />
                  </svg>
                </div>

                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {isDragging
                    ? "Drop your CSV file here"
                    : "Upload your CSV file"}
                </h2>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Drag & drop your file here, or
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <label
                    htmlFor="csvFile"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-theme-200 bg-white px-4 py-2 text-sm font-semibold text-theme-600 shadow-sm transition-all duration-200 hover:border-theme-600 hover:bg-theme-600 hover:text-white hover:shadow-md active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-theme-300 dark:hover:border-theme-600 dark:hover:bg-theme-600 dark:hover:text-white"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.8}
                      stroke="currentColor"
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 16V4m0 0L8 8m4-4 4 4"
                      />

                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16.5v1.25A2.25 2.25 0 0 0 6.25 20h11.5A2.25 2.25 0 0 0 20 17.75V16.5"
                      />
                    </svg>
                    Choose CSV
                  </label>

                  {/* Manual Entry → opens modal */}
                  <button
                    type="button"
                    onClick={openManualModal}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.8}
                      stroke="currentColor"
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.86 4.49a2 2 0 0 1 2.83 2.83L7.5 19.5 3 21l1.5-4.5L16.86 4.49Z"
                      />
                    </svg>
                    Write Manually
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  id="csvFile"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                  CSV files only
                </p>
              </div>
            </div>
          </div>

          {/* ======================================
          FILE INFORMATION
      ====================================== */}

          {headers.length > 0 && (
            <div className="px-5 pt-4 sm:px-6">
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-theme-50 text-theme-600 dark:bg-slate-800 dark:text-theme-300">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.8}
                      stroke="currentColor"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                      />

                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 3v5h5"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {fileName}
                    </p>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {rows.length} records loaded
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.8}
                    stroke="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 7h12M9 7V4h6v3m-7 4v5m8-5v5M7 7l1 13h8l1-13"
                    />
                  </svg>
                  Remove file
                </button>
              </div>
            </div>
          )}

          {/* ======================================
          TOOLBAR
      ====================================== */}

          {/* ======================================
          SEARCH
      ====================================== */}

          <div className="flex gap-3 flex-wrap justify-between px-3 pt-4 sm:px-6">
            <div className="relative w-full md:w-auto">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
                />
              </svg>

              <input
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-theme-400 focus:bg-white focus:ring-2 focus:ring-theme-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
              />

              {searchValue && (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m6 6 12 12M6 18 18 6"
                    />
                  </svg>
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={addRow} className={outlineButton}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 5v14M5 12h14"
                  />
                </svg>
                Add Row
              </button>

              <button
                type="button"
                onClick={exportCSV}
                disabled={!headers.length}
                className={outlineButton}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v12m0 0 4-4m-4 4-4-4"
                  />

                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 21h14"
                  />
                </svg>
                CSV
              </button>

              <button
                type="button"
                onClick={exportPDF}
                disabled={!headers.length}
                className={outlineButton}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                  />

                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 3v5h5"
                  />

                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 14h8M8 17h5"
                  />
                </svg>
                PDF
              </button>

              <button
                type="button"
                onClick={exportHTML}
                disabled={!headers.length}
                className={outlineButton}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m8 9-3 3 3 3m8-6 3 3-3 3M14 5l-4 14"
                  />
                </svg>
                HTML
              </button>
            </div>
          </div>

          {/* ======================================
          ERROR
      ====================================== */}

          {error && (
            <div className="px-5 pt-4 sm:px-6">
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                  className="mt-0.5 h-5 w-5 shrink-0"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.5m0 3h.01M10.3 4.7 2.9 17.5A2 2 0 0 0 4.63 20.5h14.74a2 2 0 0 0 1.73-3L13.7 4.7a2 2 0 0 0-3.4 0Z"
                  />
                </svg>

                <span>{error}</span>
              </div>
            </div>
          )}

          {/* ======================================
          TABLE
      ====================================== */}

          <div className="px-3 py-5 sm:px-6">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              {!headers.length ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-7 w-7"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                      />

                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M14 3v5h5"
                      />
                    </svg>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    No CSV data loaded
                  </h3>

                  <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400 dark:text-slate-500">
                    Upload a CSV file above to start editing your data.
                  </p>
                </div>
              ) : (
                <div className="modern-scrollbar max-h-[520px] overflow-auto">
                  <table className="w-max min-w-full table-fixed border-separate border-spacing-0">
                    <thead className="sticky top-0 z-20">
                      <tr>
                        {headers.map((header, index) => {
                          const width =
                            columnWidths[index] || DEFAULT_COLUMN_WIDTH;

                          return (
                            <th
                              key={index}
                              style={{
                                width,
                                minWidth: width,
                              }}
                              className="relative border-b border-r border-theme-700 bg-theme-600 px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide text-white"
                            >
                              <div className="truncate pr-3">{header}</div>

                              <div
                                onMouseDown={(event) =>
                                  startColumnResize(event, index)
                                }
                                className={`absolute right-0 top-0 z-30 h-full w-2 cursor-col-resize transition-colors ${
                                  resizingColumn === index
                                    ? "bg-theme-200"
                                    : "hover:bg-theme-300/70"
                                }`}
                              />
                            </th>
                          );
                        })}

                        <th className="sticky right-0 z-30 w-30 border-b border-theme-700 bg-theme-600 px-3 py-3.5 text-center text-xs font-bold uppercase tracking-wide text-white">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredRows.map(({ row, originalIndex }) => (
                        <tr
                          key={originalIndex}
                          className="group transition-colors hover:bg-theme-50/40 dark:hover:bg-slate-800/60"
                        >
                          {headers.map((_, columnIndex) => {
                            const width =
                              columnWidths[columnIndex] || DEFAULT_COLUMN_WIDTH;

                            return (
                              <td
                                key={columnIndex}
                                style={{
                                  width,
                                  minWidth: width,
                                }}
                                className="border-b border-r border-slate-200 p-1 dark:border-slate-800"
                              >
                                <input
                                  type="text"
                                  value={row[columnIndex] ?? ""}
                                  onChange={(event) =>
                                    updateCell(
                                      originalIndex,
                                      columnIndex,
                                      event.target.value,
                                    )
                                  }
                                  className="w-full min-w-0 rounded-md bg-transparent px-2.5 py-2 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:bg-theme-50 focus:ring-1 focus:ring-theme-300 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-theme-600"
                                />
                              </td>
                            );
                          })}

                          <td className="sticky right-0 border-b border-slate-200 bg-white p-2 text-center transition-colors group-hover:bg-theme-50 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-slate-800">
                            <button
                              type="button"
                              onClick={() => deleteRow(originalIndex)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.8}
                                stroke="currentColor"
                                className="h-4 w-4"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 7h12M9 7V4h6v3m-7 4v5m8-5v5M7 7l1 13h8l1-13"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}

                      {filteredRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={headers.length + 1}
                            className="px-6 py-14 text-center"
                          >
                            <div className="flex flex-col items-center">
                              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={1.6}
                                  stroke="currentColor"
                                  className="h-5 w-5"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
                                  />
                                </svg>
                              </div>

                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                No matching records
                              </p>

                              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                Try changing your search keyword.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ======================================
            TABLE INFO
        ====================================== */}

            {headers.length > 0 && (
              <div className="flex flex-col gap-2 pt-3 text-xs text-slate-400 dark:text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing{" "}
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {filteredRows.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    {rows.length}
                  </span>{" "}
                  rows
                </span>

                <span>
                  {headers.length} columns
                  {searchValue && (
                    <>
                      {" "}
                      • filtered by "
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        {searchValue}
                      </span>
                      "
                    </>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* ======================================
          FOOTER TIP
      ====================================== */}

          <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60 sm:px-6">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-theme-100 text-theme-600 dark:bg-slate-800 dark:text-theme-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.8}
                    stroke="currentColor"
                    className="h-3 w-3"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 17v.01M12 7a4 4 0 0 1 4 4c0 2-4 3-4 5"
                    />
                  </svg>
                </span>
                Click any cell to edit
              </span>

              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                Drag column edges to resize
              </span>

              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                Changes are kept in the current session
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* ========================================
      MANUAL ENTRY MODAL
  ======================================== */}
      {showManualModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-entry-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={closeManualModal}
          />

          {/* Modal Card */}
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-theme-50 text-theme-600 dark:bg-slate-800 dark:text-theme-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.8}
                    stroke="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.86 4.49a2 2 0 0 1 2.83 2.83L7.5 19.5 3 21l1.5-4.5L16.86 4.49Z"
                    />
                  </svg>
                </div>

                <div>
                  <h3
                    id="manual-entry-title"
                    className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100"
                  >
                    Manual CSV Entry
                  </h3>

                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Type or paste CSV data. The first line becomes the header
                    row.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeManualModal}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m6 6 12 12M6 18 18 6"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="modern-scrollbar flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <textarea
                ref={manualTextareaRef}
                value={manualText}
                onChange={(event) => {
                  setManualText(event.target.value);
                  if (manualError) setManualError("");
                }}
                rows={12}
                spellCheck={false}
                placeholder={`name,email,role\nJohn Doe,john@example.com,Admin\nJane Smith,jane@example.com,Editor`}
                className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-theme-400 focus:bg-white focus:ring-2 focus:ring-theme-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
              />

              {manualError && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.8}
                    stroke="currentColor"
                    className="mt-0.5 h-4 w-4 shrink-0"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.5m0 3h.01M10.3 4.7 2.9 17.5A2 2 0 0 0 4.63 20.5h14.74a2 2 0 0 0 1.73-3L13.7 4.7a2 2 0 0 0-3.4 0Z"
                    />
                  </svg>
                  <span>{manualError}</span>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                <span>{manualText.length} characters</span>
                <span>
                  Tip: press{" "}
                  <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Esc
                  </kbd>{" "}
                  to close
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/60 sm:px-6">
              <button
                type="button"
                onClick={closeManualModal}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleManualClear}
                disabled={!manualText}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={!manualText.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-theme-600 bg-theme-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:border-theme-700 hover:bg-theme-700 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m5 13 4 4L19 7"
                  />
                </svg>
                Load Data
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================
      GLOBAL SCROLLBAR
  ======================================== */}
      <style>{`
    * {
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
    }

    *::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    *::-webkit-scrollbar-track {
      background: transparent;
    }

    *::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 999px;
    }

    *::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    *::-webkit-scrollbar-corner {
      background: transparent;
    }

    .modern-scrollbar {
      scrollbar-width: thin;
      scrollbar-color: #94a3b8 transparent;
    }

    .modern-scrollbar::-webkit-scrollbar {
      width: 7px;
      height: 7px;
    }

    .modern-scrollbar::-webkit-scrollbar-track {
      background: #f8fafc;
    }

    .modern-scrollbar::-webkit-scrollbar-thumb {
      background: #94a3b8;
      border-radius: 999px;
      border: 2px solid #f8fafc;
    }

    .modern-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #64748b;
    }

    /* Dark-mode scrollbar overrides */
    .dark *::-webkit-scrollbar-thumb {
      background: #475569;
    }
    .dark *::-webkit-scrollbar-thumb:hover {
      background: #64748b;
    }
    .dark .modern-scrollbar {
      scrollbar-color: #475569 transparent;
    }
    .dark .modern-scrollbar::-webkit-scrollbar-track {
      background: #0f172a;
    }
    .dark .modern-scrollbar::-webkit-scrollbar-thumb {
      background: #475569;
      border-color: #0f172a;
    }
    .dark .modern-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #64748b;
    }
  `}</style>
    </div>
  );
};

export default CsvToTable;
