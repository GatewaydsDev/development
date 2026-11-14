type Json = Record<string, any>;

export function passkeysSupported(): boolean {
    return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
}

function cookie(name: string): string | null {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));

    return match ? decodeURIComponent(match[1]) : null;
}

async function post(url: string, body: Json = {}): Promise<Response> {
    return fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-XSRF-TOKEN': cookie('XSRF-TOKEN') ?? '',
        },
        body: JSON.stringify(body),
    });
}

function toBytes(value: string): Uint8Array {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function toBase64(buffer: ArrayBuffer): string {
    let binary = '';
    new Uint8Array(buffer).forEach((byte) => (binary += String.fromCharCode(byte)));

    return btoa(binary);
}

function encode(credential: PublicKeyCredential): Json {
    const response = credential.response as Json;
    const out: Json = {};

    ['clientDataJSON', 'attestationObject', 'authenticatorData', 'signature', 'userHandle'].forEach((key) => {
        if (response[key]) {
            out[key] = toBase64(response[key]);
        }
    });

    return {
        id: credential.id,
        type: credential.type,
        rawId: toBase64(credential.rawId),
        authenticatorAttachment: credential.authenticatorAttachment,
        clientExtensionResults: credential.getClientExtensionResults(),
        response: out,
    };
}

function decodeOptions(options: Json): Json {
    const publicKey: Json = { ...options, challenge: toBytes(options.challenge) };

    if (options.user) {
        publicKey.user = { ...options.user, id: toBytes(options.user.id) };
    }

    ['excludeCredentials', 'allowCredentials'].forEach((key) => {
        if (options[key]) {
            publicKey[key] = options[key].map((item: Json) => ({ ...item, id: toBytes(item.id) }));
        }
    });

    return publicKey;
}

export function deviceName(): string {
    const agent = navigator.userAgent;

    if (/iPhone/.test(agent)) return 'iPhone';
    if (/iPad/.test(agent)) return 'iPad';
    if (/Android/.test(agent)) return 'Android phone';
    if (/Macintosh/.test(agent)) return 'Mac';
    if (/Windows/.test(agent)) return 'Windows PC';

    return 'This device';
}

export async function registerPasskey(optionsUrl: string, saveUrl: string, alias: string): Promise<void> {
    const optionsResponse = await post(optionsUrl);

    if (!optionsResponse.ok) {
        throw new Error('Could not start the setup. Please try again.');
    }

    const credential = (await navigator.credentials.create({
        publicKey: decodeOptions(await optionsResponse.json()) as PublicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
        throw new Error('Setup was cancelled.');
    }

    const saved = await post(saveUrl, { ...encode(credential), alias });

    if (!saved.ok) {
        throw new Error('This device could not be saved.');
    }
}

export async function conditionalPasskeysAvailable(): Promise<boolean> {
    return (
        passkeysSupported() &&
        typeof PublicKeyCredential.isConditionalMediationAvailable === 'function' &&
        (await PublicKeyCredential.isConditionalMediationAvailable())
    );
}

export async function loginWithPasskey(
    optionsUrl: string,
    loginUrl: string,
    mode: { conditional?: boolean; signal?: AbortSignal } = {},
): Promise<string> {
    const optionsResponse = await post(optionsUrl);

    if (!optionsResponse.ok) {
        throw new Error('Could not start the sign in. Please try again.');
    }

    const credential = (await navigator.credentials.get({
        publicKey: decodeOptions(await optionsResponse.json()) as PublicKeyCredentialRequestOptions,
        ...(mode.conditional ? { mediation: 'conditional' as CredentialMediationRequirement } : {}),
        signal: mode.signal,
    })) as PublicKeyCredential | null;

    if (!credential) {
        throw new Error('Sign in was cancelled.');
    }

    const result = await post(loginUrl, encode(credential));
    const json = await result.json().catch(() => ({}));

    if (!result.ok) {
        throw new Error(json.message ?? 'This device could not sign you in.');
    }

    return json.redirect as string;
}
