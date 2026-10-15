<?php

use App\Support\TakeoffNamer;
use App\Support\TakeoffPdfScope;

function takeoffScopePage(int $page, array $items): array
{
    return [
        'page' => $page,
        'width' => 612.0,
        'height' => 792.0,
        'origin_x' => 0.0,
        'origin_y' => 0.0,
        'items' => $items,
    ];
}

test('a door schedule keeps size and uses the plan tag as the position', function () {
    $scope = TakeoffPdfScope::fromPages([
        takeoffScopePage(1, [
            ['x' => 72, 'y' => 720, 'text' => 'DOOR SCHEDULE'],
            ['x' => 72, 'y' => 660, 'text' => 'MARK'],
            ['x' => 160, 'y' => 660, 'text' => 'WIDTH'],
            ['x' => 250, 'y' => 660, 'text' => 'HEIGHT'],
            ['x' => 340, 'y' => 660, 'text' => 'LOCATION'],
            ['x' => 450, 'y' => 660, 'text' => 'HAND'],
            ['x' => 72, 'y' => 630, 'text' => 'D1'],
            ['x' => 160, 'y' => 630, 'text' => "3'-0\""],
            ['x' => 250, 'y' => 630, 'text' => "7'-0\""],
            ['x' => 340, 'y' => 630, 'text' => 'Lobby'],
            ['x' => 450, 'y' => 630, 'text' => 'RH'],
            ['x' => 72, 'y' => 600, 'text' => 'D2'],
            ['x' => 160, 'y' => 600, 'text' => "3'-0\""],
            ['x' => 250, 'y' => 600, 'text' => "7'-0\""],
            ['x' => 340, 'y' => 600, 'text' => 'Office'],
            ['x' => 450, 'y' => 600, 'text' => 'LH'],
            ['x' => 72, 'y' => 570, 'text' => 'D3'],
            ['x' => 160, 'y' => 570, 'text' => "2'-8\""],
            ['x' => 250, 'y' => 570, 'text' => "6'-8\""],
            ['x' => 340, 'y' => 570, 'text' => 'Lab'],
            ['x' => 450, 'y' => 570, 'text' => 'RH'],
            ['x' => 430, 'y' => 40, 'text' => 'A-601'],
            ['x' => 500, 'y' => 40, 'text' => 'REV B'],
        ]),
        takeoffScopePage(2, [
            ['x' => 120, 'y' => 500, 'text' => 'D1'],
            ['x' => 300, 'y' => 400, 'text' => 'D2'],
            ['x' => 450, 'y' => 250, 'text' => 'D3'],
        ]),
    ]);

    expect($scope['sheet_number'])->toBe('A-601')
        ->and($scope['sheet_title'])->toBe('Door Schedule')
        ->and($scope['revision_label'])->toBe('B')
        ->and($scope['document_type'])->toBe('schedule')
        ->and($scope['openings'])->toHaveCount(3)
        ->and(TakeoffNamer::countPhrase($scope['openings']))->toBe('3 doors');

    $first = $scope['openings'][0];
    expect($first['tag'])->toBe('D1')
        ->and($first['opening_type'])->toBe('door')
        ->and($first['width'])->toBe('36')
        ->and($first['height'])->toBe('84')
        ->and($first['dimension_unit'])->toBe('in')
        ->and($first['location'])->toBe('Lobby')
        ->and($first['handing'])->toBe('RH')
        ->and($first['quantity'])->toBe('1.00')
        ->and($first['markers'])->toHaveCount(1)
        ->and($first['markers'][0]['page'])->toBe(2);

    expect(abs($first['markers'][0]['x'] - (120 / 612)))->toBeLessThan(0.0001)
        ->and(abs($first['markers'][0]['y'] - (1 - (500 / 792))))->toBeLessThan(0.0001);

    expect($scope['openings'][2]['tag'])->toBe('D3')
        ->and($scope['openings'][2]['width'])->toBe('32')
        ->and($scope['openings'][2]['height'])->toBe('80')
        ->and($scope['openings'][2]['location'])->toBe('Lab');
});

test('architectural size codes and window schedules are read', function () {
    $scope = TakeoffPdfScope::fromPages([
        takeoffScopePage(1, [
            ['x' => 72, 'y' => 700, 'text' => 'DOOR SCHEDULE'],
            ['x' => 72, 'y' => 660, 'text' => 'MARK'],
            ['x' => 180, 'y' => 660, 'text' => 'SIZE'],
            ['x' => 72, 'y' => 630, 'text' => 'D4'],
            ['x' => 180, 'y' => 630, 'text' => '3070'],
            ['x' => 72, 'y' => 500, 'text' => 'D9 3\'-0" x 7\'-0" Corridor RH'],
        ]),
        takeoffScopePage(2, [
            ['x' => 72, 'y' => 700, 'text' => 'WINDOW SCHEDULE'],
            ['x' => 72, 'y' => 660, 'text' => 'MARK'],
            ['x' => 180, 'y' => 660, 'text' => 'WIDTH'],
            ['x' => 280, 'y' => 660, 'text' => 'HEIGHT'],
            ['x' => 72, 'y' => 630, 'text' => 'W1'],
            ['x' => 180, 'y' => 630, 'text' => '900'],
            ['x' => 280, 'y' => 630, 'text' => '2100'],
        ]),
    ]);

    $byTag = [];

    foreach ($scope['openings'] as $opening) {
        $byTag[$opening['tag']] = $opening;
    }

    expect($byTag['D4']['width'])->toBe('36')
        ->and($byTag['D4']['height'])->toBe('84')
        ->and($byTag['D9']['width'])->toBe('36')
        ->and($byTag['D9']['height'])->toBe('84')
        ->and($byTag['D9']['location'])->toBe('Corridor')
        ->and($byTag['D9']['handing'])->toBe('RH')
        ->and($byTag['W1']['opening_type'])->toBe('window')
        ->and($byTag['W1']['dimension_unit'])->toBe('mm')
        ->and($byTag['W1']['width'])->toBe('900')
        ->and($byTag['W1']['height'])->toBe('2100')
        ->and(TakeoffNamer::countPhrase($scope['openings']))->toBe('2 doors, 1 window');
});

test('a wrapped architectural door schedule row becomes one opening', function () {
    $scope = TakeoffPdfScope::fromPages([
        takeoffScopePage(1, [
            ['x' => 40, 'y' => 500, 'text' => 'NOTES ABOUT A DOOR OPENING'],
            ['x' => 100, 'y' => 500, 'text' => '201 LOBBY 201 3\' - 0" 7\' - 0" 0\' - 1 3/4" F W'],
            ['x' => 360, 'y' => 500, 'text' => 'D HM PNT3 50 1, 2 201'],
            ['x' => 100, 'y' => 470, 'text' => '202 OFFICE 88 3\' - 0" 6\' - 8" 0\' - 1 3/4" F W'],
            ['x' => 100, 'y' => 458, 'text' => 'D 202'],
            ['x' => 360, 'y' => 458, 'text' => '203 HALL 203 3\' - 0" 7\' - 0" 0\' - 1 3/4" F 203'],
            ['x' => 360, 'y' => 430, 'text' => '204 HALL 204 3\' - 0" 7\' - 0" 0\' - 1 3/4" F W'],
            ['x' => 100, 'y' => 418, 'text' => 'D 204'],
            ['x' => 360, 'y' => 418, 'text' => '205 HALL 205 3\' - 0" 7\' - 0" 0\' - 1 3/4" F 205'],
        ]),
    ]);

    $byTag = [];

    foreach ($scope['openings'] as $opening) {
        $byTag[$opening['tag']] = $opening;
    }

    expect($byTag)->toHaveKeys(['201', '202', '203', '204', '205'])
        ->and($byTag['201']['width'])->toBe('36')
        ->and($byTag['201']['height'])->toBe('84')
        ->and($byTag['201']['depth'])->toBe('1.75')
        ->and($byTag['201']['location'])->toBe('LOBBY')
        ->and($byTag['201']['frame_type'])->toBe('Hollow metal')
        ->and($byTag['201']['finish'])->toBe('PNT3')
        ->and($byTag['201']['hardware_set'])->toBe('1, 2')
        ->and($byTag['201']['acoustic_requirement'])->toBe('STC 50')
        ->and($byTag['202']['location'])->toBe('OFFICE · 88')
        ->and($byTag['202']['height'])->toBe('80')
        ->and($byTag['204']['location'])->toBe('HALL')
        ->and($byTag['205']['width'])->toBe('36');
});

test('a click lands on the schedule row under the cursor', function () {
    $left = ['tag' => '201', 'width' => '36', 'markers' => [['page' => 1, 'x' => 0.20, 'y' => 0.60]]];
    $right = ['tag' => '202', 'width' => '32', 'markers' => [['page' => 1, 'x' => 0.70, 'y' => 0.603]]];
    $below = ['tag' => '203', 'width' => '36', 'markers' => [['page' => 1, 'x' => 0.20, 'y' => 0.40]]];

    expect(TakeoffPdfScope::matchAt([$left, $right, $below], 1, 0.75, 0.60)['tag'])->toBe('202')
        ->and(TakeoffPdfScope::matchAt([$left, $right, $below], 1, 0.22, 0.40)['tag'])->toBe('203')
        ->and(TakeoffPdfScope::matchAt([$left, $right, $below], 1, 0.50, 0.10))->toBeNull();
});

test('a pdf with no text explains that the drawing could not be read', function () {
    $scope = TakeoffPdfScope::fromPages([
        takeoffScopePage(1, []),
    ]);

    expect($scope['openings'])->toBe([])
        ->and($scope['notes'][0])->toContain('text layer');
});
