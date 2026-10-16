<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

class MailAuthentication
{
    /**
     * @return list<string>
     */
    public function problemsForMailbox(?string $mailbox): array
    {
        if (app()->runningUnitTests()) {
            return [];
        }

        $domain = $this->domain($mailbox);

        if ($domain === null) {
            return [];
        }

        return Cache::remember(
            'mail-authentication:'.$domain,
            3600,
            fn (): array => $this->problems(
                $domain,
                $this->records($domain, DNS_TXT),
                $this->records('_dmarc.'.$domain, DNS_TXT),
                $this->records('selector1._domainkey.'.$domain, DNS_CNAME),
                $this->records('selector2._domainkey.'.$domain, DNS_CNAME),
            ),
        );
    }

    /**
     * @param  list<array<string, mixed>>  $spfRecords
     * @param  list<array<string, mixed>>  $dmarcRecords
     * @param  list<array<string, mixed>>  $dkimSelector1
     * @param  list<array<string, mixed>>  $dkimSelector2
     * @return list<string>
     */
    public function problems(
        string $domain,
        array $spfRecords,
        array $dmarcRecords,
        array $dkimSelector1,
        array $dkimSelector2,
    ): array {
        $problems = [];
        $spf = [];

        foreach ($spfRecords as $record) {
            $text = $this->text($record);

            if (str_starts_with(strtolower(ltrim($text)), 'v=spf1')) {
                $spf[] = $text;
            }
        }

        if ($spf === []) {
            $problems[] = $domain.' has no SPF record. Add v=spf1 include:spf.protection.outlook.com -all so receivers can accept Microsoft 365 mail.';
        } elseif (count($spf) > 1) {
            $problems[] = $domain.' has more than one SPF record. Keep a single record that includes include:spf.protection.outlook.com.';
        } elseif (! str_contains(strtolower($spf[0]), 'include:spf.protection.outlook.com')) {
            $problems[] = $domain.' SPF does not authorize Microsoft 365. Add include:spf.protection.outlook.com before the all mechanism, or mail from this website can land in Junk.';
        }

        $dmarc = '';

        foreach ($dmarcRecords as $record) {
            $dmarc .= ' '.$this->text($record);
        }

        if (! str_contains(strtolower($dmarc), 'v=dmarc1')) {
            $problems[] = $domain.' has no DMARC record. Add one after SPF and DKIM are working.';
        }

        if ($dkimSelector1 === [] && $dkimSelector2 === []) {
            $problems[] = $domain.' has no Microsoft 365 DKIM records. Turn on DKIM for this domain in Microsoft 365 Defender.';
        }

        return $problems;
    }

    private function domain(?string $mailbox): ?string
    {
        $mailbox = strtolower(trim((string) $mailbox));
        $at = strrpos($mailbox, '@');

        if ($at === false) {
            return null;
        }

        $domain = substr($mailbox, $at + 1);

        return $domain !== '' && ! str_contains($domain, ' ') ? $domain : null;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function records(string $name, int $type): array
    {
        $records = @dns_get_record($name, $type);

        return is_array($records) ? $records : [];
    }

    /**
     * @param  array<string, mixed>  $record
     */
    private function text(array $record): string
    {
        if (isset($record['txt']) && is_string($record['txt'])) {
            return $record['txt'];
        }

        if (isset($record['entries']) && is_array($record['entries'])) {
            return implode('', array_map(fn ($entry): string => is_string($entry) ? $entry : '', $record['entries']));
        }

        return '';
    }
}
