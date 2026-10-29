# Microsoft 365 mail

The website reads and sends mail through Microsoft Graph. Microsoft 365 still receives the mail. Opening Email or clicking Refresh loads the mailbox at that moment. Mail does not sync while the page is closed. There is no webhook in this version.

Each signed-in user sees only the mailbox stored on their user row. The Email screen does not accept a mailbox from the browser, including for a super admin.

The public contact form is separate. It sends the quote through Microsoft 365 from the sales mailbox (`CONTACT_FORM_TO`, then `MICROSOFT_MAIL_FROM`). When that mailbox is saved on a super admin who has a Microsoft app secret, the form uses that same account. The visitor address is Reply-To only. The active company email is used only when neither sales address is set.

## Azure application

Use one Entra application and application permissions, not delegated `/me` access.

1. Each assigned address needs an active Exchange Online mailbox in this tenant.
2. `MICROSOFT_TENANT_ID` and `MICROSOFT_CLIENT_ID` must be the tenant and application that own those mailboxes.
3. Application permissions: `Mail.Send` and `Mail.Read`.
4. A tenant administrator must grant admin consent.
5. `Mail.ReadWrite` is not required for this read-and-send version.
6. An Exchange administrator must scope the application to the intended mailboxes. Use current Microsoft guidance for Exchange Online Application RBAC or a supported application access policy. Entra admin consent and Exchange RBAC can both add access, so a broad Entra grant is not limited by the Laravel mailbox column.
7. Storing `microsoft_mailbox` in this application does not restrict what the Azure application can access in the tenant.
8. GoDaddy-managed tenants may need GoDaddy administrator access or GoDaddy support before consent and mailbox scoping can be finished.
9. `MICROSOFT_CLIENT_SECRET` is the secret **Value** from Certificates & secrets. The Secret ID is not used. Rotate the value before it expires and update the server environment. Do not put the value in git, frontend code, or `VITE_` variables.

## Server setup

```bash
php artisan migrate
php artisan config:clear
php artisan config:cache
```

Confirm each numeric user ID before assigning a mailbox. The command does not look people up by name, create users, or change passwords or roles.

```bash
php artisan users:assign-mailbox USER_ID larryd@gateway-ds.com
php artisan users:assign-mailbox USER_ID ricardo@gateway-ds.com
php artisan users:assign-mailbox USER_ID sales@gateway-ds.com
```

Run the same user and mailbox again only to confirm an assignment. It will not create a duplicate. A second user cannot take a mailbox that is already assigned.

After changing `.env`, clear and rebuild the configuration cache with the commands above.
