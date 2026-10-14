<?php

namespace App\Support;

use InvalidArgumentException;

class TakeoffMoney
{
    public static function raw(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '0';
        }

        $string = trim((string) $value);

        if (! preg_match('/^-?\d+(\.\d+)?$/', $string)) {
            throw new InvalidArgumentException('Invalid decimal amount.');
        }

        return $string;
    }

    public static function money(mixed $value): string
    {
        return self::round(self::raw($value));
    }

    public static function dimension(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return bcadd(self::raw($value), '0', 3);
    }

    public static function rate(mixed $percent): ?string
    {
        if ($percent === null || $percent === '') {
            return null;
        }

        return bcdiv(self::raw($percent), '100', 6);
    }

    public static function percent(mixed $rate): ?string
    {
        if ($rate === null || $rate === '') {
            return null;
        }

        return self::round(bcmul(self::raw($rate), '100', 8));
    }

    public static function round(string $value): string
    {
        $negative = str_starts_with($value, '-');
        $value = ltrim($value, '-');

        if (! str_contains($value, '.')) {
            $value .= '.000';
        }

        [$whole, $fraction] = explode('.', $value, 2);
        $whole = $whole === '' ? '0' : $whole;
        $fraction = str_pad($fraction, 3, '0');
        $cents = substr($fraction, 0, 2);
        $next = (int) substr($fraction, 2, 1);

        if ($next >= 5) {
            $cents = bcadd($cents, '1', 0);
        }

        if (bccomp($cents, '99', 0) === 1) {
            $whole = bcadd($whole, '1', 0);
            $cents = '00';
        }

        $result = $whole.'.'.str_pad($cents, 2, '0', STR_PAD_LEFT);

        if ($negative && bccomp($result, '0.00', 2) !== 0) {
            return '-'.$result;
        }

        return $result;
    }

    public static function add(mixed $left, mixed $right): string
    {
        return self::round(bcadd(self::raw($left), self::raw($right), 8));
    }

    public static function sub(mixed $left, mixed $right): string
    {
        return self::round(bcsub(self::raw($left), self::raw($right), 8));
    }

    public static function mul(mixed $left, mixed $right): string
    {
        return self::round(bcmul(self::raw($left), self::raw($right), 8));
    }

    public static function div(mixed $left, mixed $right): string
    {
        if (bccomp(self::raw($right), '0', 8) === 0) {
            throw new InvalidArgumentException('Division by zero.');
        }

        return self::round(bcdiv(self::raw($left), self::raw($right), 8));
    }

    public static function comp(mixed $left, mixed $right, int $scale = 2): int
    {
        return bccomp(self::raw($left), self::raw($right), $scale);
    }

    public static function selling(string $cost, string $method, ?string $markupRate, ?string $marginRate): string
    {
        if (self::comp($cost, '0') === 0) {
            return '0.00';
        }

        if ($method === 'margin') {
            $rate = self::raw($marginRate ?? '0');

            if (bccomp($rate, '0', 6) === -1 || bccomp($rate, '1', 6) >= 0) {
                throw new InvalidArgumentException('Margin must be below 100%.');
            }

            $divisor = bcsub('1', $rate, 8);

            return self::round(bcdiv(self::raw($cost), $divisor, 8));
        }

        $factor = bcadd('1', self::raw($markupRate ?? '0'), 8);

        return self::round(bcmul(self::raw($cost), $factor, 8));
    }

    public static function marginRatio(?string $profit, ?string $selling): ?string
    {
        if ($selling === null || self::comp($selling, '0') <= 0) {
            return null;
        }

        return bcdiv(self::raw($profit ?? '0'), self::raw($selling), 4);
    }
}
