<?php

namespace App\Support;

use App\Models\DocumentSetting;

class DocumentAppearance
{
    public const DEFAULT_HEADER_BACKGROUND = '#065f46';

    public const DEFAULT_TABLE_HEADER_BACKGROUND = '#065f46';

    public const DOCUMENTS = [
        'bid' => [
            'label' => 'Bid',
            'description' => 'Single bid proposal',
        ],
        'bid_list' => [
            'label' => 'Bid directory',
            'description' => 'Printed list of bids',
        ],
        'quotation' => [
            'label' => 'Quotation',
            'description' => 'Single quotation',
        ],
        'project' => [
            'label' => 'Project',
            'description' => 'Single project report',
        ],
        'project_list' => [
            'label' => 'Project directory',
            'description' => 'Printed list of projects',
        ],
        'catalog' => [
            'label' => 'Product catalog',
            'description' => 'Printed product catalog',
        ],
    ];

    public const FORMATS = [
        'print' => [
            'label' => 'Print-ready',
            'description' => 'On-screen print preview',
        ],
        'pdf' => [
            'label' => 'PDF',
            'description' => 'Downloaded PDF file',
        ],
        'word' => [
            'label' => 'Word',
            'description' => 'Downloaded .docx file',
        ],
    ];

    public function __construct(
        public readonly string $headerBackground,
        public readonly string $tableHeaderBackground,
        public readonly string $document = 'bid',
        public readonly string $format = 'print',
    ) {}

    public static function key(string $document, string $format): string
    {
        return $document.'.'.$format;
    }

    public static function current(): self
    {
        return self::for('bid', 'print');
    }

    public static function for(string $document, string $format): self
    {
        $document = self::normalizeDocument($document);
        $format = self::normalizeFormat($format);
        $settings = DocumentSetting::forKey(self::key($document, $format));

        return new self(
            self::normalize($settings->header_background_color),
            self::normalize($settings->table_header_background_color),
            $document,
            $format,
        );
    }

    public static function defaults(): self
    {
        return new self(self::DEFAULT_HEADER_BACKGROUND, self::DEFAULT_TABLE_HEADER_BACKGROUND);
    }

    /**
     * @return array<string, array{label: string, description: string, formats: array<string, array{header_background_color: string, table_header_background_color: string}>}>
     */
    public static function catalog(): array
    {
        $rows = DocumentSetting::query()->get()->keyBy('document_key');
        $catalog = [];

        foreach (self::DOCUMENTS as $document => $meta) {
            $formats = [];

            foreach (array_keys(self::FORMATS) as $format) {
                $settings = $rows->get(self::key($document, $format));
                $formats[$format] = [
                    'header_background_color' => self::normalize($settings?->header_background_color),
                    'table_header_background_color' => self::normalize($settings?->table_header_background_color),
                ];
            }

            $catalog[$document] = [
                'label' => $meta['label'],
                'description' => $meta['description'],
                'formats' => $formats,
            ];
        }

        return $catalog;
    }

    public static function normalizeDocument(string $document): string
    {
        return array_key_exists($document, self::DOCUMENTS) ? $document : 'bid';
    }

    public static function normalizeFormat(string $format): string
    {
        return array_key_exists($format, self::FORMATS) ? $format : 'print';
    }

    /**
     * @return array<string, string>
     */
    public function css(): array
    {
        return $this->palette();
    }

    public function word(string $key): string
    {
        return ltrim($this->palette()[$key] ?? '#000000', '#');
    }

    /**
     * @return array<string, string>
     */
    public function formValues(): array
    {
        return [
            'header_background_color' => $this->headerBackground,
            'table_header_background_color' => $this->tableHeaderBackground,
        ];
    }

    /**
     * @return array<string, string>
     */
    private function palette(): array
    {
        $header = $this->headerBackground;
        $table = $this->tableHeaderBackground;
        $headerText = $this->contrastColor($header);
        $tableText = $this->contrastColor($table);

        return [
            'header_bg' => $header,
            'header_text' => $headerText,
            'header_muted' => $this->mix($header, $headerText, 0.38),
            'header_soft' => $this->mix($header, $headerText, 0.22),
            'header_year' => $this->mix($header, $headerText, 0.12),
            'accent' => $this->adjustLightness($header, 0.22),
            'title' => $this->adjustLightness($header, -0.06),
            'brand' => $header,
            'brand_mid' => $this->adjustLightness($header, -0.03),
            'highlight_bg' => $this->mix('#ffffff', $header, 0.92),
            'highlight_border' => $this->mix('#ffffff', $header, 0.55),
            'row_alt' => $this->mix('#ffffff', $header, 0.96),
            'button' => $this->mix('#ffffff', $header, 0.38),
            'toolbar_bg' => $this->adjustLightness($header, -0.06),
            'toolbar_text' => $this->mix('#ffffff', $header, 0.92),
            'table_header_bg' => $table,
            'table_header_text' => $tableText,
        ];
    }

    public static function normalize(?string $value, string $fallback = self::DEFAULT_HEADER_BACKGROUND): string
    {
        $hex = strtolower(trim((string) $value));

        if (preg_match('/^#([a-f0-9]{3})$/', $hex, $matches) === 1) {
            $digits = $matches[1];

            return sprintf('#%s%s%s%s%s%s', $digits[0], $digits[0], $digits[1], $digits[1], $digits[2], $digits[2]);
        }

        if (preg_match('/^#([a-f0-9]{6})$/', $hex) === 1) {
            return $hex;
        }

        return strtolower($fallback);
    }

    private function contrastColor(string $hex): string
    {
        [$red, $green, $blue] = $this->rgb($hex);
        $luminance = (0.2126 * $red + 0.7152 * $green + 0.0722 * $blue) / 255;

        return $luminance > 0.55 ? '#111827' : '#ffffff';
    }

    private function mix(string $from, string $to, float $amount): string
    {
        $amount = max(0, min(1, $amount));
        [$fromRed, $fromGreen, $fromBlue] = $this->rgb($from);
        [$toRed, $toGreen, $toBlue] = $this->rgb($to);

        return $this->hexFromRgb(
            (int) round($fromRed + ($toRed - $fromRed) * (1 - $amount)),
            (int) round($fromGreen + ($toGreen - $fromGreen) * (1 - $amount)),
            (int) round($fromBlue + ($toBlue - $fromBlue) * (1 - $amount)),
        );
    }

    private function adjustLightness(string $hex, float $delta): string
    {
        [$hue, $saturation, $lightness] = $this->hsl($hex);

        return $this->hexFromHsl($hue, $saturation, max(0, min(1, $lightness + $delta)));
    }

    /**
     * @return array{int, int, int}
     */
    private function rgb(string $hex): array
    {
        $value = ltrim(self::normalize($hex), '#');

        return [
            hexdec(substr($value, 0, 2)),
            hexdec(substr($value, 2, 2)),
            hexdec(substr($value, 4, 2)),
        ];
    }

    /**
     * @return array{float, float, float}
     */
    private function hsl(string $hex): array
    {
        [$red, $green, $blue] = array_map(fn (int $channel): float => $channel / 255, $this->rgb($hex));
        $max = max($red, $green, $blue);
        $min = min($red, $green, $blue);
        $lightness = ($max + $min) / 2;
        $delta = $max - $min;

        if ($delta == 0.0) {
            return [0.0, 0.0, $lightness];
        }

        $saturation = $lightness > 0.5
            ? $delta / (2 - $max - $min)
            : $delta / ($max + $min);

        $hue = match ($max) {
            $red => (($green - $blue) / $delta + ($green < $blue ? 6 : 0)) / 6,
            $green => (($blue - $red) / $delta + 2) / 6,
            default => (($red - $green) / $delta + 4) / 6,
        };

        return [$hue, $saturation, $lightness];
    }

    private function hexFromHsl(float $hue, float $saturation, float $lightness): string
    {
        if ($saturation == 0.0) {
            $channel = (int) round($lightness * 255);

            return $this->hexFromRgb($channel, $channel, $channel);
        }

        $q = $lightness < 0.5
            ? $lightness * (1 + $saturation)
            : $lightness + $saturation - $lightness * $saturation;
        $p = 2 * $lightness - $q;

        return $this->hexFromRgb(
            (int) round($this->hueToRgb($p, $q, $hue + 1 / 3) * 255),
            (int) round($this->hueToRgb($p, $q, $hue) * 255),
            (int) round($this->hueToRgb($p, $q, $hue - 1 / 3) * 255),
        );
    }

    private function hueToRgb(float $p, float $q, float $t): float
    {
        if ($t < 0) {
            $t += 1;
        }
        if ($t > 1) {
            $t -= 1;
        }
        if ($t < 1 / 6) {
            return $p + ($q - $p) * 6 * $t;
        }
        if ($t < 1 / 2) {
            return $q;
        }
        if ($t < 2 / 3) {
            return $p + ($q - $p) * (2 / 3 - $t) * 6;
        }

        return $p;
    }

    private function hexFromRgb(int $red, int $green, int $blue): string
    {
        return sprintf(
            '#%02x%02x%02x',
            max(0, min(255, $red)),
            max(0, min(255, $green)),
            max(0, min(255, $blue)),
        );
    }
}
