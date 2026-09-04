import { useState } from "react";
import {
  AlertTriangle,
  Bug,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Gauge,
  Shield,
  Sparkles,
  WandSparkles,
  X,
  FileCode2,
  ArrowRight,
  CircleDot,
} from "lucide-react";
import "./App.css";

function buildDiffLines(before, after) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  const rows = [];

  for (let i = 0; i < maxLines; i++) {
    const beforeLine = beforeLines[i];
    const afterLine = afterLines[i];

    if (beforeLine === afterLine) {
      rows.push({
        type: "same",
        before: beforeLine ?? "",
        after: afterLine ?? "",
        beforeNumber: beforeLine !== undefined ? i + 1 : "",
        afterNumber: afterLine !== undefined ? i + 1 : "",
      });
    } else {
      rows.push({
        type: beforeLine === undefined ? "added" : "changed",
        before: beforeLine ?? "",
        after: afterLine ?? "",
        beforeNumber: beforeLine !== undefined ? i + 1 : "",
        afterNumber: afterLine !== undefined ? i + 1 : "",
      });
    }
  }

  return rows;
}

function App() {
  const [language, setLanguage] = useState("Python");
  const [fileName, setFileName] = useState("main.py");
  const [code, setCode] = useState(
    `def divide(a, b):
    return a / b`
  );

  const [reviewResult, setReviewResult] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [expandedIssue, setExpandedIssue] = useState(null);

  const [fixingIssueId, setFixingIssueId] = useState(null);
  const [fixResult, setFixResult] = useState(null);
  const [fixError, setFixError] = useState("");
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const diffLines = fixResult ? buildDiffLines(code, fixResult.fixed_code) : [];

  const reviewCode = async () => {
    if (!code.trim()) {
      setReviewError("Please enter some code first.");
      return;
    }

    setIsReviewing(true);
    setReviewError("");
    setReviewResult(null);
    setFixResult(null);
    setFixError("");

    try {
      const response = await fetch("http://127.0.0.1:8000/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Review failed.");
      }

      setReviewResult(data);
    } catch (error) {
      setReviewError(error.message || "Unable to review code.");
    } finally {
      setIsReviewing(false);
    }
  };

  const fixWithAI = async (issue) => {
    setFixingIssueId(issue.id);
    setFixError("");
    setFixResult(null);
    setCopied(false);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          issue: `${issue.title}

${issue.explanation}

Suggested fix: ${issue.suggested_fix}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "AI fix failed.");
      }

      setFixResult({
        issue,
        explanation: data.explanation,
        fixed_code: data.fixed_code,
      });
    } catch (error) {
      setFixError(error.message || "Unable to generate the AI fix.");
    } finally {
      setFixingIssueId(null);
    }
  };

  const copyFixedCode = async () => {
    if (!fixResult?.fixed_code) return;

    try {
      await navigator.clipboard.writeText(fixResult.fixed_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFixError("Could not copy the fixed code.");
    }
  };

  const copyEditorCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1800);
    } catch {
      setReviewError("Could not copy the code.");
    }
  };

  const applyFixedCode = () => {
    if (!fixResult?.fixed_code) return;
    setCode(fixResult.fixed_code);
    setFixResult(null);
    setCopied(false);
  };

  const getSeverityIcon = (severity) => {
    if (severity === "critical") return <AlertTriangle size={18} />;
    if (severity === "warning") return <Bug size={18} />;
    return <Sparkles size={18} />;
  };

  const getCategoryIcon = (category) => {
    if (category === "security") return <Shield size={14} />;
    if (category === "performance") return <Gauge size={14} />;
    return <Code2 size={14} />;
  };

  const getSeverityClass = (severity) => {
    if (severity === "critical") return "severity-critical";
    if (severity === "warning") return "severity-warning";
    return "severity-suggestion";
  };

  const issues = reviewResult?.issues || [];
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const suggestionCount = issues.filter((i) => i.severity === "suggestion").length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <WandSparkles size={19} />
          </div>
          <div>
            <div className="brand-name">CodePilot</div>
            <div className="brand-subtitle">AI Code Review Agent</div>
          </div>
        </div>

        <div className="topbar-right">
          <div className="topbar-pill">
            <span className="status-dot" />
            Gemini AI
          </div>
          <div className="engine-status">
            <CircleDot size={13} />
            Engine Ready
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="hero">
          <div className="hero-badge">
            <Sparkles size={14} />
            Intelligent code analysis
          </div>

          <h1>
            Ship better code,
            <span> with AI.</span>
          </h1>

          <p>
            Review code for bugs, security risks, and performance issues —
            then generate a clear, ready-to-apply fix.
          </p>

          <div className="hero-points">
            <span><Check size={14} /> Bugs</span>
            <span><Check size={14} /> Security</span>
            <span><Check size={14} /> Performance</span>
          </div>
        </section>

        <section className="workspace-card">
          <div className="section-top">
            <div>
              <div className="section-kicker">WORKSPACE</div>
              <h2>Review your code</h2>
              <p>Paste a code snippet and let CodePilot inspect it.</p>
            </div>
            <div className="workspace-badge">
              <FileCode2 size={15} />
              AI-assisted
            </div>
          </div>

          <div className="controls-row">
            <div className="control-group">
              <label>Language</label>
              <div className="select-wrap">
                <select
                  value={language}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLanguage(value);

                    const extensions = {
                      Python: "py",
                      JavaScript: "js",
                      TypeScript: "ts",
                      Java: "java",
                      "C++": "cpp",
                      "C#": "cs",
                    };

                    setFileName(`main.${extensions[value] || "txt"}`);
                  }}
                >
                  <option>Python</option>
                  <option>JavaScript</option>
                  <option>TypeScript</option>
                  <option>Java</option>
                  <option>C++</option>
                  <option>C#</option>
                </select>
                <ChevronDown size={15} />
              </div>
            </div>

            <div className="control-group">
              <label>File name</label>
              <input
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
              />
            </div>
          </div>

          <div className="editor-wrapper">
            <div className="editor-toolbar">
              <div className="editor-file">
                <span className="file-dot" />
                <span>{fileName}</span>
              </div>

              <button
                className="icon-button"
                onClick={copyEditorCode}
                title="Copy code"
              >
                {codeCopied ? <Check size={15} /> : <Copy size={15} />}
                <span>{codeCopied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <div className="editor-body">
              <div className="editor-gutter" aria-hidden="true">
                {code.split("\n").map((_, index) => (
                  <span key={index}>{index + 1}</span>
                ))}
              </div>

              <textarea
                className="code-editor"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                spellCheck="false"
                placeholder="Paste your code here..."
              />
            </div>
          </div>

          <div className="checks-row">
            <span className="checks-label">AI checks</span>
            <span className="check-chip"><Bug size={13} /> Bugs</span>
            <span className="check-chip"><Shield size={13} /> Security</span>
            <span className="check-chip"><Gauge size={13} /> Performance</span>
          </div>

          <button
            className="review-button"
            onClick={reviewCode}
            disabled={isReviewing}
          >
            {isReviewing ? (
              <>
                <span className="button-spinner" />
                Analyzing code...
              </>
            ) : (
              <>
                <Sparkles size={17} />
                Review Code
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {reviewError && (
            <div className="error-message">
              <AlertTriangle size={16} />
              <span>{reviewError}</span>
            </div>
          )}
        </section>

        {reviewResult && (
          <section className="results-section">
            <div className="results-heading">
              <div>
                <div className="section-kicker">ANALYSIS COMPLETE</div>
                <h2>Review Results</h2>
                <p className="results-subtitle">
                  CodePilot found {issues.length} actionable finding{issues.length === 1 ? "" : "s"}.
                </p>
              </div>

              <div className="quality-score">
                <div
                  className="score-ring"
                  style={{
                    "--score": `${Math.max(0, Math.min(100, reviewResult.score))}%`,
                  }}
                >
                  <div className="score-ring-inner">
                    <strong>{reviewResult.score}</strong>
                    <span>/100</span>
                  </div>
                </div>
                <div>
                  <div className="score-label">Quality score</div>
                  <div className="score-note">AI assessment</div>
                </div>
              </div>
            </div>

            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-icon critical-icon">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <strong>{criticalCount}</strong>
                  <span>Critical</span>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-icon warning-icon">
                  <Bug size={18} />
                </div>
                <div>
                  <strong>{warningCount}</strong>
                  <span>Warnings</span>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-icon suggestion-icon">
                  <Sparkles size={18} />
                </div>
                <div>
                  <strong>{suggestionCount}</strong>
                  <span>Suggestions</span>
                </div>
              </div>

              <div className="summary-card">
                <div className="summary-icon total-icon">
                  <Code2 size={18} />
                </div>
                <div>
                  <strong>{issues.length}</strong>
                  <span>Total issues</span>
                </div>
              </div>
            </div>

            <div className="issues-header">
              <div>
                <h3>Detected Issues</h3>
                <p>Review each finding and generate an AI-powered fix.</p>
              </div>
              <span className="issue-count">{issues.length} findings</span>
            </div>

            <div className="issues-list">
              {issues.length === 0 ? (
                <div className="no-issues">
                  <div className="success-icon">
                    <Check size={21} />
                  </div>
                  <div>
                    <strong>Looks good!</strong>
                    <p>CodePilot did not find any significant problems in this code.</p>
                  </div>
                </div>
              ) : (
                issues.map((issue) => {
                  const isExpanded = expandedIssue === issue.id;
                  const isFixing = fixingIssueId === issue.id;

                  return (
                    <div
                      className={`issue-card ${isExpanded ? "issue-card-expanded" : ""}`}
                      key={issue.id}
                    >
                      <div className="issue-main">
                        <div className={`severity-icon ${getSeverityClass(issue.severity)}`}>
                          {getSeverityIcon(issue.severity)}
                        </div>

                        <div className="issue-content">
                          <div className="issue-topline">
                            <span className={`severity-badge ${getSeverityClass(issue.severity)}`}>
                              {issue.severity}
                            </span>
                            <span className="category-badge">
                              {getCategoryIcon(issue.category)}
                              {issue.category}
                            </span>
                            <span className="line-number">Line {issue.line}</span>
                          </div>

                          <h4>{issue.title}</h4>
                          <p>{issue.explanation}</p>

                          <div className="suggested-fix">
                            <span className="fix-label">Recommended fix</span>
                            <span>{issue.suggested_fix}</span>
                          </div>

                          <div className="issue-actions">
                            <button
                              className="alternative-button"
                              onClick={() =>
                                setExpandedIssue(isExpanded ? null : issue.id)
                              }
                            >
                              <Sparkles size={14} />
                              Alternative approaches
                              {isExpanded ? (
                                <ChevronUp size={14} />
                              ) : (
                                <ChevronDown size={14} />
                              )}
                            </button>

                            <button
                              className="fix-button"
                              onClick={() => fixWithAI(issue)}
                              disabled={isFixing}
                            >
                              {isFixing ? (
                                <>
                                  <span className="small-spinner" />
                                  Generating fix...
                                </>
                              ) : (
                                <>
                                  <WandSparkles size={14} />
                                  Fix with AI
                                </>
                              )}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="approaches">
                              {issue.approaches.map((approach, index) => (
                                <div
                                  className="approach-card"
                                  key={`${issue.id}-${index}`}
                                >
                                  <div className="approach-number">
                                    0{index + 1}
                                  </div>
                                  <div className="approach-content">
                                    <div className="approach-header">
                                      <strong>{approach.name}</strong>
                                      {approach.recommended && (
                                        <span className="recommended-badge">
                                          Recommended
                                        </span>
                                      )}
                                    </div>
                                    <p>{approach.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {fixError && (
          <div className="error-message fix-error">
            <AlertTriangle size={16} />
            <span>{fixError}</span>
          </div>
        )}

        {fixResult && (
          <section className="fix-section">
            <div className="fix-header">
              <div>
                <div className="section-kicker">AI FIX GENERATED</div>
                <h2>Ready-to-apply fix</h2>
                <p>
                  CodePilot generated a corrected version for{" "}
                  <strong>{fixResult.issue.title}</strong>.
                </p>
              </div>

              <button
                className="close-fix"
                onClick={() => setFixResult(null)}
                title="Close"
              >
                <X size={17} />
              </button>
            </div>

            <div className="fix-explanation">
              <div className="explanation-icon">
                <WandSparkles size={17} />
              </div>
              <div>
                <strong>What was fixed</strong>
                <p>{fixResult.explanation}</p>
              </div>
            </div>

            <div className="diff-container">
              <div className="diff-titlebar">
                <div>
                  <strong>Code changes</strong>
                  <span>Review the AI-generated modification before applying it.</span>
                </div>
                <div className="diff-legend">
                  <span className="legend-item removed">− Removed</span>
                  <span className="legend-item added">+ Added</span>
                </div>
              </div>

              <div className="diff-header">
                <div className="diff-side-title before-title">
                  <span className="window-dot gray-dot" />
                  BEFORE
                </div>
                <div className="diff-side-title after-title">
                  <span className="window-dot green-dot" />
                  AFTER
                </div>
              </div>

              <div className="diff-body">
                {diffLines.map((line, index) => (
                  <div className="diff-row" key={index}>
                    <div
                      className={`diff-side ${
                        line.type === "changed" ? "diff-removed" : ""
                      }`}
                    >
                      <span className="diff-line-number">{line.beforeNumber}</span>
                      <span className="diff-symbol">
                        {line.type === "changed" ? "−" : " "}
                      </span>
                      <code>{line.before}</code>
                    </div>

                    <div
                      className={`diff-side ${
                        line.type === "changed" ? "diff-added" : ""
                      }`}
                    >
                      <span className="diff-line-number">{line.afterNumber}</span>
                      <span className="diff-symbol">
                        {line.type === "changed" ? "+" : " "}
                      </span>
                      <code>{line.after}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="fix-actions">
              <button className="secondary-button" onClick={copyFixedCode}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Copied!" : "Copy fixed code"}
              </button>

              <button className="apply-button" onClick={applyFixedCode}>
                <Check size={15} />
                Apply fix to editor
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <div>
          <span className="footer-brand">CodePilot</span>
          <span>AI-powered software engineering assistant</span>
        </div>
        <span>Built with React + FastAPI + Gemini</span>
      </footer>
    </div>
  );
}

export default App;
