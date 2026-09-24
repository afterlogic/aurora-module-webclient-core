<?php
/**
 * Sends a Playwright E2E HTML report by email over raw SMTP (no Composer deps).
 * Works on Windows and Linux as long as the `openssl` PHP extension is enabled
 * (needed for SSL/TLS SMTP, which virtually every provider requires today).
 * PHP 7.x compatible (no constructor property promotion, no str_starts_with/str_contains).
 *
 * Usage:
 *   php send-e2e-report.php [path-to-html-report] [--status=passed|failed] [--to=a@x.com,b@y.com]
 *       [--subject="..."]
 *
 * If the report path is omitted, no attachment/report link is sent — instead a plain test
 * email goes out to confirm the mail delivery channel is working.
 *
 * The bare index.html is attached as-is. Its screenshots/traces live in a sibling data/
 * folder that doesn't travel with it, so it won't render those inline — that's why this
 * script also reads Playwright's `results.json` (the `json` reporter's output, expected next
 * to the HTML report) and renders the email body as HTML: overall status, run details,
 * a per-module summary and every test grouped by module (error excerpt for failures, reason
 * for skips), plus a link to the hosted report for anyone who wants the full interactive view.
 * Since the summary is read straight from results.json, this script can also be re-run
 * standalone against an old report to resend/test the email without rerunning the tests.
 *
 * Settings file: `.env.e2e`, resolved 1 directory above this script (i.e. next to
 * playwright.config.js — adjust the `dirname($scriptDir, 1)` call in main() if your
 * layout differs). Real environment variables always win over its values.
 *
 * Configuration (environment variables, or the `.env.e2e` file above):
 *   MAIL_HOST            smtp.example.com
 *   MAIL_PORT            587 (STARTTLS) | 465 (implicit SSL) | 25 (unencrypted, not recommended)
 *   MAIL_ENCRYPTION      tls | ssl | none
 *   MAIL_USERNAME        SMTP auth login
 *   MAIL_PASSWORD        SMTP auth password / app password
 *   MAIL_FROM_ADDRESS    sender@example.com
 *   MAIL_FROM_NAME       "E2E Bot" (optional)
 *   E2E_MAIL_TO          comma-separated default recipient list (overridable with --to)
 *   E2E_MAIL_SUBJECT     default subject template (overridable with --subject)
 *   PLAYWRIGHT_BASE_URL  tested installation, shown in the email (optional)
 *   WEB_INSTALL_URL      base URL of the installation, e.g. https://dev.example.com
 *                         (its filesystem root is assumed to be 5 directories above
 *                         .env.e2e — see buildReportUrl())
 *
 * Exit code: 0 on success, 1 on any failure (bad args, SMTP error, etc).
 * Never throws past main() — always exits cleanly so callers can decide whether
 * a failed email should also fail the overall CI job.
 */

function startsWith(string $haystack, string $needle): bool
{
    return substr($haystack, 0, strlen($needle)) === $needle;
}

function loadDotEnvIfPresent(string $path): void
{
    if (!is_file($path)) {
        return;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
            continue;
        }
        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        $value = trim($value, "\"'");
        // Real environment variables always win over .env values.
        if (getenv($key) === false) {
            putenv("$key=$value");
        }
    }
}

function envOrFail(string $key): string
{
    $value = getenv($key);
    if ($value === false || $value === '') {
        fwrite(STDERR, "[send-e2e-report] Missing required environment variable: $key\n");
        exit(1);
    }
    return $value;
}

function parseArgs(array $argv): array
{
    $positional = [];
    $options = ['status' => null, 'to' => null, 'subject' => null];

    foreach (array_slice($argv, 1) as $arg) {
        if (startsWith($arg, '--status=')) {
            $options['status'] = substr($arg, 9);
        } elseif (startsWith($arg, '--to=')) {
            $options['to'] = substr($arg, 5);
        } elseif (startsWith($arg, '--subject=')) {
            $options['subject'] = substr($arg, 10);
        } else {
            $positional[] = $arg;
        }
    }

    return [$positional[0] ?? null, $options];
}

const REPORT_STATUS = [
    // status => [icon, label, row background, accent]
    'failed' => ['❌', 'Failed', '#fdf1f1', '#e8b4b4'],
    'flaky' => ['⚠️', 'Flaky', '#fff8e8', '#ecd29a'],
    'passed' => ['✅', 'Passed', '#f1f9f3', '#b5dcbf'],
    'skipped' => ['⏭️', 'Skipped', '#f6f6f8', '#d6d6dc'],
];
const REPORT_STATUS_ORDER = ['failed' => 0, 'flaky' => 1, 'passed' => 2, 'skipped' => 3];

/** Module name from a spec path such as ../../../MailWebclient/test/e2e/mail.spec.js. */
function reportModuleFromFile(string $file, string $fallback): string
{
    $parts = preg_split('#[\\\\/]#', $file);
    foreach ($parts as $i => $part) {
        if ($i > 0 && ($part === 'test' || $part === 'vue-mobile')) {
            return $parts[$i - 1];
        }
    }
    return $fallback;
}

/** Browser / device part of a project name: "Mail · Chrome" or "Mail-iPhone13". */
function reportBrowserFromProject(string $project, string $module): string
{
    if (strpos($project, ' · ') !== false) {
        $parts = explode(' · ', $project);
        return end($parts);
    }
    if (strpos($project, $module . '-') === 0) {
        return substr($project, strlen($module) + 1);
    }
    return $project;
}

/** First meaningful lines of a Playwright error, without ANSI colors. */
function reportErrorExcerpt(array $result): string
{
    $message = $result['error']['message'] ?? ($result['errors'][0]['message'] ?? '');
    $message = preg_replace('/\x1b\[[0-9;]*m/', '', (string) $message);
    $lines = array_values(array_filter(array_map('trim', explode("\n", $message)), 'strlen'));
    $excerpt = implode("\n", array_slice($lines, 0, 3));
    // Cut to 400 characters without relying on mbstring.
    return preg_replace('/^(.{400}).+$/su', '$1…', $excerpt);
}

/** Reasons given in test.skip() / test.fixme(), without duplicates. */
function reportSkipReason(array $test): string
{
    $reasons = [];
    foreach ($test['annotations'] ?? [] as $annotation) {
        $description = trim((string) ($annotation['description'] ?? ''));
        if (in_array($annotation['type'] ?? '', ['skip', 'fixme'], true) && $description !== '') {
            $reasons[$description] = true;
        }
    }
    return implode("
", array_keys($reasons));
}

/** Flatten Playwright's suites/specs tree into one row per test per project. */
function reportCollectRows(array $suite, array $describe, array &$rows): void
{
    foreach ($suite['specs'] ?? [] as $spec) {
        foreach ($spec['tests'] ?? [] as $test) {
            $results = $test['results'] ?? [];
            $last = $results ? $results[count($results) - 1] : [];
            $status = [
                'unexpected' => 'failed',
                'flaky' => 'flaky',
                'expected' => 'passed',
                'skipped' => 'skipped',
            ][$test['status']] ?? 'failed';
            $module = reportModuleFromFile($spec['file'] ?? '', $test['projectName']);
            $rows[] = [
                'module' => $module,
                'file' => basename(str_replace('\\', '/', $spec['file'] ?? '')),
                'describe' => implode(' › ', $describe),
                'title' => $spec['title'],
                'browser' => reportBrowserFromProject($test['projectName'], $module),
                'status' => $status,
                'duration' => (int) ($last['duration'] ?? 0),
                'attempts' => count($results),
                'error' => $status === 'failed' || $status === 'flaky' ? reportErrorExcerpt($last) : '',
                'skipReason' => $status === 'skipped' ? reportSkipReason($test) : '',
            ];
        }
    }
    foreach ($suite['suites'] ?? [] as $child) {
        // Nested suites are describe() blocks; the top level is the file itself.
        $childDescribe = $describe;
        if (($child['title'] ?? '') !== '' && ($child['title'] ?? '') !== ($child['file'] ?? null)
            && !preg_match('/\.(spec|setup)\.[jt]s$/', $child['title'])) {
            $childDescribe[] = $child['title'];
        }
        reportCollectRows($child, $childDescribe, $rows);
    }
}

/** Parsed report: rows plus run stats, or null when results.json is missing / invalid. */
function loadReport(string $jsonReportPath): ?array
{
    if (!is_file($jsonReportPath)) {
        return null;
    }
    $report = json_decode(file_get_contents($jsonReportPath), true);
    if (!is_array($report)) {
        return null;
    }
    $rows = [];
    foreach ($report['suites'] ?? [] as $suite) {
        reportCollectRows($suite, [], $rows);
    }
    usort($rows, function (array $a, array $b): int {
        return [$a['module'], REPORT_STATUS_ORDER[$a['status']], $a['file'], $a['title'], $a['browser']]
            <=> [$b['module'], REPORT_STATUS_ORDER[$b['status']], $b['file'], $b['title'], $b['browser']];
    });
    $counts = array_fill_keys(array_keys(REPORT_STATUS), 0);
    foreach ($rows as $row) {
        $counts[$row['status']]++;
    }
    return [
        'rows' => $rows,
        'counts' => $counts,
        'startTime' => $report['stats']['startTime'] ?? null,
        'duration' => (int) ($report['stats']['duration'] ?? 0),
    ];
}

function reportDuration(int $ms): string
{
    $s = (int) round($ms / 1000);
    if ($s < 60) {
        return $s . 's';
    }
    if ($s < 3600) {
        return intdiv($s, 60) . 'm ' . str_pad((string) ($s % 60), 2, '0', STR_PAD_LEFT) . 's';
    }
    return intdiv($s, 3600) . 'h ' . str_pad((string) intdiv($s % 3600, 60), 2, '0', STR_PAD_LEFT) . 'm';
}

function h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Module name that may wrap between CamelCase words on narrow screens. */
function hModule(string $module): string
{
    return preg_replace('/(?<=[a-z])(?=[A-Z])/', '<wbr>', h($module));
}

/** Worst status of a group of rows: failed > flaky > passed > skipped (all skipped). */
function reportGroupStatus(array $counts): string
{
    foreach (['failed', 'flaky', 'passed'] as $status) {
        if ($counts[$status] > 0) {
            return $status;
        }
    }
    return 'skipped';
}

/**
 * HTML body: status banner, run details, per-module summary, and every test
 * grouped by module with error excerpts on failed ones and reasons on skipped ones.
 */
function buildResultsHtml(array $report, string $suiteLabel, string $reportUrl, string $installUrl): string
{
    $rows = $report['rows'];
    $counts = $report['counts'];
    $total = count($rows);
    $overall = reportGroupStatus($counts);
    $failed = $counts['failed'];

    $browsers = array_values(array_unique(array_column($rows, 'browser')));
    $showBrowser = count($browsers) > 1;
    // Flaky only appears with retries; hide its column and counter when there are none.
    $statuses = array_filter(REPORT_STATUS, function (string $status) use ($counts): bool {
        return $status !== "flaky" || $counts["flaky"] > 0;
    }, ARRAY_FILTER_USE_KEY);

    $font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
    $border = '#dfe3e8';
    $muted = '#6b7280';
    $cell = "padding:6px 8px;border:1px solid $border;vertical-align:top;word-break:break-word;";
    $th = "padding:6px 8px;border:1px solid $border;background:#f3f5f8;text-align:left;font-weight:600;color:#374151;";

    if ($overall === 'failed') {
        $headline = "❌ $suiteLabel E2E: $failed of $total tests failed";
        $bannerBg = '#fbeaea';
        $bannerFg = '#8a2c2c';
    } elseif ($overall === 'flaky') {
        $headline = "⚠️ $suiteLabel E2E: passed with {$counts['flaky']} flaky tests";
        $bannerBg = '#fff4dc';
        $bannerFg = '#7a5a12';
    } else {
        $headline = "✅ $suiteLabel E2E: all {$counts['passed']} tests passed";
        $bannerBg = '#e6f4ea';
        $bannerFg = '#1f6b3a';
    }

    $details = [];
    if ($installUrl !== '') {
        $details['Installation'] = '<a href="' . h($installUrl) . '" style="color:#2563eb;">' . h($installUrl) . '</a>';
    }
    if ($report['startTime']) {
        $details['Started'] = h(date('Y-m-d H:i T', strtotime($report['startTime'])));
    }
    $details['Duration'] = h(reportDuration($report['duration']));
    $details['Browsers'] = h(implode(', ', $browsers));

    $out = [];
    $out[] = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>';
    $out[] = "<body style=\"margin:0;padding:0;background:#f4f5f7;$font\">";
    $out[] = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:16px 4px;">';
    $out[] = "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:820px;background:#ffffff;border:1px solid $border;border-radius:8px;$font font-size:14px;color:#1f2937;\">";

    // Banner
    $out[] = "<tr><td style=\"padding:18px 16px;background:$bannerBg;color:$bannerFg;border-radius:8px 8px 0 0;font-size:19px;font-weight:600;\">" . h($headline) . '</td></tr>';

    // Counters + link
    $chips = [];
    foreach ($statuses as $status => [$icon, $label, $bg, $accent]) {
        $chips[] = "<td style=\"padding:8px 12px;background:$bg;border:1px solid $accent;border-radius:6px;white-space:nowrap;\">$icon <b>{$counts[$status]}</b> " . h(strtolower($label)) . '</td><td width="8"></td>';
    }
    $out[] = '<tr><td style="padding:16px 16px 4px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' . implode('', $chips) . '</tr></table></td></tr>';

    // Run details
    $detailRows = '';
    foreach ($details as $name => $value) {
        $detailRows .= "<tr><td style=\"padding:3px 16px 3px 0;color:$muted;white-space:nowrap;\">$name</td><td style=\"padding:3px 0;\">$value</td></tr>";
    }
    $out[] = "<tr><td style=\"padding:12px 16px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\">$detailRows</table></td></tr>";
    $out[] = '<tr><td style="padding:4px 16px 18px;"><a href="' . h($reportUrl) . '" style="display:inline-block;padding:9px 16px;background:#3b6fd8;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Open full Playwright report</a></td></tr>';

    // Group rows by module
    $modules = [];
    foreach ($rows as $row) {
        $modules[$row['module']][] = $row;
    }

    // Summary by module
    $sectionTitle = function (string $title) use ($font): string {
        return "<tr><td style=\"padding:14px 16px 8px;font-size:16px;font-weight:600;$font\">" . h($title) . '</td></tr>';
    };
    $out[] = $sectionTitle('Summary by module');
    $summary = "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse;font-size:13px;\">";
    $summary .= "<tr><th style=\"$th\">Module</th><th style=\"$th text-align:center;\">✅ Passed</th><th style=\"$th text-align:center;\">❌ Failed</th>" . (isset($statuses["flaky"]) ? "<th style=\"$th text-align:center;\">⚠️ Flaky</th>" : "") . "<th style=\"$th text-align:center;\">⏭️ Skipped</th><th style=\"$th text-align:right;\">Time</th></tr>";
    foreach ($modules as $module => $moduleRows) {
        $c = array_fill_keys(array_keys(REPORT_STATUS), 0);
        $time = 0;
        foreach ($moduleRows as $row) {
            $c[$row['status']]++;
            $time += $row['duration'];
        }
        $bg = REPORT_STATUS[reportGroupStatus($c)][2];
        $num = function (int $n, string $status) use ($cell): string {
            $style = $n === 0 ? "color:#c0c4cc;" : ($status === 'failed' ? 'color:#a33a3a;font-weight:600;' : '');
            return "<td style=\"$cell text-align:center;$style\">$n</td>";
        };
        $summary .= "<tr style=\"background:$bg;\"><td style=\"$cell font-weight:600;\">" . REPORT_STATUS[reportGroupStatus($c)][0] . ' ' . hModule($module) . '</td>'
            . $num($c['passed'], 'passed') . $num($c['failed'], 'failed') . (isset($statuses['flaky']) ? $num($c['flaky'], 'flaky') : '') . $num($c['skipped'], 'skipped')
            . "<td style=\"$cell text-align:right;color:$muted;white-space:nowrap;\">" . h(reportDuration($time)) . '</td></tr>';
    }
    $summary .= '</table>';
    $out[] = "<tr><td style=\"padding:0 16px 8px;\">$summary</td></tr>";

    // All tests grouped by module; failed / flaky rows carry their error excerpt.
    $testTable = function (array $groups) use ($cell, $th, $muted, $border, $showBrowser): string {
        $cols = $showBrowser ? 4 : 3;
        $html = "<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse;font-size:13px;\">";
        $html .= "<tr><th style=\"$th width:28px;text-align:center;\"></th><th style=\"$th\">Test</th>"
            . ($showBrowser ? "<th style=\"$th\">Browser</th>" : '')
            . "<th style=\"$th text-align:right;\">Time</th></tr>";
        foreach ($groups as $module => $groupRows) {
            $c = array_count_values(array_column($groupRows, 'status'));
            $parts = [];
            foreach (REPORT_STATUS as $status => [$icon]) {
                if (!empty($c[$status])) {
                    $parts[] = "$icon {$c[$status]}";
                }
            }
            $html .= "<tr><td colspan=\"$cols\" style=\"padding:8px 10px;border:1px solid $border;background:#e9edf3;font-weight:600;color:#1f2937;\">"
                . hModule($module) . "<span style=\"font-weight:400;color:$muted;\">&nbsp;&nbsp;" . implode('&nbsp;&nbsp;', $parts) . '</span></td></tr>';
            foreach ($groupRows as $row) {
                [$icon, $label, $bg, $accent] = REPORT_STATUS[$row['status']];
                $where = $row['file'] . ($row['describe'] !== '' ? ' › ' . $row['describe'] : '');
                $titleColor = $row['status'] === 'skipped' ? $muted : '#1f2937';
                $test = "<div style=\"color:$titleColor;\">" . h($row['title']) . '</div>'
                    . "<div style=\"color:$muted;font-size:12px;margin-top:2px;\">" . h($where)
                    . ($row['attempts'] > 1 ? ' · ' . $row['attempts'] . ' attempts' : '') . '</div>';
                if ($row['error'] !== '') {
                    $test .= "<div style=\"margin-top:6px;padding:6px 8px;background:#ffffff;border:1px solid $accent;border-radius:4px;font-family:Consolas,Menlo,monospace;font-size:12px;color:#7a2e2e;white-space:pre-wrap;overflow-wrap:anywhere;\">"
                        . h($row['error']) . '</div>';
                }
                if ($row['status'] === 'skipped') {
                    // A skip without a reason hides why the test did not run; flag it.
                    $missing = $row['skipReason'] === '';
                    $noteBorder = $missing ? REPORT_STATUS['failed'][3] : $accent;
                    $noteColor = $missing ? '#a33a3a' : '#4b5563';
                    $test .= "<div style=\"margin-top:6px;padding:6px 8px;background:#ffffff;border:1px solid $noteBorder;border-radius:4px;font-size:12px;color:$noteColor;white-space:pre-wrap;overflow-wrap:anywhere;\"><b>Skipped:</b> "
                        . h($missing ? 'Reason is not defined' : $row['skipReason']) . '</div>';
                }
                $html .= "<tr style=\"background:$bg;\"><td style=\"$cell text-align:center;border-left:3px solid $accent;\" title=\"$label\">$icon</td>"
                    . "<td style=\"$cell\">$test</td>"
                    . ($showBrowser ? "<td style=\"$cell white-space:nowrap;\">" . h($row['browser']) . '</td>' : '')
                    . "<td style=\"$cell text-align:right;color:$muted;white-space:nowrap;\">" . ($row['status'] === 'skipped' ? '—' : h(reportDuration($row['duration']))) . '</td></tr>';
            }
        }
        return $html . '</table>';
    };

    $out[] = $sectionTitle('All tests');
    $out[] = '<tr><td style="padding:0 16px 20px;">' . $testTable($modules) . '</td></tr>';

    $out[] = "<tr><td style=\"padding:12px 16px 18px;border-top:1px solid $border;color:$muted;font-size:12px;\">The full Playwright HTML report is attached and available at the link above.</td></tr>";
    $out[] = '</table></td></tr></table></body></html>';
    return implode("\n", $out);
}

/** Minimal RFC 5321 SMTP client: connect, EHLO, optional STARTTLS, AUTH LOGIN, MAIL/RCPT/DATA. */
final class SmtpClient
{
    /** @var resource */
    private $socket;

    /** @var string */
    private $host;

    /** @var int */
    private $port;

    /** @var string tls | ssl | none */
    private $encryption;

    /** @var int */
    private $timeoutSeconds;

    public function __construct(string $host, int $port, string $encryption, int $timeoutSeconds = 20)
    {
        $this->host = $host;
        $this->port = $port;
        $this->encryption = $encryption;
        $this->timeoutSeconds = $timeoutSeconds;
    }

    public function send(string $username, string $password, string $from, array $to, string $rawMessage): void
    {
        $this->connect();
        $this->expect(220);

        $this->ehlo();

        if ($this->encryption === 'tls') {
            $this->command('STARTTLS');
            $this->expect(220);
            $this->enableCrypto();
            $this->ehlo(); // must re-negotiate capabilities after STARTTLS
        }

        $this->authLogin($username, $password);

        $this->command('MAIL FROM:<' . $from . '>');
        $this->expect(250);

        foreach ($to as $recipient) {
            $this->command('RCPT TO:<' . $recipient . '>');
            $this->expect(250, 251);
        }

        $this->command('DATA');
        $this->expect(354);

        // Dot-stuff any line that starts with a lone '.', per RFC 5321.
        $stuffed = preg_replace('/^\./m', '..', $rawMessage);
        $this->write($stuffed . "\r\n.\r\n");
        $this->expect(250);

        $this->command('QUIT');
        fclose($this->socket);
    }

    private function connect(): void
    {
        $prefix = $this->encryption === 'ssl' ? 'ssl://' : '';
        $target = $prefix . $this->host . ':' . $this->port;

        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
            ],
        ]);

        $socket = @stream_socket_client(
            $target,
            $errno,
            $errstr,
            $this->timeoutSeconds,
            STREAM_CLIENT_CONNECT,
            $context
        );

        if ($socket === false) {
            throw new RuntimeException("Could not connect to $target: [$errno] $errstr");
        }

        stream_set_timeout($socket, $this->timeoutSeconds);
        $this->socket = $socket;
    }

    private function enableCrypto(): void
    {
        $ok = stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        if ($ok !== true) {
            throw new RuntimeException('STARTTLS negotiation failed');
        }
    }

    private function ehlo(): void
    {
        $this->command('EHLO ' . (gethostname() ?: 'localhost'));
        $this->expect(250);
    }

    private function authLogin(string $username, string $password): void
    {
        $this->command('AUTH LOGIN');
        $this->expect(334);
        $this->command(base64_encode($username));
        $this->expect(334);
        $this->command(base64_encode($password));
        $this->expect(235);
    }

    private function command(string $line): void
    {
        $this->write($line . "\r\n");
    }

    private function write(string $data): void
    {
        if (fwrite($this->socket, $data) === false) {
            throw new RuntimeException('Failed writing to SMTP socket');
        }
    }

    /** Reads one (possibly multi-line) SMTP response and asserts its status code. */
    private function expect(int ...$acceptableCodes): void
    {
        $response = '';
        do {
            $line = fgets($this->socket, 515);
            if ($line === false) {
                throw new RuntimeException('SMTP connection closed unexpectedly while awaiting: ' . implode('/', $acceptableCodes));
            }
            $response .= $line;
            // Multi-line responses use "250-text"; the final line uses "250 text".
            $continues = isset($line[3]) && $line[3] === '-';
        } while ($continues);

        $code = (int) substr($response, 0, 3);
        if (!in_array($code, $acceptableCodes, true)) {
            throw new RuntimeException("Unexpected SMTP response (wanted " . implode('/', $acceptableCodes) . "): " . trim($response));
        }
    }
}

function buildMimeMessage(
    string $from,
    string $fromName,
    array $to,
    string $subject,
    string $body,
    ?string $attachmentPath = null,
    string $bodyType = 'text/plain'
): string {
    $date = date('r');
    $messageId = '<' . bin2hex(random_bytes(16)) . '@' . (gethostname() ?: 'localhost') . '>';

    // No attachment (mail-channel test): a plain single-part message, no MIME multipart needed.
    if ($attachmentPath === null) {
        $headers = [
            'From' => sprintf('%s <%s>', encodeHeaderWord($fromName), $from),
            'To' => implode(', ', $to),
            'Subject' => encodeHeaderWord($subject),
            'Date' => $date,
            'Message-ID' => $messageId,
            'MIME-Version' => '1.0',
            'Content-Type' => "$bodyType; charset=UTF-8",
            'Content-Transfer-Encoding' => 'base64',
        ];

        $lines = [];
        foreach ($headers as $name => $value) {
            $lines[] = "$name: $value";
        }
        $lines[] = '';
        $lines[] = chunk_split(base64_encode($body));

        return implode("\r\n", $lines);
    }

    $boundary = 'e2e-report-' . bin2hex(random_bytes(12));

    $headers = [
        'From' => sprintf('%s <%s>', encodeHeaderWord($fromName), $from),
        'To' => implode(', ', $to),
        'Subject' => encodeHeaderWord($subject),
        'Date' => $date,
        'Message-ID' => $messageId,
        'MIME-Version' => '1.0',
        'Content-Type' => "multipart/mixed; boundary=\"$boundary\"",
    ];

    $lines = [];
    foreach ($headers as $name => $value) {
        $lines[] = "$name: $value";
    }
    $lines[] = '';

    $lines[] = "--$boundary";
    $lines[] = "Content-Type: $bodyType; charset=UTF-8";
    $lines[] = 'Content-Transfer-Encoding: base64';
    $lines[] = '';
    $lines[] = chunk_split(base64_encode($body));

    $attachmentName = basename($attachmentPath);
    $attachmentType = detectMimeType($attachmentPath);
    $attachmentData = chunk_split(base64_encode(file_get_contents($attachmentPath)));
    $lines[] = "--$boundary";
    $lines[] = "Content-Type: $attachmentType; name=\"$attachmentName\"";
    $lines[] = 'Content-Transfer-Encoding: base64';
    $lines[] = "Content-Disposition: attachment; filename=\"$attachmentName\"";
    $lines[] = '';
    $lines[] = $attachmentData;
    $lines[] = "--$boundary--";

    return implode("\r\n", $lines);
}

/** Real content type of the attachment, so the MIME header never lies about what's inside. */
function detectMimeType(string $path): string
{
    if (function_exists('mime_content_type')) {
        $detected = @mime_content_type($path);
        if ($detected !== false && $detected !== '') {
            return $detected;
        }
    }

    $extensionTypes = [
        'html' => 'text/html',
        'htm' => 'text/html',
        'zip' => 'application/zip',
        'txt' => 'text/plain',
        'json' => 'application/json',
    ];
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

    return $extensionTypes[$ext] ?? 'application/octet-stream';
}

function encodeHeaderWord(string $value): string
{
    // Encode as UTF-8 "encoded word" only if needed, so plain ASCII stays readable.
    if (preg_match('/^[\x20-\x7E]*$/', $value)) {
        return $value;
    }
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

/** Path of $to relative to $from. Assumes $to lives under $from. */
function relativePath(string $from, string $to): string
{
    $from = str_replace('\\', '/', rtrim($from, '/\\'));
    $to = str_replace('\\', '/', rtrim($to, '/\\'));

    $fromParts = explode('/', $from);
    $toParts = explode('/', $to);

    while (count($fromParts) > 0 && count($toParts) > 0 && $fromParts[0] === $toParts[0]) {
        array_shift($fromParts);
        array_shift($toParts);
    }

    return implode('/', $toParts);
}

/**
 * Builds the public URL for the report: WEB_INSTALL_URL + the report's path
 * relative to the installation's filesystem root (5 directories above .env.e2e).
 */
function buildReportUrl(string $webInstallUrl, string $envPath, string $reportPath): string
{
    $installRoot = realpath(dirname($envPath, 5)) ?: dirname($envPath, 5);
    $reportRealPath = realpath($reportPath) ?: $reportPath;

    $relative = relativePath($installRoot, $reportRealPath);

    return rtrim($webInstallUrl, '/') . '/' . ltrim($relative, '/');
}

function main(): void
{
    $scriptDir = __DIR__;
    $envPath = dirname($scriptDir, 1) . DIRECTORY_SEPARATOR . '.env.e2e';
    loadDotEnvIfPresent($envPath);

    [$reportPath, $options] = parseArgs($_SERVER['argv']);
    $isChannelTest = $reportPath === null;

    if (!$isChannelTest && !is_file($reportPath)) {
        fwrite(STDERR, "[send-e2e-report] Report file not found: $reportPath\n");
        exit(1);
    }

    $host = envOrFail('MAIL_HOST');
    $port = (int) envOrFail('MAIL_PORT');
    $encryption = strtolower(getenv('MAIL_ENCRYPTION') ?: 'tls');
    $username = envOrFail('MAIL_USERNAME');
    $password = envOrFail('MAIL_PASSWORD');
    $fromAddress = envOrFail('MAIL_FROM_ADDRESS');
    $fromName = getenv('MAIL_FROM_NAME') ?: 'E2E Bot';
    $webInstallUrl = envOrFail('WEB_INSTALL_URL');

    $toRaw = $options['to'] ?? getenv('E2E_MAIL_TO');
    if (!$toRaw) {
        fwrite(STDERR, "[send-e2e-report] No recipients: set E2E_MAIL_TO or pass --to=a@x.com,b@y.com\n");
        exit(1);
    }
    $to = array_values(array_filter(array_map('trim', explode(',', $toRaw))));

    if ($isChannelTest) {
        $subject = $options['subject'] ?? 'Desktop E2E mail channel test';
        $body = "This is a test email confirming the E2E report mail delivery channel is working.\n";
    } else {
        $status = $options['status'] ?? getenv('E2E_REPORT_STATUS') ?: null;
        $defaultSubject = getenv('E2E_MAIL_SUBJECT') ?: 'Desktop E2E test report';
        $subject = $options['subject'] ?? $defaultSubject;
        if ($status !== null) {
            $subject = '[' . strtoupper($status) . '] ' . $subject;
        }

        $reportUrl = buildReportUrl($webInstallUrl, $envPath, $reportPath);

        $installUrl = (string) getenv('PLAYWRIGHT_BASE_URL');
        $report = loadReport(dirname($reportPath) . DIRECTORY_SEPARATOR . 'results.json');
        if ($report !== null) {
            $body = buildResultsHtml($report, 'Desktop', $reportUrl, $installUrl);
        } else {
            // No results.json (e.g. the run crashed before the reporter wrote it).
            $statusText = $status === 'passed' ? '✅ All tests passed.' : '❌ Test run failed.';
            $body = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;font-size:14px;">'
                . '<p style="font-size:17px;font-weight:600;">' . h($statusText) . '</p>'
                . '<p>No results.json was found, so there is no per-test breakdown.</p>'
                . '<p><a href="' . h($reportUrl) . '">Open the Playwright report</a></p></body></html>';
        }
    }

    try {
        $message = buildMimeMessage(
            $fromAddress,
            $fromName,
            $to,
            $subject,
            $body,
            $isChannelTest ? null : $reportPath,
            $isChannelTest ? 'text/plain' : 'text/html'
        );

        $client = new SmtpClient($host, $port, $encryption);
        $client->send($username, $password, $fromAddress, $to, $message);

        echo $isChannelTest
            ? "[send-e2e-report] Test email sent to: " . implode(', ', $to) . "\n"
            : "[send-e2e-report] Sent report to: " . implode(', ', $to) . "\n";
    } catch (Throwable $e) {
        fwrite(STDERR, '[send-e2e-report] Failed to send email: ' . $e->getMessage() . "\n");
        exit(1);
    }
}

main();
