<?php

use App\Support\TakeoffMoney;

test('takeoff money rounds half up and rejects margin of 100 percent', function () {
    expect(TakeoffMoney::round('1.225'))->toBe('1.23')
        ->and(TakeoffMoney::round('1.224'))->toBe('1.22')
        ->and(TakeoffMoney::money('10'))->toBe('10.00')
        ->and(TakeoffMoney::selling('200.00', 'markup', '0.10', null))->toBe('220.00')
        ->and(TakeoffMoney::selling('200.00', 'margin', null, '0.20'))->toBe('250.00')
        ->and(TakeoffMoney::selling('0.00', 'markup', '0.10', null))->toBe('0.00')
        ->and(TakeoffMoney::marginRatio('0.00', '0.00'))->toBeNull();

    expect(fn () => TakeoffMoney::selling('100.00', 'margin', null, '1'))
        ->toThrow(InvalidArgumentException::class);
});

test('one-time costs are not multiplied and markup is not combined with margin', function () {
    $material = TakeoffMoney::mul('100.00', '2');
    $freight = '50.00';
    $cost = TakeoffMoney::add($material, $freight);
    $selling = TakeoffMoney::add(
        TakeoffMoney::selling($material, 'markup', '0.10', null),
        TakeoffMoney::selling($freight, 'markup', '0.10', null),
    );

    expect($material)->toBe('200.00')
        ->and($cost)->toBe('250.00')
        ->and($selling)->toBe('275.00')
        ->and(TakeoffMoney::selling($material, 'markup', '0.10', '0.50'))->toBe('220.00');
});
