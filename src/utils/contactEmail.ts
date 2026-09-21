export type EmailRowKindType = 'email' | 'tel' | 'url'
export type EmailRowType = readonly [label: string, value: string, kind?: EmailRowKindType]

interface Options {
  brand: string
  kicker: string
  title: string
  detail?: string
  rows: EmailRowType[]
  attachments: string[]
  origin?: string
}

// Email clients ignore stylesheets, so the palette is inlined here — the one place hex is unavoidable.
const COLOR = {
  page: '#f4f4f5',
  ink: '#18181b',
  muted: '#71717a',
  line: '#e4e4e7',
  panel: '#fafafa',
  white: '#ffffff'
}

const SANS = '-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif'

const escapeHtml = (value: string): string =>
  value.replaceAll(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[char] ?? char
  ))

const href = (value: string, kind: EmailRowKindType): string => {
  if (kind === 'email') return `mailto:${value}`
  if (kind === 'tel') return `tel:${value.replaceAll(/[^\d+]/g, '')}`
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

const renderValue = ([, value, kind]: EmailRowType): string => {
  const safe = escapeHtml(value)
  if (!kind || value === '—') return safe
  return `<a href="${escapeHtml(href(value, kind))}" style="color:${COLOR.ink};text-decoration:underline">${safe}</a>`
}

const renderRow = (row: EmailRowType): string => `
              <tr>
                <td style="padding:0 0 4px;font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:${COLOR.muted}">${escapeHtml(row[0])}</td>
              </tr>
              <tr>
                <td style="padding:0 0 20px;font-family:${SANS};font-size:16px;line-height:1.5;color:${COLOR.ink};white-space:pre-wrap">${renderValue(row)}</td>
              </tr>`

const renderAttachments = (attachments: string[]): string => attachments.length === 0 ? '' : `
              <tr>
                <td style="padding:4px 0 0">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.panel};border-left:3px solid ${COLOR.line}">
                    <tr>
                      <td style="padding:16px 20px;font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:${COLOR.muted}">Attachments</td>
                    </tr>
                    ${attachments.map((name) => `
                    <tr>
                      <td style="padding:0 20px 16px;font-family:${SANS};font-size:15px;line-height:1.5;color:${COLOR.ink}">${escapeHtml(name)}</td>
                    </tr>`).join('')}
                  </table>
                </td>
              </tr>`

// Tables and inline styles are required: Outlook renders with the Word engine and strips <style>/flex.
export const buildContactEmail = ({ brand, kicker, title, detail, rows, attachments, origin }: Options): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(kicker)} — ${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(title)}${detail ? ` · ${escapeHtml(detail)}` : ''}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.page}">
  <tr>
    <td align="center" style="padding:32px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
        <tr>
          <td style="padding:28px 32px;background-color:${COLOR.ink}">
            <div style="font-family:${SANS};font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${COLOR.white}">${escapeHtml(brand)}</div>
            <div style="padding-top:6px;font-family:${SANS};font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:${COLOR.muted}">New message from the website</div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 8px;background-color:${COLOR.white}">
            <div style="font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;color:${COLOR.muted}">${escapeHtml(kicker)}</div>
            <div style="padding-top:10px;font-family:${SANS};font-size:28px;font-weight:700;line-height:1.2;color:${COLOR.ink}">${escapeHtml(title)}</div>
            ${detail ? `<div style="padding-top:8px;font-family:${SANS};font-size:16px;color:${COLOR.muted}">${escapeHtml(detail)}</div>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px;background-color:${COLOR.white}">
            <div style="height:1px;margin:28px 0;background-color:${COLOR.line};font-size:0;line-height:0">&nbsp;</div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 36px;background-color:${COLOR.white}">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${rows.map((row) => renderRow(row)).join('')}
              ${renderAttachments(attachments)}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${COLOR.muted}">
            Sent automatically from the ${escapeHtml(brand)} website form${origin ? ` &middot; ${escapeHtml(origin)}` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
