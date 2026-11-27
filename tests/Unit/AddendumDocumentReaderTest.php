<?php

use App\Support\AddendumDocumentReader;

test('an addendum date line is the issued date, not the bid date', function () {
    $read = AddendumDocumentReader::fromText(<<<'TXT'
ADDENDUM NO. 1
DATE: 11/27/2026
Project: Courthouse
The bid date is now December 15, 2026 at 2:00 PM.
TXT);

    expect($read['number'])->toBe('1')
        ->and($read['issued_on'])->toBe('2026-11-27')
        ->and($read['bid_date'])->toBe('2026-12-15')
        ->and($read['bid_time'])->toBe('14:00');
});

test('the issued date is read when it is split onto the next line or written out', function () {
    $split = AddendumDocumentReader::fromText("ADDENDUM NO. 3\nDate of Issue\nNovember 27, 2026\n");
    $formal = AddendumDocumentReader::fromText('This addendum is issued this 27th day of November, 2026.');
    $compact = AddendumDocumentReader::fromText('ADDENDUMNO.4 DATE11/27/26');

    expect($split['issued_on'])->toBe('2026-11-27')
        ->and($split['number'])->toBe('3')
        ->and($formal['issued_on'])->toBe('2026-11-27')
        ->and($compact['number'])->toBe('4')
        ->and($compact['issued_on'])->toBe('2026-11-27');
});

test('a title block date is read when the glyphs or the month are split apart', function () {
    $spaced = AddendumDocumentReader::fromText("ADDENDUM NO. 1\nDATE: 1 1 / 2 7 / 2 0 2 6");
    $dashed = AddendumDocumentReader::fromText("ADDENDUM NO. 2\nDATE: 27-Nov-2026");
    $before = AddendumDocumentReader::fromText('ADDENDUM NO. 5 11/27/2026 DATE');

    expect($spaced['issued_on'])->toBe('2026-11-27')
        ->and($dashed['issued_on'])->toBe('2026-11-27')
        ->and($before['issued_on'])->toBe('2026-11-27')
        ->and($before['number'])->toBe('5');
});

test('the issued date is the date for this addendum, not an earlier document or addendum', function () {
    $original = AddendumDocumentReader::fromText(<<<'TXT'
ADDENDUM NO. 3
DATE: November 27, 2026

This addendum modifies the original bidding documents dated March 1, 2026.
The bid date is now December 15, 2026 at 2:00 PM.
TXT);
    $previous = AddendumDocumentReader::fromText(<<<'TXT'
Addendum No. 1 dated October 10, 2026.
Addendum No. 2 dated October 20, 2026.

ADDENDUM NO. 3
DATE: November 27, 2026
TXT);
    $savedFileDate = AddendumDocumentReader::fromText(<<<'TXT'
ADDENDUM NO. 3
DATE: November 27, 2026
Issued: 2026-01-05
TXT);

    expect($original['number'])->toBe('3')
        ->and($original['issued_on'])->toBe('2026-11-27')
        ->and($original['bid_date'])->toBe('2026-12-15')
        ->and($previous['number'])->toBe('3')
        ->and($previous['issued_on'])->toBe('2026-11-27')
        ->and($savedFileDate['issued_on'])->toBe('2026-11-27');
});
