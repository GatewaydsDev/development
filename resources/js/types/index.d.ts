export interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at?: string;
    avatar?: string | null;
    avatar_url?: string | null;
    initials?: string;
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
    address?: string | null;
    state?: string | null;
    country?: string | null;
    projectType?: string | null;
    message?: string | null;
    status?: string | null;
    contactSubmissionId?: number | null;
    createdAt?: string | null;
    readAt?: string | null;
    isRead?: boolean;
}

export interface Contact {
    id: number;
    uuid?: string;
    name: string;
    email: string;
    phone_number?: string | null;
    company?: string | null;
    title?: string | null;
    notes?: string | null;
    is_active?: boolean;
    created_at?: string | null;
}

export interface SentEmail {
    id: number;
    recipientName?: string | null;
    recipientEmail: string;
    subject: string;
    message?: string | null;
    sentByName?: string | null;
    sentAt?: string | null;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User;
        can: {
            manageUsers: boolean;
            manageOwnAccount: boolean;
            viewUsers: boolean;
            createUsers: boolean;
            updateUsers: boolean;
            viewUserActivity: boolean;
            manageDocumentColors: boolean;
            viewCompany: boolean;
            manageAccess: boolean;
            manageNotifications: boolean;
            viewProjects: boolean;
            createProjects: boolean;
            updateProjects: boolean;
            deleteProjects: boolean;
            viewSensitiveProjectFields: boolean;
            viewBids: boolean;
            createBids: boolean;
            updateBids: boolean;
            deleteBids: boolean;
            viewQuotations: boolean;
            createQuotations: boolean;
            updateQuotations: boolean;
            deleteQuotations: boolean;
            viewProducts: boolean;
            createProducts: boolean;
            updateProducts: boolean;
            deleteProducts: boolean;
            viewServices: boolean;
            createServices: boolean;
            updateServices: boolean;
            deleteServices: boolean;
            viewContractors: boolean;
            createContractors: boolean;
            updateContractors: boolean;
            deleteContractors: boolean;
            viewEmployees: boolean;
            createEmployees: boolean;
            updateEmployees: boolean;
            deleteEmployees: boolean;
        };
        notifications: {
            unreadCount: number;
            latestUnread: AppNotification[];
        };
    };
    session: {
        idleTimeoutMinutes: number;
    };
    flash?: {
        success?: string | null;
        error?: string | null;
        importedScopeText?: string | null;
        importedScopeTextTemplateId?: number | null;
        importedShippingText?: string | null;
        importedShippingTextTemplateId?: number | null;
    };
};
