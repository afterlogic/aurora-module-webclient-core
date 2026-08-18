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
 * to the HTML report) and inlines a plain-text pass/fail-per-test/per-project listing into the
 * email body, plus a link to the hosted report for anyone who wants the full interactive view.
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

/** Flattens Playwright's recursive suites/specs tree into one row per test-per-project. */
function collectSpecResults(array $suite, array &$rows): void
{
    foreach ($suite['specs'] ?? [] as $spec) {
        foreach ($spec['tests'] ?? [] as $test) {
            $rows[] = [
                'title' => $spec['title'],
                'project' => $test['projectName'],
                'status' => $test['status'], // 'expected' | 'unexpected' | 'flaky' | 'skipped'
            ];
        }
    }
    foreach ($suite['suites'] ?? [] as $child) {
        collectSpecResults($child, $rows);
    }
}

/**
 * Turns Playwright's JSON reporter output into a plain-text pass/fail-per-test/per-project
 * listing — the same breakdown the HTML report shows, formatted for an email body.
 */
function buildResultsSummary(string $jsonReportPath): string
{
    if (!is_file($jsonReportPath)) {
        return '';
    }

    $report = json_decode(file_get_contents($jsonReportPath), true);
    if (!is_array($report)) {
        return '';
    }

    $rows = [];
    foreach ($report['suites'] ?? [] as $suite) {
        collectSpecResults($suite, $rows);
    }
    if (empty($rows)) {
        return '';
    }

    $labels = ['unexpected' => 'FAIL', 'flaky' => 'FLAKY', 'expected' => 'PASS', 'skipped' => 'SKIP'];
    $order = ['unexpected' => 0, 'flaky' => 1, 'expected' => 2, 'skipped' => 3];

    usort($rows, function (array $a, array $b) use ($order): int {
        $statusDiff = ($order[$a['status']] ?? 9) <=> ($order[$b['status']] ?? 9);
        return $statusDiff !== 0 ? $statusDiff : strcmp($a['project'], $b['project']);
    });

    $counts = [];
    foreach ($rows as $row) {
        $counts[$row['status']] = ($counts[$row['status']] ?? 0) + 1;
    }
    $countsParts = [];
    foreach ($labels as $status => $label) {
        if (!empty($counts[$status])) {
            $countsParts[] = $counts[$status] . ' ' . strtolower($label);
        }
    }

    $projectWidth = max(array_map(function (array $row): int {
        return strlen($row['project']);
    }, $rows));

    $lines = ['Test results: ' . implode(', ', $countsParts), ''];
    foreach ($rows as $row) {
        $label = str_pad($labels[$row['status']] ?? strtoupper($row['status']), 5);
        $lines[] = $label . ' ' . str_pad($row['project'], $projectWidth) . '  ' . $row['title'];
    }

    return implode("\n", $lines);
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
    string $bodyText,
    ?string $attachmentPath = null
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
            'Content-Type' => 'text/plain; charset=UTF-8',
            'Content-Transfer-Encoding' => 'base64',
        ];

        $lines = [];
        foreach ($headers as $name => $value) {
            $lines[] = "$name: $value";
        }
        $lines[] = '';
        $lines[] = chunk_split(base64_encode($bodyText));

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
    $lines[] = 'Content-Type: text/plain; charset=UTF-8';
    $lines[] = 'Content-Transfer-Encoding: base64';
    $lines[] = '';
    $lines[] = chunk_split(base64_encode($bodyText));

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
        $bodyText = "This is a test email confirming the E2E report mail delivery channel is working.\n";
    } else {
        $status = $options['status'] ?? getenv('E2E_REPORT_STATUS') ?: null;
        $defaultSubject = getenv('E2E_MAIL_SUBJECT') ?: 'Desktop E2E test report';
        $subject = $options['subject'] ?? $defaultSubject;
        if ($status !== null) {
            $subject = '[' . strtoupper($status) . '] ' . $subject;
        }

        $reportUrl = buildReportUrl($webInstallUrl, $envPath, $reportPath);

        $statusText = $status === 'passed'
            ? 'All tests passed successfully.'
            : ($status === 'failed' ? 'Test failed!' : 'Test passed.');

        $bodyText = $statusText . "\n\nFollow the link for more details: " . $reportUrl . "\n";

        $summary = buildResultsSummary(dirname($reportPath) . DIRECTORY_SEPARATOR . 'results.json');
        if ($summary !== '') {
            $bodyText .= "\n" . $summary . "\n";
        }
    }

    try {
        $message = buildMimeMessage($fromAddress, $fromName, $to, $subject, $bodyText, $isChannelTest ? null : $reportPath);

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
