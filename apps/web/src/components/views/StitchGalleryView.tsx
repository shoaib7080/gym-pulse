import { useState } from 'react';
import { ExternalLink, Download, Layers } from '../ui/icons';

interface StitchScreen {
  id: string;
  number: number;
  title: string;
  description: string;
  screenshotUrl: string;
  htmlUrl: string;
  dimensions: string;
  highlights: string[];
}

const SCREENS: StitchScreen[] = [
  {
    id: 'c3f29c5880f34a7495c8609dfcf6e302',
    number: 1,
    title: 'Approach 1: Asymmetrical Bento Grid Hub',
    description: 'Dynamic 2x2 telemetry pulse, live hourly capacity curve, multi-branch network health, platform compliance vault, floor coaches and equipment diagnostics.',
    screenshotUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1UoSF0LWG4kXw5AfXwM0lQwdGfXOXmL83v20Mphn9zpMyhD-EP2yc46EJLkrpstAY0nf6u5JBIk4dRlY7iph9YcMUfYzgDKlRB7ILCroARppMKjcPJberXCcVzKpVN5Qb9GOr31Kn64Rvk11kHbqzYHcZK-4TzMNH2VqTOQrBygpPy5NgjcyrYLBIGbtukOfkkCvjiyL5eV579Vy3i--g4aR2XG0U28vRrkZznPgUlDzQyqXYMqWaDuBNop',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1ZTcyODBmOGE0ZWQwNWYxM2I4YmZiMzI0MzQ4EgsSBxDXyrO0rggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjk2MTMyNTU0NjU1Nzg2NzI2OQ&filename=&opi=89354086',
    dimensions: '2560 × 3368 px',
    highlights: ['2x2 Bento Hub', 'Real-time 1.2s Telemetry', 'Hourly Area Curve', 'Turnstile Stream', 'Equipment Tracker'],
  },
  {
    id: '5f498321859a4712affe48f42afc9fb6',
    number: 2,
    title: 'Approach 2: Navbar Flow Dashboard',
    description: 'Sticky horizontal operations bar with date picker and log exporter, 4-metric KPI ribbon, filterable member directory table with locker assignments, and campus showcase.',
    screenshotUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1VvRfGG7ttr8964OXT86D1L1HcOLICiFaCK1mFGQMpE0TwQTcy8mku7DkBNv3FtGO90hn-niaGbl_YLQdS3XZM7CpS6xaCGOb1b_JdFZXQ6Vtl6Y4CXT8_eY9SG3rrsLYkyeI1qOfpzJ41C8FwWUmQps2CdJQOBp6blTv3srpT78pgyWYnmEb2sb50dT1iqXGMQPBCszRThB9ZvNL_e_DADs6_9xksTorx5nDmCDW4Kk1nxnmXf3bf9oq63',
    htmlUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1ZTZjNmRkZGU4MzMwNDRmNjEyNmJkMWQ2OTc0EgsSBxDXyrO0rggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjk2MTMyNTU0NjU1Nzg2NzI2OQ&filename=&opi=89354086',
    dimensions: '2560 × 3120 px',
    highlights: ['Sticky Secondary Operations Bar', '4-Metric KPI Ribbon', 'Filterable Member Table', 'Document Step Bar', 'Campus Showcase'],
  },
  {
    id: 'd93d5eb8ef104ebcbdc0c86ce212c465',
    number: 3,
    title: 'Approach 3: Classic Pro Sidebar Dashboard',
    description: 'Enterprise console stage with live sync indicator, 3 focus cards (Retention Velocity, Legal Sanctions, Profile completeness ring), live turnstile sensor stream, and SHA256 audit ledger.',
    screenshotUrl: 'https://stitch.googleapis.com/v1/projects/12961325546557867269/files/14364092766710371861:download',
    htmlUrl: 'https://stitch.googleapis.com/v1/projects/12961325546557867269/files/14873006941773109718:download',
    dimensions: '2560 × 4310 px',
    highlights: ['Admin Console Stage', 'Grace Period & Churn Strip', '92% Profile Radial', 'RFID Gate Sensors', 'SHA256 File Vault'],
  },
];

export function StitchGalleryView() {
  const [selectedScreen, setSelectedScreen] = useState<StitchScreen | null>(null);

  return (
    <div className="flex flex-col w-full pb-12 p-6 gap-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low border border-outline-variant/30 p-6 shadow-md rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-on-surface font-display">
              Stitch Screen Gallery & Specifications
            </h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Project: <strong className="text-on-surface">GymPulse Admin Dashboard Suite</strong> • Project ID: <code className="text-primary font-mono">12961325546557867269</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/stitch_screens/README.md"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-bright text-xs font-semibold text-on-surface transition-colors"
          >
            <span>View Documentation</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Screen Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {SCREENS.map((sc) => (
          <div
            key={sc.id}
            className="rounded-2xl bg-surface-container-low border border-outline-variant/30 overflow-hidden shadow-lg flex flex-col justify-between group hover:border-primary/50 transition-all min-w-0"
          >
            <div>
              {/* Image Preview */}
              <div
                className="relative h-56 w-full bg-surface-container-lowest overflow-hidden cursor-pointer"
                onClick={() => setSelectedScreen(sc)}
              >
                <img
                  src={sc.screenshotUrl}
                  alt={sc.title}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/90 via-transparent to-transparent flex items-end p-4">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/20 text-primary font-mono uppercase">
                      Screen #{sc.number}
                    </span>
                    <h3 className="text-sm font-bold text-on-surface mt-1">{sc.title}</h3>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex flex-col gap-3">
                <p className="text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                  {sc.description}
                </p>

                <div className="flex items-center justify-between text-[11px] text-outline font-mono pt-1 border-t border-outline-variant/20">
                  <span>ID: {sc.id.slice(0, 10)}...</span>
                  <span>{sc.dimensions}</span>
                </div>

                {/* Highlights */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {sc.highlights.map((h, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface text-[10px] font-medium"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-5 pt-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedScreen(sc)}
                className="flex-1 py-2 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-colors text-center cursor-pointer"
              >
                View Full Preview
              </button>

              <a
                href={sc.htmlUrl}
                target="_blank"
                rel="noreferrer"
                title="Download Hosted HTML"
                className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </a>

              <a
                href={sc.screenshotUrl}
                target="_blank"
                rel="noreferrer"
                title="Open Screenshot in New Tab"
                className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary transition-colors cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Screen Fullscreen Modal */}
      {selectedScreen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-lowest/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedScreen(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-surface-container-low border border-outline-variant/60 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-outline-variant/30 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-on-surface font-display">
                  {selectedScreen.title}
                </h2>
                <div className="text-xs text-outline font-mono">
                  Screen ID: {selectedScreen.id} • {selectedScreen.dimensions}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={selectedScreen.screenshotUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container text-xs font-semibold text-primary"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Full Image</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedScreen(null)}
                  className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Scrollable Image View */}
            <div className="flex-1 overflow-y-auto p-4 bg-surface-container-lowest flex justify-center">
              <img
                src={selectedScreen.screenshotUrl}
                alt={selectedScreen.title}
                className="w-full h-auto rounded-lg shadow-lg border border-outline-variant/30"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
