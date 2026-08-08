# Smoke-test production page APIs via Vercel proxy with demo session.
$ErrorActionPreference = 'Continue'
$base = 'https://frontend-self-one-14.vercel.app'
$cookieJar = Join-Path $env:TEMP 'ats_smoke_cookies.txt'
Remove-Item $cookieJar -ErrorAction SilentlyContinue

curl.exe -sS -c $cookieJar -X POST "$base/api/demo-login" -H "Content-Type: application/json" -d "{}" -o NUL
if ($LASTEXITCODE -ne 0) { Write-Error 'demo-login failed'; exit 1 }

$endpoints = @(
  @{ Page = 'Auth'; Path = '/api/profile' },
  @{ Page = 'Dashboard'; Path = '/api/analytics/dashboard-stats' },
  @{ Page = 'Analytics'; Path = '/api/analytics/charts' },
  @{ Page = 'Analytics DEI'; Path = '/api/analytics/dei' },
  @{ Page = 'Jobs'; Path = '/jobs?isTemplate=false' },
  @{ Page = 'Jobs templates'; Path = '/jobs?isTemplate=true' },
  @{ Page = 'Candidates'; Path = '/candidates?limit=5' },
  @{ Page = 'Pending review'; Path = '/candidates/pending?limit=5' },
  @{ Page = 'Applications'; Path = '/api/applications?limit=20' },
  @{ Page = 'Interviews'; Path = '/api/interviews' },
  @{ Page = 'Team'; Path = '/api/team' },
  @{ Page = 'Notifications'; Path = '/api/notifications?limit=10' },
  @{ Page = 'Notif count'; Path = '/api/notifications/count' },
  @{ Page = 'Callbacks'; Path = '/api/notifications/upcoming-callbacks' },
  @{ Page = 'Positions'; Path = '/api/positions' },
  @{ Page = 'Positions all'; Path = '/api/positions/all' },
  @{ Page = 'Clients'; Path = '/api/clients' },
  @{ Page = 'Clients all'; Path = '/api/clients/all' },
  @{ Page = 'Sources'; Path = '/api/sources' },
  @{ Page = 'Sources all'; Path = '/api/sources/all' },
  @{ Page = 'Org members'; Path = '/api/organization/members' },
  @{ Page = 'Candidate fields'; Path = '/api/organization/candidate-fields' },
  @{ Page = 'Audit log'; Path = '/api/organization/audit-log?limit=10' },
  @{ Page = 'Audit distinct'; Path = '/api/organization/audit-log/distinct' },
  @{ Page = 'Security'; Path = '/api/security/settings' },
  @{ Page = 'SSO config'; Path = '/api/sso/config' },
  @{ Page = 'SSO metadata'; Path = '/api/sso/config/metadata-url' },
  @{ Page = 'Custom roles'; Path = '/api/custom-roles' },
  @{ Page = 'Role perms'; Path = '/api/custom-roles/permissions' },
  @{ Page = 'Billing status'; Path = '/api/billing/status' },
  @{ Page = 'Billing plans'; Path = '/api/billing/plans' },
  @{ Page = 'Billing invoices'; Path = '/api/billing/invoices' },
  @{ Page = 'Webhooks'; Path = '/api/webhooks' },
  @{ Page = 'Webhook events'; Path = '/api/webhooks/available-events' },
  @{ Page = 'API keys'; Path = '/api/api-keys' },
  @{ Page = 'DEI settings'; Path = '/api/dei/settings' },
  @{ Page = 'DEI metrics'; Path = '/api/dei/metrics' },
  @{ Page = 'DEI blind'; Path = '/api/dei/blind-mode' },
  @{ Page = 'Global search'; Path = '/api/search?q=demo' },
  @{ Page = 'Reports pipeline'; Path = '/api/reports-studio/pipeline' },
  @{ Page = 'Reports sources'; Path = '/api/reports-studio/sources' },
  @{ Page = 'Reports TTH'; Path = '/api/reports-studio/time-to-hire' },
  @{ Page = 'Reports jobs'; Path = '/api/reports-studio/jobs-performance' },
  @{ Page = 'Report schedules'; Path = '/api/report-schedules' },
  @{ Page = 'Announcements'; Path = '/api/announcements' },
  @{ Page = 'Announcements all'; Path = '/api/announcements/all' },
  @{ Page = 'Talent pools'; Path = '/api/talent-pools' },
  @{ Page = 'Skills'; Path = '/api/skills' },
  @{ Page = 'Inbox threads'; Path = '/api/inbox/threads' },
  @{ Page = 'Inbox stats'; Path = '/api/inbox/stats' },
  @{ Page = 'Sequences'; Path = '/api/sequences' },
  @{ Page = 'Assessments'; Path = '/api/assessments' },
  @{ Page = 'Approvals wf'; Path = '/api/approvals/workflows' },
  @{ Page = 'Approvals inst'; Path = '/api/approvals/instances' },
  @{ Page = 'Offer templates'; Path = '/api/offer-templates' },
  @{ Page = 'Scorecard tpl'; Path = '/api/scorecard-templates' },
  @{ Page = 'Saved searches'; Path = '/api/saved-searches' },
  @{ Page = 'Company brand'; Path = '/api/company-brand' },
  @{ Page = 'White label'; Path = '/api/white-label' },
  @{ Page = 'Chatbot admin'; Path = '/api/chatbot/admin/settings' },
  @{ Page = 'Referrals'; Path = '/api/referrals' },
  @{ Page = 'Email settings'; Path = '/api/email-settings' },
  @{ Page = 'Email templates'; Path = '/api/email-templates' },
  @{ Page = 'Email channels'; Path = '/api/email/channels' },
  @{ Page = 'Email sender'; Path = '/api/email/sender-status' },
  @{ Page = 'Push vapid'; Path = '/api/push/vapid-public' },
  @{ Page = 'Profile stats'; Path = '/api/profile/stats' },
  @{ Page = 'Org lists CTC'; Path = '/api/org-lists/ctc/all' },
  @{ Page = 'Org lists notice'; Path = '/api/org-lists/notice/all' },
  @{ Page = 'Export preview'; Path = '/api/export/preview' },
  @{ Page = 'Integrations'; Path = '/api/integrations' }
)

$fail = @()
$warn = @()
$pass = 0

foreach ($ep in $endpoints) {
  $url = "$base$($ep.Path)"
  $tmp = Join-Path $env:TEMP 'ats_smoke_body.txt'
  $code = curl.exe -sS -b $cookieJar -o $tmp -w '%{http_code}' $url
  $body = ''
  if (Test-Path $tmp) { $body = Get-Content -Raw $tmp -ErrorAction SilentlyContinue }
  $snippet = if ($body) { ($body.Substring(0, [Math]::Min(90, $body.Length)) -replace '\s+', ' ') } else { '' }
  $isHtml = $body -match '^\s*<!doctype|^\s*<html'
  $isGetOptions = $body -match 'getOptions is not a function'
  $okish = ($code -match '^(200|201|204)$') -or ($code -eq '404' -and -not $isHtml) # some optional resources 404

  if ($isHtml -or $isGetOptions -or ($code -match '^(500|502|503)$')) {
    $fail += [pscustomobject]@{ Page = $ep.Page; Code = $code; Path = $ep.Path; Snippet = $snippet }
    Write-Host "FAIL $($ep.Page) [$code] $($ep.Path) :: $snippet"
  } elseif ($code -match '^(401|403)$') {
    $warn += [pscustomobject]@{ Page = $ep.Page; Code = $code; Path = $ep.Path; Snippet = $snippet }
    Write-Host "AUTH $($ep.Page) [$code] $($ep.Path)"
  } elseif (-not $okish -and $code -ne '404') {
    $warn += [pscustomobject]@{ Page = $ep.Page; Code = $code; Path = $ep.Path; Snippet = $snippet }
    Write-Host "WARN $($ep.Page) [$code] $($ep.Path) :: $snippet"
  } else {
    $pass++
    Write-Host "OK   $($ep.Page) [$code]"
  }
}

Write-Host ''
Write-Host "SUMMARY pass=$pass warn=$($warn.Count) fail=$($fail.Count) total=$($endpoints.Count)"
if ($fail.Count) {
  Write-Host '--- FAILURES ---'
  $fail | Format-Table -AutoSize | Out-String | Write-Host
}
if ($warn.Count) {
  Write-Host '--- WARNINGS ---'
  $warn | Format-Table -AutoSize | Out-String | Write-Host
}
