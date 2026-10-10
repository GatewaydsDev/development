export async function saveDocumentDraft<T>(
    url: string,
    method: 'post' | 'patch',
    data: object,
    onErrors: (errors: Record<string, string>) => void,
): Promise<T> {
    const token = decodeURIComponent(
        document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='))?.slice(11) ?? '',
    );
    const response = await fetch(url, {
        method: method.toUpperCase(),
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': token,
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        if (response.status === 422) {
            const body: { errors: Record<string, string[]> } = await response.json();
            onErrors(Object.fromEntries(Object.entries(body.errors).map(([key, messages]) => [key, messages[0]])));
            throw new Error('Check the highlighted fields before saving and updating the layout.');
        }
        throw new Error(response.status === 401 || response.status === 419
            ? 'Your session expired. Sign in again before saving.'
            : 'The document could not be saved. Your edits have not been replaced.');
    }
    const body: { document: T } = await response.json();
    return body.document;
}
