export interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at?: string;
    level?: {
        id: number;
        name: string;
    } | null;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User;
        can: {
            manageUsers: boolean;
            viewUsers: boolean;
            createUsers: boolean;
            updateUsers: boolean;
            manageAccess: boolean;
        };
    };
};
