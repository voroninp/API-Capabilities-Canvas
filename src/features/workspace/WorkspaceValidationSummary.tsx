import { summarizeIssues, type ValidationIssue } from '../../domain/validation'

export function WorkspaceValidationSummary({
  issues,
  saveState,
}: {
  readonly issues: readonly ValidationIssue[]
  readonly saveState: string
}) {
  const summary = summarizeIssues(issues)

  return (
    <aside className="note-card validation-summary">
      <p className="eyebrow">Validation and persistence</p>
      <div className="pill-row">
        <span className="pill success">{summary.errors} errors</span>
        <span className="pill warning">{summary.warnings} warnings</span>
        <span className="pill info">{summary.infos} info</span>
        <span aria-atomic="true" aria-live="polite" className="pill" role="status">
          {saveState}
        </span>
      </div>
      <div className="issues-list">
        {issues.length === 0 ? <p className="helper-text">No validation issues.</p> : null}
        {issues.map((issue) => (
          <article className={`issue-card ${issue.severity}`} key={issue.id}>
            <strong>{issue.severity.toUpperCase()}</strong>
            {issue.title ? <h4 className="issue-title">{issue.title}</h4> : null}
            <p>{issue.message}</p>
            <span className="helper-text mono">{issue.path}</span>
          </article>
        ))}
      </div>
    </aside>
  )
}
