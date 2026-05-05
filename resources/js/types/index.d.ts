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

export interface AppNotification {
    id: string;
    title: string;
    name?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    organization?: string | null;
    projectType?: string | null;
    message?: string | null;
    contactSubmissionId?: number | null;
    createdAt?: string | null;
    readAt?: string | null;
    isRead?: boolean;
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
            viewCompany: boolean;
            manageAccess: boolean;
        };
        notifications: {
            unreadCount: number;
            latestUnread: AppNotification[];
        };
    };
};
