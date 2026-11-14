import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
    configFile: false,
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
    appType: 'custom',
});
let phone;
try {
    phone = await server.ssrLoadModule('/resources/js/lib/phoneFormatting.ts');
} finally {
    await server.close();
}

for (const [value, country, expected] of [
    ['', 'US', ''],
    ['570', 'US', '570'],
    ['5705', 'US', '(570) 5'],
    ['5705550100', 'US', '(570) 555-0100'],
    ['+1 (570) 555-0100', 'US', '(570) 555-0100'],
    ['15705550100', 'US', '(570) 555-0100'],
    ['4165550100', 'CA', '(416) 555-0100'],
    ['07700900123', 'GB', '07700 900123'],
    ['+447700900123', 'GB', '07700 900123'],
    ['612345678', 'FR', '6 12 34 56 78'],
    ['0612345678', 'FR', '06 12 34 56 78'],
    ['412345678', 'AU', '412 345 678'],
    ['+61412345678', 'AU', '412 345 678'],
    ['+447700900123', 'US', '+447700900123'],
]) {
    test(`input ${country} ${JSON.stringify(value)}`, () => {
        assert.equal(phone.formatPhoneNumber(value, country), expected);
        assert.equal(phone.formatPhoneNumber(expected, country), expected, 'mask is stable when reopening/editing');
    });
}

for (const [value, country, expected] of [
    ['+15705550100', 'US', '+1 (570) 555-0100'],
    ['+1 570 555 0100', null, '+1 (570) 555-0100'],
    ['+1 (570) 555-0100 x123', null, '+1 (570) 555-0100 ext. 123'],
    ['5705550100', null, '+1 (570) 555-0100'],
    ['+14165550100', 'CA', '+1 (416) 555-0100'],
    ['+447700900123', 'GB', '+44 7700 900123'],
    ['+33612345678', 'FR', '+33 6 12 34 56 78'],
    ['+61412345678', 'AU', '+61 412 345 678'],
    ['+971501234567', null, '+971 50 123 4567'],
    ['123', null, '123'],
    ['unclassified legacy value', null, 'unclassified legacy value'],
    ['Call +1 570 555 0100', null, 'Call +1 570 555 0100'],
    ['', null, ''],
]) {
    test(`display ${JSON.stringify(value)}`, () => {
        assert.equal(phone.formatPhoneDisplay(value, country), expected);
    });
}

test('all supported countries retain every input digit', () => {
    for (const country of phone.phoneCountries) {
        const digits = '234567890123'.slice(0, country.nationalDigits);
        const masked = phone.formatPhoneNumber(digits, country.code);
        assert.equal(masked.replace(/\D/g, ''), digits, country.code);
    }
});
