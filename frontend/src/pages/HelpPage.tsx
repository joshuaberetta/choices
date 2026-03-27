import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'

interface Section {
  id: string
  label: string
  subsections?: { id: string; label: string }[]
}

const sections: Section[] = [
  { id: 'overview', label: 'Overview' },
  {
    id: 'projects',
    label: 'Projects',
    subsections: [
      { id: 'projects-create', label: 'Creating a project' },
      { id: 'projects-edit', label: 'Editing & deleting' },
    ],
  },
  {
    id: 'choice-lists',
    label: 'Choice Lists',
    subsections: [
      { id: 'choice-lists-create', label: 'Creating a list' },
      { id: 'choice-lists-settings', label: 'List settings' },
    ],
  },
  {
    id: 'choices',
    label: 'Managing Choices',
    subsections: [
      { id: 'choices-add', label: 'Adding choices' },
      { id: 'choices-edit', label: 'Editing inline' },
      { id: 'choices-reorder', label: 'Reordering' },
      { id: 'choices-delete', label: 'Deleting' },
    ],
  },
  {
    id: 'csv',
    label: 'CSV Import & Export',
    subsections: [
      { id: 'csv-export', label: 'Export' },
      { id: 'csv-import', label: 'Import' },
      { id: 'csv-format', label: 'CSV format' },
    ],
  },
  {
    id: 'columns',
    label: 'Extra Columns',
    subsections: [
      { id: 'columns-add', label: 'Adding columns' },
      { id: 'columns-edit', label: 'Renaming & deleting' },
      { id: 'columns-values', label: 'Editing cell values' },
    ],
  },
  {
    id: 'system-columns',
    label: 'System Columns',
    subsections: [
      { id: 'system-removed', label: 'removed' },
      { id: 'system-protected', label: 'protected' },
      { id: 'system-pin', label: 'pin' },
    ],
  },
  {
    id: 'name-generation',
    label: 'Name Generation',
  },
  {
    id: 'label-column',
    label: 'Label Column Name',
  },
  {
    id: 'kobo',
    label: 'KoboToolbox Integration',
    subsections: [
      { id: 'kobo-urls', label: 'Webhook URLs' },
      { id: 'kobo-auth', label: 'Webhook authentication' },
      { id: 'kobo-add', label: 'Add endpoint' },
      { id: 'kobo-remove', label: 'Remove endpoint' },
      { id: 'kobo-csv', label: 'CSV export endpoint' },
      { id: 'kobo-xlsform', label: 'XLSForm setup' },
    ],
  },
  {
    id: 'sharing',
    label: 'Sharing & Access',
    subsections: [
      { id: 'sharing-projects', label: 'Project sharing' },
      { id: 'sharing-require-auth', label: 'Webhook authentication' },
    ],
  },
  {
    id: 'public-projects',
    label: 'Public Projects',
  },
  {
    id: 'following',
    label: 'Following Lists',
    subsections: [
      { id: 'following-follow', label: 'Following a list' },
      { id: 'following-customise', label: 'Customising columns' },
      { id: 'following-export', label: 'Custom CSV export URL' },
      { id: 'following-import', label: 'Bulk CSV import' },
    ],
  },
  {
    id: 'collections',
    label: 'Collections',
    subsections: [
      { id: 'collections-create', label: 'Creating a collection' },
      { id: 'collections-projects', label: 'Adding projects' },
      { id: 'collections-sharing', label: 'Sharing collections' },
      { id: 'collections-public', label: 'Public collections' },
    ],
  },
  {
    id: 'account',
    label: 'Your Account',
  },
]

function Heading2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-xl font-semibold text-gray-900 mt-10 mb-3 pb-2 border-b border-gray-200 scroll-mt-6"
    >
      {children}
    </h2>
  )
}

function Heading3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-base font-semibold text-gray-800 mt-6 mb-2 scroll-mt-6">
      {children}
    </h3>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-700 leading-relaxed mb-3">{children}</p>
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-sm bg-gray-100 text-indigo-700 px-1.5 py-0.5 rounded">
      {children}
    </code>
  )
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-gray-900 text-gray-100 text-sm font-mono rounded-lg p-4 overflow-x-auto mb-4 leading-relaxed">
      {children}
    </pre>
  )
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc list-inside space-y-1 text-gray-700 mb-3 ml-1">{children}</ul>
}

function Li({ children }: { children: React.ReactNode }) {
  return <li className="leading-relaxed">{children}</li>
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 mb-4 text-indigo-900 text-sm leading-relaxed">
      <span className="font-semibold">Note: </span>
      {children}
    </div>
  )
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-amber-900 text-sm leading-relaxed">
      <span className="font-semibold">Warning: </span>
      {children}
    </div>
  )
}

export default function HelpPage() {
  const location = useLocation()
  const didScroll = useRef(false)

  // Scroll to hash on first render
  useEffect(() => {
    if (location.hash && !didScroll.current) {
      const el = document.getElementById(location.hash.slice(1))
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        didScroll.current = true
      }
    }
  }, [location.hash])

  return (
    <div className="flex gap-8 items-start">
      {/* Sidebar TOC */}
      <nav className="hidden lg:block w-56 shrink-0 sticky top-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Contents
        </p>
        <ul className="space-y-1 text-sm">
          {sections.map(s => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block text-gray-600 hover:text-indigo-600 font-medium py-0.5 transition-colors"
              >
                {s.label}
              </a>
              {s.subsections && (
                <ul className="ml-3 mt-0.5 space-y-0.5">
                  {s.subsections.map(sub => (
                    <li key={sub.id}>
                      <a
                        href={`#${sub.id}`}
                        className="block text-gray-500 hover:text-indigo-600 py-0.5 transition-colors"
                      >
                        {sub.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Main content */}
      <article className="min-w-0 flex-1 pb-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Help &amp; Documentation</h1>
          <p className="text-gray-500">Everything you need to know about using Choices.</p>
        </div>

        {/* ── Overview ── */}
        <Heading2 id="overview">Overview</Heading2>
        <P>
          <strong>Choices</strong> is a service for managing external choice lists that integrate
          with <a href="https://www.kobotoolbox.org/" className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">KoboToolbox</a> surveys.
          Instead of hard-coding select options in your XLSForm, you point KoboToolbox at a
          live CSV URL hosted here. Choices in that CSV can then be added or removed dynamically
          — for example, when a field survey records a new participant, or when a participant
          leaves.
        </P>
        <P>The app is organised into three levels:</P>
        <Ul>
          <Li><strong>Projects</strong> — each project maps to a KoboToolbox project and has a unique slug (ID).</Li>
          <Li><strong>Choice Lists</strong> — each project can hold many named lists (e.g. <Code>enumerators</Code>, <Code>villages</Code>).</Li>
          <Li><strong>Choices</strong> — each list holds individual options with a machine-readable <em>value</em> and a human-readable <em>label</em>.</Li>
        </Ul>

        {/* ── Projects ── */}
        <Heading2 id="projects">Projects</Heading2>
        <Heading3 id="projects-create">Creating a project</Heading3>
        <P>
          From the home page, click <strong>+ New Project</strong>. Enter a name, a slug, and an
          optional description, then click <strong>Create</strong>.
        </P>
        <Ul>
          <Li>
            The <strong>slug</strong> must match the KoboToolbox project ID exactly (e.g.{' '}
            <Code>aQQv2xc99EodN8pB8GZ6Jq</Code>). You can find this in the KoboToolbox project
            URL.
          </Li>
          <Li>Slugs must be unique per user account.</Li>
        </Ul>

        <Heading3 id="projects-edit">Editing &amp; deleting</Heading3>
        <P>
          Hover over a project row to reveal <strong>Edit</strong>, <strong>Settings</strong>,
          and <strong>Delete</strong> buttons (owner only). Editing opens an inline form;
          deleting requires a confirmation click to prevent accidents. Deleting a project
          permanently removes all its choice lists and choices.
        </P>
        <P>
          The <strong>Settings</strong> panel lets you toggle whether the project is public
          and manage which other users the project is shared with. See{' '}
          <a href="#sharing" className="text-indigo-600 hover:underline">Sharing &amp; Access</a> for details.
        </P>

        {/* ── Choice Lists ── */}
        <Heading2 id="choice-lists">Choice Lists</Heading2>
        <Heading3 id="choice-lists-create">Creating a list</Heading3>
        <P>
          Inside any project, click <strong>+ New List</strong>. Provide a name and a slug.
          The slug becomes part of the KoboToolbox webhook URL and CSV export URL, so choose
          something short and stable (e.g. <Code>enumerators</Code>).
        </P>
        <Note>
          List slugs must be unique within a project. Changing a slug after you have already
          configured KoboToolbox will break the integration until you update the URLs there too.
        </Note>

        <Heading3 id="choice-lists-settings">List settings</Heading3>
        <P>
          Open a list by clicking its name or the <strong>View →</strong> button. The detail
          page exposes several settings:
        </P>
        <Ul>
          <Li><strong>Label column name</strong> — the CSV column header used for the label (see <a href="#label-column" className="text-indigo-600 hover:underline">Label Column Name</a>).</Li>
          <Li><strong>Name generation</strong> — how the machine-readable <em>value</em> is generated for new choices (see <a href="#name-generation" className="text-indigo-600 hover:underline">Name Generation</a>).</Li>
        </Ul>

        {/* ── Choices ── */}
        <Heading2 id="choices">Managing Choices</Heading2>
        <Heading3 id="choices-add">Adding choices</Heading3>
        <P>
          Use the <strong>+ Add choice</strong> form at the bottom of the choices table. Type a
          label and press <kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono">Enter</kbd> or
          click <strong>Add</strong>. The value/name is generated automatically according to
          the list's <a href="#name-generation" className="text-indigo-600 hover:underline">name generation</a> setting.
        </P>

        <Heading3 id="choices-edit">Editing inline</Heading3>
        <P>
          Click any <strong>label</strong>, <strong>value</strong>, or extra-column cell to edit
          it inline. Press <kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono">Enter</kbd> or
          click outside the cell to save, or press{' '}
          <kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono">Escape</kbd> to cancel.
        </P>
        <Note>
          Labels must be unique within a list. Values must also be unique within a list — take
          care when editing values manually, especially if KoboToolbox already has data
          referencing the old value.
        </Note>

        <Heading3 id="choices-reorder">Reordering</Heading3>
        <P>There are two ways to reorder choices:</P>
        <Ul>
          <Li>
            <strong>Drag and drop</strong> — grab the ⠿ handle on the left of any row and drag
            it to a new position. The order is saved to the server immediately.
          </Li>
          <Li>
            <strong>Sort by column</strong> — click the <strong>Label</strong> or{' '}
            <strong>Value</strong> column header to sort ascending or descending. The sorted
            order is saved to the server. Pinned choices (see <a href="#system-pin" className="text-indigo-600 hover:underline">pin</a>) are always kept at the bottom regardless of sort direction.
          </Li>
        </Ul>

        <Heading3 id="choices-delete">Deleting</Heading3>
        <P>
          Click the <strong>✕</strong> button at the end of a row to permanently delete that
          choice. Protected choices show a <strong>🔒 Protected</strong> badge instead and
          cannot be deleted from the UI (see <a href="#system-protected" className="text-indigo-600 hover:underline">protected</a>).
        </P>
        <Warn>
          Hard deletion is permanent and cannot be undone. If you want to hide a choice from
          KoboToolbox without losing it, use the{' '}
          <a href="#system-removed" className="text-amber-700 underline">removed</a> flag instead.
        </Warn>

        {/* ── CSV ── */}
        <Heading2 id="csv">CSV Import &amp; Export</Heading2>
        <Heading3 id="csv-export">Export</Heading3>
        <P>
          Click the <strong>↓ Download CSV</strong> button on the list detail page to download
          the full choice list as a CSV file. The exported file includes all extra columns
          (including system columns like <Code>removed</Code> and <Code>protected</Code>).
        </P>
        <P>
          This is the same CSV served to KoboToolbox — you can use it to inspect or back up
          your data.
        </P>

        <Heading3 id="csv-import">Import</Heading3>
        <P>
          Click <strong>↑ Import CSV</strong> to replace the entire choice list with the
          contents of a CSV file. A file picker will open; select your file and the import runs
          immediately.
        </P>
        <Warn>
          Import completely replaces all existing choices. Make sure you have a backup (use
          Export first) before importing.
        </Warn>

        <Heading3 id="csv-format">CSV format</Heading3>
        <P>Required columns:</P>
        <Ul>
          <Li><Code>name</Code> or <Code>value</Code> — the machine-readable choice ID.</Li>
          <Li><Code>label</Code> (or any XLSForm translation column starting with <Code>label</Code>, e.g. <Code>label::English (en)</Code>) — the human-readable label.</Li>
        </Ul>
        <P>Example:</P>
        <Pre>{`name,label
abc123,Joshua Beretta
def456,Maria García
ghi789,Ahmed Al-Hassan`}</Pre>
        <P>Additional columns beyond <Code>name</Code> and <Code>label</Code> are automatically created as extra columns on the list. The delimiter is auto-detected — comma, semicolon, tab, and pipe are all supported (which handles semicolon-separated Excel exports).</P>
        <Note>
          The reserved column names <Code>name</Code>, <Code>value</Code>, <Code>label</Code>,{' '}
          <Code>removed</Code>, <Code>protected</Code>, and <Code>pin</Code> cannot be used as
          custom extra column names.
        </Note>

        {/* ── Extra columns ── */}
        <Heading2 id="columns">Extra Columns</Heading2>
        <P>
          Every choice list can have any number of named extra columns — useful for storing
          additional metadata alongside each choice (e.g. a phone number, a region, an
          enumeration area code). Extra columns are included in CSV exports and in the
          KoboToolbox CSV feed.
        </P>

        <Heading3 id="columns-add">Adding columns</Heading3>
        <P>
          Click the <strong>+ column</strong> button in the table header row. Type a name and
          press <kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono">Enter</kbd> or click <strong>Add</strong>.
        </P>

        <Heading3 id="columns-edit">Renaming &amp; deleting</Heading3>
        <P>
          Click a column header name to rename it inline. Click the <strong>✕</strong> button
          that appears next to the header to delete the column and all its values.
        </P>
        <Note>
          System columns (<Code>removed</Code>, <Code>protected</Code>, <Code>pin</Code>) cannot
          be renamed or deleted.
        </Note>

        <Heading3 id="columns-values">Editing cell values</Heading3>
        <P>
          Click any cell in an extra column to edit its value inline. An em-dash (—) indicates
          an empty cell. Press <kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono">Enter</kbd> to save or{' '}
          <kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono">Escape</kbd> to cancel.
        </P>

        {/* ── System columns ── */}
        <Heading2 id="system-columns">System Columns</Heading2>
        <P>
          Three special columns are automatically created on every choice list. They are stored
          the same way as extra columns but have built-in behaviour. They are rendered as
          checkboxes (toggle) in the UI and cannot be renamed or deleted.
        </P>

        <Heading3 id="system-removed">removed</Heading3>
        <P>
          A soft-delete flag. When <Code>removed = true</Code>:
        </P>
        <Ul>
          <Li>The choice remains in the database and is included in CSV exports.</Li>
          <Li>You can filter it out in KoboToolbox by adding a <Code>choice_filter</Code> expression (e.g. <Code>removed != 'true'</Code>).</Li>
          <Li>If the KoboToolbox <strong>/add</strong> webhook receives a label that matches an existing removed choice, it will automatically re-activate it (set <Code>removed = false</Code>) instead of creating a duplicate.</Li>
        </Ul>
        <P>
          The <strong>/remove</strong> webhook sets <Code>removed = true</Code> for a choice by
          its value/ID.
        </P>

        <Heading3 id="system-protected">protected</Heading3>
        <P>
          Prevents a choice from being soft-deleted. When <Code>protected = true</Code>:
        </P>
        <Ul>
          <Li>The <strong>/remove</strong> webhook returns <Code>403 Forbidden</Code> and does not change the choice.</Li>
          <Li>The hard-delete button in the UI is hidden; a 🔒 <strong>Protected</strong> badge is shown instead.</Li>
        </Ul>
        <P>
          Use this to protect reference choices that must never be removed, even accidentally.
        </P>

        <Heading3 id="system-pin">pin</Heading3>
        <P>
          Pins a choice to the bottom of the list. When <Code>pin = true</Code>:
        </P>
        <Ul>
          <Li>The choice is excluded from alphabetical re-sorting when new choices arrive via the <strong>/add</strong> webhook.</Li>
          <Li>Column-header sort (label/value) also keeps pinned choices at the bottom.</Li>
        </Ul>
        <P>
          Useful for catch-all options like "Other" or "Prefer not to say" that should always
          appear last regardless of incoming additions.
        </P>

        {/* ── Name generation ── */}
        <Heading2 id="name-generation">Name Generation</Heading2>
        <P>
          Each list has a <strong>Name generation</strong> setting that controls how the
          machine-readable <em>value</em> (the XLSForm <Code>name</Code> column) is generated
          when a new choice is created via the UI or the <strong>/add</strong> webhook.
        </P>

        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-700 border-b border-gray-200">Mode</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700 border-b border-gray-200">Behaviour</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700 border-b border-gray-200">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-2 font-mono text-indigo-700">uuid</td>
                <td className="px-4 py-2 text-gray-700">Random 9-character short UUID. Stable and opaque — safe for data where the value doesn't need to be human-readable.</td>
                <td className="px-4 py-2 font-mono text-gray-500">sgdgbs324</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-indigo-700">from_label</td>
                <td className="px-4 py-2 text-gray-700">Derived from the label: lowercased, spaces replaced with <Code>_</Code>, non-alphanumeric characters removed, then truncated to the <em>Max length</em> (if set). Collisions get a <Code>_2</Code>, <Code>_3</Code> suffix. <strong>This is the default.</strong></td>
                <td className="px-4 py-2 font-mono text-gray-500">joshua_beretta</td>
              </tr>
            </tbody>
          </table>
        </div>

        <P>
          Set <strong>Max length</strong> (only active in <Code>from_label</Code> mode) to
          truncate generated values — useful when downstream systems have field length limits.
          Leave at <Code>0</Code> for no limit.
        </P>
        <Note>
          Changing the name generation mode only affects <em>new</em> choices. Existing values
          are not modified.
        </Note>

        {/* ── Label column name ── */}
        <Heading2 id="label-column">Label Column Name</Heading2>
        <P>
          By default, the CSV column header for the human-readable label is <Code>label</Code>.
          You can change this per list to support XLSForm multi-language surveys. For example,
          setting it to <Code>label::English (en)</Code> will make KoboToolbox display the
          correct language-aware column.
        </P>
        <P>
          Edit the value in the <strong>Label column name</strong> field on the list detail page
          and click <strong>Save</strong>. The next CSV export and KoboToolbox feed will use the
          new header.
        </P>

        {/* ── KoboToolbox Integration ── */}
        <Heading2 id="kobo">KoboToolbox Integration</Heading2>
        <P>
          Choices exposes webhook endpoints that KoboToolbox can call directly.
          All endpoints are scoped to your username so your data is isolated.
          The CSV export endpoint is always public; the write endpoints (<Code>/add</Code>,{' '}
          <Code>/remove</Code>, <Code>/delete</Code>) require authentication by default — see{' '}
          <a href="#kobo-auth" className="text-indigo-600 hover:underline">Webhook authentication</a> below.
        </P>

        <Heading3 id="kobo-urls">Webhook URLs</Heading3>
        <P>
          On any list detail page, the <strong>KoboToolbox Integration</strong> panel shows the
          four URLs. Click any URL to copy it to the clipboard.
        </P>
        <P>The URL pattern is:</P>
        <Pre>{`https://choices.imtools.info/{username}/{project_slug}/{list_slug}/...`}</Pre>

        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-700 border-b border-gray-200">Method</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700 border-b border-gray-200">Path suffix</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700 border-b border-gray-200">Auth</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-700 border-b border-gray-200">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              <tr>
                <td className="px-4 py-2 font-mono text-green-700">GET</td>
                <td className="px-4 py-2 font-mono text-gray-600">/export/choices.csv</td>
                <td className="px-4 py-2 text-gray-500">Never</td>
                <td className="px-4 py-2 text-gray-700">Download the list as CSV (use as KoboToolbox external choices URL)</td>
              </tr>
              <tr className="bg-gray-50/50">
                <td className="px-4 py-2 font-mono text-blue-700">POST</td>
                <td className="px-4 py-2 font-mono text-gray-600">/add</td>
                <td className="px-4 py-2 text-gray-500">If require_auth</td>
                <td className="px-4 py-2 text-gray-700">Add a new choice (or re-activate a removed one)</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-amber-700">POST</td>
                <td className="px-4 py-2 font-mono text-gray-600">/remove</td>
                <td className="px-4 py-2 text-gray-500">If require_auth</td>
                <td className="px-4 py-2 text-gray-700">Soft-delete a choice (set <Code>removed=true</Code>)</td>
              </tr>
              <tr className="bg-gray-50/50">
                <td className="px-4 py-2 font-mono text-red-700">POST</td>
                <td className="px-4 py-2 font-mono text-gray-600">/delete</td>
                <td className="px-4 py-2 text-gray-500">If require_auth</td>
                <td className="px-4 py-2 text-gray-700">Permanently hard-delete a choice</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Heading3 id="kobo-auth">Webhook authentication</Heading3>
        <P>
          Each choice list has a <strong>Require authentication</strong> toggle in the
          KoboToolbox Integration panel. When enabled (the default), the{' '}
          <Code>/add</Code>, <Code>/remove</Code>, and <Code>/delete</Code> endpoints require{' '}
          <strong>HTTP Basic Authentication</strong>. Use your Choices username and password
          when configuring the KoboToolbox REST service.
        </P>
        <P>
          Authentication is accepted for the project owner and any users the project has been{' '}
          <a href="#sharing-projects" className="text-indigo-600 hover:underline">shared with</a>.
          The CSV export endpoint is always public regardless of this setting.
        </P>
        <Warn>
          Disabling authentication means anyone who knows the endpoint URL can add or remove
          choices without credentials. Only disable this if your KoboToolbox deployment cannot
          send Basic Auth headers.
        </Warn>

        <Heading3 id="kobo-add">Add endpoint</Heading3>
        <P>
          Send a POST with a JSON body containing the label of the choice to add. The key name
          does not matter — only the first value in the object is used.
        </P>
        <Pre>{`POST /{username}/{project}/{list}/add
Content-Type: application/json

{ "name": "Maria García" }`}</Pre>
        <P>
          The endpoint is <strong>idempotent</strong> — if a choice with that label already
          exists (and is not removed), it returns success without creating a duplicate. If the
          label matches a previously-removed choice, it is re-activated.
        </P>
        <P>
          When a new choice is added, all non-pinned choices in the list are automatically
          sorted alphabetically. Pinned choices remain at the bottom.
        </P>

        <Heading3 id="kobo-remove">Remove endpoint</Heading3>
        <P>
          Send a POST with the choice <strong>value/ID</strong> (not the label) to soft-delete
          it:
        </P>
        <Pre>{`POST /{username}/{project}/{list}/remove
Content-Type: application/json

{ "name": "abc123" }`}</Pre>
        <P>
          This sets <Code>removed = true</Code>. The choice remains in the database and the CSV
          but can be filtered in KoboToolbox. Protected choices return <Code>403 Forbidden</Code>.
        </P>
        <P>
          To <strong>permanently delete</strong> a choice, use the <Code>/delete</Code> endpoint
          instead (same request format).
        </P>

        <Heading3 id="kobo-csv">CSV export endpoint</Heading3>
        <P>
          The CSV export URL can be pasted directly into KoboToolbox as the source for an
          external choices list. It returns a CSV with all columns including extra columns. The
          label column header respects the list's <a href="#label-column" className="text-indigo-600 hover:underline">label column name</a> setting.
        </P>
        <Note>
          The CSV export endpoint requires no authentication. Anyone with the URL can read the
          choice list data. Avoid including sensitive data in choice labels or values.
        </Note>

        <Heading3 id="kobo-xlsform">XLSForm setup</Heading3>
        <P>
          To use an external choice list in a KoboToolbox survey:
        </P>
        <Ul>
          <Li>
            In your XLSForm <strong>survey</strong> sheet, set the question type to{' '}
            <Code>select_one_from_file {'{filename}.csv'}</Code> (replace <Code>{'{filename}'}</Code> with your list slug).
          </Li>
          <Li>
            In KoboToolbox <strong>Settings → REST Services</strong>, configure a REST service
            that POSTs to the <Code>/add</Code> endpoint when a form is submitted. Map the
            relevant field to the request body.
          </Li>
          <Li>
            In the survey's <strong>External files</strong> section, point to the{' '}
            <Code>/export/choices.csv</Code> URL as the source CSV. KoboToolbox will re-fetch
            this URL each time a form is opened.
          </Li>
          <Li>
            Optionally add a <Code>choice_filter</Code> column in the survey sheet with the
            expression <Code>removed != 'true'</Code> to hide soft-deleted choices from
            respondents.
          </Li>
        </Ul>

        {/* ── Sharing & Access ── */}
        <Heading2 id="sharing">Sharing &amp; Access</Heading2>

        <Heading3 id="sharing-projects">Project sharing</Heading3>
        <P>
          Project owners can share a project with other registered users. Open the{' '}
          <strong>Settings</strong> panel on any project row (owner only), then type a username
          in the <strong>Sharing</strong> section and click <strong>Share</strong>.
        </P>
        <P>
          Shared users will see the project in their <strong>My Projects</strong> tab with a
          &ldquo;Shared by&rdquo; badge. They can view and edit choice lists and add/remove choices
          via the webhooks, but they cannot change the project&rsquo;s public visibility or delete the
          project.
        </P>
        <P>
          To revoke access, open the Settings panel and click <strong>Remove</strong> next to
          the user&rsquo;s name.
        </P>

        <Heading3 id="sharing-require-auth">Webhook authentication (require_auth)</Heading3>
        <P>
          Each choice list has a <strong>Require authentication</strong> toggle in the
          KoboToolbox Integration panel. When enabled (the default), the <Code>/add</Code>,{' '}
          <Code>/remove</Code>, and <Code>/delete</Code> endpoints require HTTP Basic
          Authentication using your Choices credentials. Authentication is accepted for the
          project owner and all shared users.
        </P>
        <Note>
          The CSV export endpoint is always public regardless of the <Code>require_auth</Code> setting.
        </Note>

        {/* ── Public Projects ── */}
        <Heading2 id="public-projects">Public Projects</Heading2>
        <P>
          Any project can be made <strong>public</strong> by its owner. Open the{' '}
          <strong>Settings</strong> panel on the project row and toggle{' '}
          <strong>Make this project public</strong>.
        </P>
        <P>
          Public projects appear in the <strong>Public Projects</strong> tab and are browsable
          by anyone — including users who are not logged in. Each public project&rsquo;s detail page
          shows all its choice lists and their active (non-removed) choices, plus a{' '}
          <strong>Copy CSV URL</strong> button for each list.
        </P>
        <Note>
          Making a project public does not affect authentication on the write endpoints.
          If <Code>require_auth</Code> is enabled, callers still need credentials to add or
          remove choices even when the project is public.
        </Note>

        {/* ── Following Lists ── */}
        <Heading2 id="following">Following Lists</Heading2>
        <P>
          Any logged-in user can <strong>follow</strong> a public choice list to create a
          personal configuration layer on top of it. Following lets you add your own extra
          columns (e.g. translations), override the label column name, and share a
          personalised CSV export URL — all without changing the source list.
        </P>

        <Heading3 id="following-follow">Following a list</Heading3>
        <P>
          Open a <strong>Public Projects</strong> or <strong>Public Collections</strong> detail
          page. Each choice list row has a <strong>Follow</strong> button (visible when you are
          logged in). Click it to follow the list. A confirmation badge
          (“Following ✓”) replaces the button once you are following.
        </P>
        <P>
          On Public Collections detail pages there is also a{' '}
          <strong>Follow all lists</strong> button in the collection header that follows every
          visible unfollowed list in one click.
        </P>
        <P>
          To see all your followed lists, click <strong>Following</strong> in the navigation
          bar. Each card shows the list name, your user columns, and a <strong>Copy URL</strong>{' '}
          button for the personalised CSV export. Click the card title to open the detail page.
        </P>
        <P>
          To stop following a list, click <strong>Unfollow</strong> on the Following page or
          inside the detail page. All your user-column data for that list will be deleted.
        </P>

        <Heading3 id="following-customise">Customising columns</Heading3>
        <P>
          Inside a followed list’s detail page you can:
        </P>
        <Ul>
          <Li>
            <strong>Override the label column name</strong> — type a custom header (e.g.{' '}
            <Code>label::French (fr)</Code>) into the <em>Label column name</em> field and
            press Enter or click away to save.
          </Li>
          <Li>
            <strong>Add user columns</strong> — click <strong>+ Add column</strong> and enter
            a name. The column appears in the choices table and in your personalised CSV.
          </Li>
          <Li>
            <strong>Rename a user column</strong> — click the column name in the header to
            edit it inline.
          </Li>
          <Li>
            <strong>Delete a user column</strong> — click the ✕ button in the column header.
            All cell values for that column will be permanently deleted.
          </Li>
          <Li>
            <strong>Edit cell values</strong> — click any cell in a user column to edit its
            value inline. Original list columns (name, label, and the list’s own extra columns)
            are read-only.
          </Li>
        </Ul>
        <Note>
          User columns are private to your account. They do not affect the source choice list
          or any other user’s view.
        </Note>

        <Heading3 id="following-export">Custom CSV export URL</Heading3>
        <P>
          Every followed list has a permanent, unauthenticated CSV export URL of the form:
        </P>
        <Pre>{`/{your_username}/{project_slug}/custom/{list_slug}.csv`}</Pre>
        <P>
          This URL is shown on the detail page and the Following list page. Anyone with the
          URL can download the CSV — no login required. The CSV includes:
        </P>
        <Ul>
          <Li>All original list columns (name, label, the list’s own extra columns)</Li>
          <Li>Your user-defined extra columns</Li>
        </Ul>
        <P>
          The label header uses your <em>label column name</em> override if set; otherwise
          falls back to the list’s own label column name, then <Code>label</Code>.
        </P>
        <P>
          You can paste this URL directly into KoboToolbox as an external CSV source to keep
          your XLSForm supplied with a personalised version of the choice list.
        </P>

        <Heading3 id="following-import">Bulk CSV import</Heading3>
        <P>
          Use the <strong>Import CSV</strong> card on the detail page to bulk-set user-column
          values. Upload a CSV file containing a <Code>name</Code> column (matching the choice
          names) and one column per user column you want to populate.
        </P>
        <P>
          The import is <strong>upsert-only</strong>: existing values for rows present in the
          CSV are updated; rows absent from the CSV are left unchanged; source choices are
          never created, modified, or deleted.
        </P>
        <P>
          Any column in the uploaded CSV that does not yet exist as a user column will be
          created automatically.
        </P>

        {/* ── Collections ── */}
        <Heading2 id="collections">Collections</Heading2>
        <P>
          A <strong>Collection</strong> groups one or more projects together under a single
          named set. Collections are useful when a survey draws from several related reference
          lists that live in different projects — for example, a set of administrative-boundary
          lookup tables (provinces, districts, villages) that multiple teams share.
        </P>
        <P>
          Collections can be kept private, shared with specific users, or made fully public so
          anyone can browse them without logging in.
        </P>

        <Heading3 id="collections-create">Creating a collection</Heading3>
        <P>
          Navigate to <strong>Collections</strong> in the header (requires login). Click{' '}
          <strong>+ New Collection</strong>, enter a name, a globally-unique slug, and an
          optional description, then click <strong>Create</strong>.
        </P>
        <Ul>
          <Li>Collection slugs must be unique across <em>all</em> users (unlike project slugs, which are only unique per user).</Li>
          <Li>Once created, click the collection name to open its detail page where you can manage projects, sharing, and visibility.</Li>
        </Ul>

        <Heading3 id="collections-projects">Adding &amp; removing projects</Heading3>
        <P>
          On the collection detail page, use the <strong>Add project</strong> dropdown to pick
          any project you own or have access to. Click <strong>Add</strong> to include it.
        </P>
        <P>
          To remove a project from the collection, click the <strong>Remove</strong> button next
          to it in the project list. Removing a project from a collection does not delete the
          project or any of its data.
        </P>
        <Note>
          Projects in a collection cannot be deleted from the database while they are still
          listed in that collection. Remove them from the collection first if you need to delete
          the project.
        </Note>
        <P>
          In the <strong>My Projects</strong> view, each project header shows purple{' '}
          <strong>📁 collection</strong> chips for every collection it belongs to. Click a chip
          to jump straight to that collection.
        </P>

        <Heading3 id="collections-sharing">Sharing collections</Heading3>
        <P>
          The collection owner can share a collection with other registered users. Open the
          collection detail page, scroll to the <strong>Sharing</strong> panel, type a username,
          and click <strong>Share</strong>.
        </P>
        <P>
          Shared users can see the collection and all its projects (subject to individual
          project access rules), but cannot change the collection&rsquo;s settings, add or remove
          projects, or delete the collection.
        </P>
        <P>
          To revoke access, click <strong>Remove</strong> next to the user&rsquo;s name in the
          Sharing panel. Only the owner can share or unshare.
        </P>
        <Note>
          Collection sharing is separate from project sharing. Sharing a collection does not
          automatically grant write access to the projects inside it.
        </Note>

        <Heading3 id="collections-public">Public collections</Heading3>
        <P>
          Toggle <strong>Make this collection public</strong> in the collection settings to
          publish it. Public collections appear in the <strong>Public Collections</strong> browser
          (accessible without login) and display all their projects with their active choice
          lists and a <strong>Copy CSV URL</strong> button for each list.
        </P>
        <P>
          Use the search bar on the Public Collections page to filter by name or description.
        </P>
        <Note>
          Making a collection public exposes the names and slugs of its member projects and
          their choice lists to unauthenticated users. Ensure the data in those lists is
          suitable for public visibility before enabling this option.
        </Note>

        {/* ── Account ── */}
        <Heading2 id="account">Your Account</Heading2>
        <P>
          User accounts are created by an administrator — there is no self-service signup. To
          request an account, contact your system administrator.
        </P>
        <P>
          To change your password, click your username in the top-right of the header, then
          select <strong>Change password</strong>. You will need to enter your current password
          before setting a new one. Passwords must be at least 8 characters long.
        </P>
        <P>
          To log out, click the <strong>Log out</strong> button in the header. Your session will
          be terminated and you will be redirected to the login page.
        </P>
        <Note>
          All your data (projects, lists, choices) belongs to your account. Projects shared
          with you by other owners are also visible and editable, but you cannot delete them
          or change their public visibility.
        </Note>

        <div className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-400">
          Need help not covered here?{' '}
          <Link to="/" className="text-indigo-500 hover:underline">
            Return to the app
          </Link>
          .
        </div>
      </article>
    </div>
  )
}
